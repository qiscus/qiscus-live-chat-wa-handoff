// SYNTHETIC: per-app push config from qismo-api (GET /api/v2/live_handover/push_config).
// The backend is a fake fetch; Firebase values are invented.
import { describe, expect, test } from "bun:test"
import type { PushConfig } from "../push/config"
import { appScope, fetchAppPushConfig, parseAppPushConfig, parseBaseUrl, resolveAppConfig } from "./appConfig"

const API_KEY = "AIza" + "B".repeat(35)

async function vapid(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
  return Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("base64url")
}

async function goodBody(over: Record<string, unknown> = {}) {
  return {
    status: "configured",
    firebase: { apiKey: API_KEY, authDomain: "app-two.firebaseapp.com", projectId: "app-two-project", messagingSenderId: "222222222222", appId: "1:222222222222:web:abcdef012345" },
    vapidKey: await vapid(),
    ...over,
  }
}

describe("parseBaseUrl: same allowlist as widget.html", () => {
  test("accepts Qiscus https hosts and localhost, returns the bare origin", () => {
    expect(parseBaseUrl("https://qismo.qiscus.com")).toBe("https://qismo.qiscus.com")
    expect(parseBaseUrl("https://qismo-stag2.qiscus.io/some/path?x=1")).toBe("https://qismo-stag2.qiscus.io")
    expect(parseBaseUrl("http://localhost:8080")).toBe("http://localhost:8080")
  })
  test("refuses foreign hosts, lookalikes and plain http", () => {
    for (const bad of ["https://evil.example", "https://qiscus.com.evil.example", "http://qismo.qiscus.com", "https://notqiscus.com", "javascript:alert(1)", "", "not a url"]) {
      expect(parseBaseUrl(bad)).toBeNull()
    }
  })
})

describe("parseAppPushConfig: validates with the Worker's own rules", () => {
  test("a good body becomes firebase + vapidKey only", async () => {
    const body = await goodBody({ extra: "ignored", firebase: { ...(await goodBody()).firebase, measurementId: "G-IGNORED" } })
    const cfg = parseAppPushConfig(body)
    expect(cfg).not.toBeNull()
    expect(Object.keys(cfg!).sort()).toEqual(["firebase", "vapidKey"])
    expect(cfg!.firebase).toEqual({ apiKey: API_KEY, authDomain: "app-two.firebaseapp.com", projectId: "app-two-project", messagingSenderId: "222222222222", appId: "1:222222222222:web:abcdef012345" })
  })
  test("authDomain is optional", async () => {
    const good = await goodBody()
    const { authDomain: _drop, ...firebase } = good.firebase
    expect(parseAppPushConfig({ ...good, firebase })?.firebase.authDomain).toBeUndefined()
  })
  test("unconfigured, wrong status, non-objects -> null", async () => {
    expect(parseAppPushConfig({ status: "unconfigured" })).toBeNull()
    expect(parseAppPushConfig({ ...(await goodBody()), status: "ok" })).toBeNull()
    for (const v of [null, undefined, "x", 42, [], {}]) expect(parseAppPushConfig(v)).toBeNull()
  })
  test("each malformed or missing field -> null (no half-configured push)", async () => {
    const good = await goodBody()
    const bad = (fb: Record<string, unknown>) => parseAppPushConfig({ ...good, firebase: { ...good.firebase, ...fb } })
    expect(bad({ apiKey: "nope" })).toBeNull()
    expect(bad({ apiKey: undefined })).toBeNull()
    expect(bad({ projectId: "X" })).toBeNull()
    expect(bad({ messagingSenderId: "12" })).toBeNull()
    expect(bad({ appId: "1:222222222222:ios:abcdef012345" })).toBeNull()
    expect(bad({ appId: "1:999999999999:web:abcdef012345" })).toBeNull() // another project's number
    expect(bad({ authDomain: "not a host" })).toBeNull()
    expect(bad({ projectId: 12345 })).toBeNull()
    expect(parseAppPushConfig({ ...good, vapidKey: "short" })).toBeNull()
    expect(parseAppPushConfig({ ...good, vapidKey: undefined })).toBeNull()
    expect(parseAppPushConfig({ ...good, firebase: null })).toBeNull()
  })
})

