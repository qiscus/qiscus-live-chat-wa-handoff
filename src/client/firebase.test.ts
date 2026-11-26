import { describe, expect, test } from "bun:test"
import { PushStageError, tokenOptions } from "./firebase"
import { errorDetail } from "./controller"

describe("PushStageError", () => {
  test("names the failing stage in the detail shown to the customer", () => {
    const e = new PushStageError("installations", new TypeError("Load failed"), "retried, googleapis unreachable")
    expect(errorDetail(e)).toBe("PushStageError: installations (retried, googleapis unreachable) — TypeError: Load failed")
  })
})

describe("tokenOptions", () => {
  const reg = {} as ServiceWorkerRegistration
  test("passes the VAPID key when the config has one", () => {
    expect(tokenOptions({ vapidKey: "k" }, reg)).toEqual({ vapidKey: "k", serviceWorkerRegistration: reg })
  })
  test("omits vapidKey entirely when absent (Firebase's default key)", () => {
    const opts = tokenOptions({}, reg)
    expect(opts).toEqual({ serviceWorkerRegistration: reg })
    expect("vapidKey" in opts).toBe(false)
    expect("vapidKey" in tokenOptions({ vapidKey: "" }, reg)).toBe(false)
  })
})
