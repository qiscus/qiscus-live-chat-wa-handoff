// SYNTHETIC: in-memory storage, invented app codes / users / tokens, and a
// fake fetch standing in for the Qiscus SDK API. No network is touched.
import { describe, expect, test } from "bun:test"
import {
  PREVIOUS_SESSION_KEY,
  SESSION_KEY,
  SESSION_MAX_AGE_MS,
  clearSession,
  loadSession,
  sameIdentity,
  saveSession,
  stashSessionForInvite,
  takePreviousSession,
} from "./session"
import { SDK_BASE_URL, removeDeviceToken, setDeviceToken } from "./sdkDeviceToken"
import { MemoryStorage } from "./testing"

const T0 = 1_800_000_000_000
const FCM_TOKEN = "synthetic-fcm-token:" + "A".repeat(140)
const user = (email = "synthetic-customer@example.invalid") => ({
  email,
  token: "synthetic-sdk-token-" + email,
  refresh_token: "synthetic-refresh",
  username: "Synthetic Customer",
  last_comment_id: 1,
})

describe("session store (synthetic)", () => {
  test("save then load returns the session", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "synthetic-app", roomId: "101", user: user() }, T0)
    const r = loadSession(s, T0 + 1000)
    expect(r.state).toBe("valid")
    if (r.state !== "valid") throw new Error()
    expect(r.session.appId).toBe("synthetic-app")
    expect(r.session.roomId).toBe("101")
    expect(r.session.user.token).toBe("synthetic-sdk-token-synthetic-customer@example.invalid")
    expect(r.session.expiresAt).toBe(T0 + SESSION_MAX_AGE_MS)
  })

  test("never persists an identity_token, even if the SDK user object carries one", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: { ...user(), identity_token: "synthetic-idt" } as never }, T0)
    expect(s.getItem(SESSION_KEY)).not.toContain("synthetic-idt")
  })

  test("expired session is reported as expired (for teardown) and removed", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: user() }, T0)
    const r = loadSession(s, T0 + SESSION_MAX_AGE_MS + 1)
    expect(r.state).toBe("expired")
    expect(s.getItem(SESSION_KEY)).toBeNull()
  })

  test("garbage / tampered storage is treated as no session and removed", () => {
    const s = new MemoryStorage()
    for (const junk of ["{", "null", '{"v":1}', JSON.stringify({ v: 1, appId: "a", roomId: "1", user: { email: "x" } })]) {
      s.setItem(SESSION_KEY, junk)
      expect(loadSession(s, T0).state).toBe("none")
      expect(s.getItem(SESSION_KEY)).toBeNull()
    }
  })

  test("rejects invalid app codes and room ids at save time", () => {
    const s = new MemoryStorage()
    expect(() => saveSession(s, { appId: "../evil", roomId: "1", user: user() }, T0)).toThrow()
    expect(() => saveSession(s, { appId: "a1", roomId: "1;drop", user: user() }, T0)).toThrow()
    expect(s.getItem(SESSION_KEY)).toBeNull()
  })

  test("a session saved in the future (clock skew / tamper) is rejected", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: user() }, T0 + 10 * SESSION_MAX_AGE_MS)
    expect(loadSession(s, T0).state).toBe("none")
  })

  test("a new invite moves the old session aside; resume can no longer see it", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: user("old@example.invalid") }, T0)
    stashSessionForInvite(s)
    expect(loadSession(s, T0).state).toBe("none")
    expect(s.getItem(PREVIOUS_SESSION_KEY)).not.toBeNull()
    const prev = takePreviousSession(s)
    expect(prev?.user.email).toBe("old@example.invalid")
    expect(s.getItem(PREVIOUS_SESSION_KEY)).toBeNull()
    expect(takePreviousSession(s)).toBeNull()
  })

  test("stash keeps an older pending previous session if the invite page reloads", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: user("old@example.invalid") }, T0)
    stashSessionForInvite(s)
    stashSessionForInvite(s) // second invite before the first resolved: nothing current to stash
    expect(takePreviousSession(s)?.user.email).toBe("old@example.invalid")
  })

  test("sameIdentity compares app + SDK user", () => {
    const a = { appId: "a1", user: { email: "u1" } }
    expect(sameIdentity(a, { appId: "a1", user: { email: "u1" } })).toBe(true)
    expect(sameIdentity(a, { appId: "a2", user: { email: "u1" } })).toBe(false)
    expect(sameIdentity(a, { appId: "a1", user: { email: "u2" } })).toBe(false)
    expect(sameIdentity(a, null)).toBe(false)
  })

  test("clearSession removes it", () => {
    const s = new MemoryStorage()
    saveSession(s, { appId: "a1", roomId: "1", user: user() }, T0)
    clearSession(s)
    expect(loadSession(s, T0).state).toBe("none")
  })
})

describe("SDK device-token REST (synthetic fake upstream)", () => {
  const session = { appId: "synthetic-app", roomId: "7", user: user(), savedAt: T0, expiresAt: T0 + 1, v: 1 as const }

  function fakeFetch(status = 200) {
    const calls: { url: string; init: RequestInit }[] = []
    const fn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ results: { changed: true } }), { status })
    }) as unknown as typeof fetch
    return { fn, calls }
  }

  test("register posts platform=web to the fixed SDK host with the customer's own SDK session", async () => {
    const f = fakeFetch()
    const r = await setDeviceToken(f.fn, session, FCM_TOKEN)
    expect(r).toEqual({ ok: true, status: 200 })
    expect(f.calls).toHaveLength(1)
    const { url, init } = f.calls[0]!
    expect(url).toBe(`${SDK_BASE_URL}/api/v2/sdk/set_user_device_token`)
    expect(init.method).toBe("POST")
    const h = new Headers(init.headers)
    expect(h.get("QISCUS-SDK-APP-ID")).toBe("synthetic-app")
    expect(h.get("QISCUS-SDK-USER-ID")).toBe(session.user.email)
    expect(h.get("QISCUS-SDK-TOKEN")).toBe(session.user.token)
    expect(JSON.parse(String(init.body))).toEqual({
      device_token: FCM_TOKEN,
      device_platform: "web",
      is_development: false,
    })
    expect(init.credentials).toBe("omit")
    expect(init.referrerPolicy).toBe("no-referrer")
  })

  test("remove uses the remove endpoint", async () => {
    const f = fakeFetch()
    await removeDeviceToken(f.fn, session, FCM_TOKEN)
    expect(f.calls[0]!.url).toBe(`${SDK_BASE_URL}/api/v2/sdk/remove_user_device_token`)
  })

  test("upstream rejection is reported with status, never with the token", async () => {
    const f = fakeFetch(401)
    const r = await setDeviceToken(f.fn, session, FCM_TOKEN)
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
    expect(JSON.stringify(r)).not.toContain(FCM_TOKEN)
    expect(JSON.stringify(r)).not.toContain(session.user.token)
  })

  test("network failure never throws", async () => {
    const boom = (async () => {
      throw new TypeError("synthetic network down")
    }) as unknown as typeof fetch
    const r = await setDeviceToken(boom, session, FCM_TOKEN)
    expect(r).toEqual({ ok: false, status: 0, error: "network" })
  })

  test("refuses obviously bad tokens instead of sending them", async () => {
    const f = fakeFetch()
    for (const bad of ["", "a b", "x".repeat(5000)]) {
      const r = await setDeviceToken(f.fn, session, bad)
      expect(r.ok).toBe(false)
    }
    expect(f.calls).toHaveLength(0)
  })
})
