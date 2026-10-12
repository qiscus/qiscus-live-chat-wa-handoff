/**
 * Top-level push + resume wiring for /widget.html, bundled as
 * /js/push/handoff-push.js and exposed as `window.HandoffPush`.
 *
 * widget.html calls:
 *   const push = HandoffPush.start({ iframeUrl })
 *   invite (#t=) present -> push.beginInvite(); QismoFull mounts as before;
 *                           handoff-ready -> push.handoffReady();
 *                           handoff-error -> push.inviteFailed()
 *   no invite            -> push.resume() -> session ? push.mountResumeRoom(...)
 *                                                    : existing QismoFull path
 *
 * Messages from the room iframe are accepted only from THIS origin AND from the
 * current #qcw-iframe window; their payload is never trusted — the session is
 * read from same-origin storage the room wrote.
 */
import type { PushConfig } from "../push/config"
import { type ConfiguredPushConfig, type ExchangeCapture, PushController, type PushDeps, type PushUiState } from "./controller"
import { parseInviteLink } from "./inviteLink"
import { APP_CODE_RE, ROOM_ID_RE, type StoredSession, loadSession } from "./session"
import { detectSupport, probeBrowser } from "./support"
import { writeSwContext } from "./swContext"

const SW_URL = "/sw.js"
const FIREBASE_MODULE = "/js/push/firebase.js"
const DISMISS_KEY = "qiscus-handoff:push-dismissed:v1"
const IFRAME_ID = "qcw-iframe"

type Fcm = PushDeps["fcm"]

// ------------------------------------------------------------ service worker

// Debug trail for operators (DevTools console, "Verbose" level). Never logs a
// token, an e-mail or any message content.
export function debug(...args: unknown[]): void {
  try {
    console.debug("[handoff-push]", ...args)
  } catch {}
}

// How often a visible page asks the browser to re-check /sw.js. The browser
// already re-checks on navigation; this covers a PWA left open for days.
const SW_UPDATE_EVERY_MS = 30 * 60 * 1000

let swRegistration: Promise<ServiceWorkerRegistration> | null = null
let swLastUpdate = 0
function registerSw(): Promise<ServiceWorkerRegistration> {
  if (!swRegistration) {
    // updateViaCache "none": the update check never goes through the HTTP
    // cache, so a deployed sw.js is seen on the very next check.
    swRegistration = navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        debug("sw registered", { scope: reg.scope, active: !!reg.active, waiting: !!reg.waiting })
        swLastUpdate = Date.now()
        reg.addEventListener("updatefound", () => {
          const next = reg.installing
          debug("sw update found")
          next?.addEventListener("statechange", () => debug("sw update state", next.state))
        })
        return navigator.serviceWorker.ready
      })
    swRegistration.catch((e) => {
      debug("sw registration failed", String(e))
      swRegistration = null
    })
  }
  return swRegistration
}

/** Ask the browser to re-check /sw.js (throttled). A changed worker installs and takes over by itself. */
function checkSwUpdate(force = false): void {
  if (!swRegistration) return
  if (!force && Date.now() - swLastUpdate < SW_UPDATE_EVERY_MS) return
  swLastUpdate = Date.now()
  void swRegistration
    .then((reg) => reg.update())
    .then(() => debug("sw update check done"))
    .catch((e) => debug("sw update check failed", String(e)))
}

/**
 * TEST SEAM (headless tests only): on localhost/127.0.0.1, a page may provide
 * `window.__HANDOFF_PUSH_TEST__.fcm.getToken` to replace Firebase token
 * minting, because a headless browser cannot reach a real push service.
 * Ignored on every other host.
 */
function testSeamGetToken(): ((cfg: ConfiguredPushConfig) => Promise<string>) | null {
  const host = location.hostname
  if (host !== "localhost" && host !== "127.0.0.1") return null
  const seam = (window as unknown as { __HANDOFF_PUSH_TEST__?: { fcm?: { getToken?: (c: ConfiguredPushConfig) => Promise<string> } } })
    .__HANDOFF_PUSH_TEST__
  return seam?.fcm?.getToken ?? null
}

