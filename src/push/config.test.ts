// SYNTHETIC: every value below is invented for tests. None is a real Firebase
// project, API key or VAPID key.
import { describe, expect, test } from "bun:test"
import { PUSH_ENV_KEYS, readPushConfig, roomOriginAllowed } from "./config"

async function syntheticVapidKey(): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))
  return Buffer.from(raw).toString("base64url")
}

async function syntheticEnv(): Promise<Record<string, string>> {
  return {
    FIREBASE_API_KEY: "AIza" + "S".repeat(35),
    FIREBASE_AUTH_DOMAIN: "synthetic-project.firebaseapp.com",
    FIREBASE_PROJECT_ID: "synthetic-project",
    FIREBASE_MESSAGING_SENDER_ID: "123456789012",
    FIREBASE_APP_ID: "1:123456789012:web:abcdef0123456789",
    FIREBASE_VAPID_KEY: await syntheticVapidKey(),
  }
}

describe("readPushConfig (synthetic)", () => {
  test("no env at all -> unconfigured, lists every required key", () => {
    const cfg = readPushConfig({})
    expect(cfg.status).toBe("unconfigured")
    if (cfg.status !== "unconfigured") throw new Error("unreachable")
    expect(cfg.missing).toEqual([
      "FIREBASE_API_KEY",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_MESSAGING_SENDER_ID",
      "FIREBASE_APP_ID",
      "FIREBASE_VAPID_KEY",
    ])
    expect(cfg.invalid).toEqual([])
  })

  test("complete synthetic env -> configured public config only", async () => {
    const env = await syntheticEnv()
    const cfg = readPushConfig(env)
    expect(cfg.status).toBe("configured")
    if (cfg.status !== "configured") throw new Error("unreachable")
    expect(cfg.firebase).toEqual({
      apiKey: env.FIREBASE_API_KEY,
      authDomain: env.FIREBASE_AUTH_DOMAIN,
      projectId: env.FIREBASE_PROJECT_ID,
      messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
      appId: env.FIREBASE_APP_ID,
    })
    expect(cfg.vapidKey).toBe(env.FIREBASE_VAPID_KEY)
    expect(cfg.appCodes).toBeNull()
  })

  test("authDomain is optional", async () => {
    const env = await syntheticEnv()
    delete env.FIREBASE_AUTH_DOMAIN
    const cfg = readPushConfig(env)
    expect(cfg.status).toBe("configured")
    if (cfg.status !== "configured") throw new Error("unreachable")
    expect(cfg.firebase.authDomain).toBeUndefined()
  })

  test("malformed values are reported as invalid, never echoed", async () => {
    const env = await syntheticEnv()
    env.FIREBASE_API_KEY = "not-a-key"
    env.FIREBASE_APP_ID = "1:999999999999:web:abcdef" // sender id mismatch
    env.FIREBASE_VAPID_KEY = Buffer.from(new Uint8Array(65)).toString("base64url") // not 0x04-prefixed
    env.FIREBASE_AUTH_DOMAIN = "https://evil.example/path"
    const cfg = readPushConfig(env)
    expect(cfg.status).toBe("unconfigured")
    if (cfg.status !== "unconfigured") throw new Error("unreachable")
    expect(cfg.missing).toEqual([])
    expect(cfg.invalid.sort() as string[]).toEqual(
      ["FIREBASE_API_KEY", "FIREBASE_APP_ID", "FIREBASE_AUTH_DOMAIN", "FIREBASE_VAPID_KEY"].sort(),
    )
    expect(JSON.stringify(cfg)).not.toContain("not-a-key")
  })

  test("a service-account JSON pasted into an env var is rejected", async () => {
    const env = await syntheticEnv()
    env.FIREBASE_API_KEY = JSON.stringify({ type: "service_account", private_key: "-----BEGIN PRIVATE KEY-----" })
    const cfg = readPushConfig(env)
    expect(cfg.status).toBe("unconfigured")
    expect(JSON.stringify(cfg)).not.toContain("PRIVATE KEY")
  })

  test("PUSH_APP_CODES restricts which apps may enable push", async () => {
    const env = { ...(await syntheticEnv()), PUSH_APP_CODES: " app-one , APP2 ,," }
    const cfg = readPushConfig(env)
    if (cfg.status !== "configured") throw new Error("expected configured")
    expect(cfg.appCodes).toEqual(["app-one", "APP2"])
  })

  test("PUSH_APP_CODES with junk is invalid", async () => {
    const env = { ...(await syntheticEnv()), PUSH_APP_CODES: "ok,<script>" }
    const cfg = readPushConfig(env)
    expect(cfg.status).toBe("unconfigured")
    if (cfg.status !== "unconfigured") throw new Error("unreachable")
    expect(cfg.invalid).toEqual(["PUSH_APP_CODES"])
  })

  test("PUSH_ROOM_ORIGINS accepts a https wildcard and matches only its subdomains", async () => {
    const cfg = readPushConfig({ ...(await syntheticEnv()), PUSH_ROOM_ORIGINS: "https://omnichannel.qiscus.com, https://*.qiscus.io" })
    if (cfg.status !== "configured") throw new Error("unreachable")
    expect(cfg.roomOrigins).toEqual(["https://omnichannel.qiscus.com", "https://*.qiscus.io"])
    for (const ok of ["https://omnichannel.qiscus.com", "https://qismo-stag2.qiscus.io", "https://qismo-stag3.qiscus.io", "https://a.b.qiscus.io"])
      expect(roomOriginAllowed(ok, cfg.roomOrigins)).toBe(true)
    for (const no of [
      "https://qiscus.io", // the apex itself is not a subdomain
      "https://evilqiscus.io",
      "https://qiscus.io.evil.example",
      "https://qismo-stag2.qiscus.io:8443",
      "http://qismo-stag2.qiscus.io",
      "https://qismo-stag2.qiscus.com",
      "https://qismo-stag2.qiscus.io/path",
      "",
      null,
    ])
      expect(roomOriginAllowed(no, cfg.roomOrigins)).toBe(false)
  })

  test("PUSH_ROOM_ORIGINS refuses malformed wildcards", async () => {
    const env = await syntheticEnv()
    for (const bad of ["https://*", "https://*.com", "http://*.qiscus.io", "https://*.qiscus.io/x", "https://a.*.qiscus.io", "https://*.qiscus.io:8443", "*.qiscus.io"]) {
      const cfg = readPushConfig({ ...env, PUSH_ROOM_ORIGINS: bad })
      expect(cfg.status).toBe("unconfigured")
      if (cfg.status === "unconfigured") expect(cfg.invalid).toEqual(["PUSH_ROOM_ORIGINS"])
    }
  })

  test("PUSH_ENV_KEYS lists every env name the Worker reads", () => {
    expect([...PUSH_ENV_KEYS].sort() as string[]).toEqual(
      [
        "FIREBASE_API_KEY",
        "FIREBASE_AUTH_DOMAIN",
        "FIREBASE_PROJECT_ID",
        "FIREBASE_MESSAGING_SENDER_ID",
        "FIREBASE_APP_ID",
        "FIREBASE_VAPID_KEY",
        "PUSH_APP_CODES",
        "PUSH_ROOM_ORIGINS",
      ].sort(),
    )
  })
})
