// SYNTHETIC: qismo-api's GET /api/v2/live_handover/push_config is a fake fetch
// answering the shapes in CONTRACT.md. Firebase values are invented.
import { describe, expect, test } from "bun:test"
import type { PushConfig } from "../push/config"
import { APP_CONFIG_TIMEOUT_MS, PUSH_CONFIG_PATH, appScope, fetchAppPushConfig, parseAppPushConfig, resolveAppConfig } from "./appConfig"

async function vapid(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
  return Buffer.from(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))).toString("base64url")
}

const FIREBASE = {
  apiKey: "AIza" + "B".repeat(35),
  authDomain: "synthetic-backend.firebaseapp.com",
  projectId: "synthetic-backend",
  messagingSenderId: "222222222222",
  appId: "1:222222222222:web:0123456789abcdef",
}
const API = "https://qismo-stag4.qiscus.io"

const ENV: PushConfig = {
  status: "configured",
  firebase: { apiKey: "AIza" + "S".repeat(35), projectId: "synthetic-project", messagingSenderId: "123456789012", appId: "1:123456789012:web:abcdef0123456789" },
  vapidKey: "env-vapid",
  appCodes: ["other-app"],
  roomOrigins: ["https://omnichannel.qiscus.com"],
}

function fakeFetch(answer: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = (async (input: string, init: RequestInit) => {
    calls.push({ url: input, init })
    return answer(new URL(input), init)
  }) as unknown as typeof fetch
  return { fn, calls }
}

describe("parseAppPushConfig (contract shapes)", () => {
  test("configured with vapidKey", async () => {
    const key = await vapid()
    expect(parseAppPushConfig({ status: "configured", firebase: FIREBASE, vapidKey: key })).toEqual({ firebase: FIREBASE, vapidKey: key })
  })

  test("configured without vapidKey (default VAPID) and without authDomain", () => {
    const { authDomain: _, ...fb } = FIREBASE
    expect(parseAppPushConfig({ status: "configured", firebase: fb })).toEqual({ firebase: fb })
    expect(parseAppPushConfig({ status: "configured", firebase: fb, vapidKey: null })).toEqual({ firebase: fb })
  })

  test("unconfigured, invalid and junk are not a config", () => {
    for (const body of [{ status: "unconfigured" }, { status: "invalid" }, null, "configured", [], { status: "configured" }, { status: "configured", firebase: "x" }]) {
      expect(parseAppPushConfig(body)).toBeNull()
    }
  })

  test("every field is checked with the Worker env rules", async () => {
    const bad: Record<string, unknown>[] = [
      { apiKey: "nope" },
      { apiKey: undefined },
      { projectId: "Bad_Project" },
      { messagingSenderId: "12" },
      { appId: "1:999999999999:web:0123456789abcdef" }, // project number != sender id
      { appId: "2:222222222222:ios:abc" },
      { authDomain: "not a host" },
      { apiKey: 42 },
    ]
    for (const over of bad) expect(parseAppPushConfig({ status: "configured", firebase: { ...FIREBASE, ...over } })).toBeNull()
    expect(parseAppPushConfig({ status: "configured", firebase: FIREBASE, vapidKey: "not-a-p256-point" })).toBeNull()
    expect(parseAppPushConfig({ status: "configured", firebase: FIREBASE, vapidKey: 7 })).toBeNull()
  })

  test("only the public fields are kept", () => {
    const parsed = parseAppPushConfig({ status: "configured", firebase: { ...FIREBASE, private_key: "x" }, reason: "y", id: 1 })
    expect(parsed).toEqual({ firebase: FIREBASE })
  })
})

describe("fetchAppPushConfig (synthetic qismo-api)", () => {
  test("GET {baseUrl}/api/v2/live_handover/push_config?app_code=..., credentials omitted, abortable", async () => {
    const key = await vapid()
    const f = fakeFetch(() => Response.json({ status: "configured", firebase: FIREBASE, vapidKey: key }))
    expect(await fetchAppPushConfig(f.fn, API, "app_1-X")).toEqual({ firebase: FIREBASE, vapidKey: key })
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]!.url).toBe(`${API}${PUSH_CONFIG_PATH}?app_code=app_1-X`)
    expect(f.calls[0]!.init.credentials).toBe("omit")
    expect(f.calls[0]!.init.signal).toBeInstanceOf(AbortSignal)
    expect(APP_CONFIG_TIMEOUT_MS).toBe(4000)
  })

  test("unconfigured, 400, 5xx, invalid JSON and network errors give null (env fallback)", async () => {
    const answers: (() => Response | Promise<Response>)[] = [
      () => Response.json({ status: "unconfigured" }),
      () => Response.json({ status: "invalid" }, { status: 400 }),
      () => new Response("oops", { status: 502 }),
      () => new Response("not json", { status: 200 }),
      () => Response.json({ status: "configured", firebase: FIREBASE }, { status: 201 }),
      () => Promise.reject(new TypeError("Failed to fetch")),
    ]
    for (const a of answers) expect(await fetchAppPushConfig(fakeFetch(a).fn, API, "app1")).toBeNull()
  })

  test("times out (abort) and falls back", async () => {
    const f = fakeFetch(
      (_u, init) =>
        new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    )
    const started = Date.now()
    expect(await fetchAppPushConfig(f.fn, API, "app1", undefined, 30)).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  test("asks only an allowlisted qismo origin, and only for a valid app code", async () => {
    const f = fakeFetch(() => Response.json({ status: "configured", firebase: FIREBASE }))
    for (const host of ["https://evil.example", "https://user-content.qiscus.io", "http://qismo.qiscus.com", "https://qismo.qiscus.com/path"]) {
      expect(await fetchAppPushConfig(f.fn, host, "app1")).toBeNull()
    }
    for (const code of ["", "a/b", "a b", "x".repeat(65), "../x"]) expect(await fetchAppPushConfig(f.fn, API, code)).toBeNull()
    expect(f.calls).toEqual([])
  })
})

describe("resolveAppConfig (precedence)", () => {
  test("a backend answer wins, counts as enabled for the app, keeps env room origins, own scope", () => {
    const cfg = resolveAppConfig(ENV, { firebase: FIREBASE }, "app1", "/")
    expect(cfg).toEqual({
      status: "configured",
      firebase: FIREBASE,
      appCodes: ["app1"],
      roomOrigins: ["https://omnichannel.qiscus.com"],
      swScope: "/a/app1/",
    })
    expect("vapidKey" in cfg).toBe(false)
  })

  test("with a custom VAPID key and with no usable env", () => {
    const cfg = resolveAppConfig({ status: "unconfigured", missing: ["FIREBASE_API_KEY"], invalid: [] }, { firebase: FIREBASE, vapidKey: "k" }, "app1", "/w/")
    expect(cfg).toMatchObject({ status: "configured", vapidKey: "k", roomOrigins: [], swScope: "/w/a/app1/" })
  })

  test("no backend answer: the env config untouched", () => {
    expect(resolveAppConfig(ENV, null, "app1", "/")).toBe(ENV)
  })

  test("appScope", () => {
    expect(appScope("/", "app1")).toBe("/a/app1/")
    expect(appScope("/api/v2/live_handover/w/", "app1")).toBe("/api/v2/live_handover/w/a/app1/")
  })
})