const fcm: Fcm = {
  async getToken(cfg) {
    const reg = await registerSw()
    const seam = testSeamGetToken()
    if (seam) return seam(cfg)
    const path: string = FIREBASE_MODULE // non-literal: loaded at runtime, not bundled here
    let mod: { getToken(c: ConfiguredPushConfig, r: ServiceWorkerRegistration): Promise<string> }
    try {
      mod = await import(path)
    } catch (e) {
      // Name the stage: Safari reports a failed module load as a bare TypeError.
      const err = e as { name?: string; message?: string }
      throw new Error(`module ${path} — ${err?.name || "Error"}: ${err?.message || String(e)}`)
    }
    return mod.getToken(cfg, reg)
  },
  async deleteToken() {
    const reg = await registerSw()
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
  },
}

async function loadConfig(): Promise<PushConfig> {
  const res = await fetch("/push/config", { cache: "no-store", credentials: "same-origin" })
  const body = (await res.json()) as PushConfig
  if (body && (body.status === "configured" || body.status === "unconfigured")) return body
  return { status: "unconfigured", missing: [], invalid: [] }
}

// ------------------------------------------------------------------------ UI

const STYLE = `
#handoff-push{position:fixed;left:12px;right:12px;top:12px;z-index:2147483000;max-width:520px;margin:0 auto;
  box-sizing:border-box;padding:12px 14px;border-radius:10px;background:#fff;color:#23272f;
  box-shadow:0 4px 18px rgba(0,0,0,.18);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
#handoff-push[hidden]{display:none}
#handoff-push p{margin:0 0 8px}
#handoff-push .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
#handoff-push button{font:inherit;border:0;border-radius:8px;padding:8px 12px;cursor:pointer;background:#eef0f4;color:#23272f}
#handoff-push button.primary{background:#27b199;color:#fff}
#handoff-push ul{margin:0 0 8px;padding-left:20px;list-style:disc outside}
#handoff-push .detail{margin:0 0 8px;font-size:12px;color:#6b7280;word-break:break-word}
#handoff-push input{font:inherit;width:100%;box-sizing:border-box;padding:8px;margin:0 0 8px;border:1px solid #cfd4dc;border-radius:8px}
`

const TEXT = {
  offer: "Mau dapat notifikasi saat agen membalas, meski halaman ini ditutup?",
  onlyYou: "Hanya terlihat oleh Anda",
  enable: "Aktifkan notifikasi",
  later: "Nanti",
  close: "Tutup",
  busy: "Mengaktifkan notifikasi…",
  enabled: "Notifikasi aktif. Kami akan memberi tahu saat agen membalas.",
  off: "Matikan",
  denied:
    "Notifikasi diblokir di browser ini. Jika ingin diberi tahu saat agen membalas, izinkan notifikasi untuk situs ini di pengaturan browser.",
  iosInstall: "Kalau ingin mendapatkan notifikasi di Live Chat, Anda perlu memasangnya di Layar Utama (iOS 16.4+):",
  iosInstallSteps: [
    "Ketuk “Salin link” di bawah.",
    "Ketuk tombol Bagikan, lalu “Tambah ke Layar Utama” (pastikan “Buka sebagai Web App” aktif).",
    "Buka Live Chat dari Layar Utama, lalu ketuk “Tempel”.",
  ],
  iosNoAddOption: "Tidak ada pilihan “Tambah ke Layar Utama”? Buka halaman ini di Safari dulu.",
  iosOpenSafari: "Kalau ingin mendapatkan notifikasi di Live Chat, Anda perlu membukanya di Safari lalu memasangnya di Layar Utama:",
  iosOpenSafariSteps: [
    "Ketuk menu ⋯ di halaman ini, lalu pilih buka di Safari / browser.",
    "Atau ketuk “Salin link”, buka Safari, lalu tempel di kolom alamat.",
    "Di Safari, ikuti petunjuk berikutnya untuk menambahkan ke Layar Utama.",
  ],
  copyLink: "Salin link",
  copied: "Link disalin",
  copyFailed: "Gagal menyalin",
  paste: "Tempel",
  error: "Notifikasi belum bisa diaktifkan. Coba lagi nanti.",
  errorBrowser:
    "Notifikasi belum bisa diaktifkan di browser ini. Coba buka link undangan di Google Chrome, Microsoft Edge, Firefox, atau Safari, lalu aktifkan notifikasi di sana.",
  errorBlocked: "Notifikasi diblokir oleh pemblokir konten/iklan di perangkat ini. Agar bisa aktif:",
  errorBlockedSteps: [
    "iPhone/iPad: buka Settings → Safari → Extensions, matikan pemblokir konten (mis. Firefox Focus, AdGuard, 1Blocker).",
    "Matikan juga VPN atau DNS pemblokir iklan bila ada.",
    "Tutup Live Chat, buka lagi, lalu ketuk “Coba lagi”.",
  ],
  retry: "Coba lagi",
  pasteIntro: "Tempel link undangan dari WhatsApp untuk melanjutkan percakapan di aplikasi ini.",
  pastePlaceholder: "https://…",
  pasteGo: "Lanjutkan",
  pasteBad: "Link tidak dikenali. Salin link undangan dari pesan WhatsApp, lalu tempel di sini.",
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.textContent = label
  if (primary) b.className = "primary"
  b.addEventListener("click", onClick)
  return b
}