describe("fetchAppPushConfig", () => {
  const ok = async (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

  test("asks the validated base host for this app code, with no credentials", async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return ok(await goodBody())
    }) as unknown as typeof fetch
    const cfg = await fetchAppPushConfig(f, "https://qismo-stag2.qiscus.io", "app_two-9")
    expect(cfg?.firebase.projectId).toBe("app-two-project")
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe("https://qismo-stag2.qiscus.io/api/v2/live_handover/push_config?app_code=app_two-9")
    expect(calls[0]!.init.credentials).toBe("omit")
  })
  test("a malformed app code never reaches the network", async () => {
    let n = 0
    const f = (async () => (n++, ok({}))) as unknown as typeof fetch
    for (const bad of ["", "a b", "../x", "a&b=1", "x".repeat(65)]) expect(await fetchAppPushConfig(f, "https://qismo.qiscus.com", bad)).toBeNull()
    expect(n).toBe(0)
  })
  test("unconfigured, 400, 5xx, garbage JSON, thrown fetch -> null", async () => {
    const run = (f: unknown) => fetchAppPushConfig(f as typeof fetch, "https://qismo.qiscus.com", "app1")
    expect(await run(async () => ok({ status: "unconfigured" }))).toBeNull()
    expect(await run(async () => ok({ error: "bad app_code" }, 400))).toBeNull()
    expect(await run(async () => ok(await goodBody(), 503))).toBeNull()
    expect(await run(async () => new Response("<html>", { status: 200 }))).toBeNull()
    expect(await run(async () => ok({ ...(await goodBody()), vapidKey: "bad" }))).toBeNull()
    expect(await run(async () => Promise.reject(new TypeError("offline")))).toBeNull()
  })
  test("a backend that hangs cannot hold the room hostage: gives up after the timeout", async () => {
    const f = ((_url: string, init: RequestInit) =>
      new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))) as unknown as typeof fetch
    const t0 = Date.now()
    expect(await fetchAppPushConfig(f, "https://qismo.qiscus.com", "app1", 50)).toBeNull()
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})

describe("resolveAppConfig: precedence", () => {
  const envConfigured = (over: Record<string, unknown> = {}): PushConfig => ({
    status: "configured",
    firebase: { apiKey: "AIza" + "E".repeat(35), projectId: "env-project", messagingSenderId: "111111111111", appId: "1:111111111111:web:abcdef012345" },
    vapidKey: "env-vapid",
    appCodes: ["weaper"],
    ...over,
  }) as PushConfig
  const envOff: PushConfig = { status: "unconfigured", missing: ["FIREBASE_API_KEY"], invalid: [] }
  const be = { firebase: { apiKey: API_KEY, projectId: "app-two-project", messagingSenderId: "222222222222", appId: "1:222222222222:web:abcdef012345" }, vapidKey: "be-vapid" }

  test("backend config wins over env, enables exactly that app and scopes the service worker per app", () => {
    const r = resolveAppConfig(envConfigured(), be, "app2")
    expect(r).toMatchObject({ status: "configured", firebase: be.firebase, vapidKey: "be-vapid", appCodes: ["app2"], source: "backend", swScope: "/a/app2/" })
  })
  test("backend wins even when env PUSH_APP_CODES does not list the app", () => {
    expect(resolveAppConfig(envConfigured({ appCodes: ["weaper"] }), be, "app2").status).toBe("configured")
  })
  test("no backend config -> the env result, untouched (Weaper keeps the root scope)", () => {
    const env = envConfigured()
    expect(resolveAppConfig(env, null, "weaper")).toBe(env)
    expect(resolveAppConfig(envOff, null, "weaper")).toBe(envOff)
  })
})

describe("appScope", () => {
  test("one scope per app code, under /a/", () => {
    expect(appScope("app2")).toBe("/a/app2/")
    expect(appScope("a_b-C9")).toBe("/a/a_b-C9/")
    expect(appScope("app2", "/api/v2/live_handover/w/")).toBe("/api/v2/live_handover/w/a/app2/")
  })
})
