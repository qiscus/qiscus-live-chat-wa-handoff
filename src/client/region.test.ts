// The page's settings from its URL (origins.ts, page.ts) and the SDK host (region)
// that follows the customer's login: room, resume, push registration.
import { describe, expect, test } from "bun:test"
import { DEFAULT_SDK_ORIGIN, pickApiOrigin, pickIframeUrl, pickSdkOrigin } from "./origins"
import { resolveEnv } from "./page"
import { roomSdkOrigin } from "./room"
import { removeDeviceToken, setDeviceToken, verifyIdentityToken } from "./sdkDeviceToken"
import { SESSION_KEY, loadSession, saveSession } from "./session"

const LIVE = "https://live-widget.qiscus.com"
const STAGING = "https://live-widget-staging.qiscus.com"
const MY = "https://api-my.qiscus.com"
const page = (host: string, q: Record<string, string>) => `${host}/widget.html?${new URLSearchParams(q)}#t=synthetic`

function memory() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
function recorder(body: unknown = { results: { user: { email: "c@example.invalid", token: "sdk-token" } } }) {
  const calls: string[] = []
  const f = (async (url: string) => {
    calls.push(String(url))
    return new Response(JSON.stringify(body), { status: 200 })
  }) as unknown as typeof fetch
  return { f, calls }
}
const user = { email: "c@example.invalid", token: "sdk-token" }

describe("page settings from the URL", () => {
  test("qismo-api's hosted URL: each staging lane, its own API, one widget host", () => {
    for (const n of ["", "1", "2", "4", "8"]) {
      const api = `https://qismo-stag${n}.qiscus.io`
      expect(resolveEnv(page(STAGING, { baseUrl: api, iframeUrl: STAGING }))).toEqual({
        baseUrl: api,
        sdkBaseUrl: DEFAULT_SDK_ORIGIN,
        iframeUrl: STAGING,
        scriptUrl: `${STAGING}/js/qismo-full-v5.js`,
      })
    }
  })

  test("region MY: its qismo-api host is allowed", () => {
    const env = resolveEnv(page(LIVE, { baseUrl: "https://omnichannel-my.qiscus.com" }))
    expect(env?.baseUrl).toBe("https://omnichannel-my.qiscus.com")
  })

  test("region MY: the SDK host comes from sdkBaseUrl", () => {
    const env = resolveEnv(page(LIVE, { baseUrl: "https://multichannel-api.qiscus.com", sdkBaseUrl: MY }))
    expect(env?.sdkBaseUrl).toBe(MY)
  })

  test("defaults: production API, ID SDK, the room next to this page", () => {
    expect(resolveEnv(`${LIVE}/widget.html#t=x`)).toEqual({
      baseUrl: "https://qismo.qiscus.com",
      sdkBaseUrl: DEFAULT_SDK_ORIGIN,
      iframeUrl: LIVE,
      scriptUrl: `${LIVE}/js/qismo-full-v5.js`,
    })
  })

  test("a host outside the lists stops the page, wildcard subdomains included", () => {
    for (const baseUrl of [
      "https://evil.example",
      "https://someone.handlify.qiscus.io",
      "https://anything.qiscus.com",
      "http://qismo.qiscus.com",
      "https://user@qismo.qiscus.com",
      "javascript:alert(1)",
      "https://qismo-stagx.qiscus.io",
    ])
      expect(resolveEnv(page(LIVE, { baseUrl }))).toBeNull()
    for (const sdkBaseUrl of ["https://evil.example", "https://api4.qiscus.com", "http://api3.qiscus.com"])
      expect(resolveEnv(page(LIVE, { sdkBaseUrl }))).toBeNull()
    expect(resolveEnv(page(LIVE, { iframeUrl: "https://evil.example" }))).toBeNull()
  })

  test("only origins are kept: a path or query in an allowed value is dropped", () => {
    expect(pickApiOrigin("https://qismo.qiscus.com/api?x=1", LIVE)).toBe("https://qismo.qiscus.com")
    expect(pickSdkOrigin(`${MY}/api/v2/sdk`, LIVE)).toBe(MY)
  })

  test("no query value can choose the script", () => {
    expect(resolveEnv(page(LIVE, { scriptUrl: "https://evil.example/x.js" }))?.scriptUrl).toBe(`${LIVE}/js/qismo-full-v5.js`)
  })

  test("loopback hosts only while the page itself is on loopback", () => {
    expect(pickApiOrigin("http://127.0.0.1:8393", "http://127.0.0.1:8787/widget.html")).toBe("http://127.0.0.1:8393")
    expect(pickSdkOrigin("http://localhost:8080", "http://localhost:8787/widget.html")).toBe("http://localhost:8080")
    expect(pickApiOrigin("http://127.0.0.1:8393", `${LIVE}/widget.html`)).toBeNull()
    expect(pickSdkOrigin("http://localhost:8080", `${LIVE}/widget.html`)).toBeNull()
  })

  test("iframeUrl: this origin or a qismo/MCF host", () => {
    expect(pickIframeUrl(LIVE, `${LIVE}/widget.html`)).toBe(LIVE)
    expect(pickIframeUrl("https://omnichannel.qiscus.com", `${LIVE}/widget.html`)).toBe("https://omnichannel.qiscus.com")
    expect(pickIframeUrl(null, "https://h.example/sub/widget.html")).toBe("https://h.example/sub")
  })
})

