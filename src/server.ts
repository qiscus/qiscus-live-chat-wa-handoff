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
 * - the public FCM config is read from the container env (same PUSH_ENV_KEYS
 *   the Alchemy deploy binds as plain_text).
 */
import { createHash } from "node:crypto"
import { join, normalize, sep } from "node:path"
import app from "./worker"
import { PUSH_ENV_KEYS } from "./push/config"

const PUBLIC_DIR = normalize(process.env.PUBLIC_DIR ?? join(process.cwd(), "public"))
const PORT = Number(process.env.PORT ?? 8080)

// public/ is baked into the image, so each file's ETag is computed once.
const etags = new Map<string, string>()

async function serveAsset(req: Request): Promise<Response | null> {
  if (req.method !== "GET" && req.method !== "HEAD") return null
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(req.url).pathname)
  } catch {
    return null
  }
  if (pathname.endsWith("/") || pathname.includes("\0")) return null
  const full = normalize(join(PUBLIC_DIR, pathname))
  if (!full.startsWith(PUBLIC_DIR + sep)) return null
  const file = Bun.file(full)
  if (!(await file.exists())) return null

  let etag = etags.get(full)
  if (!etag) {
    etag = `"${createHash("md5").update(new Uint8Array(await file.arrayBuffer())).digest("hex")}"`
    etags.set(full, etag)
  }
  const headers = new Headers({
    "Content-Type": file.type,
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: etag,
  })
  if (req.headers.get("If-None-Match") === etag) return new Response(null, { status: 304, headers })
  return new Response(req.method === "HEAD" ? null : file, { headers })
}

const env: Record<string, unknown> = {
  ASSETS: {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
      (await serveAsset(new Request(input, init))) ?? new Response("Not found", { status: 404 }),
  },
}
for (const key of PUSH_ENV_KEYS) {
  const value = process.env[key]?.trim()
  if (value) env[key] = value
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    return (await serveAsset(req)) ?? app.fetch(req, env)
  },
})
console.log(`live-widget listening on :${PORT}, public dir ${PUBLIC_DIR}`)
