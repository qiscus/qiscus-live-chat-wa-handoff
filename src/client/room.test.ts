// SYNTHETIC: fake windows/storage; invented app codes, users and invite tokens.
import { describe, expect, test } from "bun:test"
import { parseInviteEnv, parseInviteLink } from "./inviteLink"
import { persistLogin, resumeSession, trustedParent } from "./room"
import { SESSION_KEY } from "./session"
import { MemoryStorage } from "./testing"

const ORIGIN = "https://handoff.example.invalid"
const T0 = 1_800_000_000_000

function frameWindow(parentOrigin: string | "throws" | "self") {
  const self: any = { location: { origin: ORIGIN } }
  if (parentOrigin === "self") self.parent = self
  else
    self.parent = {
      get location() {
        if (parentOrigin === "throws") throw new DOMException("cross-origin", "SecurityError")
        return { origin: parentOrigin }
      },
    }
  return self as Window
}

describe("room helper (synthetic)", () => {
  test("trustedParent: only a same-origin parent frame", () => {
    expect(trustedParent(frameWindow(ORIGIN))).toBe(true)
    expect(trustedParent(frameWindow("throws"))).toBe(false)
    expect(trustedParent(frameWindow("https://evil.example"))).toBe(false)
    expect(trustedParent(frameWindow("self"))).toBe(false) // top-level, not framed
  })

  test("persistLogin stores the SDK user only under a trusted parent", () => {
    const s = new MemoryStorage()
    const userData = { user: { email: "c@example.invalid", token: "synthetic-sdk" }, identity_token: "synthetic-idt" }
    expect(persistLogin(frameWindow("https://evil.example"), s, "app1", "42", userData, T0)).toBe(false)
    expect(s.getItem(SESSION_KEY)).toBeNull()
    expect(persistLogin(frameWindow(ORIGIN), s, "app1", "42", userData, T0)).toBe(true)
    const raw = s.getItem(SESSION_KEY)!
    expect(raw).toContain("synthetic-sdk")
    expect(raw).not.toContain("synthetic-idt")
  })

  test("persistLogin ignores malformed login payloads", () => {
    const s = new MemoryStorage()
    expect(persistLogin(frameWindow(ORIGIN), s, "app1", "42", { user: { email: "x" } }, T0)).toBe(false)
    expect(persistLogin(frameWindow(ORIGIN), s, "app1", "42", null, T0)).toBe(false)
    expect(persistLogin(frameWindow(ORIGIN), s, "../x", "42", { user: { email: "c", token: "t" } }, T0)).toBe(false)
    expect(s.getItem(SESSION_KEY)).toBeNull()
  })

  test("resumeSession: only for a trusted parent and the matching app", () => {
    const s = new MemoryStorage()
    persistLogin(frameWindow(ORIGIN), s, "app1", "42", { user: { email: "c@example.invalid", token: "synthetic-sdk" } }, T0)
    expect(resumeSession(frameWindow("https://evil.example"), s, "app1", T0)).toBeNull()
    expect(resumeSession(frameWindow(ORIGIN), s, "other-app", T0)).toBeNull()
    expect(resumeSession(frameWindow(ORIGIN), s, "app1", T0)?.roomId).toBe("42")
  })
})

describe("parseInviteLink (synthetic tokens)", () => {
  const TOKEN = "eyJhbGciOi.synthetic-PAYLOAD_123.sig-abc"
  test("Qiscus redirector links", () => {
    expect(parseInviteLink(`https://qismo.qiscus.com/c/${TOKEN}`, ORIGIN)).toBe(TOKEN)
    expect(parseInviteLink(`https://multichannel.qiscus.com/api/v2/live_handover/c/${TOKEN}`, ORIGIN)).toBe(TOKEN)
    expect(parseInviteLink(`  https://qismo-stag2.qiscus.io/c/${TOKEN}  `, ORIGIN)).toBe(TOKEN)
  })
  test("this page with a #t= fragment", () => {
    expect(parseInviteLink(`${ORIGIN}/widget.html?baseUrl=x#t=${TOKEN}`, ORIGIN)).toBe(TOKEN)
  })
  test("rejects foreign hosts, plain http, junk and oversized input", () => {
    for (const bad of [
      `https://evil.example/c/${TOKEN}`,
      `https://qiscus.com.evil.example/c/${TOKEN}`,
      `http://qismo.qiscus.com/c/${TOKEN}`,
      `https://evil.example/widget.html#t=${TOKEN}`,
      `https://qismo.qiscus.com/c/`,
      `https://qismo.qiscus.com/c/${TOKEN}/extra`,
      `https://qismo.qiscus.com/c/<script>`,
      "javascript:alert(1)",
      "not a url",
      "https://qismo.qiscus.com/c/" + "a".repeat(5000),
    ]) {
      expect(parseInviteLink(bad, ORIGIN)).toBeNull()
    }
  })
})

