import { describe, expect, test } from "bun:test"
import { basePathOf } from "./base"

describe("basePathOf", () => {
  test("domain root", () => {
    expect(basePathOf("https://h.example/widget.html")).toBe("/")
    expect(basePathOf("https://h.example/widget.html?baseUrl=https%3A%2F%2Fa.example#t=x")).toBe("/")
    expect(basePathOf("https://h.example/")).toBe("/")
  })

  test("under a sub-path: the directory of widget.html, with a trailing slash", () => {
    expect(basePathOf("https://h.example/api/v2/live_handover/w/widget.html?source=pwa#t=x")).toBe("/api/v2/live_handover/w/")
    expect(basePathOf("https://h.example/a/widget.html")).toBe("/a/")
  })
})
