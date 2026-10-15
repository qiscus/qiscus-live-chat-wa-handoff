// SYNTHETIC: every dependency is a fake — in-memory storage, a fake Qiscus SDK
// API (fetch), a fake FCM (token minting), a fake Notification permission
// and a fake service-worker context store. No browser, no network.
import { describe, expect, test } from "bun:test"
import { PushController, REG_KEY, OPT_IN_KEY, errorDetail, type PushDeps, type PushUiState } from "./controller"
import { detectSupport } from "./support"
import { loadSession, saveSession, stashSessionForInvite, type SdkUser } from "./session"
import { MemoryStorage } from "./testing"
import type { PushConfig } from "../push/config"

const CONFIG: PushConfig = {
  status: "configured",
  firebase: {
    apiKey: "AIza" + "S".repeat(35),
    projectId: "synthetic-project",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef0123456789",
  },
  vapidKey: "synthetic-vapid",
  appCodes: null,
  roomOrigins: [],
}

const tok = (n: number) => `synthetic-fcm-${n}:` + "A".repeat(120)
const u = (email: string): SdkUser => ({ email, token: `synthetic-sdk-token-${email}` })

function harness(over: Partial<{ config: PushConfig; configFor: (appId: string | undefined) => PushConfig; resumeUrl: string; permission: NotificationPermission; support: ReturnType<typeof detectSupport>; grant: NotificationPermission; status: number }> = {}) {
  const storage = new MemoryStorage()
  let now = 1_800_000_000_000
  let permission: NotificationPermission = over.permission ?? "default"
  let nextToken = 1
  const sdkCalls: { path: string; app: string; user: string; sdkToken: string; device: string }[] = []
  const fcmCalls: string[] = []
  const swWrites: unknown[] = []
  const swScopes: (string | undefined)[] = []
  const configCalls: (string | undefined)[] = []
  const minted: unknown[] = []
  const deleted: unknown[] = []
  const states: PushUiState[] = []
  let status = over.status ?? 200

  const deps: PushDeps = {
    storage,
    now: () => now,
    fetch: (async (url: string, init: RequestInit) => {
      const h = new Headers(init.headers)
      const path = new URL(url).pathname.split("/").pop()!
      const body = JSON.parse(String(init.body))
      sdkCalls.push({
        path,
        app: h.get("QISCUS-SDK-APP-ID")!,
        user: h.get("QISCUS-SDK-USER-ID")!,
        sdkToken: h.get("QISCUS-SDK-TOKEN")!,
        device: body.device_token ?? body.identity_token,
      })
      if (path === "verify_identity_token") {
        if (status !== 200) return new Response("{}", { status })
        return Response.json({ status: 200, results: { user: { ...u("cross@example.invalid"), identity_token: "must-not-be-stored" } } })
      }
      return new Response("{}", { status })
    }) as unknown as typeof fetch,
    support: () => over.support ?? "supported",
    permission: () => permission,
    requestPermission: async () => {
      permission = over.grant ?? "granted"
      return permission
    },
    loadConfig: async (appId) => {
      configCalls.push(appId)
      return over.configFor ? over.configFor(appId) : (over.config ?? CONFIG)
    },
    resumeUrl: over.resumeUrl ? () => over.resumeUrl : undefined,
    fcm: {
      getToken: async (cfg) => {
        fcmCalls.push("getToken")
        minted.push(cfg)
        return tok(nextToken)
      },
      deleteToken: async (target) => {
        fcmCalls.push("deleteToken")
        deleted.push(target)
      },
    },
    swContext: {
      write: async (ctx, scope) => {
        swWrites.push(ctx)
        swScopes.push(scope)
      },
    },
    onState: (s) => states.push(s),
  }
  const ctl = new PushController(deps)
  return {
    ctl,
    storage,
    sdkCalls,
    fcmCalls,
    swWrites,
    swScopes,
    configCalls,
    minted,
    deleted,
    states,
    last: () => states[states.length - 1],
    setPermission: (p: NotificationPermission) => (permission = p),
    rotateToken: () => nextToken++,
    advance: (ms: number) => (now += ms),
    setStatus: (s: number) => (status = s),
    nowFn: () => now,
    login: (appId: string, roomId: string, email: string) => saveSession(storage, { appId, roomId, user: u(email) }, now),
  }
}

