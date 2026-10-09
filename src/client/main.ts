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
import { type ConfiguredPushConfig, PushController, type PushDeps, type PushUiState } from "./controller"
import { parseInviteLink } from "./inviteLink"
import { APP_CODE_RE, type StoredSession, loadSession } from "./session"
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
    const mod = (await import(path)) as { getToken(c: ConfiguredPushConfig, r: ServiceWorkerRegistration): Promise<string> }
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
#handoff-push input{font:inherit;width:100%;box-sizing:border-box;padding:8px;margin:0 0 8px;border:1px solid #cfd4dc;border-radius:8px}
`

const TEXT = {
  offer: "Dapatkan notifikasi saat agen membalas, meski halaman ini ditutup.",
  enable: "Aktifkan notifikasi",
  later: "Nanti",
  close: "Tutup",
  busy: "Mengaktifkan notifikasi…",
  enabled: "Notifikasi aktif. Kami akan memberi tahu saat agen membalas.",
  off: "Matikan",
  denied:
    "Notifikasi diblokir di browser ini. Jika ingin diberi tahu saat agen membalas, izinkan notifikasi untuk situs ini di pengaturan browser.",
  iosInstall:
    "Di iPhone/iPad, notifikasi hanya tersedia setelah halaman ini ditambahkan ke Layar Utama (iOS 16.4+): ketuk tombol Bagikan, lalu “Tambah ke Layar Utama”. Aplikasi di Layar Utama tidak berbagi sesi dengan Safari, jadi setelah membukanya, tempel lagi link undangan dari WhatsApp di sana.",
  error: "Notifikasi belum bisa diaktifkan. Coba lagi nanti.",
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

  const dismissed = () => sessionStorage.getItem(DISMISS_KEY) === "1"
  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1")
    root.hidden = true
  }

  function show(text: string, buttons: HTMLButtonElement[]) {
    clearTimeout(hideTimer)
    root.replaceChildren()
    const p = document.createElement("p")
    p.textContent = text
    const row = document.createElement("div")
    row.className = "row"
    for (const b of buttons) row.appendChild(b)
    root.appendChild(p)
    root.appendChild(row)
    root.hidden = false
  }

  function render(state: PushUiState) {
    document.documentElement.dataset.handoffPush = state.kind
    switch (state.kind) {
      case "offer":
        if (dismissed()) return void (root.hidden = true)
        return show(TEXT.offer, [button(TEXT.later, dismiss), button(TEXT.enable, actions.enable, true)])
      case "busy":
        return show(TEXT.busy, [])
      case "enabled":
        show(TEXT.enabled, [button(TEXT.off, actions.disable), button(TEXT.close, () => (root.hidden = true))])
        hideTimer = setTimeout(() => (root.hidden = true), 8000)
        return
      case "denied":
        if (dismissed()) return void (root.hidden = true)
        return show(TEXT.denied, [button(TEXT.close, dismiss)])
      case "ios-install":
        if (dismissed()) return void (root.hidden = true)
        return show(TEXT.iosInstall, [button(TEXT.close, dismiss)])
      case "error":
        return show(TEXT.error, [button(TEXT.close, () => (root.hidden = true)), button(TEXT.retry, actions.enable, true)])
      case "unconfigured":
        // Not a customer-facing condition; visible to operators in the console.
        console.info("[handoff-push] push is not configured; missing:", state.missing.join(", ") || "-", "invalid:", state.invalid.join(", ") || "-")
        root.hidden = true
        return
      case "cross-origin-room":
        console.info("[handoff-push] push off: the room iframe is on another origin and is not in PUSH_ROOM_ORIGINS (or its exchange was not seen)")
        root.hidden = true
        return
      case "app-not-enabled":
        console.info("[handoff-push] push off: this app is not in PUSH_APP_CODES")
        root.hidden = true
        return
      case "unsupported":
        console.info("[handoff-push] push off: this browser has no Web Push here (needs HTTPS + PushManager)")
        root.hidden = true
        return
      default:
        root.hidden = true
    }
  }

  function showPasteForm(onToken: (token: string) => void) {
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

  window.addEventListener("message", (e: MessageEvent) => {
    if (e.origin !== location.origin) return
    const frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null
    if (!frame || e.source !== frame.contentWindow) return
    const name = e.data && typeof e.data === "object" ? (e.data as { event_name?: unknown }).event_name : null
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

  let iframeOrigin: string | null = null
  try {
    iframeOrigin = new URL(opts.iframeUrl, location.href).origin
  } catch {}

  return {
    beginInvite: () => ctl.beginInvite(),
    inviteFailed: () => void ctl.inviteFailed(),
    handoffReady: () => {
      // A room on another origin cannot hand its SDK login to this page.
      if (iframeOrigin !== location.origin) void ctl.crossOriginRoom()
    },
    resume: () => ctl.resume(),
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
