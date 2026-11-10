/**
 * The hosts the handoff page may be pointed at from its URL:
 *
 *   widget.html?baseUrl=<qismo API>&sdkBaseUrl=<Qiscus SDK API>&iframeUrl=<room host>#t=<invite>
 *
 * qismo-api builds that URL from its own deployment config (one widget
 * deployment serves every qismo environment and region). Anyone can craft such
 * a link, though, and `baseUrl` receives the invite while `sdkBaseUrl` receives
 * the identity token and the whole conversation. So each value must be an
 * exact origin from these lists; a wildcard over *.qiscus.com / *.qiscus.io
 * would also trust subdomains that host other people's content.
 *
 * The lists live in code on purpose: this repo deploys on every merge, so a new
 * region is a one-line change, and there is no per-environment config to drift.
 * Loopback hosts are accepted only while the page itself runs on loopback
 * (local development and the e2e suite).
 */

export const DEFAULT_API_ORIGIN = "https://qismo.qiscus.com"
export const DEFAULT_SDK_ORIGIN = "https://api3.qiscus.com"

/** qismo-api hosts. MCF hosts are listed too: they also serve the remote room. */
export const API_ORIGINS: readonly string[] = [
  "https://qismo.qiscus.com",
  "https://multichannel-api.qiscus.com",
  "https://multichannel-api-latest.qiscus.com",
  "https://multichannel.qiscus.com",
  "https://omnichannel.qiscus.com",
  // region MY: qismo-api's OC_BASE_URL there
  "https://omnichannel-my.qiscus.com",
]
/** qismo staging lanes: qismo-stag.qiscus.io, qismo-stag2.qiscus.io, ... */
const API_ORIGIN_PATTERNS: readonly RegExp[] = [/^https:\/\/qismo-stag\d*\.qiscus\.io$/]

/** Qiscus SDK hosts, one per region (ID, MY). */
export const SDK_ORIGINS: readonly string[] = ["https://api3.qiscus.com", "https://api-my.qiscus.com"]

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"])

function pageHref(href?: string): string | undefined {
  if (href) return href
  return typeof location === "undefined" ? undefined : location.href
}

function isLoopbackDev(url: URL, href?: string): boolean {
  const page = pageHref(href)
  if (!page) return false
  let pageUrl: URL
  try {
    pageUrl = new URL(page)
  } catch {
    return false
  }
  return LOOPBACK.has(pageUrl.hostname) && LOOPBACK.has(url.hostname) && (url.protocol === "http:" || url.protocol === "https:")
}

/** The origin of `raw` if it is a plain http(s) URL with no credentials, else null. */
function originOf(raw: string, href?: string): URL | null {
  try {
    const url = new URL(raw, pageHref(href))
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

export function isApiOrigin(origin: string, href?: string): boolean {
  const url = originOf(origin, href)
  if (!url || url.origin !== origin) return false
  return API_ORIGINS.includes(origin) || API_ORIGIN_PATTERNS.some((p) => p.test(origin)) || isLoopbackDev(url, href)
}

export function isSdkOrigin(origin: string, href?: string): boolean {
  const url = originOf(origin, href)
  if (!url || url.origin !== origin) return false
  return SDK_ORIGINS.includes(origin) || isLoopbackDev(url, href)
}

/**
 * A query value as an allowed origin: the default when absent or empty, null
 * when present but not allowed (the caller refuses to start).
 */
function pick(raw: string | null | undefined, fallback: string, allowed: (origin: string) => boolean, href?: string): string | null {
  if (raw == null || raw === "") return fallback
  const url = originOf(raw, href)
  if (!url) return null
  return allowed(url.origin) ? url.origin : null
}

export function pickApiOrigin(raw: string | null | undefined, href?: string): string | null {
  return pick(raw, DEFAULT_API_ORIGIN, (o) => isApiOrigin(o, href), href)
}

export function pickSdkOrigin(raw: string | null | undefined, href?: string): string | null {
  return pick(raw, DEFAULT_SDK_ORIGIN, (o) => isSdkOrigin(o, href), href)
}

/**
 * Where the room iframe is loaded from (QismoFull appends
 * `/iframes/v5/<app>/live-handover-room`). Default: this deployment, next to
 * widget.html, so the room and its UI bundle ship with the page. An override
 * may only name this origin or a qismo/MCF host.
 */
export function pickIframeUrl(raw: string | null | undefined, href: string): string | null {
  const own = new URL(".", href).href.replace(/\/$/, "")
  if (raw == null || raw === "") return own
  const url = originOf(raw, href)
  if (!url) return null
  if (url.origin === new URL(href).origin) return url.origin
  return isApiOrigin(url.origin, href) ? url.origin : null
}