describe("detectSupport (synthetic navigator shapes)", () => {
  const base = { isSecureContext: true, serviceWorker: true, pushManager: true, notification: true, userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/150", standalone: false, maxTouchPoints: 0 }
  test("desktop Chrome", () => expect(detectSupport(base)).toBe("supported"))
  test("insecure context", () => expect(detectSupport({ ...base, isSecureContext: false })).toBe("unsupported"))
  test("no PushManager", () => expect(detectSupport({ ...base, pushManager: false })).toBe("unsupported"))
  test("iPhone Safari tab needs Add to Home Screen", () =>
    expect(detectSupport({ ...base, pushManager: false, notification: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" })).toBe("ios-install"))
  test("iPadOS desktop UA with touch is iOS", () =>
    expect(detectSupport({ ...base, pushManager: false, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 })).toBe("ios-install"))
  test("iPhone WhatsApp in-app browser (app token) is sent to Safari first", () =>
    expect(detectSupport({ ...base, pushManager: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.25.1" })).toBe("ios-open-safari"))
  test("iPhone embedded WKWebView without the Safari/ token is sent to Safari first", () =>
    expect(detectSupport({ ...base, pushManager: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" })).toBe("ios-open-safari"))
  test("Android WhatsApp WebView is sent to Chrome, even if it exposes the Push API objects", () =>
    expect(detectSupport({ ...base, userAgent: "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/150 Mobile WhatsApp/2.25" })).toBe("android-open-browser"))
  test("Android WebView without push objects is sent to Chrome (not 'unsupported')", () =>
    expect(detectSupport({ ...base, pushManager: false, notification: false, userAgent: "Mozilla/5.0 (Linux; Android 14; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0 Mobile Safari/537.36" })).toBe("android-open-browser"))
  test("Android Instagram in-app browser (app token) is sent to Chrome", () =>
    expect(detectSupport({ ...base, pushManager: false, userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/150 Mobile Safari/537.36 Instagram 300.0" })).toBe("android-open-browser"))
  test("Android in-app browser with an unrecognised UA (no wv, no app token) but no Push API is sent to Chrome", () =>
    expect(detectSupport({ ...base, pushManager: false, notification: false, userAgent: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Mobile Safari/537.36" })).toBe("android-open-browser"))
  test("Android without push on plain http stays unsupported (no secure context to fix by switching browser)", () =>
    expect(detectSupport({ ...base, isSecureContext: false, userAgent: "Mozilla/5.0 (Linux; Android 14; K) Chrome/150.0 Mobile Safari/537.36" })).toBe("unsupported"))
  test("Android Chrome (and a Chrome Custom Tab, same UA) is supported", () =>
    expect(detectSupport({ ...base, userAgent: "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Mobile Safari/537.36" })).toBe("supported"))
  test("iOS home-screen app with push", () =>
    expect(detectSupport({ ...base, standalone: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe("supported"))
  test("old iOS home-screen app without push", () =>
    expect(detectSupport({ ...base, standalone: true, pushManager: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" })).toBe("unsupported"))
})

describe("PushController (synthetic)", () => {
  test("unconfigured: says so with the missing names and never touches FCM", async () => {
    const h = harness({ config: { status: "unconfigured", missing: ["FIREBASE_VAPID_KEY"], invalid: [] } })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "unconfigured", missing: ["FIREBASE_VAPID_KEY"], invalid: [] })
    expect(h.fcmCalls).toEqual([])
    expect(h.sdkCalls).toEqual([])
  })

  test("no session: nothing is offered", async () => {
    const h = harness()
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "hidden" })
  })

  test("unsupported / iOS-install states", async () => {
    for (const support of ["unsupported", "ios-install", "ios-open-safari", "android-open-browser"] as const) {
      const h = harness({ support })
      h.login("app1", "11", "c1@example.invalid")
      await h.ctl.sessionReady()
      expect(h.last()).toEqual({ kind: support })
    }
  })

  test("app not in PUSH_APP_CODES: no offer, no registration", async () => {
    const h = harness({ config: { ...CONFIG, appCodes: ["other-app"] } as PushConfig })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "app-not-enabled" })
    await h.ctl.enable()
    expect(h.sdkCalls).toEqual([])
  })

  test("opt-in: offer -> permission -> FCM token -> registered for THIS customer as platform web", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "offer" })
    expect(h.fcmCalls).toEqual([]) // nothing happens before the explicit click
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect(h.sdkCalls).toEqual([
      { path: "set_user_device_token", app: "app1", user: "c1@example.invalid", sdkToken: "synthetic-sdk-token-c1@example.invalid", device: tok(1) },
    ])
    expect(h.swWrites.at(-1)).toEqual({ appId: "app1", roomId: "11", selfEmail: "c1@example.invalid" })
    expect(h.storage.getItem(OPT_IN_KEY)).toBe("1")
    expect(JSON.parse(h.storage.getItem(REG_KEY)!)).toMatchObject({ fcmToken: tok(1), appId: "app1", userEmail: "c1@example.invalid", roomId: "11" })
  })

  test("permission denied: denied state, no token, no registration", async () => {
    const h = harness({ grant: "denied" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "denied" })
    expect(h.fcmCalls).toEqual([])
    expect(h.sdkCalls).toEqual([])
    expect(h.storage.getItem(OPT_IN_KEY)).toBeNull()
  })

  test("already denied before any click: denied state", async () => {
    const h = harness({ permission: "denied" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "denied" })
  })

  test("prompt dismissed (still default): back to offer", async () => {
    const h = harness({ grant: "default" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "offer" })
  })

  test("refresh with an unchanged token and identity is idempotent (no network)", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect(h.sdkCalls).toEqual([])
  })

  test("FCM token rotation: registers the new token, removes the old one", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.rotateToken()
    h.sdkCalls.length = 0
    await h.ctl.sessionReady()
    expect(h.sdkCalls.map((c) => [c.path, c.device])).toEqual([
      ["set_user_device_token", tok(2)],
      ["remove_user_device_token", tok(1)],
    ])
  })

  test("new invite for a DIFFERENT customer: old registration removed with the OLD session, new one registered with the NEW session", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.fcmCalls.length = 0

    h.ctl.beginInvite()
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none") // old identity can no longer resume
    h.rotateToken() // deleteToken -> a fresh token next time
    h.login("app2", "22", "new@example.invalid") // what the room iframe writes after login
    await h.ctl.sessionReady()

    expect(h.sdkCalls).toEqual([
      { path: "remove_user_device_token", app: "app1", user: "old@example.invalid", sdkToken: "synthetic-sdk-token-old@example.invalid", device: tok(1) },
      { path: "set_user_device_token", app: "app2", user: "new@example.invalid", sdkToken: "synthetic-sdk-token-new@example.invalid", device: tok(2) },
    ])
    expect(h.fcmCalls).toEqual(["deleteToken", "getToken"])
    expect(h.swWrites.at(-1)).toEqual({ appId: "app2", roomId: "22", selfEmail: "new@example.invalid" })
  })

  test("new invite for the SAME customer keeps the registration", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.ctl.beginInvite()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.sdkCalls).toEqual([])
    expect(h.last()).toEqual({ kind: "enabled" })
  })

  test("same customer, different room: SW context follows the new room", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.ctl.beginInvite()
    h.login("app1", "12", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.swWrites.at(-1)).toEqual({ appId: "app1", roomId: "12", selfEmail: "c1@example.invalid" })
  })

  test("invite exchange failed: old identity is still torn down", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.ctl.beginInvite()
    await h.ctl.inviteFailed()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "old@example.invalid"]])
    expect(h.storage.getItem(REG_KEY)).toBeNull()
    expect(h.swWrites.at(-1)).toBeNull()
  })

  test("room is not same-origin: reported, and an old identity is torn down", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.ctl.beginInvite()
    await h.ctl.crossOriginRoom()
    expect(h.last()).toEqual({ kind: "cross-origin-room" })
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  const ROOM = "https://omnichannel.example.invalid"
  const seen = { appId: "app1", roomId: "77", identityToken: "synthetic-identity-token" }

  test("cross-origin room NOT in roomOrigins: reported, no SDK call, nothing stored", async () => {
    const h = harness({ config: { ...CONFIG, roomOrigins: ["https://other.example.invalid"] } as PushConfig })
    await h.ctl.crossOriginRoom({ origin: ROOM, exchange: seen })
    expect(h.last()).toEqual({ kind: "cross-origin-room" })
    expect(h.sdkCalls).toEqual([])
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
  })

  test("allowed cross-origin room without a seen exchange: reported, nothing stored", async () => {
    const h = harness({ config: { ...CONFIG, roomOrigins: [ROOM] } as PushConfig })
    await h.ctl.crossOriginRoom({ origin: ROOM, exchange: null })
    expect(h.last()).toEqual({ kind: "cross-origin-room" })
    expect(h.sdkCalls).toEqual([])
  })

  test("allowed cross-origin room: identity token verified as the app, session stored, offer shown, then registered", async () => {
    const h = harness({ config: { ...CONFIG, roomOrigins: [ROOM] } as PushConfig })
    await h.ctl.crossOriginRoom({ origin: ROOM, exchange: seen })
    expect(h.sdkCalls.map((c) => [c.path, c.app, c.user])).toEqual([["verify_identity_token", "app1", null as unknown as string]])
    const loaded = loadSession(h.storage, h.nowFn())
    expect(loaded.state).toBe("valid")
    if (loaded.state !== "valid") throw new Error("unreachable")
    expect([loaded.session.appId, loaded.session.roomId, loaded.session.user.email]).toEqual(["app1", "77", "cross@example.invalid"])
    expect(JSON.stringify(loaded.session)).not.toContain("must-not-be-stored")
    expect(JSON.stringify(loaded.session)).not.toContain("synthetic-identity-token")
    expect(h.last()).toEqual({ kind: "offer" })
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect(h.sdkCalls.at(-1)!.path).toBe("set_user_device_token")
    expect(h.sdkCalls.at(-1)!.user).toBe("cross@example.invalid")
  })

  test("allowed cross-origin room, verify rejected upstream: reported, nothing stored", async () => {
    const h = harness({ config: { ...CONFIG, roomOrigins: [ROOM] } as PushConfig, status: 401 })
    await h.ctl.crossOriginRoom({ origin: ROOM, exchange: seen })
    expect(h.last()).toEqual({ kind: "cross-origin-room" })
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
  })

  test("permission revoked in browser settings: registration removed on next load", async () => {
    for (const revoked of ["default", "denied"] as const) {
      const h = harness()
      h.login("app1", "11", "c1@example.invalid")
      await h.ctl.sessionReady()
      await h.ctl.enable()
      h.sdkCalls.length = 0
      h.setPermission(revoked)
      await h.ctl.sessionReady()
      expect(h.sdkCalls.map((c) => c.path)).toEqual(["remove_user_device_token"])
      expect(h.storage.getItem(REG_KEY)).toBeNull()
      expect(h.last()).toEqual({ kind: revoked === "denied" ? "denied" : "offer" })
    }
  })

  test("user turns it off: removed + FCM token deleted", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.disable()
    expect(h.sdkCalls.at(-1)?.path).toBe("remove_user_device_token")
    expect(h.fcmCalls.at(-1)).toBe("deleteToken")
    expect(h.storage.getItem(OPT_IN_KEY)).toBeNull()
    expect(h.last()).toEqual({ kind: "offer" })
  })

  test("conversation closed: registration removed, session cleared (no resume)", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.sessionClosed()
    expect(h.sdkCalls.at(-1)?.path).toBe("remove_user_device_token")
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
    expect(h.swWrites.at(-1)).toBeNull()
    expect(h.last()).toEqual({ kind: "hidden" })
  })

  test("resume: valid session is returned without any network", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    const s = await h.ctl.resume()
    expect(s?.roomId).toBe("11")
    expect(h.sdkCalls).toEqual([])
  })

  test("resume after expiry: nothing to resume, registration removed with the expired session's creds", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.advance(49 * 60 * 60 * 1000)
    expect(await h.ctl.resume()).toBeNull()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "c1@example.invalid"]])
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  test("resume after an abandoned invite: previous identity torn down, never resumed", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    stashSessionForInvite(h.storage) // invite page closed before the exchange finished
    h.sdkCalls.length = 0
    expect(await h.ctl.resume()).toBeNull()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "old@example.invalid"]])
  })

  test("resumed session rejected upstream: torn down and cleared", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.sessionInvalid()
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  test("registration rejected upstream: error state, nothing stored, SW not armed", async () => {
    const h = harness({ status: 401 })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "error", reason: "http-401", detail: "set_user_device_token HTTP 401" })
    expect(h.storage.getItem(REG_KEY)).toBeNull()
    expect(h.swWrites).toEqual([])
  })

  test("FCM token minting fails: error state, nothing registered", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    h.ctl["deps"].fcm.getToken = async () => {
      throw new Error("synthetic messaging/token-subscribe-failed")
    }
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "error", reason: "fcm", detail: "Error: synthetic messaging/token-subscribe-failed" })
    expect(h.sdkCalls).toEqual([])
  })

  test("error detail names the failure but never shows a token-like value", () => {
    const e = Object.assign(new Error("Registration failed - push service error"), { name: "AbortError" })
    expect(errorDetail(e)).toBe("AbortError: Registration failed - push service error")
    expect(errorDetail(new Error("bad token " + "A".repeat(150)))).toBe("Error: bad token …")
    expect(errorDetail("x".repeat(500)).length).toBeLessThanOrEqual(200)
  })

  test("the state never contains a token", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    const dump = JSON.stringify(h.states)
    expect(dump).not.toContain("synthetic-fcm")
    expect(dump).not.toContain("synthetic-sdk-token")
  })
})

