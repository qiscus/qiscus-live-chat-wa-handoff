// SYNTHETIC: the container entrypoint against a throwaway public/ tree and
// invented env values. No Cloudflare, Qiscus or Firebase call is made.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHandler } from "./server"

let dir: string
let handle: (req: Request) => Promise<Response>
const get = (path: string, headers: Record<string, string> = {}) =>
  handle(new Request(`http://localhost${path}`, { headers }))

beforeAll(() => {
  dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "handoff-static-"))
  mkdirSync(join(dir, "js"))
  mkdirSync(join(dir, "sub"))
  writeFileSync(join(dir, "widget.html"), "<html>widget</html>")
  writeFileSync(join(dir, "live-handover-room.html"), "<html>room</html>")
  writeFileSync(join(dir, "sw.js"), "// service worker " + "x".repeat(2000))
  writeFileSync(join(dir, "js", "a.js"), "console.log(1)")
  writeFileSync(join(dir, "sub", "index.html"), "<html>index</html>")
  handle = createHandler(dir, { UNRELATED_SECRET: "must-not-leak" })
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe("static files (same behaviour as the Worker asset layer)", () => {
  test("html is served literally, no redirect, with revalidation headers and an ETag", async () => {
    const res = await get("/widget.html")
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/html")
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate")
    expect(await res.text()).toBe("<html>widget</html>")
    expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{32}"$/)
  })

  test("If-None-Match gets a 304 without a body", async () => {
    const etag = (await get("/js/a.js")).headers.get("etag")!
    const res = await get("/js/a.js", { "if-none-match": etag })
    expect(res.status).toBe(304)
    expect(await res.text()).toBe("")
  })

  test("gzip only when the client accepts it, and it round-trips", async () => {
    const plain = await get("/sw.js")
    expect(plain.headers.get("content-encoding")).toBeNull()
    const gz = await get("/sw.js", { "accept-encoding": "gzip, br" })
    expect(gz.headers.get("content-encoding")).toBe("gzip")
    expect(gz.headers.get("vary")).toContain("Accept-Encoding")
    expect(Bun.gunzipSync(new Uint8Array(await gz.arrayBuffer())).length).toBe((await plain.text()).length)
  })

  test("no directory index, no .html stripping, no path traversal", async () => {
    expect((await get("/sub/")).status).toBe(404)
    expect((await get("/sub")).status).toBe(404)
    expect((await get("/widget")).status).toBe(404)
    for (const bad of ["/../package.json", "/%2e%2e/package.json", "/js/../../package.json", "/%00", "/%E0%A4%A"])
      expect((await get(bad)).status).toBe(404)
  })

  test("HEAD has headers and no body; POST is refused", async () => {
    const head = await handle(new Request("http://localhost/widget.html", { method: "HEAD" }))
    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")
    expect((await handle(new Request("http://localhost/widget.html", { method: "POST" }))).status).toBe(404)
  })
})

describe("app routes behind the static layer", () => {
  test("/ is the landing page", async () => {
    const res = await get("/")
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("Live Handover Widget")
  })

  test("/push/config reads process env and leaks nothing else", async () => {
    const res = await get("/push/config")
    expect(res.headers.get("cache-control")).toBe("no-store")
    const text = await res.text()
    expect(JSON.parse(text).status).toBe("unconfigured")
    expect(text).not.toContain("must-not-leak")
  })

  test("per-app service worker: scoped, never cached, bad app code refused", async () => {
    const res = await get("/a/some-app_1/sw.js")
    expect(res.status).toBe(200)
    expect(res.headers.get("service-worker-allowed")).toBeNull()
    expect(res.headers.get("cache-control")).toBe("no-cache")
    expect((await res.text()).startsWith("// service worker")).toBe(true)
    expect((await get("/a/bad%20code/sw.js")).status).toBe(404)
  })

  test("room route maps to the static room page, query kept", async () => {
    const res = await get("/iframes/v5/some-app/live-handover-room?x=1")
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("<html>room</html>")
  })

  test("unknown path is a plain 404", async () => {
    expect((await get("/nope")).status).toBe(404)
  })
})