/** Copy this page's link (with the invite fragment) for the Home Screen app's paste form. */
function copyLinkButton(primary = false): HTMLButtonElement {
  const b = button(TEXT.copyLink, () => {
    const done = (ok: boolean) => {
      b.textContent = ok ? TEXT.copied : TEXT.copyFailed
      setTimeout(() => (b.textContent = TEXT.copyLink), 2500)
    }
    if (!navigator.clipboard?.writeText) return done(false)
    navigator.clipboard.writeText(location.href).then(
      () => done(true),
      () => done(false),
    )
  }, primary)
  return b
}

/**
 * Push guidance is shown as a "virtual" chat bubble at the end of the room's
 * message list: rendered only in this browser, never sent with sendComment,
 * so it exists nowhere in Omnichannel and the agent never sees it. That needs
 * the room iframe on THIS origin (our own room page). A cross-origin room, or
 * a room that has not rendered yet, falls back to the floating banner.
 */
const BUBBLE_ID = "handoff-bubble"
const BUBBLE_STYLE = `
#handoff-bubble{display:flex;flex-direction:column;align-items:flex-start;margin:8px 12px 16px;
  font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#23272f}
#handoff-bubble[hidden]{display:none}
#handoff-bubble .hb-bubble{max-width:85%;box-sizing:border-box;padding:10px 12px;border-radius:12px 12px 12px 4px;
  background:#f1f3f5;border:1px dashed #cfd4dc}
#handoff-bubble p{margin:0 0 8px}
#handoff-bubble ul{margin:0 0 8px;padding-left:20px;list-style:disc outside}
#handoff-bubble li{margin:0 0 4px;display:list-item;list-style:inherit}
#handoff-bubble .detail{font-size:12px;color:#6b7280;word-break:break-word}
#handoff-bubble .row{display:flex;gap:8px;flex-wrap:wrap}
#handoff-bubble button{font:inherit;border:1px solid #27b199;border-radius:16px;padding:6px 12px;cursor:pointer;background:#fff;color:#1f8f7b}
#handoff-bubble button.primary{background:#27b199;color:#fff}
#handoff-bubble .hb-meta{margin-top:4px;font-size:11px;color:#8a919c}
`

interface View {
  text: string
  buttons: HTMLButtonElement[]
  detail?: string
  steps?: string[]
  autoHideMs?: number
}

function fill(container: HTMLElement, v: View): void {
  const doc = container.ownerDocument
  const nodes: Node[] = []
  const p = doc.createElement("p")
  p.textContent = v.text
  nodes.push(p)
  if (v.steps) {
    const list = doc.createElement("ul")
    for (const step of v.steps) {
      const li = doc.createElement("li")
      li.textContent = step
      list.appendChild(li)
    }
    nodes.push(list)
  }
  if (v.detail) {
    const d = doc.createElement("p")
    d.className = "detail"
    d.textContent = v.detail
    nodes.push(d)
  }
  if (v.buttons.length) {
    const row = doc.createElement("div")
    row.className = "row"
    for (const b of v.buttons) row.appendChild(b)
    nodes.push(row)
  }
  container.replaceChildren(...nodes)
}

const watched = new WeakSet<Element>()