// ---------------------------------------------------------------- per-app config

const cfgOf = (project: string, appCode?: string): PushConfig =>
  ({
    ...CONFIG,
    firebase: { ...(CONFIG as { firebase: object }).firebase, projectId: project },
    appCodes: appCode ? [appCode] : null,
    ...(appCode ? { source: "backend", swScope: `/a/${appCode}/` } : {}),
  }) as PushConfig
const OFF: PushConfig = { status: "unconfigured", missing: ["FIREBASE_API_KEY"], invalid: [] }

describe("PushController: per-app config and service-worker scope (synthetic)", () => {
  test("config is asked for the SESSION's app, once per app", async () => {
    const h = harness({ configFor: (app) => cfgOf(`proj-${app}`, app) })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.sessionReady()
    expect(h.configCalls.every((a) => a === "app1")).toBe(true)
    expect(h.configCalls).toHaveLength(1)
    expect((h.minted[0] as { firebase: { projectId: string } }).firebase.projectId).toBe("proj-app1")
  })

  test("another app's config is never used: app2 unconfigured while app1 is configured -> push off for app2", async () => {
    const h = harness({ configFor: (app) => (app === "app1" ? cfgOf("proj-app1", "app1") : OFF) })
    h.login("app2", "22", "c2@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "unconfigured", missing: ["FIREBASE_API_KEY"], invalid: [] })
    await h.ctl.enable()
    expect(h.fcmCalls).toEqual([])
    expect(h.sdkCalls).toEqual([])
  })

  test("backend-scoped app: token minted with its scope, registration + SW context + resume URL carry it", async () => {
    const h = harness({ configFor: (app) => cfgOf("proj-app2", app!), resumeUrl: "/widget.html?source=notification&baseUrl=https%3A%2F%2Fqismo-stag2.qiscus.io" })
    h.login("app2", "22", "c2@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect((h.minted[0] as { swScope: string }).swScope).toBe("/a/app2/")
    expect(JSON.parse(h.storage.getItem(REG_KEY)!).scope).toBe("/a/app2/")
    expect(h.swWrites.at(-1)).toEqual({ appId: "app2", roomId: "22", selfEmail: "c2@example.invalid", resume: "/widget.html?source=notification&baseUrl=https%3A%2F%2Fqismo-stag2.qiscus.io" })
    expect(h.swScopes.at(-1)).toBe("/a/app2/")
  })

  test("env-config app (Weaper): root scope, no scope in the registration, SW context exactly as before", async () => {
    const h = harness({ resumeUrl: "/widget.html?source=notification&baseUrl=https%3A%2F%2Fqismo.qiscus.com" })
    h.login("weaper", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect((h.minted[0] as { swScope?: string }).swScope).toBeUndefined()
    expect(JSON.parse(h.storage.getItem(REG_KEY)!)).not.toHaveProperty("scope")
    expect(h.swWrites.at(-1)).toEqual({ appId: "weaper", roomId: "11", selfEmail: "c1@example.invalid" })
    expect(h.swScopes.at(-1)).toBeUndefined()
  })

  test("switching apps removes the old app's subscription in ITS scope before the new app registers in its own", async () => {
    const h = harness({ configFor: (app) => cfgOf(`proj-${app}`, app!) })
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.deleted.length = 0
    h.sdkCalls.length = 0
    h.ctl.beginInvite()
    h.rotateToken()
    h.login("app2", "22", "new@example.invalid")
    await h.ctl.sessionReady()
    expect(h.deleted).toEqual([{ swScope: "/a/app1/" }])
    expect(h.sdkCalls.map((c) => [c.path, c.app])).toEqual([
      ["remove_user_device_token", "app1"],
      ["set_user_device_token", "app2"],
    ])
    // the old app's SW context is cleared under the old scope, the new one written under the new scope
    expect(h.swScopes.slice(-2)).toEqual(["/a/app1/", "/a/app2/"])
    expect(h.swWrites.slice(-2)[0]).toBeNull()
    expect((h.minted.at(-1) as { swScope: string }).swScope).toBe("/a/app2/")
  })

  test("teardown does not need the old app's config to still load (scope comes from the registration)", async () => {
    let off = false
    const h = harness({ configFor: (app) => (off ? OFF : cfgOf(`proj-${app}`, app!)) })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.deleted.length = 0
    off = true // backend now unreachable / unconfigured
    const fresh = harness({ configFor: () => OFF })
    fresh.storage.map = new Map(h.storage.map)
    await fresh.ctl.sessionClosed()
    expect(fresh.deleted).toEqual([{ swScope: "/a/app1/" }])
    expect(fresh.storage.getItem(REG_KEY)).toBeNull()
  })

  test("a legacy root-scope registration moving to a backend-scoped config is re-subscribed and the old subscription removed", async () => {
    // Weaper registered under the root scope with the Worker env config ...
    const h = harness()
    h.login("weaper", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    // ... then the backend starts serving config for it.
    const upgraded = harness({ permission: "granted", configFor: (app) => cfgOf("proj-weaper", app!) })
    upgraded.storage.map = new Map(h.storage.map)
    upgraded.rotateToken()
    await upgraded.ctl.sessionReady()
    expect(upgraded.last()).toEqual({ kind: "enabled" })
    expect(upgraded.deleted).toEqual([{ swScope: undefined }]) // the old ROOT subscription
    expect(JSON.parse(upgraded.storage.getItem(REG_KEY)!).scope).toBe("/a/weaper/")
  })
})
