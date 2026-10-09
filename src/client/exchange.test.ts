// SYNTHETIC: pure helpers that read QismoFull's own exchange response.
import { describe, expect, test } from "bun:test"
import { isExchangeRequest, parseExchange } from "./main"

const BASE = "https://handoff.example.invalid/widget.html"

describe("exchange observation (synthetic)", () => {
  test("only a POST to a Qiscus host's exchange path is observed", () => {
    expect(isExchangeRequest("POST", "https://qismo.qiscus.com/api/v2/live_handover/exchange", BASE)).toBe(true)
    expect(isExchangeRequest("post", "https://qismo-stag2.qiscus.io/api/v2/live_handover/exchange", BASE)).toBe(true)
    for (const [m, url] of [
      ["GET", "https://qismo.qiscus.com/api/v2/live_handover/exchange"],
      ["POST", "https://evil.example/api/v2/live_handover/exchange"],
      ["POST", "https://qiscus.com.evil.example/api/v2/live_handover/exchange"],
      ["POST", "http://qismo.qiscus.com/api/v2/live_handover/exchange"],
      ["POST", "https://qismo.qiscus.com/api/v2/live_handover/close"],
      ["POST", "/api/v2/live_handover/exchange"],
    ] as const) {
      expect(isExchangeRequest(m, url, BASE)).toBe(false)
    }
  })

  test("reads app, room and identity token, wrapped in data or not", () => {
    const body = { app_code: "app1", room_id: 4711, identity_token: "synthetic-id-token", name: "x" }
    expect(parseExchange(JSON.stringify(body))).toEqual({ appId: "app1", roomId: "4711", identityToken: "synthetic-id-token" })
    expect(parseExchange(JSON.stringify({ data: body }))).toEqual({ appId: "app1", roomId: "4711", identityToken: "synthetic-id-token" })
  })

  test("anything malformed is ignored", () => {
    for (const raw of [
      "not json",
      "{}",
      JSON.stringify({ app_code: "bad app!", room_id: 1, identity_token: "t" }),
      JSON.stringify({ app_code: "app1", room_id: "12a", identity_token: "t" }),
      JSON.stringify({ app_code: "app1", room_id: 1, identity_token: "" }),
      JSON.stringify({ app_code: "app1", room_id: 1, identity_token: 5 }),
    ]) {
      expect(parseExchange(raw)).toBeNull()
    }
  })
})
