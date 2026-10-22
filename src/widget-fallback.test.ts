// widget.html's own fallback copy (shown when /js/push/handoff-push.js fails to load) must
// resolve EN/ID from browser languages without the bundle. Static: runs the inline script in a
// stubbed vm context; no browser, no network.
import { describe, expect, test } from "bun:test"
import vm from "node:vm"

const html = await Bun.file(new URL("../public/widget.html", import.meta.url)).text()
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!).join("\n")

type Nav = { languages?: readonly string[]; language?: string }

// Runs the page script with NO window.HandoffPush (bundle failed to load).
function run(nav: Nav, search = "") {
  const status = { textContent: "", style: {} as Record<string, string> }
  const root = { lang: "en" }
  let onerror: (() => void) | undefined
  const win: Record<string, unknown> = {}
  win.addEventListener = () => {}
  const ctx: Record<string, unknown> = {
    window: win,
    navigator: nav,
    location: { href: "https://w.example/widget.html" + search, search, hash: "", origin: "https://w.example", pathname: "/widget.html" },
    history: { replaceState() {} },
    console: { log() {} },
    URL,
    URLSearchParams,
    document: {
      documentElement: root,
      body: {},
      getElementById: () => status,
      createElement: () => {
        const s: Record<string, unknown> = {}
        Object.defineProperty(s, "onerror", { set: (f) => (onerror = f), get: () => onerror })
        return s
      },
      head: { appendChild: () => queueMicrotask(() => onerror?.()) },
    },
  }
  Object.assign(ctx, win)
  vm.runInNewContext(inline, ctx)
  return { status, root, failBundle: async () => (await Promise.resolve(), status.textContent) }
}

const EN_CONNECTING = "Connecting…"
const ID_CONNECTING = "Menghubungkan…"
const EN_INVALID = "The widget configuration is invalid."
const ID_INVALID = "Konfigurasi widget tidak valid."
const EN_NETWORK = "Unable to connect to the server. Check your connection and reload the page."
const ID_NETWORK = "Gagal terhubung ke server. Periksa koneksi Anda dan muat ulang halaman."

describe("widget.html fallback copy without the handoff-push bundle", () => {
  test("English is the default when no language is available", () => {
    const r = run({})
    expect(r.status.textContent).toBe(EN_CONNECTING)
    expect(r.root.lang).toBe("en")
  })

  test("navigator.languages with id first selects Indonesian", () => {
    const r = run({ languages: ["id-ID", "en-US"], language: "en-US" })
    expect(r.status.textContent).toBe(ID_CONNECTING)
    expect(r.root.lang).toBe("id")
  })

  test("navigator.languages wins over navigator.language", () => {
    expect(run({ languages: ["en-GB", "id"], language: "id-ID" }).status.textContent).toBe(EN_CONNECTING)
  })

  test("navigator.language is used when languages is missing or empty", () => {
    expect(run({ language: "id" }).status.textContent).toBe(ID_CONNECTING)
    expect(run({ languages: [], language: "id-ID" }).status.textContent).toBe(ID_CONNECTING)
  })

  test("unsupported languages fall back to English", () => {
    expect(run({ languages: ["fr-FR", "ja"], language: "fr-FR" }).status.textContent).toBe(EN_CONNECTING)
  })

  test("invalid-config error localizes (EN/ID)", () => {
    const q = "?scriptUrl=https%3A%2F%2Fevil.example%2Fx.js"
    expect(run({ languages: ["id-ID"] }, q).status.textContent).toBe(ID_INVALID)
    expect(run({ languages: ["en-US"] }, q).status.textContent).toBe(EN_INVALID)
  })

  test("bundle-load failure (script onerror) localizes (EN/ID)", async () => {
    expect(await run({ languages: ["id-ID"] }).failBundle()).toBe(ID_NETWORK)
    expect(await run({ languages: ["en-US"] }).failBundle()).toBe(EN_NETWORK)
    expect(await run({ languages: ["de"] }).failBundle()).toBe(EN_NETWORK)
  })

  test("static markup is English by default and does not hard-code Indonesian copy", () => {
    expect(html).toMatch(/<html lang="en">/)
    expect(html).not.toMatch(/Menghubungkan…<\/div>/)
  })
})
