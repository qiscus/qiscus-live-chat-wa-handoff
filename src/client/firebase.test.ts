import { afterEach, describe, expect, test } from "bun:test"
import { deleteApp, getApps } from "firebase/app"
import { PushStageError, firebaseApp } from "./firebase"
import { errorDetail } from "./controller"

describe("PushStageError", () => {
  test("names the failing stage in the detail shown to the customer", () => {
    const e = new PushStageError("installations", new TypeError("Load failed"), "retried, googleapis unreachable")
    expect(errorDetail(e)).toBe("PushStageError: installations (retried, googleapis unreachable) — TypeError: Load failed")
  })
})

// SYNTHETIC Firebase web configs (no network: initializeApp only stores options).
const fb = (n: string, sender: string) =>
  ({ status: "configured", vapidKey: "v", appCodes: null, roomOrigins: [], firebase: { apiKey: "AIza" + n.repeat(35), projectId: `proj-${n}-synth`, messagingSenderId: sender, appId: `1:${sender}:web:abcdef012345` } }) as never

describe("firebaseApp: one Firebase app per project, reused", () => {
  afterEach(async () => {
    await Promise.all(getApps().map((a) => deleteApp(a)))
  })
  test("the same project always gets the same app (token minting asks for it several times)", () => {
    const one = firebaseApp(fb("1", "111111111111"))
    expect(firebaseApp(fb("1", "111111111111"))).toBe(one)
    expect(getApps()).toHaveLength(1)
  })
  test("a second project gets its own app, and asking again for either does not create more", () => {
    const one = firebaseApp(fb("1", "111111111111"))
    const two = firebaseApp(fb("2", "222222222222"))
    expect(two).not.toBe(one)
    expect(two.options.projectId).toBe("proj-2-synth")
    expect(firebaseApp(fb("2", "222222222222"))).toBe(two)
    expect(firebaseApp(fb("1", "111111111111"))).toBe(one)
    expect(getApps()).toHaveLength(2)
  })
})
