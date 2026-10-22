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
    const sdk = await Bun.file(pub("js/qiscus-sdk.3.2.13.js")).text()

    expect(room.includes("qiscus-sdk.3.2.13.js")).toBe(true)
    expect(room.includes("qiscus-sdk.3.2.13.css")).toBe(true)
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
    expect(await Bun.file(pub("js/qiscus-sdk.3.2.13.js")).exists()).toBe(true)
    expect(await Bun.file(pub("css/qiscus-sdk.3.2.13.css")).exists()).toBe(true)
  })
})
