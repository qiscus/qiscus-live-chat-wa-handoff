/**
 * Bun runtime for the live widget on Kubernetes (TKE), replacing the
 * Cloudflare Worker deploy without changing src/worker.ts.
 *
 * It mirrors what Cloudflare does in front of the Worker:
 * - a file that exists under public/ is served as-is (Workers assets with
 *   htmlHandling "none": /widget.html stays /widget.html, no redirect, so the
 *   #t=... invite fragment survives), with the same cache headers;
 * - every other request goes to the Hono app in worker.ts, whose `ASSETS`
 *   binding is emulated here (the live-handover-room route uses it);
 * - text responses are compressed (br, then gzip) the way Cloudflare's edge
 *   does, and a compressed response carries a weak ETag, as on Cloudflare;
 * - If-None-Match uses the weak comparison of RFC 9110 §13.1.2 and accepts a
 *   list, so revalidation still gets 304 when a proxy weakened the ETag;
 * - the public FCM config is read from the container env (same PUSH_ENV_KEYS
 *   the Alchemy deploy binds as plain_text).
 */
import { createHash } from "node:crypto"
import { join, normalize, sep } from "node:path"
import { brotliCompressSync, constants as zlib, gzipSync } from "node:zlib"
import app from "./worker"
import { PUSH_ENV_KEYS } from "./push/config"

type Encoding = "br" | "gzip"

// Below this size compression saves less than the headers it adds.
const MIN_COMPRESS_BYTES = 1024
const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|manifest\+json|xml|x-javascript)|image\/svg\+xml)/i
const ASSET_CACHE_CONTROL = "public, max-age=0, must-revalidate"
// Brotli 9 is within ~10% of 11 at a fraction of the time (qiscus-sdk.js:
// 133 ms vs 3.8 s); static files are compressed once and cached.
const STATIC_QUALITY = 9
const DYNAMIC_QUALITY = 5

/** Encoding to use for this request, br preferred, honouring q=0. */
export function pickEncoding(acceptEncoding: string | null): Encoding | null {
  if (!acceptEncoding) return null
  const q = new Map<string, number>()
  for (const part of acceptEncoding.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";")
    if (!name) continue
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
    const value = qp ? Number(qp.slice(2)) : 1
    q.set(name, Number.isNaN(value) ? 0 : value)
  }
  const weight = (enc: Encoding) => q.get(enc) ?? q.get("*") ?? 0
  if (weight("br") > 0) return "br"
  if (weight("gzip") > 0) return "gzip"
  return null
}

/** Weak comparison of an If-None-Match header (a list, or *) against an ETag. */
export function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  const opaque = (tag: string) => tag.trim().replace(/^W\//, "")
  const want = opaque(etag)
  return ifNoneMatch.split(",").some((tag) => tag.trim() === "*" || opaque(tag) === want)
}

type Bytes = Uint8Array<ArrayBuffer>

function compress(body: Bytes, enc: Encoding, quality: number): Bytes {
  const out = enc === "br"
    ? brotliCompressSync(body, {
        params: {
          [zlib.BROTLI_PARAM_QUALITY]: quality,
          [zlib.BROTLI_PARAM_SIZE_HINT]: body.byteLength,
        },
      })
    : gzipSync(body, { level: quality >= 9 ? 9 : 6 })
  return new Uint8Array(out)
}

const isCompressible = (type: string | null) => !!type && COMPRESSIBLE.test(type)

interface Asset {
  type: string
  etag: string
  body: Bytes
  encoded: Partial<Record<Encoding, Bytes>>
}

export interface ServerOptions {
  publicDir?: string
  env?: Record<string, string | undefined>
}

