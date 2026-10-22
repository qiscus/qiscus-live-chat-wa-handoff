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

  test("widget.html keys exist in both catalogs and its EN/ID fallback dictionaries equal the catalogs", async () => {
    const html = await read("widget.html")
    const keys = [...html.matchAll(/text\("(page\.[a-z_]+)"\)/g)].map((m) => m[1]!)
    expect(keys.length).toBeGreaterThanOrEqual(10)
    for (const key of keys) {
      expect(en[key]).toBeString()
      expect(id[key]).toBeString()
    }
    const block = (lang: "en" | "id") => html.match(new RegExp(`\\n {8}${lang}: \\{([\\s\\S]*?)\\n {8}\\},`))![1]!
    for (const [lang, catalog] of [["en", en], ["id", id]] as const) {
      const entries = [...block(lang).matchAll(/"(page\.[a-z_]+)": "([^"]+)"/g)]
      expect(entries.map((e) => e[1]).sort()).toEqual([...new Set(keys)].sort())
      for (const [, key, value] of entries) expect(value).toBe(catalog[key!]!)
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