/** The bubble host inside a same-origin room's message list, or null. */
function roomBubble(): { wrap: HTMLElement; body: HTMLElement } | null {
  const frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
  let doc: Document | null = null
  try {
    doc = frame?.contentDocument ?? null // null for a cross-origin room
  } catch {
    return null
  }
  const inner = doc?.querySelector(".qcw-comments .inner")
  if (!doc || !inner) return null
  if (!doc.getElementById("handoff-bubble-style")) {
    const st = doc.createElement("style")
    st.id = "handoff-bubble-style"
    st.textContent = BUBBLE_STYLE
    doc.head.appendChild(st)
  }
  let wrap = doc.getElementById(BUBBLE_ID)
  if (!wrap) {
    wrap = doc.createElement("div")
    wrap.id = BUBBLE_ID
    wrap.setAttribute("role", "status")
    wrap.setAttribute("aria-live", "polite")
    wrap.dataset.virtual = "true" // local only: not a message, not in Omnichannel
    const bubbleBody = doc.createElement("div")
    bubbleBody.className = "hb-bubble"
    const meta = doc.createElement("div")
    meta.className = "hb-meta"
    meta.textContent = TEXT.onlyYou
    wrap.appendChild(bubbleBody)
    wrap.appendChild(meta)
  }
  if (inner.lastElementChild !== wrap) inner.appendChild(wrap)
  if (!watched.has(inner)) {
    // The SDK (Vue) may append its own nodes after ours: keep the bubble last.
    watched.add(inner)
    new MutationObserver(() => {
      const w = doc!.getElementById(BUBBLE_ID)
      if (w && !w.hidden && inner.lastElementChild !== w) inner.appendChild(w)
    }).observe(inner, { childList: true })
  }
  return { wrap, body: wrap.querySelector(".hb-bubble") as HTMLElement }
}

