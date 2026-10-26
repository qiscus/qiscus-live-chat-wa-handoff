/**
 * Turn a pasted WhatsApp invite link into the invite token, for the Home
 * Screen app on iOS (its storage is separate from Safari, so a session started
 * in Safari is not visible there). Accepts only:
 *
 *   https://<*.qiscus.com|*.qiscus.io>/c/<token>
 *   https://<*.qiscus.com|*.qiscus.io>/api/v2/live_handover/c/<token>
 *   <this origin>/widget.html#t=<token>
 *
 * The redirector does not consume the token and qismo-api resumes a reused
 * token within its session window, so re-exchanging it is the normal path.
 */
const TOKEN_RE = /^[A-Za-z0-9._~-]{16,4096}$/
const QISCUS_HOST = /(^|\.)qiscus\.(com|io)$/
const REDIRECT_PATH = /^\/(?:api\/v2\/live_handover\/)?c\/([^/]+)$/

export function parseInviteLink(input: string, selfOrigin: string, widgetPath = "/widget.html"): string | null {
  const raw = (input || "").trim()
  if (!raw || raw.length > 5000) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.origin === selfOrigin && url.pathname === widgetPath) {
    const m = /(?:^|&)t=([^&]+)/.exec(url.hash.slice(1))
    const token = m ? decodeURIComponent(m[1]!) : ""
    return TOKEN_RE.test(token) ? token : null
  }
  if (url.protocol !== "https:" || !QISCUS_HOST.test(url.hostname)) return null
  const m = REDIRECT_PATH.exec(url.pathname)
  if (!m) return null
  let token: string
  try {
    token = decodeURIComponent(m[1]!)
  } catch {
    return null
  }
  return TOKEN_RE.test(token) ? token : null
}

export interface InviteEnv {
  baseUrl?: string
}

function isLocal(url: URL): boolean {
  return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && /^https?:$/.test(url.protocol)
}

function isQiscusHttps(url: URL): boolean {
  return url.protocol === "https:" && QISCUS_HOST.test(url.hostname)
}

/**
 * The environment a pasted widget link points at (`baseUrl` = the qismo-api the
 * token belongs to). The Home Screen app starts at `/widget.html?source=pwa`,
 * without it, so a token minted on another environment would otherwise be
 * exchanged against the production default and refused. Same rule as
 * widget.html's `fromQuery`: only https Qiscus hosts (or localhost). The room
 * host is always this page's own origin, so a pasted `iframeUrl` is ignored.
 * Only this page's own link form can carry it; anything refused is dropped.
 */
export function parseInviteEnv(input: string, selfOrigin: string, widgetPath = "/widget.html"): InviteEnv {
  let url: URL
  try {
    url = new URL((input || "").trim())
  } catch {
    return {}
  }
  if (url.origin !== selfOrigin || url.pathname !== widgetPath) return {}
  const env: InviteEnv = {}
  const raw = url.searchParams.get("baseUrl")
  if (!raw) return env
  try {
    const u = new URL(raw, selfOrigin)
    if (isQiscusHttps(u) || isLocal(u)) env.baseUrl = u.origin
  } catch {}
  return env
}