describe("parseInviteEnv (environment carried by a pasted widget link)", () => {
  const T = "eyJhbG...-abc"
  test("keeps baseUrl and iframeUrl from this page's link as origins", () => {
    const link = `${ORIGIN}/widget.html?baseUrl=${encodeURIComponent("https://qismo-stag2.qiscus.io/x")}&iframeUrl=${encodeURIComponent(ORIGIN)}#t=${T}`
    expect(parseInviteEnv(link, ORIGIN)).toEqual({ baseUrl: "https://qismo-stag2.qiscus.io", iframeUrl: ORIGIN })
  })
  test("drops hosts that fromQuery would refuse", () => {
    const link = `${ORIGIN}/widget.html?baseUrl=https%3A%2F%2Fevil.example&iframeUrl=https%3A%2F%2Fevil.example#t=${T}`
    expect(parseInviteEnv(link, ORIGIN)).toEqual({})
    expect(parseInviteEnv(`${ORIGIN}/widget.html?baseUrl=${encodeURIComponent(ORIGIN)}#t=${T}`, ORIGIN)).toEqual({})
  })
  test("carries sdkBaseUrl (region) from this page's link: ID, MY, and none", () => {
    const MY = "https://api-my.qiscus.com"
    const ID = "https://api3.qiscus.com"
    const link = (q: string) => `${ORIGIN}/widget.html${q}#t=${T}`
    expect(parseInviteEnv(link(`?sdkBaseUrl=${encodeURIComponent(MY)}`), ORIGIN)).toEqual({ sdkBaseUrl: MY })
    expect(parseInviteEnv(link(`?sdkBaseUrl=${encodeURIComponent(MY + "/api/v2")}`), ORIGIN)).toEqual({ sdkBaseUrl: MY }) // origin only
    expect(parseInviteEnv(link(`?sdkBaseUrl=${encodeURIComponent(ID)}`), ORIGIN)).toEqual({ sdkBaseUrl: ID })
    expect(parseInviteEnv(link("?source=pwa"), ORIGIN)).toEqual({}) // not carried -> controller default
    expect(parseInviteEnv(link("?sdkBaseUrl="), ORIGIN)).toEqual({})
    // all three together, as qismo-api builds the link for region MY
    const all = `?baseUrl=${encodeURIComponent("https://omnichannel-my.qiscus.com")}&sdkBaseUrl=${encodeURIComponent(MY)}&iframeUrl=${encodeURIComponent(ORIGIN)}`
    expect(parseInviteEnv(link(all), ORIGIN)).toEqual({ baseUrl: "https://omnichannel-my.qiscus.com", sdkBaseUrl: MY, iframeUrl: ORIGIN })
  })
  test("drops an sdkBaseUrl that origins.ts would refuse", () => {
    for (const bad of [
      "https://evil.example",
      "https://api4.qiscus.com", // *.qiscus.com is not an SDK host
      "https://evil.qiscus.io",
      "http://api3.qiscus.com", // not https
      "https://user:pw@api3.qiscus.com",
      "https://api3.qiscus.com.evil.example",
      "javascript:alert(1)",
      "https://qismo.qiscus.com", // an API host is not an SDK host
    ])
      expect(parseInviteEnv(`${ORIGIN}/widget.html?sdkBaseUrl=${encodeURIComponent(bad)}#t=${T}`, ORIGIN)).toEqual({})
    // a refused value does not take the allowed ones down with it
    expect(
      parseInviteEnv(`${ORIGIN}/widget.html?baseUrl=${encodeURIComponent("https://qismo.qiscus.com")}&sdkBaseUrl=https%3A%2F%2Fevil.example#t=${T}`, ORIGIN),
    ).toEqual({ baseUrl: "https://qismo.qiscus.com" })
  })
  test("baseUrl / iframeUrl use the exact lists, not *.qiscus.com / *.qiscus.io", () => {
    for (const bad of ["https://evil.qiscus.com", "https://x.qiscus.io", "https://qismo-stag.qiscus.io.evil.example"])
      expect(parseInviteEnv(`${ORIGIN}/widget.html?baseUrl=${encodeURIComponent(bad)}&iframeUrl=${encodeURIComponent(bad)}#t=${T}`, ORIGIN)).toEqual({})
    expect(parseInviteEnv(`${ORIGIN}/widget.html?baseUrl=${encodeURIComponent("https://multichannel-api.qiscus.com")}#t=${T}`, ORIGIN)).toEqual({
      baseUrl: "https://multichannel-api.qiscus.com",
    })
  })
  test("redirector links and junk carry nothing", () => {
    expect(parseInviteEnv(`https://qismo.qiscus.com/c/${T}`, ORIGIN)).toEqual({})
    expect(parseInviteEnv("not a url", ORIGIN)).toEqual({})
  })
})