function createUi(actions: { enable(): void; disable(): void }) {
  const style = document.createElement("style")
  style.textContent = STYLE
  document.head.appendChild(style)
  const root = document.createElement("div")
  root.id = "handoff-push"
  root.setAttribute("role", "status")
  root.setAttribute("aria-live", "polite")
  root.hidden = true
  document.body.appendChild(root)
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setInterval> | undefined
  let lastState: PushUiState | null = null

  const dismissed = () => sessionStorage.getItem(DISMISS_KEY) === "1"
  const hideAll = () => {
    clearTimeout(hideTimer)
    clearInterval(retryTimer)
    root.hidden = true
    const frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    try {
      const w = frame?.contentDocument?.getElementById(BUBBLE_ID)
      if (w) w.hidden = true
    } catch {}
  }
  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1")
    hideAll()
  }

  function paint(v: View | null) {
    hideAll()
    if (!v) return
    const bubble = roomBubble()
    if (bubble) {
      fill(bubble.body, v)
      bubble.wrap.hidden = false
      const list = bubble.wrap.closest(".qcw-comments") as HTMLElement | null
      if (list) list.scrollTop = list.scrollHeight
    } else {
      fill(root, v)
      root.hidden = false
      // The same-origin room may still be loading: move into it once it renders.
      if (document.getElementById(IFRAME_ID)) {
        let tries = 0
        retryTimer = setInterval(() => {
          if (++tries > 60) return clearInterval(retryTimer)
          if (roomBubble() && lastState) render(lastState)
        }, 500)
      }
    }
    if (v.autoHideMs) hideTimer = setTimeout(hideAll, v.autoHideMs)
  }

  function view(state: PushUiState): View | null {
    switch (state.kind) {
      case "offer":
        if (dismissed()) return null
        return { text: TEXT.offer, buttons: [button(TEXT.later, dismiss), button(TEXT.enable, actions.enable, true)] }
      case "busy":
        return { text: TEXT.busy, buttons: [] }
      case "enabled":
        return { text: TEXT.enabled, buttons: [button(TEXT.off, actions.disable), button(TEXT.close, hideAll)], autoHideMs: 8000 }
      case "denied":
        if (dismissed()) return null
        return { text: TEXT.denied, buttons: [button(TEXT.close, dismiss)] }
      case "ios-install":
        if (dismissed()) return null
        return {
          text: TEXT.iosInstall,
          steps: TEXT.iosInstallSteps,
          detail: TEXT.iosNoAddOption,
          buttons: [button(TEXT.later, dismiss), copyLinkButton(true)],
        }
      case "ios-open-safari":
        if (dismissed()) return null
        // No "open in Safari" button: WhatsApp iOS ignores x-safari-https://
        // (tested on a real iPhone, 2026-10-12), and a dead button is worse
        // than instructions.
        return { text: TEXT.iosOpenSafari, steps: TEXT.iosOpenSafariSteps, buttons: [button(TEXT.later, dismiss), copyLinkButton(true)] }
      case "error":
        return {
          // "googleapis unreachable" = firebase.ts retried and a probe to
          // Google also failed: a content blocker / DNS filter on the device
          // (confirmed on an iPhone with Firefox Focus as a Safari blocker).
          // Other "fcm" = the browser could not reach its push service (e.g. a
          // de-Googled Chromium such as Helium): retrying here will not help.
          ...(state.reason === "fcm" && state.detail?.includes("googleapis unreachable")
            ? { text: TEXT.errorBlocked, steps: TEXT.errorBlockedSteps }
            : { text: state.reason === "fcm" ? TEXT.errorBrowser : TEXT.error }),
          buttons: [button(TEXT.close, hideAll), button(TEXT.retry, actions.enable, true)],
          // Shown on the page: after a reopen the console trail is gone.
          detail: `Kode: ${state.reason}${state.detail ? ` — ${state.detail}` : ""}`,
        }
      case "unconfigured":
        // Not a customer-facing condition; visible to operators in the console.
        console.info("[handoff-push] push is not configured; missing:", state.missing.join(", ") || "-", "invalid:", state.invalid.join(", ") || "-")
        return null
      case "cross-origin-room":
        console.info("[handoff-push] push off: the room iframe is on another origin and is not in PUSH_ROOM_ORIGINS (or its exchange was not seen)")
        return null
      case "app-not-enabled":
        console.info("[handoff-push] push off: this app is not in PUSH_APP_CODES")
        return null
      case "unsupported":
        console.info("[handoff-push] push off: this browser has no Web Push here (needs HTTPS + PushManager)")
        return null
      default:
        return null
    }
  }

  function render(state: PushUiState) {
    document.documentElement.dataset.handoffPush = state.kind
    lastState = state
    paint(view(state))
  }

  function showPasteForm(onToken: (token: string) => void) {
    hideAll()
    root.replaceChildren()
    const p = document.createElement("p")
    p.textContent = TEXT.pasteIntro
    const input = document.createElement("input")
    input.type = "url"
    input.autocomplete = "off"
    input.placeholder = TEXT.pastePlaceholder
    input.setAttribute("aria-label", TEXT.pasteIntro)
    const err = document.createElement("p")
    err.hidden = true
    const go = button(
      TEXT.pasteGo,
      () => {
        const token = parseInviteLink(input.value, location.origin)
        input.value = ""
        if (!token) {
          err.textContent = TEXT.pasteBad
          err.hidden = false
          return
        }
        onToken(token)
      },
      true,
    )
    const row = document.createElement("div")
    row.className = "row"
    if (navigator.clipboard?.readText) {
      row.appendChild(
        button(TEXT.paste, () => {
          navigator.clipboard.readText().then(
            (text) => {
              input.value = text
              go.click()
            },
            () => input.focus(), // refused: the customer can still paste by hand
          )
        }),
      )
    }
    row.appendChild(go)
    for (const el of [p, input, err, row]) root.appendChild(el)
    root.hidden = false
    document.documentElement.dataset.handoffPush = "paste-link"
  }

  return { render, showPasteForm }
}

// ---------------------------------------------------------------------- API

export interface HandoffPushApi {
  beginInvite(): void
  inviteFailed(): void
  handoffReady(): void
  resume(): Promise<StoredSession | null>
  mountResumeRoom(session: StoredSession, handlers: { onReady(): void; onFailed(): void }): void
  /** Home Screen app with nothing to resume: offer to paste the WhatsApp link. */
  offerPasteLink(): boolean
  enable(): Promise<void>
  disable(): Promise<void>
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || !!window.matchMedia?.("(display-mode: standalone)").matches
}

// ------------------------------------------------------ exchange observation

const EXCHANGE_PATH = "/api/v2/live_handover/exchange"
const QISCUS_HOST = /(^|\.)qiscus\.(com|io)$/

/** A POST to the Qiscus handoff exchange endpoint (QismoFull's own request). */
export function isExchangeRequest(method: string, url: string, base: string): boolean {
  if (String(method).toUpperCase() !== "POST") return false
  try {
    const u = new URL(url, base)
    return u.protocol === "https:" && QISCUS_HOST.test(u.hostname) && u.pathname === EXCHANGE_PATH
  } catch {
    return false
  }
}

