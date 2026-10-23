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

export function parseInviteLink(input: string, selfOrigin: string): string | null {
  const raw = (input || "").trim()
  if (!raw || raw.length > 5000) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.origin === selfOrigin && url.pathname === "/widget.html") {
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
  iframeUrl?: string
}

function isLocal(url: URL): boolean {
  return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && /^https?:$/.test(url.protocol)
}

function isQiscusHttps(url: URL): boolean {
  return url.protocol === "https:" && QISCUS_HOST.test(url.hostname)
}

/**
 * The environment a pasted widget link points at (`baseUrl` = the qismo-api the
 * token belongs to, `iframeUrl` = the room host). The Home Screen app starts at
 * `/widget.html?source=pwa`, without these, so a token minted on another
 * environment would otherwise be exchanged against the production default and
 * refused. Same rules as widget.html's `fromQuery`: baseUrl only on https
 * Qiscus hosts (or localhost); iframeUrl also on this page's own origin.
 * Only this page's own link form can carry them; anything refused is dropped.
 */
export function parseInviteEnv(input: string, selfOrigin: string): InviteEnv {
  let url: URL
  try {
    url = new URL((input || "").trim())
  } catch {
    return {}
  }
  if (url.origin !== selfOrigin || url.pathname !== "/widget.html") return {}
  const env: InviteEnv = {}
  const pick = (name: string, allowSelf: boolean): string | undefined => {
    const raw = url.searchParams.get(name)
    if (!raw) return undefined
    try {
      const u = new URL(raw, selfOrigin)
      if ((allowSelf && u.origin === selfOrigin) || isQiscusHttps(u) || isLocal(u)) return u.origin
    } catch {}
    return undefined
  }
  const baseUrl = pick("baseUrl", false)
  const iframeUrl = pick("iframeUrl", true)
  if (baseUrl) env.baseUrl = baseUrl
  if (iframeUrl) env.iframeUrl = iframeUrl
  return env
}
