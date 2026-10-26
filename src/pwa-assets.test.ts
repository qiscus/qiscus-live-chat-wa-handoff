// Static PWA assets: manifest, icons, offline page. No network.
import { describe, expect, test } from "bun:test"

const pub = (p: string) => new URL("../public/" + p, import.meta.url)
const manifest = await Bun.file(pub("manifest.webmanifest")).json()

function pngSize(bytes: Uint8Array): [number, number] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset)
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return [dv.getUint32(16), dv.getUint32(20)]
}

describe("manifest.webmanifest", () => {
  test("stable id, same-origin start_url and scope", () => {
    expect(manifest.id).toBe("/widget.html")
    expect(manifest.start_url).toBe("/widget.html?source=pwa")
    expect(manifest.scope).toBe("/")
    expect(manifest.display).toBe("standalone")
  })

  test("carries no token or credential, and no fragment", () => {
    for (const field of ["id", "start_url", "scope"]) expect(manifest[field]).not.toContain("#")
    const text = JSON.stringify(manifest)
    for (const bad of ["t=", "token", "identity", "baseUrl", "iframeUrl", "scriptUrl", "app_id"]) {
      expect(text).not.toContain(bad)
    }
  })

  test("every icon exists with the declared size; a maskable icon is present", async () => {
    for (const icon of manifest.icons) {
      const bytes = new Uint8Array(await Bun.file(pub(icon.src.slice(1))).arrayBuffer())
      const [w, h] = pngSize(bytes)
      expect(`${w}x${h}`).toBe(icon.sizes)
    }
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true)
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true)
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true)
  })

  test("apple touch icon and notification badge exist", async () => {
    const [aw] = pngSize(new Uint8Array(await Bun.file(pub("img/pwa/apple-touch-icon-180.png")).arrayBuffer()))
    expect(aw).toBe(180)
    const [bw] = pngSize(new Uint8Array(await Bun.file(pub("img/pwa/badge-96.png")).arrayBuffer()))
    expect(bw).toBe(96)
  })

  test("offline page is static and self-contained", async () => {
    const html = await Bun.file(pub("offline.html")).text()
    expect(html).not.toMatch(/<script\s+src=/i)
    expect(html).not.toMatch(/https?:\/\//)
  })
})

describe("customer End chat bundle", () => {
  test("room and parent bundle implement the end-chat message contract", async () => {
    const room = await Bun.file(pub("live-handover-room.html")).text()
    const hosted = await Bun.file(pub("widget.html")).text()
    const widget = await Bun.file(pub("js/qismo-full-v5.js")).text()
    const sdk = await Bun.file(pub("js/qiscus-handoff.js")).text()

    expect(room.includes("qiscus-handoff.js")).toBe(true)
    expect(room.includes("qiscus-handoff.css")).toBe(true)
    expect(room.includes("customerEndChat: true")).toBe(true)
    expect(room.includes("customerLocale: 'auto'")).toBe(true)
    expect(room.includes("END_CHAT_TIMEOUT_MS = 15000")).toBe(true)
    expect(room.includes("qiscus:customer-end-chat-result")).toBe(true)
    expect(room.includes("e.source !== window.parent")).toBe(true)
    expect(hosted.includes("customerEndChat: true")).toBe(false)
    expect(widget.includes("qiscus:customer-end-chat")).toBe(true)
    expect(widget.includes("qiscus:customer-end-chat-result")).toBe(true)
    expect(sdk.includes("customerEndChat")).toBe(true)
    expect(sdk.includes("Akhiri chat")).toBe(true)
    expect(await Bun.file(pub("js/qiscus-handoff.js")).exists()).toBe(true)
    expect(await Bun.file(pub("css/qiscus-handoff.css")).exists()).toBe(true)
  })
})

describe("multilingual static assets", () => {
  test("the handover room page uses an SDK build that contains the customer locale logic", async () => {
    const html = await Bun.file(pub("live-handover-room.html")).text()
    const css = /href="(\/css\/qiscus-handoff\.css)"/.exec(html)?.[1]
    const js = /src="(\/js\/qiscus-handoff\.js)"/.exec(html)?.[1]
    expect(css).toBeDefined()
    expect(js).toBeDefined()
    expect(html).toContain("customerLocale: 'auto'")
    const sdk = await Bun.file(pub(js!.slice(1))).text()
    expect(sdk).toContain("customerLocale")
    expect(sdk).toContain("Akhiri chat")
    expect(sdk).toContain("Seret file ke sini untuk mengunggah")
    expect(await Bun.file(pub(css!.slice(1))).exists()).toBe(true)
  })

  test("the manifest carries no Indonesian-only copy now that English is the fallback", () => {
    expect(manifest.lang).toBe("en")
    expect(manifest.description).not.toMatch(/Lanjutkan/)
  })

  test("static pages default to English and only switch to Indonesian from browser languages", async () => {
    // widget.html resolves its own locale (independent of the handoff-push bundle) from navigator.languages.
    const widget = await Bun.file(pub("widget.html")).text()
    expect(widget).toMatch(/<html lang="en">/)
    expect(widget).toContain("navigator.languages")
    for (const page of ["offline.html", "live-handover-room.html"]) {
      const html = await Bun.file(pub(page)).text()
      expect(html).toMatch(/<html lang="en">/)
      expect(html).toContain("navigator.languages")
    }
    const bundle = await Bun.file(pub("js/push/handoff-push.js")).text()
    expect(bundle).toContain("navigator.languages")
  })
})