/** The fields push needs from an exchange response body, or null. */
export function parseExchange(raw: string): ExchangeCapture | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown> & { data?: Record<string, unknown> }
    const d = (j && typeof j.data === "object" && j.data) || j
    const appId = d.app_code
    const roomId = d.room_id == null ? "" : String(d.room_id)
    const identityToken = d.identity_token
    if (typeof appId !== "string" || !APP_CODE_RE.test(appId)) return null
    if (!ROOM_ID_RE.test(roomId)) return null
    if (typeof identityToken !== "string" || !identityToken || identityToken.length > 8192) return null
    return { appId, roomId, identityToken }
  } catch {
    return null
  }
}

/**
 * QismoFull exchanges the invite with XMLHttpRequest and hands the identity
 * token only to the room iframe. With a cross-origin room that is the only
 * moment the page can learn it, so the page reads that one response. Kept in
 * memory, used once, never stored or logged.
 */
function observeExchange(onCapture: (c: ExchangeCapture) => void): void {
  if (typeof XMLHttpRequest === "undefined") return
  const proto = XMLHttpRequest.prototype as XMLHttpRequest & { __handoffObserved?: boolean }
  if (proto.__handoffObserved) return
  proto.__handoffObserved = true
  const open = proto.open
  const send = proto.send
  const marked = new WeakSet<XMLHttpRequest>()
  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    if (isExchangeRequest(method, String(url), location.href)) marked.add(this)
    return (open as (...a: unknown[]) => void).apply(this, [method, url, ...rest])
  } as typeof proto.open
  proto.send = function (this: XMLHttpRequest, ...args: unknown[]) {
    if (marked.has(this)) {
      this.addEventListener("load", () => {
        if (this.status < 200 || this.status >= 300) return debug("exchange answered", this.status)
        const c = parseExchange(typeof this.responseText === "string" ? this.responseText : "")
        debug("exchange seen", c ? { appId: c.appId, roomId: c.roomId } : "unparsed")
        if (c) onCapture(c)
      })
    }
    return (send as (...a: unknown[]) => void).apply(this, args)
  } as typeof proto.send
}

