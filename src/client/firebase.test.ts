import { describe, expect, test } from "bun:test"
import { PushStageError } from "./firebase"
import { errorDetail } from "./controller"

describe("PushStageError", () => {
  test("names the failing stage in the detail shown to the customer", () => {
    const e = new PushStageError("installations", new TypeError("Load failed"), "retried, googleapis unreachable")
    expect(errorDetail(e)).toBe("PushStageError: installations (retried, googleapis unreachable) — TypeError: Load failed")
  })
})
