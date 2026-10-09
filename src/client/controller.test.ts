// SYNTHETIC: every dependency is a fake — in-memory storage, a fake Qiscus SDK
// API (fetch), a fake FCM (token minting), a fake Notification permission
// and a fake service-worker context store. No browser, no network.
import { describe, expect, test } from "bun:test"
import { PushController, REG_KEY, OPT_IN_KEY, type PushDeps, type PushUiState } from "./controller"
import { detectSupport } from "./support"
import { loadSession, saveSession, stashSessionForInvite, type SdkUser } from "./session"
import { MemoryStorage } from "./testing"
import type { PushConfig } from "../push/config"

const CONFIG: PushConfig = {
  status: "configured",
  firebase: {
    apiKey: "AIza" + "S".repeat(35),
    projectId: "synthetic-project",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef0123456789",
  },
  vapidKey: "synthetic-vapid",
  appCodes: null,
}

const tok = (n: number) => `synthetic-fcm-${n}:` + "A".repeat(120)
const u = (email: string): SdkUser => ({ email, token: `synthetic-sdk-token-${email}` })

function harness(over: Partial<{ config: PushConfig; permission: NotificationPermission; support: ReturnType<typeof detectSupport>; grant: NotificationPermission; status: number }> = {}) {
  const storage = new MemoryStorage()
  let now = 1_800_000_000_000
  let permission: NotificationPermission = over.permission ?? "default"
  let nextToken = 1
  const sdkCalls: { path: string; app: string; user: string; sdkToken: string; device: string }[] = []
  const fcmCalls: string[] = []
  const swWrites: unknown[] = []
  const states: PushUiState[] = []
  let status = over.status ?? 200

  const deps: PushDeps = {
    storage,
    now: () => now,
    fetch: (async (url: string, init: RequestInit) => {
      const h = new Headers(init.headers)
      sdkCalls.push({
        path: new URL(url).pathname.split("/").pop()!,
        app: h.get("QISCUS-SDK-APP-ID")!,
        user: h.get("QISCUS-SDK-USER-ID")!,
        sdkToken: h.get("QISCUS-SDK-TOKEN")!,
        device: JSON.parse(String(init.body)).device_token,
      })
      return new Response("{}", { status })
    }) as unknown as typeof fetch,
    support: () => over.support ?? "supported",
    permission: () => permission,
    requestPermission: async () => {
      permission = over.grant ?? "granted"
      return permission
    },
    loadConfig: async () => over.config ?? CONFIG,
    fcm: {
      getToken: async () => {
        fcmCalls.push("getToken")
        return tok(nextToken)
      },
      deleteToken: async () => {
        fcmCalls.push("deleteToken")
      },
    },
    swContext: {
      write: async (ctx) => {
        swWrites.push(ctx)
      },
    },
    onState: (s) => states.push(s),
  }
  const ctl = new PushController(deps)
  return {
    ctl,
    storage,
    sdkCalls,
    fcmCalls,
    swWrites,
    states,
    last: () => states[states.length - 1],
    setPermission: (p: NotificationPermission) => (permission = p),
    rotateToken: () => nextToken++,
    advance: (ms: number) => (now += ms),
    setStatus: (s: number) => (status = s),
    nowFn: () => now,
    login: (appId: string, roomId: string, email: string) => saveSession(storage, { appId, roomId, user: u(email) }, now),
  }
}

