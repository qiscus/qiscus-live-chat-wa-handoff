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
import { pickApiOrigin, pickIframeUrl, pickSdkOrigin } from "./origins"

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
  sdkBaseUrl?: string
  iframeUrl?: string
}

/**
 * The environment a pasted widget link points at (`baseUrl` = the qismo-api the
 * token belongs to, `sdkBaseUrl` = the Qiscus SDK host (region) the identity
 * token is verified on, `iframeUrl` = the room host). The Home Screen app
 * starts at `/widget.html?source=pwa`, without these, so a token minted on
 * another environment or region would otherwise be exchanged against the
 * production default and refused. Each value goes through the same pickers as
 * widget.html's own query (origins.ts): exact allowlisted origins only, never a
 * wildcard over *.qiscus.com / *.qiscus.io. Only this page's own link form can
 * carry them; anything refused is dropped (the token is then used on defaults).
 */
export function parseInviteEnv(input: string, selfOrigin: string, widgetPath = "/widget.html"): InviteEnv {
  let url: URL
  try {
    url = new URL((input || "").trim())
  } catch {
    return {}
  }
  if (url.origin !== selfOrigin || url.pathname !== widgetPath) return {}
  const href = `${selfOrigin}${widgetPath}`
  // pick*() fall back to a default for an absent value; only a value that is
  // present and accepted is carried.
  const carry = (name: string, pick: (raw: string) => string | null): string | undefined => {
    const raw = url.searchParams.get(name)
    return raw ? (pick(raw) ?? undefined) : undefined
  }
  const baseUrl = carry("baseUrl", (raw) => pickApiOrigin(raw, href))
  const sdkBaseUrl = carry("sdkBaseUrl", (raw) => pickSdkOrigin(raw, href))
  const iframeUrl = carry("iframeUrl", (raw) => pickIframeUrl(raw, href))
  const env: InviteEnv = {}
  if (baseUrl) env.baseUrl = baseUrl
  if (sdkBaseUrl) env.sdkBaseUrl = sdkBaseUrl
  if (iframeUrl) env.iframeUrl = iframeUrl
  return env
}
