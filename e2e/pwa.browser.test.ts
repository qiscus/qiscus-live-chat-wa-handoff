/**
 * SYNTHETIC headless end-to-end test of the PWA + push opt-in on the hosted
 * handoff page, in a real Chrome (system install, via playwright-core).
 *
 * REAL in this test: the Hono Worker (src/worker.ts) + public/ assets served
 * as Cloudflare's asset layer would, widget.html, the real QismoFull bundle
 * (qismo-full-v5.js), live-handover-room.html, the built push bundles,
 * sw.js (registered, receiving pushes via CDP ServiceWorker.deliverPushMessage),
 * IndexedDB, localStorage, Notification permission, getNotifications().
 *
 * FAKE (clearly synthetic; see README "Testing limits"):
 *   - qismo.qiscus.com exchange and api3.qiscus.com SDK REST: in-test fakes
 *     that enforce single-use identity tokens, SDK-token auth and room
 *     membership, and record device-token registrations;
 *   - /js/qiscus-sdk.3.2.6.js inside the room: a tiny stub exposing the same
 *     calls the room page makes (the real SDK needs a live Qiscus app + MQTT);
 *   - FCM token minting: window.__HANDOFF_PUSH_TEST__ seam (localhost only),
 *     because headless Chrome cannot obtain a real FCM/push-service token;
 *   - push delivery: CDP injects the push event; no Flash / FCM involved.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { type Browser, type BrowserContext, type CDPSession, type Page, type Route, chromium } from "playwright-core"
import app from "../src/worker"

const CHROME =
  process.env.CHROME_PATH ||
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) =>
    existsSync(p),
  )

const PUBLIC = new URL("../public/", import.meta.url)

// ------------------------------------------------------------ synthetic env

async function syntheticVapid(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
  return Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("base64url")
}

const env: Record<string, unknown> = {}
async function configurePush(on: boolean, extra: Record<string, string> = {}) {
  for (const k of Object.keys(env)) if (k !== "ASSETS") delete env[k]
  if (on)
    Object.assign(env, extra, {
      FIREBASE_API_KEY: "AIza" + "S".repeat(35),
      FIREBASE_PROJECT_ID: "synthetic-project",
      FIREBASE_MESSAGING_SENDER_ID: "123456789012",
      FIREBASE_APP_ID: "1:123456789012:web:abcdef0123456789",
      FIREBASE_VAPID_KEY: await syntheticVapid(),
    })
}

// Cloudflare assets first (htmlHandling "none"), then the Worker.
const assets = {
  async fetch(req: Request) {
    const path = decodeURIComponent(new URL(req.url).pathname)
    const file = Bun.file(new URL("." + path, PUBLIC))
    if (path.endsWith("/") || !(await file.exists())) return new Response("Not found", { status: 404 })
    return new Response(file)
  },
} as unknown as Fetcher

let server: ReturnType<typeof Bun.serve>
let ORIGIN = ""

// ------------------------------------------------------- synthetic upstream

const USERS: Record<string, { email: string; token: string; room: string }> = {
  "synthetic-invite-A": { email: "customer-a@example.invalid", token: "synthetic-sdk-A", room: "500" },
  "synthetic-invite-B": { email: "customer-b@example.invalid", token: "synthetic-sdk-B", room: "600" },
}
const upstream = {
  usedIdentityTokens: new Set<string>(),
  verifyCalls: 0,
  deviceCalls: [] as { path: string; app: string; user: string; sdkToken: string; body: Record<string, unknown> }[],
  reset() {
    this.usedIdentityTokens.clear()
    this.verifyCalls = 0
    this.deviceCalls = []
  },
}

function cors(route: Route, status: number, body: unknown) {
  const origin = route.request().headers()["origin"] || "*"
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(body),
  })
}

async function fakeQismo(route: Route) {
  const req = route.request()
  if (req.method() === "OPTIONS") return cors(route, 204, {})
  const url = new URL(req.url())
  if (url.pathname === "/api/v2/live_handover/exchange") {
    const invite = String((req.postDataJSON() as { token?: string })?.token || "")
    const u = USERS[invite]
    if (!u) return cors(route, 401, { code: "invalid_token", error: "synthetic invalid" })
    return cors(route, 200, {
      data: {
        app_code: "synthapp",
        room_id: Number(u.room),
        identity_token: `synthetic-idt-${invite}-${Date.now()}`,
        name: "Synthetic Customer",
        avatar: "",
        resumed: false,
        history_seeded: false,
      },
    })
  }
  return cors(route, 200, {})
}

function userBySdkToken(token: string | undefined) {
  return Object.values(USERS).find((u) => u.token === token)
}

async function fakeSdkApi(route: Route) {
  const req = route.request()
  if (req.method() === "OPTIONS") return cors(route, 204, {})
  const url = new URL(req.url())
  const h = req.headers()
  if (url.pathname === "/api/v2/sdk/auth/verify_identity_token") {
    upstream.verifyCalls++
    const idt = String((req.postDataJSON() as { identity_token?: string })?.identity_token || "")
    if (upstream.usedIdentityTokens.has(idt)) return cors(route, 401, { error: "identity token already used (synthetic)" })
    upstream.usedIdentityTokens.add(idt)
    const invite = Object.keys(USERS).find((k) => idt.startsWith(`synthetic-idt-${k}-`))
    if (!invite) return cors(route, 401, { error: "invalid" })
    const u = USERS[invite]!
    return cors(route, 200, { results: { user: { email: u.email, token: u.token, refresh_token: "synthetic-refresh", username: "Synthetic" } } })
  }
  const caller = userBySdkToken(h["qiscus-sdk-token"])
  if (!caller || h["qiscus-sdk-user-id"] !== caller.email || h["qiscus-sdk-app-id"] !== "synthapp") {
    return cors(route, 401, { error: "unauthorized (synthetic)" })
  }
  if (url.pathname === "/api/v2/sdk/get_room_by_id") {
    return url.searchParams.get("id") === caller.room ? cors(route, 200, { results: { room: { id: caller.room } } }) : cors(route, 403, {})
  }
  if (url.pathname === "/api/v2/sdk/set_user_device_token" || url.pathname === "/api/v2/sdk/remove_user_device_token") {
    upstream.deviceCalls.push({
      path: url.pathname.split("/").pop()!,
      app: h["qiscus-sdk-app-id"]!,
      user: h["qiscus-sdk-user-id"]!,
      sdkToken: h["qiscus-sdk-token"]!,
      body: req.postDataJSON() as Record<string, unknown>,
    })
    return cors(route, 200, { results: { changed: true } })
  }
  return cors(route, 404, {})
}

// Stub of the calls live-handover-room.html makes on QiscusSDK (SYNTHETIC).
const SDK_STUB = `(function(){
  var BASE='https://api3.qiscus.com';
  var core={selected:{id:0},
    init:function(c){core.cfg=c;core.AppId=c.AppId;},
    verifyIdentityToken:function(t){return fetch(BASE+'/api/v2/sdk/auth/verify_identity_token',{method:'POST',headers:{'Content-Type':'application/json','QISCUS-SDK-APP-ID':core.AppId},body:JSON.stringify({identity_token:t})}).then(function(r){if(!r.ok)throw r.status;return r.json();}).then(function(j){return j.results;});},
    setUserWithIdentityToken:function(e){core.userData=e.user;setTimeout(function(){core.cfg.options.loginSuccessCallback(e);},0);},
    chatGroup:function(id){return fetch(BASE+'/api/v2/sdk/get_room_by_id?id='+encodeURIComponent(id),{headers:{'QISCUS-SDK-APP-ID':core.AppId,'QISCUS-SDK-USER-ID':core.userData.email,'QISCUS-SDK-TOKEN':core.userData.token}}).then(function(r){if(!r.ok)throw r.status;core.selected={id:id};return r.json();});},
    sendComment:function(){}};
  window.QiscusSDK={core:core,render:function(){document.body.setAttribute('data-synthetic-sdk','rendered');}};
  window.QiscusUI={setCustomColors:function(){}};
})();`

// A remote (cross-origin) room that never hands anything to the page.
const REMOTE_ROOM = "<!doctype html><title>remote room (synthetic)</title><body>remote</body>"

// --------------------------------------------------------------- browser

let browser: Browser

const FCM_SEAM = `window.__HANDOFF_PUSH_TEST__ = { fcm: { getToken: async () => {
  window.__fcmMints = (window.__fcmMints || 0) + 1;
  const reg = await navigator.serviceWorker.ready;
  return 'synthetic-fcm-' + (reg.active ? 'sw' : 'nosw') + '-' + 'A'.repeat(120);
} } };`

async function newContext(opts: { grant?: boolean; userAgent?: string; deny?: boolean } = {}): Promise<BrowserContext> {
  const ctx = await browser.newContext({ userAgent: opts.userAgent })
  if (opts.grant) await ctx.grantPermissions(["notifications"], { origin: ORIGIN })
  await ctx.addInitScript(FCM_SEAM)
  if (opts.deny)
    await ctx.addInitScript(`(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
      Notification.requestPermission = async () => 'denied';
    })();`)
  await ctx.route("https://qismo.qiscus.com/**", fakeQismo)
  await ctx.route("https://api3.qiscus.com/**", fakeSdkApi)
  await ctx.route("https://omnichannel.qiscus.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: REMOTE_ROOM }))
  await ctx.route(`${ORIGIN}/js/qiscus-sdk.3.2.6.js`, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB }))
  return ctx
}

// Serve this Worker under an https host that is not localhost, the way it is
// deployed (some behaviour, e.g. the Safari hand-off link, is https-only).
const HOST = "https://handoff.example"
async function onHttpsHost(opts: Parameters<typeof newContext>[0] = {}): Promise<BrowserContext> {
  const ctx = await newContext(opts)
  await ctx.route(`${HOST}/**`, async (r) => {
    if (new URL(r.request().url()).pathname === "/js/qiscus-sdk.3.2.6.js")
      return r.fulfill({ status: 200, contentType: "application/javascript", body: SDK_STUB })
    const res = await r.fetch({ url: r.request().url().replace(HOST, ORIGIN) })
    await r.fulfill({ response: res })
  })
  return ctx
}
const hostInvite = (token: string) => `${HOST}/widget.html?iframeUrl=${encodeURIComponent(HOST)}#t=${token}`

const pushState = (page: Page) => page.evaluate(() => document.documentElement.dataset.handoffPush || null)
async function waitPushState(page: Page, kind: string) {
  await page.waitForFunction((k) => document.documentElement.dataset.handoffPush === k, kind, { timeout: 15_000 })
}
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key)
const SESSION_KEY = "qiscus-handoff:session:v1"
const REG_KEY = "qiscus-handoff:push-registration:v1"

async function swRegistrationId(cdp: CDPSession): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no SW registration seen")), 10_000)
    cdp.on("ServiceWorker.workerRegistrationUpdated", (e: { registrations: { registrationId: string; scopeURL: string; isDeleted: boolean }[] }) => {
      const r = e.registrations.find((x) => x.scopeURL === ORIGIN + "/" && !x.isDeleted)
      if (r) {
        clearTimeout(t)
        resolve(r.registrationId)
      }
    })
    void cdp.send("ServiceWorker.enable")
  })
}

function sdkPush(comment: Record<string, unknown>) {
  return JSON.stringify({
    from: "123456789012",
    data: { qiscus_sdk: "post_comment", qiscus_room_id: String(comment.room_id), payload: JSON.stringify(comment) },
  })
}

// ------------------------------------------------------------------ suite

const run = CHROME ? describe : describe.skip

run("PWA + push on the hosted handoff page (SYNTHETIC, headless Chrome)", () => {
  beforeAll(async () => {
    env.ASSETS = assets
    await configurePush(true)
    server = Bun.serve({ port: 0, hostname: "localhost", fetch: (req) => assets.fetch(req).then((r) => (r.status === 404 ? app.fetch(req, env) : r)) })
    ORIGIN = `http://localhost:${server.port}`
    browser = await chromium.launch({ executablePath: CHROME, headless: true })
    // A cold Chrome start alone can exceed bun's 5 s hook default.
  }, 60_000)

  afterAll(async () => {
    await browser?.close()
    server?.stop(true)
  })

  const invite = (t: string, selfRoom = true) =>
    `${ORIGIN}/widget.html${selfRoom ? `?iframeUrl=${encodeURIComponent(ORIGIN)}` : ""}#t=${t}`

  test("manifest + service worker are served and the page is installable-shaped", async () => {
    const res = await fetch(`${ORIGIN}/manifest.webmanifest`)
    expect(res.status).toBe(200)
    expect(((await res.json()) as { start_url: string }).start_url).toBe("/widget.html?source=pwa")
    expect((await fetch(`${ORIGIN}/sw.js`)).status).toBe(200)
    const cfg = (await (await fetch(`${ORIGIN}/push/config`)).json()) as { status: string }
    expect(cfg.status).toBe("configured")
  })

  test(
    "full flow: invite -> opt-in -> push -> resume -> switch customer -> conversation closed",
    async () => {
      upstream.reset()
      const ctx = await newContext({ grant: true })
      const page = await ctx.newPage()

      // 1. invite A, same-origin room: offer appears, nothing registered yet
      await page.goto(invite("synthetic-invite-A"))
      await waitPushState(page, "offer")
      expect(upstream.deviceCalls).toEqual([])
      // the link survives the exchange: a refresh or "open in browser" re-uses it
      expect(new URL(page.url()).hash).toBe("#t=synthetic-invite-A")
      const session = JSON.parse((await stored(page, SESSION_KEY))!)
      expect(session).toMatchObject({ appId: "synthapp", roomId: "500", user: { email: "customer-a@example.invalid" } })
      const storageDump = await page.evaluate(() => JSON.stringify({ ...localStorage }))
      expect(storageDump).not.toContain("synthetic-invite-A")
      expect(storageDump).not.toContain("synthetic-idt-")

      // 2. explicit opt-in
      await page.getByRole("button", { name: "Aktifkan notifikasi" }).click()
      await waitPushState(page, "enabled")
      expect(upstream.deviceCalls).toHaveLength(1)
      expect(upstream.deviceCalls[0]).toMatchObject({
        path: "set_user_device_token",
        app: "synthapp",
        user: "customer-a@example.invalid",
        sdkToken: "synthetic-sdk-A",
        body: { device_platform: "web", is_development: false },
      })
      expect(String(upstream.deviceCalls[0]!.body.device_token)).toStartWith("synthetic-fcm-sw-") // minted after the real SW was active

      // 3. pushes into the real service worker
      const viewer = await ctx.newPage()
      await viewer.goto(`${ORIGIN}/offline.html`)
      const cdp = await ctx.newCDPSession(viewer)
      const registrationId = await swRegistrationId(cdp)
      const sw = ctx.serviceWorkers().find((w) => w.url() === `${ORIGIN}/sw.js`)!
      const deliver = (c: Record<string, unknown>) =>
        cdp.send("ServiceWorker.deliverPushMessage", { origin: ORIGIN, registrationId, data: sdkPush(c) })
      const notifications = () =>
        viewer.evaluate(async () =>
          (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })),
        )
      const settle = () => viewer.waitForTimeout(700)
      const chatClients = () =>
        sw.evaluate(async () =>
          (await (self as any).clients.matchAll({ type: "window", includeUncontrolled: true })).filter(
            (c: { url: string }) => new URL(c.url).pathname === "/widget.html",
          ).length,
        )

      // 3a. chat page open and focused: the page shows the reply, no notification
      await page.bringToFront()
      await deliver({ id: 0, room_id: 500, type: "text", message: "seen live", email: "agent@example.invalid" })
      await settle()
      expect(await notifications()).toEqual([])

      // 3b. chat page closed (app in background)
      await page.close()
      for (let i = 0; i < 50 && (await chatClients()) > 0; i++) await viewer.waitForTimeout(100)
      expect(await chatClients()).toBe(0)
      await deliver({ id: 1, room_id: 500, type: "text", message: "secret", email: "agent@example.invalid" })
      await deliver({ id: 1, room_id: 500, type: "text", message: "secret", email: "agent@example.invalid" }) // duplicate credential
      await deliver({ id: 2, room_id: 77, type: "text", message: "wa room", email: "agent@example.invalid" }) // WhatsApp room
      await deliver({ id: 3, room_id: 500, type: "text", message: "me", email: "customer-a@example.invalid" }) // own
      await deliver({ id: 4, room_id: 500, type: "system_event", message: "x joined", email: "system@example.invalid" })
      await settle()
      const shown = await notifications()
      expect(shown).toEqual([
        { title: "Live Chat", body: "secret", tag: "handoff-500-1" },
      ])

      // 4. resume (notification click / relaunch target), no invite in URL
      const before = upstream.verifyCalls
      const resumed = await ctx.newPage()
      await resumed.goto(`${ORIGIN}/widget.html?source=notification`)
      await waitPushState(resumed, "enabled")
      const src = await resumed.evaluate(() => (document.getElementById("qcw-iframe") as HTMLIFrameElement).src)
      expect(src).toBe(`${ORIGIN}/iframes/v5/synthapp/live-handover-room?resume=1&app_id=synthapp`)
      expect(upstream.verifyCalls).toBe(before) // consumed identity token never replayed
      expect(upstream.deviceCalls).toHaveLength(1) // idempotent, no re-registration

      // 5. forged messages from the top page are ignored
      await resumed.evaluate(() => window.postMessage({ event_name: "qiscus:session-closed" }, "*"))
      await resumed.waitForTimeout(300)
      expect(await stored(resumed, SESSION_KEY)).not.toBeNull()

      // 6. a different customer's invite on the same device
      await resumed.goto(invite("synthetic-invite-B"))
      await resumed.waitForFunction(() => JSON.parse(localStorage.getItem("qiscus-handoff:session:v1") || "{}").roomId === "600")
      await waitPushState(resumed, "enabled")
      expect(upstream.deviceCalls.map((c) => [c.path, c.user, c.sdkToken])).toEqual([
        ["set_user_device_token", "customer-a@example.invalid", "synthetic-sdk-A"],
        ["remove_user_device_token", "customer-a@example.invalid", "synthetic-sdk-A"],
        ["set_user_device_token", "customer-b@example.invalid", "synthetic-sdk-B"],
      ])
      // SW now filters for B's room (chat page in the background)
      await viewer.bringToFront()
      await deliver({ id: 10, room_id: 500, type: "text", message: "old room", email: "agent@example.invalid" })
      await deliver({ id: 11, room_id: 600, type: "text", message: "new room", email: "agent@example.invalid" })
      await settle()
      expect((await notifications()).map((n) => n.tag)).toEqual(["handoff-500-1", "handoff-600-11"])

      // 7. conversation resolved inside the room
      const room = resumed.frame({ url: /live-handover-room/ })!
      await room.evaluate(() =>
        (window as any).QiscusSDK.core.cfg.options.newMessagesCallback([{ type: "system_event", message: "Agent marked this as resolved" }]),
      )
      await resumed.waitForFunction(() => localStorage.getItem("qiscus-handoff:session:v1") === null)
      await resumed.waitForFunction(() => localStorage.getItem("qiscus-handoff:push-registration:v1") === null)
      expect(upstream.deviceCalls.at(-1)).toMatchObject({ path: "remove_user_device_token", user: "customer-b@example.invalid" })

      // 8. after the session ended there is nothing to resume: no room iframe is
      // mounted and the page falls back to the pre-existing no-invite path.
      const after = await ctx.newPage()
      await after.goto(`${ORIGIN}/widget.html?source=pwa`)
      await after.waitForFunction(() => !!document.querySelector('script[src$="/js/qismo-full-v5.js"]'), null, { timeout: 15_000 })
      await after.waitForTimeout(500)
      expect(await after.$("#qcw-iframe")).toBeNull()
      expect(await after.evaluate(() => document.getElementById("handover-status")?.style.display)).not.toBe("none")
      await ctx.close()
    },
    90_000,
  )

  test(
    "resume after expiry is refused and the stale registration removed",
    async () => {
      upstream.reset()
      const ctx = await newContext({ grant: true })
      const page = await ctx.newPage()
      await page.goto(invite("synthetic-invite-A"))
      await waitPushState(page, "offer")
      await page.getByRole("button", { name: "Aktifkan notifikasi" }).click()
      await waitPushState(page, "enabled")
      // age the stored session past its 48 h cap
      await page.evaluate(() => {
        const k = "qiscus-handoff:session:v1"
        const s = JSON.parse(localStorage.getItem(k)!)
        s.savedAt -= 49 * 3600e3
        s.expiresAt -= 49 * 3600e3
        localStorage.setItem(k, JSON.stringify(s))
      })
      await page.goto(`${ORIGIN}/widget.html?source=pwa`)
      await page.waitForFunction(() => localStorage.getItem("qiscus-handoff:push-registration:v1") === null)
      expect(upstream.deviceCalls.map((c) => c.path)).toEqual(["set_user_device_token", "remove_user_device_token"])
      expect(await stored(page, REG_KEY)).toBeNull()
      await ctx.close()
    },
    60_000,
  )

  test(
    "open in external browser: a fresh browser session re-exchanges the same link and enters the room (deployed host, not localhost)",
    async () => {
      upstream.reset()
      // The token must survive on a deployed (https, non-localhost) host too.
      const onHost = onHttpsHost
      const link = hostInvite("synthetic-invite-A")

      // in-app browser: first exchange; the link stays in the address bar
      const inApp = await onHost({ grant: true })
      const first = await inApp.newPage()
      await first.goto(link)
      await first.waitForFunction(() => !!localStorage.getItem("qiscus-handoff:session:v1"))
      expect(new URL(first.url()).hash).toBe("#t=synthetic-invite-A")
      const handedOver = first.url()
      await inApp.close()

      // external browser: no storage, only the URL it was handed
      const external = await onHost({ grant: true })
      const page = await external.newPage()
      await page.goto(handedOver)
      await page.waitForFunction(() => !!localStorage.getItem("qiscus-handoff:session:v1"))
      expect(JSON.parse((await stored(page, SESSION_KEY))!)).toMatchObject({ roomId: "500", user: { email: "customer-a@example.invalid" } })
      expect(new URL(page.url()).hash).toBe("#t=synthetic-invite-A")

      // a plain refresh there re-exchanges again
      await page.evaluate(() => localStorage.clear())
      await page.reload()
      await page.waitForFunction(() => !!localStorage.getItem("qiscus-handoff:session:v1"))
      expect(new URL(page.url()).hash).toBe("#t=synthetic-invite-A")
      await external.close()
    },
    60_000,
  )

  test(
    "tampered stored session for another room is rejected upstream on resume",
    async () => {
      upstream.reset()
      const ctx = await newContext({ grant: true })
      const page = await ctx.newPage()
      await page.goto(invite("synthetic-invite-A"))
      await page.waitForFunction(() => !!localStorage.getItem("qiscus-handoff:session:v1"))
      await page.evaluate(() => {
        const k = "qiscus-handoff:session:v1"
        const s = JSON.parse(localStorage.getItem(k)!)
        s.roomId = "600" // B's room
        localStorage.setItem(k, JSON.stringify(s))
      })
      await page.goto(`${ORIGIN}/widget.html?source=pwa`)
      await page.waitForFunction(() => /Sesi percakapan sudah berakhir/.test(document.getElementById("handover-status")?.textContent || ""), null, {
        timeout: 15_000,
      })
      expect(await stored(page, SESSION_KEY)).toBeNull()
      await ctx.close()
    },
    60_000,
  )

  test(
    "permission denied: denied guidance, nothing registered",
    async () => {
      upstream.reset()
      const ctx = await newContext({ deny: true })
      const page = await ctx.newPage()
      await page.goto(invite("synthetic-invite-A"))
      await waitPushState(page, "denied")
      expect(await page.locator("#handoff-push").innerText()).toContain("Notifikasi diblokir")
      expect(upstream.deviceCalls).toEqual([])
      await ctx.close()
    },
    60_000,
  )

  test(
    "iPhone Safari tab: Add to Home Screen guidance instead of a button",
    async () => {
      const ctx = await onHttpsHost({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      })
      const page = await ctx.newPage()
      await page.goto(hostInvite("synthetic-invite-A"))
      await waitPushState(page, "ios-install")
      expect(await page.locator("#handoff-push").innerText()).toContain("Tambah ke Layar Utama")
      expect(await page.getByRole("button", { name: "Salin link" }).count()).toBe(1)
      await ctx.close()
    },
    60_000,
  )

  test(
    "iPhone WhatsApp in-app browser: told to open Safari (no dead x-safari button), link can be copied",
    async () => {
      upstream.reset()
      const ctx = await onHttpsHost({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.25.1",
      })
      await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: HOST })
      const page = await ctx.newPage()
      await page.goto(hostInvite("synthetic-invite-A"))
      await waitPushState(page, "ios-open-safari")
      const text = await page.locator("#handoff-push").innerText()
      expect(text).toContain("Safari")
      expect(text).toContain("Salin link")
      // WhatsApp iOS ignores x-safari-https:// (real iPhone): never offer it
      expect(await page.locator("#handoff-push a").count()).toBe(0)
      expect(await page.content()).not.toContain("x-safari-")
      await page.getByRole("button", { name: "Salin link" }).click()
      await page.getByRole("button", { name: "Link disalin" }).waitFor()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
      expect(upstream.deviceCalls).toEqual([])
      await ctx.close()
    },
    60_000,
  )

  test(
    "default cross-origin room: reported, nothing stored, no offer",
    async () => {
      const ctx = await newContext({ grant: true })
      const page = await ctx.newPage()
      await page.goto(invite("synthetic-invite-A", false))
      await waitPushState(page, "cross-origin-room")
      expect(await stored(page, SESSION_KEY)).toBeNull()
      await ctx.close()
    },
    60_000,
  )

  test(
    "cross-origin room in PUSH_ROOM_ORIGINS: the page verifies the exchange itself, offers, registers",
    async () => {
      await configurePush(true, { PUSH_ROOM_ORIGINS: "https://omnichannel.qiscus.com" })
      try {
        upstream.reset()
        const ctx = await newContext({ grant: true })
        const page = await ctx.newPage()
        const logs: string[] = []
        page.on("console", (m) => logs.push(m.text()))
        await page.goto(invite("synthetic-invite-A", false))
        await waitPushState(page, "offer")
        expect(upstream.verifyCalls).toBe(1)
        const session = JSON.parse((await stored(page, SESSION_KEY))!)
        expect(session).toMatchObject({ appId: "synthapp", roomId: "500", user: { email: "customer-a@example.invalid" } })
        const storageDump = await page.evaluate(() => JSON.stringify({ ...localStorage }))
        expect(storageDump).not.toContain("synthetic-idt-")
        await page.getByRole("button", { name: "Aktifkan notifikasi" }).click()
        await waitPushState(page, "enabled")
        expect(upstream.deviceCalls).toHaveLength(1)
        expect(upstream.deviceCalls[0]).toMatchObject({ path: "set_user_device_token", user: "customer-a@example.invalid", body: { device_platform: "web" } })
        const trail = logs.join("\n")
        expect(trail).toContain("[handoff-push] exchange seen")
        expect(trail).not.toContain("synthetic-idt-")
        expect(trail).not.toContain("synthetic-sdk-A")
        expect(trail).not.toContain("customer-a@example.invalid")
        await ctx.close()
      } finally {
        await configurePush(true)
      }
    },
    60_000,
  )

  test(
    "enable fails: the notice shows the failure code and reason on the page (console is gone after a reopen)",
    async () => {
      upstream.reset()
      const ctx = await newContext({ grant: true })
      await ctx.addInitScript(`window.__HANDOFF_PUSH_TEST__.fcm.getToken = async () => {
        throw Object.assign(new Error('Registration failed - push service error'), { name: 'AbortError' });
      };`)
      const page = await ctx.newPage()
      await page.goto(invite("synthetic-invite-A"))
      await waitPushState(page, "offer")
      await page.getByRole("button", { name: "Aktifkan notifikasi" }).click()
      await waitPushState(page, "error")
      const text = await page.locator("#handoff-push").innerText()
      expect(text).toContain("Notifikasi belum bisa diaktifkan di browser ini")
      expect(text).toContain("Google Chrome, Microsoft Edge, Firefox, atau Safari")
      expect(text).toContain("Kode: fcm — AbortError: Registration failed - push service error")
      expect(upstream.deviceCalls).toEqual([])
      await ctx.close()
    },
    60_000,
  )

  test(
    "unconfigured Worker: push stays off and says why in the console",
    async () => {
      await configurePush(false)
      try {
        const ctx = await newContext({ grant: true })
        const page = await ctx.newPage()
        const logs: string[] = []
        page.on("console", (m) => logs.push(m.text()))
        await page.goto(invite("synthetic-invite-A"))
        await waitPushState(page, "unconfigured")
        expect(await page.locator("#handoff-push").isHidden()).toBe(true)
        expect(logs.join("\n")).toContain("FIREBASE_VAPID_KEY")
        await ctx.close()
      } finally {
        await configurePush(true)
      }
    },
    60_000,
  )
})
