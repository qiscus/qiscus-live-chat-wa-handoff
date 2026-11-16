import { describe, expect, test } from "bun:test"
import { MESSAGES, localizedText, resolveCustomerLocale } from "./i18n"

describe("customer locale", () => {
  test("chooses the first supported browser language and falls back to English", () => {
    expect(resolveCustomerLocale("id-ID")).toBe("id")
    expect(resolveCustomerLocale("id")).toBe("id")
    expect(resolveCustomerLocale("en-US")).toBe("en")
    expect(resolveCustomerLocale(["fr-FR", "id-ID"])).toBe("id")
    expect(resolveCustomerLocale("fr-FR")).toBe("en")
    expect(resolveCustomerLocale()).toBe("en")
  })

  test("English and Indonesian catalogs have identical keys", () => {
    expect(Object.keys(MESSAGES.en).sort()).toEqual(Object.keys(MESSAGES.id).sort())
  })

  test("returns localized copy and English fallback for unknown locale keys", () => {
    expect(localizedText("id", "enable")).toBe("Aktifkan notifikasi")
    expect(localizedText("en", "enable")).toBe("Enable notifications")
    expect(localizedText("id", "page.connecting")).toBe("Menghubungkan…")
    expect(localizedText("id", "not.a.real.key")).toBe("not.a.real.key")
  })

  test("notification guidance and page errors are available in both languages", () => {
    expect(MESSAGES.en.iosInstallSteps).toHaveLength(3)
    expect(MESSAGES.id.iosInstallSteps).toHaveLength(3)
    expect(MESSAGES.en.errorBlockedSteps).toHaveLength(3)
    expect(MESSAGES.id.errorBlockedSteps).toHaveLength(3)
    expect(MESSAGES.en["page.network_error"]).toContain("connection")
    expect(MESSAGES.id["page.network_error"]).toContain("koneksi")
  })
})

describe("static page copy matches the catalog", () => {
  const read = (name: string) => Bun.file(new URL(`../../public/${name}`, import.meta.url)).text()
  const en = MESSAGES.en as unknown as Record<string, string>
  const id = MESSAGES.id as unknown as Record<string, string>

  test("every status key the hosted page shows exists in both catalogs", async () => {
    // widget.html has no inline script (CSP script-src 'self'); page.ts shows
    // its status copy through localizedText(LOCALE, `page.<key>`).
    const page = await Bun.file(new URL("./page.ts", import.meta.url)).text()
    const list = page.match(/MESSAGE_KEYS = \[([\s\S]*?)\] as const/)?.[1] ?? ""
    const keys = [...list.matchAll(/"([a-z_]+)"/g)].map((m) => `page.${m[1]}`)
    expect(keys.length).toBeGreaterThanOrEqual(10)
    for (const key of [...keys, "page.connecting"]) {
      expect(en[key]).toBeString()
      expect(id[key]).toBeString()
    }
  })

  test("offline.html and the room error page use the catalog wording in both languages", async () => {
    const offline = await read("offline.html")
    expect(offline).toContain(en["page.offline"]!)
    expect(offline).toContain(id["page.offline"]!)
    expect(offline).toContain(id["page.offline_retry"]!)
    const room = await read("live-handover-room.html")
    for (const k of ["page.room_error_title", "page.room_error_message"]) {
      expect(room).toContain(en[k]!)
      expect(room).toContain(id[k]!)
    }
  })
})

describe("push error detail", () => {
  test("the error code label is localized instead of hard-coded Indonesian", async () => {
    const main = await Bun.file(new URL("./main.ts", import.meta.url)).text()
    expect(main).not.toContain("`Kode:")
    expect(main).toContain("TEXT.errorCode")
    expect(localizedText("en", "errorCode")).toBe("Code")
    expect(localizedText("id", "errorCode")).toBe("Kode")
  })
})
