// src/server.ts against the real public/ on an ephemeral port. The paths are
// the ones compared byte-for-byte with live-widget.qiscus.com (Cloudflare)
// before the Kubernetes cutover. No network call leaves the machine.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { brotliDecompressSync, gunzipSync } from "node:zlib"
import { etagMatches, pickEncoding, startServer } from "./server"

const PUBLIC_DIR = join(import.meta.dir, "..", "public")
let server: ReturnType<typeof startServer>
let base: string

beforeAll(() => {
  server = startServer({ port: 0, publicDir: PUBLIC_DIR, env: {} })
  base = `http://127.0.0.1:${server.port}`
})
afterAll(() => server.stop(true))

// Bun's fetch would otherwise ask for and transparently decode br/gzip.
const get = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  fetch(base + path, {
    method,
    headers: { "Accept-Encoding": "identity", ...headers },
    decompress: false,
  } as RequestInit)

const STATIC_PATHS = [
  "/widget.html",
  "/offline.html",
  "/sw.js",
  "/manifest.webmanifest",
  "/live-handover-room.html",
  "/css/qismo-latest-v5.css",
  "/css/qiscus-sdk.3.2.12.css",
  "/js/qismo-full-v5.js",
  "/js/qiscus-sdk.3.2.12.js",
]

describe("paths compared with Cloudflare", () => {
  for (const path of STATIC_PATHS) {
    test(`${path} is served as the file in public/`, async () => {
      const file = Bun.file(join(PUBLIC_DIR, path))
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
      expect(res.headers.get("content-length")).toBe(String(file.size))
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(await file.arrayBuffer()))
    })
  }

  test("/ comes from the Hono app", async () => {
    const res = await get("/")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
  })

  test("/push/config answers without push env", async () => {
    const res = await get("/push/config")
    expect(res.status).toBe(200)
    expect(((await res.json()) as { status: string }).status).toBe("unconfigured")
  })

  test("/iframes/v5/:appCode/live-handover-room maps to the static page", async () => {
    const res = await get("/iframes/v5/test-app/live-handover-room")
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(await Bun.file(join(PUBLIC_DIR, "live-handover-room.html")).text())
  })

  test("missing files and traversal are 404", async () => {
    for (const path of ["/index.html", "/health", "/js/", "/%2e%2e/package.json", "/js/%2e%2e/%2e%2e/package.json"]) {
      expect((await get(path)).status).toBe(404)
    }
  })
})

describe("revalidation", () => {
  test("strong, weak and listed ETags all get 304", async () => {
    const etag = (await get("/widget.html")).headers.get("etag")!
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/)
    for (const inm of [etag, `W/${etag}`, `"other", W/${etag}`, "*"]) {
      const res = await get("/widget.html", { "If-None-Match": inm })
      expect(res.status).toBe(304)
      expect(res.headers.get("etag")).toBe(etag)
    }
    expect((await get("/widget.html", { "If-None-Match": '"other"' })).status).toBe(200)
  })

  test("a compressed response's weak ETag revalidates to 304", async () => {
    const first = await get("/js/qiscus-sdk.3.2.12.js", { "Accept-Encoding": "gzip, br" })
    const etag = first.headers.get("etag")!
    expect(etag.startsWith('W/"')).toBe(true)
    const res = await get("/js/qiscus-sdk.3.2.12.js", { "Accept-Encoding": "gzip, br", "If-None-Match": etag })
    expect(res.status).toBe(304)
  })
})

describe("compression", () => {
  const path = "/js/qiscus-sdk.3.2.12.js"

  test("br is preferred and decodes to the original file", async () => {
    const original = new Uint8Array(await Bun.file(join(PUBLIC_DIR, path)).arrayBuffer())
    const res = await get(path, { "Accept-Encoding": "gzip, deflate, br" })
    expect(res.headers.get("content-encoding")).toBe("br")
    expect(res.headers.get("vary")).toBe("Accept-Encoding")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(Number(res.headers.get("content-length"))).toBe(body.byteLength)
    expect(body.byteLength).toBeLessThan(original.byteLength / 3)
    expect(new Uint8Array(brotliDecompressSync(body))).toEqual(original)
  })

  test("gzip when br is refused", async () => {
    const original = new Uint8Array(await Bun.file(join(PUBLIC_DIR, path)).arrayBuffer())
    const res = await get(path, { "Accept-Encoding": "br;q=0, gzip" })
    expect(res.headers.get("content-encoding")).toBe("gzip")
    expect(new Uint8Array(gunzipSync(new Uint8Array(await res.arrayBuffer())))).toEqual(original)
  })

  test("Hono responses are compressed too", async () => {
    const res = await get("/iframes/v5/test-app/live-handover-room", { "Accept-Encoding": "gzip" })
    expect(res.headers.get("content-encoding")).toBe("gzip")
    const html = gunzipSync(new Uint8Array(await res.arrayBuffer())).toString()
    expect(html).toBe(await Bun.file(join(PUBLIC_DIR, "live-handover-room.html")).text())
  })

  test("pickEncoding honours q-values and *", () => {
    expect(pickEncoding(null)).toBeNull()
    expect(pickEncoding("identity")).toBeNull()
    expect(pickEncoding("gzip")).toBe("gzip")
    expect(pickEncoding("gzip, br")).toBe("br")
    expect(pickEncoding("br;q=0, gzip;q=0.5")).toBe("gzip")
    expect(pickEncoding("*")).toBe("br")
    expect(pickEncoding("*;q=0")).toBeNull()
  })

  test("etagMatches uses weak comparison", () => {
    expect(etagMatches('W/"a"', '"a"')).toBe(true)
    expect(etagMatches('"b", W/"a"', '"a"')).toBe(true)
    expect(etagMatches('"b"', '"a"')).toBe(false)
    expect(etagMatches(null, '"a"')).toBe(false)
  })
})

describe("HEAD", () => {
  test("reports the size GET would send, with no body", async () => {
    for (const [path, enc] of [["/widget.html", "identity"], ["/js/qiscus-sdk.3.2.12.js", "br"]] as const) {
      const got = await get(path, { "Accept-Encoding": enc })
      const head = await get(path, { "Accept-Encoding": enc }, "HEAD")
      expect(head.status).toBe(200)
      expect(head.headers.get("content-length")).toBe(got.headers.get("content-length"))
      expect(Number(head.headers.get("content-length"))).toBeGreaterThan(0)
      expect((await head.arrayBuffer()).byteLength).toBe(0)
    }
  })
})
