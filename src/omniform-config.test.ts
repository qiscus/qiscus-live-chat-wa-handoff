import { describe, expect, test } from "bun:test"
import app from "./worker"
import { omniformScript, readOmniformConfig } from "./omniform-config"

const roomHtml = '<head><!-- omniform-config --><script src="sdk.js"></script></head>'
const assets = { fetch: async () => new Response(roomHtml, { headers: { "content-type": "text/html" } }) } as unknown as Fetcher
const room = (env: Record<string, string> = {}) =>
  app.request("/iframes/v5/someapp/live-handover-room", {}, { ASSETS: assets, ...env })

describe("readOmniformConfig", () => {
  test("off with no origins by default", () => {
    expect(readOmniformConfig({})).toEqual({ enabled: false, allowedOrigins: [] })
  })
  test("enabled only for truthy values", () => {
    for (const v of ["true", "1", "on", "YES"]) expect(readOmniformConfig({ OMNIFORM_WIDGET_ENABLED: v }).enabled).toBe(true)
    for (const v of ["false", "0", "", "maybe"]) expect(readOmniformConfig({ OMNIFORM_WIDGET_ENABLED: v }).enabled).toBe(false)
  })
  test("origins are split on commas, trimmed, blanks dropped", () => {
    expect(readOmniformConfig({ OMNIFORM_ALLOWED_ORIGINS: " https://a.example , ,https://b.example " }).allowedOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ])
  })
  test("script cannot be closed by a value", () => {
    expect(omniformScript({ enabled: true, allowedOrigins: ["</script><b>"] })).not.toContain("</script><b>")
  })
})

describe("room page injection", () => {
  test("defaults to disabled, placed before the SDK script", async () => {
    const html = await (await room()).text()
    expect(html).toContain('window.qiscusOmniForm = {"enabled":false,"allowedOrigins":[]}')
    expect(html.indexOf("qiscusOmniForm")).toBeLessThan(html.indexOf("sdk.js"))
    expect(html).not.toContain("<!-- omniform-config -->")
  })
  test("reflects env", async () => {
    const html = await (await room({ OMNIFORM_WIDGET_ENABLED: "true", OMNIFORM_ALLOWED_ORIGINS: "https://form.example" })).text()
    expect(html).toContain('{"enabled":true,"allowedOrigins":["https://form.example"]}')
  })
})
