// The forked packages (packages/) and what public/ serves must agree.
import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "node:fs"

const pub = new URL("../../public/", import.meta.url).pathname

describe("vendor bundles from packages/", () => {
  test("the room page loads the fixed-name qiscus-handoff bundle", async () => {
    const room = await Bun.file(pub + "live-handover-room.html").text()
    expect(room).toContain("/css/qiscus-handoff.css")
    expect(room).toContain("/js/qiscus-handoff.js")
    expect(room).not.toMatch(/qiscus-sdk\.\d+\.\d+\.\d+\./)
  })

  test("public/ ships qiscus-handoff plus qismo-full-v5.js and no versioned qiscus-sdk files", async () => {
    for (const f of ["js/qiscus-handoff.js", "js/qiscus-handoff.js.map", "css/qiscus-handoff.css", "js/qismo-full-v5.js"]) {
      expect(existsSync(pub + f)).toBe(true)
    }
    expect([...readdirSync(pub + "js"), ...readdirSync(pub + "css")].filter((n) => n.startsWith("qiscus-sdk."))).toEqual([])
  })

  test("the bundle and its map point at each other by the new name", async () => {
    const js = await Bun.file(pub + "js/qiscus-handoff.js").text()
    expect(js).toContain("sourceMappingURL=qiscus-handoff.js.map")
    expect(js).not.toContain("qiscus-sdk.")
    expect((await Bun.file(pub + "js/qiscus-handoff.js.map").json()).file).toBe("static/js/qiscus-handoff.js")
  })
})
