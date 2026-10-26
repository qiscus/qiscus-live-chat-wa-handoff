// SYNTHETIC: Worker routes exercised with an in-memory ASSETS fetcher and
// invented push env values. No Cloudflare, Qiscus or Firebase call is made.
import { describe, expect, test } from "bun:test"
import app from "./worker"

const fakeAssets = {
  fetch: async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200 }),
} as unknown as Fetcher

async function vapid(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair
  return Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("base64url")
}

describe("GET /push/config (synthetic)", () => {
  test("unconfigured Worker says so, with missing names and no-store", async () => {
    const res = await app.request("/push/config", {}, { ASSETS: fakeAssets })
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
    const body = (await res.json()) as { status: string; missing: string[] }
    expect(body.status).toBe("unconfigured")
    expect(body.missing).toContain("FIREBASE_VAPID_KEY")
  })

  test("configured Worker returns only the public web config", async () => {
    const env = {
      ASSETS: fakeAssets,
      FIREBASE_API_KEY: "AIza" + "S".repeat(35),
      FIREBASE_PROJECT_ID: "synthetic-project",
      FIREBASE_MESSAGING_SENDER_ID: "123456789012",
      FIREBASE_APP_ID: "1:123456789012:web:abcdef0123456789",
      FIREBASE_VAPID_KEY: await vapid(),
      UNRELATED_SECRET: "must-not-leak",
    }
    const res = await app.request("/push/config", {}, env)
    const text = await res.text()
    expect(JSON.parse(text).status).toBe("configured")
    expect(text).not.toContain("must-not-leak")
  })

  test("only GET is routed", async () => {
    const res = await app.request("/push/config", { method: "POST" }, { ASSETS: fakeAssets })
    expect(res.status).toBe(404)
  })
})

describe("existing routes still work (synthetic)", () => {
  test("hosted room path maps to the static room page", async () => {
    const res = await app.request("/iframes/v5/someapp/live-handover-room?x=1", {}, { ASSETS: fakeAssets })
    expect(await res.text()).toBe("asset:/live-handover-room.html")
  })

  test("landing page still renders", async () => {
    const res = await app.request("/", {}, { ASSETS: fakeAssets })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain("Live Handover Widget")
  })
})

describe("GET /a/:appCode/sw.js: one service-worker scope per app (synthetic)", () => {
  test("serves the same worker script under the app's own path, scoped to it and never cached", async () => {
    const res = await app.request("/a/app-two_9/sw.js", {}, { ASSETS: fakeAssets })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("asset:/sw.js")
    expect(res.headers.get("service-worker-allowed")).toBeNull() // the script directory is already the scope
    expect(res.headers.get("cache-control")).toBe("no-cache")
    expect(res.headers.get("content-type")).toContain("javascript")
  })

  test("a malformed app code or any other file under /a/ is a plain 404", async () => {
    for (const path of ["/a/app%20two/sw.js", `/a/${"x".repeat(65)}/sw.js`, "/a/../sw.js", "/a/app2/other.js", "/a/app2/", "/a//sw.js", "/a/app2/sw.js/x"]) {
      const res = await app.request(path, {}, { ASSETS: fakeAssets })
      expect(res.status).toBe(404)
    }
  })

  test("a missing underlying asset is not turned into a script", async () => {
    const missing = { fetch: async () => new Response("nope", { status: 404 }) } as unknown as Fetcher
    expect((await app.request("/a/app2/sw.js", {}, { ASSETS: missing })).status).toBe(404)
  })
})
