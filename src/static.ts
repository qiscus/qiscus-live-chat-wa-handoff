/**
 * Static file layer for running the widget outside Cloudflare (`src/server.ts`).
 *
 * On Cloudflare the Worker `assets` binding does this: it answers for any file in
 * `public/` before the Worker runs, and serves `.html` files literally
 * (`htmlHandling: "none"`, so `/widget.html#t=...` is never redirected and the
 * fragment token survives). This module reproduces that behaviour: exact file
 * match only (no directory index, no `.html` stripping, no redirects), the
 * default `Cache-Control: public, max-age=0, must-revalidate` + ETag, and gzip
 * for text types when the client accepts it.
 */
import { join, normalize, sep } from "node:path"

const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest\+json|xml)|image\/svg\+xml)/

export interface StaticAssets {
  /** Same contract as the Worker `ASSETS` binding: a Response, 404 when there is no such file. */
  fetch(req: Request): Promise<Response>
}

interface Entry {
  body: Uint8Array
  gzip: Uint8Array | null
  type: string
  etag: string
}

export function createStaticAssets(root: string): StaticAssets {
  const base = normalize(root.endsWith(sep) ? root : root + sep)
  // Files are immutable for the life of the process (the image is rebuilt to change them).
  const cache = new Map<string, Promise<Entry | null>>()

  async function load(rel: string): Promise<Entry | null> {
    const path = normalize(join(base, rel))
    if (!path.startsWith(base)) return null // path traversal
    const file = Bun.file(path)
    if (!(await file.exists())) return null
    const body = new Uint8Array(await file.arrayBuffer())
    const type = file.type || "application/octet-stream"
    const digest = new Bun.CryptoHasher("sha256").update(body).digest("hex").slice(0, 32)
    const gzip = COMPRESSIBLE.test(type) ? new Uint8Array(Bun.gzipSync(body)) : null
    return { body, gzip, type, etag: `"${digest}"` }
  }

  return {
    async fetch(req) {
      if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 })
      let rel: string
      try {
        rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, "")
      } catch {
        return new Response("Not found", { status: 404 })
      }
      if (!rel || rel.endsWith("/") || rel.includes("\0")) return new Response("Not found", { status: 404 })

      let pending = cache.get(rel)
      if (!pending) {
        pending = load(rel).catch(() => null)
        cache.set(rel, pending)
      }
      const entry = await pending
      if (!entry) {
        cache.delete(rel) // never remember misses: a probe must not grow the map
        return new Response("Not found", { status: 404 })
      }

      const headers = new Headers({
        "Content-Type": entry.type,
        "Cache-Control": "public, max-age=0, must-revalidate",
        ETag: entry.etag,
        Vary: "Accept-Encoding",
      })
      if (req.headers.get("if-none-match") === entry.etag) return new Response(null, { status: 304, headers })

      const useGzip = entry.gzip !== null && /\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")
      const body = useGzip ? entry.gzip! : entry.body
      if (useGzip) headers.set("Content-Encoding", "gzip")
      headers.set("Content-Length", String(body.byteLength))
      return new Response(req.method === "HEAD" ? null : (body as BodyInit), { status: 200, headers })
    },
  }
}
