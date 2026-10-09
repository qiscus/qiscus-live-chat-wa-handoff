// The committed browser bundles must match a fresh build of src/client.
import { describe, expect, test } from "bun:test"
import { BUNDLES, OUT_DIR, buildAll } from "../../scripts/build-client"

describe("public/js/push bundles", () => {
  test(
    "are up to date with src/client (run `bun run build:client`)",
    async () => {
      const built = await buildAll()
      for (const b of BUNDLES) {
        const committed = await Bun.file(new URL(b.out, OUT_DIR)).text()
        expect(committed === built.get(b.out)).toBe(true)
      }
    },
    60_000,
  )

  test("the page bundle does not inline Firebase and the room bundle stays tiny", async () => {
    const push = await Bun.file(new URL("handoff-push.js", OUT_DIR)).text()
    const room = await Bun.file(new URL("handoff-room.js", OUT_DIR)).text()
    expect(push).not.toContain("firebaseinstallations")
    expect(push.length).toBeLessThan(40_000)
    expect(room.length).toBeLessThan(10_000)
  })

  test("no bundle contains a service-account marker", async () => {
    for (const b of BUNDLES) {
      const code = await Bun.file(new URL(b.out, OUT_DIR)).text()
      expect(code).not.toContain("PRIVATE KEY")
      expect(code).not.toContain("service_account")
    }
  })
})