describe("the SDK host follows the login", () => {
  test("a session remembers a non-default SDK host; the default is not written", () => {
    const s = memory()
    saveSession(s, { appId: "app", roomId: "1", user, sdk: MY }, 1000)
    expect(loadSession(s, 1001)).toMatchObject({ state: "valid", session: { sdk: MY } })
    saveSession(s, { appId: "app", roomId: "1", user, sdk: DEFAULT_SDK_ORIGIN }, 1000)
    expect(JSON.parse(s.getItem(SESSION_KEY)!).sdk).toBeUndefined()
  })

  test("a stored session naming a foreign SDK host is dropped", () => {
    const s = memory()
    saveSession(s, { appId: "app", roomId: "1", user }, 1000)
    s.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(s.getItem(SESSION_KEY)!), sdk: "https://evil.example" }))
    expect(loadSession(s, 1001).state).toBe("none")
    expect(() => saveSession(s, { appId: "app", roomId: "1", user, sdk: "https://evil.example" }, 1000)).toThrow()
  })

  test("the room: resume uses the stored host, an invite uses ?sdk_base_url=", () => {
    const resumed = { v: 1 as const, appId: "app", roomId: "1", user, sdk: MY, savedAt: 1, expiresAt: 2 }
    expect(roomSdkOrigin("?resume=1&sdk_base_url=https%3A%2F%2Fapi3.qiscus.com", resumed, LIVE)).toBe(MY)
    expect(roomSdkOrigin(`?sdk_base_url=${encodeURIComponent(MY)}`, null, LIVE)).toBe(MY)
    expect(roomSdkOrigin("?app_id=app", null, LIVE)).toBe(DEFAULT_SDK_ORIGIN)
    expect(roomSdkOrigin("?sdk_base_url=https%3A%2F%2Fevil.example", null, LIVE)).toBeNull()
  })

  test("push registration goes to the login's own SDK host", async () => {
    const r = recorder({})
    const token = "f".repeat(150)
    await setDeviceToken(r.f, { appId: "app", user, sdk: MY }, token)
    await removeDeviceToken(r.f, { appId: "app", user }, token)
    expect(r.calls).toEqual([`${MY}/api/v2/sdk/set_user_device_token`, `${DEFAULT_SDK_ORIGIN}/api/v2/sdk/remove_user_device_token`])
    expect((await setDeviceToken(r.f, { appId: "app", user, sdk: "https://evil.example" }, token)).error).toBe("invalid-sdk-host")
    expect(r.calls.length).toBe(2)
  })

  test("verify_identity_token goes to the page's SDK host", async () => {
    const r = recorder()
    expect((await verifyIdentityToken(r.f, "app", "idt", MY)).ok).toBe(true)
    expect(r.calls).toEqual([`${MY}/api/v2/sdk/auth/verify_identity_token`])
    expect((await verifyIdentityToken(r.f, "app", "idt", "https://evil.example")).error).toBe("invalid-sdk-host")
    expect(r.calls.length).toBe(1)
  })
})
