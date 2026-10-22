// The forked packages (packages/) and what public/ serves must agree.
import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "node:fs"
import { sdkVersion } from "../../scripts/build-vendor"

const pub = new URL("../../public/", import.meta.url).pathname

describe("vendor bundles from packages/", () => {
  test("the room page loads the qiscus-sdk version of packages/qiscus-ui-vue", async () => {
    const v = await sdkVersion()
    const room = await Bun.file(pub + "live-handover-room.html").text()
    expect(room).toContain(`/css/qiscus-sdk.${v}.css`)
    expect(room).toContain(`/js/qiscus-sdk.${v}.js`)
    expect(room.match(/qiscus-sdk\.\d+\.\d+\.\d+\./g)?.every((m) => m === `qiscus-sdk.${v}.`)).toBe(true)
  })

  test("public/ ships exactly that qiscus-sdk version, plus qismo-full-v5.js", async () => {
    const v = await sdkVersion()
    for (const f of [`js/qiscus-sdk.${v}.js`, `js/qiscus-sdk.${v}.js.map`, `css/qiscus-sdk.${v}.css`, "js/qismo-full-v5.js"]) {
      expect(existsSync(pub + f)).toBe(true)
    }
    const shipped = [...readdirSync(pub + "js"), ...readdirSync(pub + "css")].filter((n) => n.startsWith("qiscus-sdk."))
    expect(shipped.sort()).toEqual([`qiscus-sdk.${v}.css`, `qiscus-sdk.${v}.js`, `qiscus-sdk.${v}.js.map`])
  })
})