/** Request handler: public/ first, then the Hono app, then compression. */
export function createHandler(options: ServerOptions = {}): (req: Request) => Promise<Response> {
  const publicDir = normalize(options.publicDir ?? join(process.cwd(), "public"))
  const sourceEnv = options.env ?? process.env

  // public/ is baked into the image, so each file (and each compressed
  // variant) is read and hashed once.
  const assets = new Map<string, Asset>()

  async function loadAsset(full: string): Promise<Asset | null> {
    const cached = assets.get(full)
    if (cached) return cached
    const file = Bun.file(full)
    if (!(await file.exists())) return null
    const body = new Uint8Array(await file.arrayBuffer())
    const asset: Asset = {
      type: file.type,
      etag: `"${createHash("md5").update(body).digest("hex")}"`,
      body,
      encoded: {},
    }
    assets.set(full, asset)
    return asset
  }

  async function serveAsset(req: Request): Promise<Response | null> {
    if (req.method !== "GET" && req.method !== "HEAD") return null
    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url).pathname)
    } catch {
      return null
    }
    if (pathname.endsWith("/") || pathname.includes("\0")) return null
    const full = normalize(join(publicDir, pathname))
    if (!full.startsWith(publicDir + sep)) return null
    const asset = await loadAsset(full)
    if (!asset) return null

    const compressible = isCompressible(asset.type) && asset.body.byteLength >= MIN_COMPRESS_BYTES
    const enc = compressible ? pickEncoding(req.headers.get("Accept-Encoding")) : null
    const headers = new Headers({
      "Content-Type": asset.type,
      "Cache-Control": ASSET_CACHE_CONTROL,
      ETag: enc ? `W/${asset.etag}` : asset.etag,
    })
    if (compressible) headers.set("Vary", "Accept-Encoding")
    if (etagMatches(req.headers.get("If-None-Match"), asset.etag)) {
      return new Response(null, { status: 304, headers })
    }

    let body = asset.body
    if (enc) {
      body = asset.encoded[enc] ??= compress(asset.body, enc, STATIC_QUALITY)
      headers.set("Content-Encoding", enc)
    }
    headers.set("Content-Length", String(body.byteLength))
    return new Response(req.method === "HEAD" ? null : body, { headers })
  }

  const env: Record<string, unknown> = {
    ASSETS: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        (await serveAsset(new Request(input, init))) ?? new Response("Not found", { status: 404 }),
    },
  }
  for (const key of PUSH_ENV_KEYS) {
    const value = sourceEnv[key]?.trim()
    if (value) env[key] = value
  }

  // Responses built by the Hono app (HTML pages, JSON) are compressed per
  // request, as Cloudflare does for Worker responses.
  async function compressDynamic(req: Request, res: Response): Promise<Response> {
    if (!res.body || res.status === 204 || res.status === 206 || res.status === 304) return res
    if (res.headers.has("Content-Encoding") || !isCompressible(res.headers.get("Content-Type"))) return res
    const body = new Uint8Array(await res.arrayBuffer())
    const headers = new Headers(res.headers)
    headers.append("Vary", "Accept-Encoding")
    const enc = body.byteLength >= MIN_COMPRESS_BYTES ? pickEncoding(req.headers.get("Accept-Encoding")) : null
    let out = body
    if (enc) {
      out = compress(body, enc, DYNAMIC_QUALITY)
      headers.set("Content-Encoding", enc)
      const etag = headers.get("ETag")
      if (etag && !etag.startsWith("W/")) headers.set("ETag", `W/${etag}`)
    }
    headers.set("Content-Length", String(out.byteLength))
    const init = { status: res.status, statusText: res.statusText, headers }
    return new Response(req.method === "HEAD" ? null : out, init)
  }

  return async (req) => (await serveAsset(req)) ?? compressDynamic(req, await app.fetch(req, env))
}

export function startServer(options: ServerOptions & { port?: number } = {}) {
  return Bun.serve({
    port: options.port ?? Number(process.env.PORT ?? 8080),
    fetch: createHandler(options),
  })
}

if (import.meta.main) {
  const server = startServer()
  console.log(`live-widget listening on :${server.port}`)
  // `bun server.js` is PID 1 in the container, and the kernel does not end
  // PID 1 on a signal it has no handler for: without this a rollout waits the
  // whole terminationGracePeriodSeconds and then SIGKILLs the pod.
  let stopping = false
  const shutdown = (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`${signal} received, draining in-flight requests`)
    setTimeout(() => process.exit(0), 10_000).unref()
    void server.stop().finally(() => process.exit(0))
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}