export function start(opts: { iframeUrl: string }): HandoffPushApi {
  let resuming = false
  let resumeHandlers: { onReady(): void; onFailed(): void } | null = null

  const ui = createUi({ enable: () => void ctl.enable(), disable: () => void ctl.disable() })

  const ctl = new PushController({
    storage: window.localStorage,
    fetch: window.fetch.bind(window),
    now: () => Date.now(),
    support: () => detectSupport(probeBrowser(window)),
    permission: () => ("Notification" in window ? Notification.permission : "denied"),
    requestPermission: () => Notification.requestPermission(),
    loadConfig,
    fcm,
    swContext: { write: (ctx) => writeSwContext(indexedDB, ctx) },
    onState: (s) => ui.render(s),
    debug,
  })

  // PWA shell: register the worker early (installability, offline page).
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => void registerSw().catch(() => {}))
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkSwUpdate()
    })
    navigator.serviceWorker.addEventListener("controllerchange", () => debug("sw controller changed (new version active)"))
  } else {
    debug("service worker unavailable", { secure: window.isSecureContext })
  }

  let iframeOrigin: string | null = null
  try {
    iframeOrigin = new URL(opts.iframeUrl, location.href).origin
  } catch {}
  debug("start", { page: location.origin, room: iframeOrigin, sameOrigin: iframeOrigin === location.origin })

  let exchange: ExchangeCapture | null = null
  let crossOriginAdopted = false
  if (iframeOrigin !== location.origin) observeExchange((c) => (exchange = c))

  // Apps in PUSH_APP_CODES get OUR copy of the room even on a first invite,
  // so push guidance can be a local-only bubble inside the chat (a
  // cross-origin room can only get the floating banner). QismoFull learns the
  // app code from the exchange and appends the room iframe at once; we move
  // that iframe to this origin with the same path and query (our room page
  // reads the same parameters). Until the config is known the frame is held
  // on about:blank, so the remote room never starts and never spends the
  // single-use identity token.
  let roomSwap: Promise<boolean> | null = null
  if (iframeOrigin && iframeOrigin !== location.origin) {
    const cfgReady = loadConfig().catch((): PushConfig => ({ status: "unconfigured", missing: [], invalid: [] }))
    const swap = async (frame: HTMLIFrameElement): Promise<boolean> => {
      let url: URL
      try {
        url = new URL(frame.src)
      } catch {
        return false
      }
      const m = /^\/iframes\/v5\/([^/]+)\/live-handover-room$/.exec(url.pathname)
      if (url.origin !== iframeOrigin || !m) return false
      const original = frame.src
      frame.src = "about:blank"
      const cfg = await cfgReady
      const app = decodeURIComponent(m[1]!)
      const ours = cfg.status === "configured" && !!cfg.appCodes && cfg.appCodes.includes(app)
      frame.src = ours ? location.origin + url.pathname + url.search : original
      debug("room iframe", ours ? "moved to this origin (app in PUSH_APP_CODES)" : "kept on " + iframeOrigin)
      return ours
    }
    const watch = new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes)
          if (n instanceof HTMLIFrameElement && n.id === IFRAME_ID && !roomSwap) {
            roomSwap = swap(n)
            watch.disconnect()
            return
          }
    })
    const observe = () => watch.observe(document.body, { childList: true })
    if (document.body) observe()
    else document.addEventListener("DOMContentLoaded", observe)
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    if (!frame || e.source !== frame.contentWindow) return
    const name = e.data && typeof e.data === "object" ? (e.data as { event_name?: unknown }).event_name : null
    // An adopted cross-origin room may only END the session; its payload is never trusted.
    if (e.origin !== location.origin) {
      if (crossOriginAdopted && e.origin === iframeOrigin && name === "qiscus:session-closed") {
        debug("room message (cross-origin)", name)
        void ctl.sessionClosed()
      }
      return
    }
    debug("room message", name)
    if (name === "qiscus:session-ready") {
      resumeHandlers?.onReady()
      void ctl.sessionReady()
    } else if (name === "qiscus:session-closed") {
      void ctl.sessionClosed()
    } else if (name === "qiscus:session-error" && resuming) {
      resumeHandlers?.onFailed()
      void ctl.sessionInvalid()
    }
  })

  return {
    beginInvite: () => ctl.beginInvite(),
    inviteFailed: () => void ctl.inviteFailed(),
    handoffReady: () => {
      if (iframeOrigin === location.origin) return void debug("handoff ready (same-origin room)")
      // QismoFull announces handoff-ready from its own XHR onload, which runs
      // BEFORE our load listener on that same request: wait one task so the
      // exchange response has been read.
      setTimeout(async () => {
        if (roomSwap && (await roomSwap)) {
          // Our own room now: it hands over the session itself (session-ready).
          exchange = null
          return void debug("handoff ready (room moved to this origin)")
        }
        debug("handoff ready (cross-origin room)", { exchangeSeen: !!exchange })
        // A room on another origin cannot hand its SDK login to this page; the
        // exchange the page saw can, when that origin is allowed (TEMPORARY).
        const seen = exchange
        exchange = null
        crossOriginAdopted = !!seen
        void ctl.crossOriginRoom({ origin: iframeOrigin, exchange: seen })
      }, 0)
    },
    resume: async () => {
      const s = await ctl.resume()
      debug("resume", s ? { appId: s.appId, roomId: s.roomId } : "nothing to resume")
      return s
    },
    mountResumeRoom(session, handlers) {
      if (!APP_CODE_RE.test(session.appId)) return handlers.onFailed()
      resuming = true
      resumeHandlers = handlers
      const frame = document.createElement("iframe")
      frame.id = IFRAME_ID
      frame.title = "Live Chat"
      frame.setAttribute("allow", "clipboard-write")
      const app = encodeURIComponent(session.appId)
      // No token or user data in this URL: the room reads the stored session.
      frame.src = `/iframes/v5/${app}/live-handover-room?resume=1&app_id=${app}`
      document.body.appendChild(frame)
    },
    offerPasteLink() {
      if (!isStandalone() || loadSession(window.localStorage, Date.now()).state === "valid") return false
      ui.showPasteForm((token) => {
        // Same transport as the normal invite: the fragment, which QismoFull
        // strips before the exchange and which never reaches a server.
        history.replaceState(null, "", `/widget.html${location.search}#t=${encodeURIComponent(token)}`)
        location.reload()
      })
      return true
    },
    enable: () => ctl.enable(),
    disable: () => ctl.disable(),
  }
}

declare global {
  interface Window {
    HandoffPush?: { start: typeof start }
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.HandoffPush = { start }
}
