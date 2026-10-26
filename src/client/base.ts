/**
 * The URL path prefix this app is served under, always with a trailing slash:
 * "/" on its own domain, e.g. "/api/v2/live_handover/w/" when another server
 * (qismo-api) reverse-proxies it under a sub-path. Every URL the page builds
 * for itself (service worker, scopes, room iframe, resume link) goes through
 * this, so the same build works at a domain root and under a prefix.
 *
 * It is derived from where the page itself was loaded: the directory of
 * `widget.html`, which is the only entry point, so nothing needs configuring.
 */
export function basePathOf(href: string): string {
  const path = new URL(".", href).pathname
  return path.endsWith("/") ? path : `${path}/`
}
