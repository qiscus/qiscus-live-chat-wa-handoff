/**
 * The handoff page itself, bundled as /js/handoff-page.js. widget.html carries
 * no inline script (its CSP is `script-src 'self'`); this file reads the URL,
 * mounts QismoFull and wires push + resume:
 *
 *   widget.html?baseUrl=<qismo API>&sdkBaseUrl=<SDK API>&iframeUrl=<room host>#t=<invite>
 *
 * Every parameter is optional and must name an allowed host (origins.ts); an
 * unknown host stops the page instead of sending the invite or the identity
 * token anywhere else. The bundle is always this deployment's own
 * /js/qismo-full-v5.js: no query can load a script from another host. The
 * invite stays in the fragment, which never reaches a server.
 */
import { basePathOf } from "./base"
import { localizedText } from "./i18n"
import { type HandoffPushApi, LOCALE, debug, start } from "./main"
import { pickApiOrigin, pickIframeUrl, pickSdkOrigin } from "./origins"

/** Status keys the page can show; the copy lives in i18n.ts as `page.<key>` (EN/ID). */
export const MESSAGE_KEYS = [
  "missing_token",
  "already_used",
  "invalid_token",
  "session_over",
  "too_many_requests",
  "network_error",
  "invalid_script",
  "session_expired",
  "no_session",
  "unknown",
] as const
export type MessageKey = (typeof MESSAGE_KEYS)[number]

/** Status copy in the customer's browser language (navigator.languages, English fallback). */
export const pageText = (key: MessageKey | "connecting"): string => localizedText(LOCALE, `page.${key}`)
const isMessageKey = (key: string): key is MessageKey => (MESSAGE_KEYS as readonly string[]).includes(key)

export interface PageEnv {
  /** qismo-api: invite exchange and session calls. */
  baseUrl: string
  /** Qiscus SDK API of the same region: room login, push registration. */
  sdkBaseUrl: string
  /** Host of the room iframe (QismoFull appends /iframes/v5/...). */
  iframeUrl: string
  /** This deployment's QismoFull bundle. */
  scriptUrl: string
}

/** The page's settings from its URL, or null when a parameter names a host that is not allowed. */
export function resolveEnv(href: string): PageEnv | null {
  const q = new URL(href).searchParams
  const baseUrl = pickApiOrigin(q.get("baseUrl"), href)
  const sdkBaseUrl = pickSdkOrigin(q.get("sdkBaseUrl"), href)
  const iframeUrl = pickIframeUrl(q.get("iframeUrl"), href)
  if (!baseUrl || !sdkBaseUrl || !iframeUrl) return null
  return { baseUrl, sdkBaseUrl, iframeUrl, scriptUrl: new URL(`${basePathOf(href)}js/qismo-full-v5.js`, href).href }
}

interface QismoFullCtor {
  new (args: { target: HTMLElement; props: Record<string, unknown> }): unknown
}

function boot(): void {
  const statusEl = document.getElementById("handover-status") as HTMLElement
  const say = (key: MessageKey) => {
    statusEl.style.display = ""
    statusEl.textContent = pageText(key)
  }
  if (statusEl.style.display !== "none") statusEl.textContent = pageText("connecting")

  // QismoFull strips #t= from the address bar before exchanging it. Put it
  // back so the same link keeps working: a refresh, or "open in browser" from
  // an in-app browser (WhatsApp), which starts a new browser session with no
  // stored login, re-exchanges the token and qismo-api answers it as
  // "resumed" for as long as the session runs.
  const initialHash = location.hash
  const hasInvite = /(^|&)t=/.test(location.hash.slice(1))

  const env = resolveEnv(location.href)
  if (!env) return say("invalid_script")

  // Push + resume are optional: if they fail to start, the page still chats.
  let push: HandoffPushApi | null = null
  try {
    push = start({ iframeUrl: env.iframeUrl, sdkBaseUrl: env.sdkBaseUrl })
  } catch (e) {
    debug("push not started", String(e))
  }

  const mount = () => {
    const QismoFull = (window as unknown as { QismoFull?: QismoFullCtor }).QismoFull
    if (typeof QismoFull !== "function") return say("network_error")
    new QismoFull({
      target: document.body,
      props: {
        staging: false,
        // The bundle would otherwise read baseUrl/iframeUrl (and identity
        // fields) from the query itself, around the checks above.
        readQueryParams: false,
        options: { baseUrl: env.baseUrl, qismoIframeUrl: env.iframeUrl, sdkBaseUrl: env.sdkBaseUrl },
        onEvent: (event: { event_name?: string; code?: string }) => {
          if (event.event_name === "qiscus:handoff-ready") {
            statusEl.style.display = "none"
            push?.handoffReady()
          } else if (event.event_name === "qiscus:handoff-error") {
            statusEl.textContent = pageText(event.code && isMessageKey(event.code) ? event.code : "unknown")
            if (hasInvite) push?.inviteFailed()
          }
        },
      },
    })
    if (initialHash && !location.hash) history.replaceState(null, "", location.pathname + location.search + initialHash)
  }

  const startWidget = () => {
    const script = document.createElement("script")
    script.src = env.scriptUrl
    script.onload = mount
    script.onerror = () => say("network_error")
    document.head.appendChild(script)
  }

  if (hasInvite || !push) {
    // A new invite replaces whoever was signed in on this device.
    push?.beginInvite()
    startWidget()
  } else {
    // No invite: resume the stored session (refresh, notification click, Home
    // Screen launch). Never re-uses a consumed token.
    const p = push
    p.resume().then(
      (session) => {
        if (session) {
          p.mountResumeRoom(session, {
            onReady: () => (statusEl.style.display = "none"),
            onFailed: () => say("session_expired"),
          })
        } else if (p.offerPasteLink()) {
          say("no_session")
        } else {
          startWidget()
        }
      },
      () => startWidget(),
    )
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const name = e.data && typeof e.data === "object" ? (e.data as { event_name?: unknown }).event_name : null
    if (typeof name === "string") debug("handover message", name)
  })
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot)
  else boot()
}
