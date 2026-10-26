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
  // Relative on purpose: resolved against the manifest's own URL, so the same file
  // works at a domain root and under a sub-path (see src/client/base.ts).
  test("stable id, same-origin start_url and scope", () => {
    expect(manifest.id).toBe("widget.html")
    expect(manifest.start_url).toBe("widget.html?source=pwa")
    expect(manifest.scope).toBe("./")
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
      const bytes = new Uint8Array(await Bun.file(pub(icon.src)).arrayBuffer())
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

describe("served under a path prefix", () => {
  // qismo-api serves these files under /api/v2/live_handover/w/. A root-absolute URL
  // ("/js/x.js") would then point outside the prefix, so the static pages must only use
  // relative ones, and scripts must derive their own prefix.
  const rootAbsolute = /(?:href|src|action)=["']\/(?!\/)/

  for (const file of ["widget.html", "live-handover-room.html", "offline.html"]) {
    test(`${file} has no root-absolute href/src`, async () => {
      expect(rootAbsolute.test(await Bun.file(pub(file)).text())).toBe(false)
    })
  }

  test("the manifest has no root-absolute URL", () => {
    for (const url of [manifest.id, manifest.start_url, manifest.scope, ...manifest.icons.map((i: { src: string }) => i.src)])
      expect(url.startsWith("/")).toBe(false)
  })

  test("the service worker derives its prefix from its own scope, not from literals", async () => {
    const sw = await Bun.file(pub("sw.js")).text()
    for (const literal of ['"/widget.html', '"/offline.html', '"/img/', '"/manifest.webmanifest'])
      expect(sw).not.toContain(literal)
  })

  test("the room's assets are 3 levels up (<prefix>iframes/v5/<app>/live-handover-room)", async () => {
    const html = await Bun.file(pub("live-handover-room.html")).text()
    for (const rel of ["css/qiscus-sdk.3.2.12.css", "js/qiscus-sdk.3.2.12.js", "js/third-party/aes.js", "js/push/handoff-room.js"]) {
      expect(html).toContain(`"../../../${rel}"`)
      expect(await Bun.file(pub(rel)).exists()).toBe(true)
    }
  })

  test("widget.html reads no scriptUrl/baseUrl/iframeUrl override when prefixed", async () => {
    const html = await Bun.file(pub("widget.html")).text()
    const body = /function fromQuery\(name\) \{\n([\s\S]*?)\n      \}/.exec(html)?.[1] ?? ""
    expect(body.trim().startsWith("if (prefixed) return DEFAULTS[name];")).toBe(true)
  })

  test("widget.html defaults the API and the room to its own prefix only when prefixed", async () => {
    const html = await Bun.file(pub("widget.html")).text()
    expect(html).toContain('baseUrl: prefixed ? location.origin : "https://qismo.qiscus.com"')
    expect(html).toContain('iframeUrl: prefixed ? new URL(".", location.href).href.replace(/\\/$/, "") : "https://omnichannel.qiscus.com"')
  })
})