describe("detectSupport (synthetic navigator shapes)", () => {
  const base = { isSecureContext: true, serviceWorker: true, pushManager: true, notification: true, userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/150", standalone: false, maxTouchPoints: 0 }
  test("desktop Chrome", () => expect(detectSupport(base)).toBe("supported"))
  test("insecure context", () => expect(detectSupport({ ...base, isSecureContext: false })).toBe("unsupported"))
  test("no PushManager", () => expect(detectSupport({ ...base, pushManager: false })).toBe("unsupported"))
  test("iPhone Safari tab needs Add to Home Screen", () =>
    expect(detectSupport({ ...base, pushManager: false, notification: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" })).toBe("ios-install"))
  test("iPadOS desktop UA with touch is iOS", () =>
    expect(detectSupport({ ...base, pushManager: false, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", maxTouchPoints: 5 })).toBe("ios-install"))
  test("iOS home-screen app with push", () =>
    expect(detectSupport({ ...base, standalone: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe("supported"))
  test("old iOS home-screen app without push", () =>
    expect(detectSupport({ ...base, standalone: true, pushManager: false, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)" })).toBe("unsupported"))
})

describe("PushController (synthetic)", () => {
  test("unconfigured: says so with the missing names and never touches FCM", async () => {
    const h = harness({ config: { status: "unconfigured", missing: ["FIREBASE_VAPID_KEY"], invalid: [] } })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "unconfigured", missing: ["FIREBASE_VAPID_KEY"], invalid: [] })
    expect(h.fcmCalls).toEqual([])
    expect(h.sdkCalls).toEqual([])
  })

  test("no session: nothing is offered", async () => {
    const h = harness()
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "hidden" })
  })

  test("unsupported / iOS-install states", async () => {
    for (const support of ["unsupported", "ios-install"] as const) {
      const h = harness({ support })
      h.login("app1", "11", "c1@example.invalid")
      await h.ctl.sessionReady()
      expect(h.last()).toEqual({ kind: support })
    }
  })

  test("app not in PUSH_APP_CODES: no offer, no registration", async () => {
    const h = harness({ config: { ...CONFIG, appCodes: ["other-app"] } as PushConfig })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "app-not-enabled" })
    await h.ctl.enable()
    expect(h.sdkCalls).toEqual([])
  })

  test("opt-in: offer -> permission -> FCM token -> registered for THIS customer as platform web", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "offer" })
    expect(h.fcmCalls).toEqual([]) // nothing happens before the explicit click
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect(h.sdkCalls).toEqual([
      { path: "set_user_device_token", app: "app1", user: "c1@example.invalid", sdkToken: "synthetic-sdk-token-c1@example.invalid", device: tok(1) },
    ])
    expect(h.swWrites.at(-1)).toEqual({ appId: "app1", roomId: "11", selfEmail: "c1@example.invalid" })
    expect(h.storage.getItem(OPT_IN_KEY)).toBe("1")
    expect(JSON.parse(h.storage.getItem(REG_KEY)!)).toMatchObject({ fcmToken: tok(1), appId: "app1", userEmail: "c1@example.invalid", roomId: "11" })
  })

  test("permission denied: denied state, no token, no registration", async () => {
    const h = harness({ grant: "denied" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "denied" })
    expect(h.fcmCalls).toEqual([])
    expect(h.sdkCalls).toEqual([])
    expect(h.storage.getItem(OPT_IN_KEY)).toBeNull()
  })

  test("already denied before any click: denied state", async () => {
    const h = harness({ permission: "denied" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "denied" })
  })

  test("prompt dismissed (still default): back to offer", async () => {
    const h = harness({ grant: "default" })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "offer" })
  })

  test("refresh with an unchanged token and identity is idempotent (no network)", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    await h.ctl.sessionReady()
    expect(h.last()).toEqual({ kind: "enabled" })
    expect(h.sdkCalls).toEqual([])
  })

  test("FCM token rotation: registers the new token, removes the old one", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.rotateToken()
    h.sdkCalls.length = 0
    await h.ctl.sessionReady()
    expect(h.sdkCalls.map((c) => [c.path, c.device])).toEqual([
      ["set_user_device_token", tok(2)],
      ["remove_user_device_token", tok(1)],
    ])
  })

  test("new invite for a DIFFERENT customer: old registration removed with the OLD session, new one registered with the NEW session", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.fcmCalls.length = 0

    h.ctl.beginInvite()
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none") // old identity can no longer resume
    h.rotateToken() // deleteToken -> a fresh token next time
    h.login("app2", "22", "new@example.invalid") // what the room iframe writes after login
    await h.ctl.sessionReady()

    expect(h.sdkCalls).toEqual([
      { path: "remove_user_device_token", app: "app1", user: "old@example.invalid", sdkToken: "synthetic-sdk-token-old@example.invalid", device: tok(1) },
      { path: "set_user_device_token", app: "app2", user: "new@example.invalid", sdkToken: "synthetic-sdk-token-new@example.invalid", device: tok(2) },
    ])
    expect(h.fcmCalls).toEqual(["deleteToken", "getToken"])
    expect(h.swWrites.at(-1)).toEqual({ appId: "app2", roomId: "22", selfEmail: "new@example.invalid" })
  })

  test("new invite for the SAME customer keeps the registration", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.ctl.beginInvite()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.sdkCalls).toEqual([])
    expect(h.last()).toEqual({ kind: "enabled" })
  })

  test("same customer, different room: SW context follows the new room", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.ctl.beginInvite()
    h.login("app1", "12", "c1@example.invalid")
    await h.ctl.sessionReady()
    expect(h.swWrites.at(-1)).toEqual({ appId: "app1", roomId: "12", selfEmail: "c1@example.invalid" })
  })

  test("invite exchange failed: old identity is still torn down", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.ctl.beginInvite()
    await h.ctl.inviteFailed()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "old@example.invalid"]])
    expect(h.storage.getItem(REG_KEY)).toBeNull()
    expect(h.swWrites.at(-1)).toBeNull()
  })

  test("room is not same-origin: reported, and an old identity is torn down", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.ctl.beginInvite()
    await h.ctl.crossOriginRoom()
    expect(h.last()).toEqual({ kind: "cross-origin-room" })
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  test("permission revoked in browser settings: registration removed on next load", async () => {
    for (const revoked of ["default", "denied"] as const) {
      const h = harness()
      h.login("app1", "11", "c1@example.invalid")
      await h.ctl.sessionReady()
      await h.ctl.enable()
      h.sdkCalls.length = 0
      h.setPermission(revoked)
      await h.ctl.sessionReady()
      expect(h.sdkCalls.map((c) => c.path)).toEqual(["remove_user_device_token"])
      expect(h.storage.getItem(REG_KEY)).toBeNull()
      expect(h.last()).toEqual({ kind: revoked === "denied" ? "denied" : "offer" })
    }
  })

  test("user turns it off: removed + FCM token deleted", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.disable()
    expect(h.sdkCalls.at(-1)?.path).toBe("remove_user_device_token")
    expect(h.fcmCalls.at(-1)).toBe("deleteToken")
    expect(h.storage.getItem(OPT_IN_KEY)).toBeNull()
    expect(h.last()).toEqual({ kind: "offer" })
  })

  test("conversation closed: registration removed, session cleared (no resume)", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.sessionClosed()
    expect(h.sdkCalls.at(-1)?.path).toBe("remove_user_device_token")
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
    expect(h.swWrites.at(-1)).toBeNull()
    expect(h.last()).toEqual({ kind: "hidden" })
  })

  test("resume: valid session is returned without any network", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    const s = await h.ctl.resume()
    expect(s?.roomId).toBe("11")
    expect(h.sdkCalls).toEqual([])
  })

  test("resume after expiry: nothing to resume, registration removed with the expired session's creds", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    h.sdkCalls.length = 0
    h.advance(49 * 60 * 60 * 1000)
    expect(await h.ctl.resume()).toBeNull()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "c1@example.invalid"]])
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  test("resume after an abandoned invite: previous identity torn down, never resumed", async () => {
    const h = harness()
    h.login("app1", "11", "old@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    stashSessionForInvite(h.storage) // invite page closed before the exchange finished
    h.sdkCalls.length = 0
    expect(await h.ctl.resume()).toBeNull()
    expect(h.sdkCalls.map((c) => [c.path, c.user])).toEqual([["remove_user_device_token", "old@example.invalid"]])
  })

  test("resumed session rejected upstream: torn down and cleared", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    await h.ctl.sessionInvalid()
    expect(loadSession(h.storage, h.nowFn()).state).toBe("none")
    expect(h.storage.getItem(REG_KEY)).toBeNull()
  })

  test("registration rejected upstream: error state, nothing stored, SW not armed", async () => {
    const h = harness({ status: 401 })
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "error", reason: "http-401" })
    expect(h.storage.getItem(REG_KEY)).toBeNull()
    expect(h.swWrites).toEqual([])
  })

  test("FCM token minting fails: error state, nothing registered", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    h.ctl["deps"].fcm.getToken = async () => {
      throw new Error("synthetic messaging/token-subscribe-failed")
    }
    await h.ctl.sessionReady()
    await h.ctl.enable()
    expect(h.last()).toEqual({ kind: "error", reason: "fcm" })
    expect(h.sdkCalls).toEqual([])
  })

  test("the state never contains a token", async () => {
    const h = harness()
    h.login("app1", "11", "c1@example.invalid")
    await h.ctl.sessionReady()
    await h.ctl.enable()
    const dump = JSON.stringify(h.states)
    expect(dump).not.toContain("synthetic-fcm")
    expect(dump).not.toContain("synthetic-sdk-token")
  })
})
