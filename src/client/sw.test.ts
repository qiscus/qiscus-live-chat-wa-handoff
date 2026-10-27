// SYNTHETIC: public/sw.js evaluated against fake self/clients/caches/IndexedDB.
// Push payloads below are invented, shaped after qiscus-sdk-api's sendPN map
// ({qiscus_sdk, qiscus_room_id, aps, payload: formatPubsubPayload(...)}) as it
// might arrive through FCM's web push envelope. The real Flash/FCM payload has
// NOT been observed yet — see README "Unverified".
import { beforeEach, describe, expect, test } from "bun:test"
import { CTX_DB, CTX_KEY, CTX_STORE, writeSwContext } from "./swContext"
import { loadServiceWorker, type SwHarness } from "./swTesting"

const ORIGIN = "https://handoff.example.invalid"
const SW_SOURCE = await Bun.file(new URL("../../public/sw.js", import.meta.url)).text()
const CTX = { appId: "app1", roomId: "500", selfEmail: "customer@example.invalid" }

function fcmEnvelope(comment: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  // FCM data values are strings; the SDK payload arrives JSON-encoded.
  return {
    from: "123456789012",
    fcmMessageId: "synthetic-" + Math.random(),
    data: {
      qiscus_sdk: "post_comment",
      qiscus_room_id: String(comment.room_id ?? ""),
      payload: JSON.stringify(comment),
      ...extra,
    },
  }
}

function pushData(obj: unknown) {
  return { json: () => obj, text: () => JSON.stringify(obj) }
}

const agentReply = (over: Record<string, unknown> = {}) => ({
  id: 9001,
  room_id: 500,
  type: "text",
  message: "Synthetic secret order details",
  email: "agent@example.invalid",
  username: "Synthetic Agent",
  ...over,
})

let sw: SwHarness

async function withContext(ctx: typeof CTX | null) {
  // Written exactly as the page does it (swContext.ts), read by the SW.
  await writeSwContext(sw.indexedDB as unknown as IDBFactory, ctx)
}

async function push(obj: unknown) {
  await sw.dispatch("push", { data: pushData(obj) })
}

const visible = () => sw.shown.filter((n) => !n.closed)

beforeEach(async () => {
  sw = await loadServiceWorker(SW_SOURCE, ORIGIN)
})

describe("sw.js push handling (synthetic)", () => {
  test("agent reply in the handoff room -> one notification whose body is the message, no agent name", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply()))
    expect(visible()).toHaveLength(1)
    const n = visible()[0]!
    expect(n.title).toBe("Live Chat")
    expect(n.options.body).toBe("Synthetic secret order details")
    expect(JSON.stringify(n)).not.toContain("Synthetic Agent")
    expect(n.options.tag).toBe("handoff-500-9001")
    expect(n.options.renotify).toBe(false)
  })

  test("long or multi-line messages are collapsed and cut to 120 characters with an ellipsis", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ message: "Halo\n\n  kak,   " + "a".repeat(200) })))
    const body = visible()[0]!.options.body as string
    expect(Array.from(body)).toHaveLength(120)
    expect(body.startsWith("Halo kak, aaa")).toBe(true)
    expect(body.endsWith("…")).toBe(true)
  })

  test("the cut never splits an emoji", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ message: "😀".repeat(130) })))
    const body = visible()[0]!.options.body as string
    expect(body).toBe("😀".repeat(119) + "…")
  })

  test("attachments become a label instead of a URL", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ id: 1, type: "file_attachment", message: "", payload: { url: "https://cdn.example/a/photo.JPG?x=1" } })))
    await push(fcmEnvelope(agentReply({ id: 2, type: "file_attachment", message: "", payload: { url: "https://cdn.example/a/invoice.pdf" } })))
    await push(fcmEnvelope(agentReply({ id: 3, message: "[file] https://cdn.example/b/pic.png [/file]" })))
    await push(fcmEnvelope(agentReply({ id: 4, message: "[file] https://cdn.example/b/doc.xlsx [/file]" })))
    expect(visible().map((n) => n.options.body)).toEqual(["Mengirim gambar", "Mengirim file", "Mengirim gambar", "Mengirim file"])
    expect(JSON.stringify(visible())).not.toContain("cdn.example")
  })

  test("an empty or non-text message falls back to the generic body", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ id: 1, message: "   \n " })))
    await push(fcmEnvelope(agentReply({ id: 2, message: undefined })))
    expect(visible().map((n) => n.options.body)).toEqual([
      "Ada balasan baru dari agen. Ketuk untuk membuka percakapan.",
      "Ada balasan baru dari agen. Ketuk untuk membuka percakapan.",
    ])
  })

  test("the same message delivered twice (N FCM credentials) shows once", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply()))
    await push(fcmEnvelope(agentReply()))
    expect(sw.shown).toHaveLength(1)
  })

  test("two different replies are two notifications", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply()))
    await push(fcmEnvelope(agentReply({ id: 9002 })))
    expect(visible().map((n) => n.options.tag)).toEqual(["handoff-500-9001", "handoff-500-9002"])
  })

  test("own message is not announced", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ email: CTX.selfEmail })))
    expect(visible()).toHaveLength(0)
  })

  test("system events are not announced", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ type: "system_event", message: "Synthetic Agent joined this conversation" })))
    expect(visible()).toHaveLength(0)
  })

  test("pushes for another room (e.g. the customer's WhatsApp room) are not announced", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ room_id: 77 })))
    expect(visible()).toHaveLength(0)
  })

  test("room id only in the FCM data envelope is still honoured", async () => {
    await withContext(CTX)
    const env = fcmEnvelope({ id: 1, type: "text", message: "x", email: "agent@example.invalid" })
    env.data.qiscus_room_id = "77"
    await push(env)
    expect(visible()).toHaveLength(0)
  })

  test("no registration context (unregistered device) -> nothing announced", async () => {
    await withContext(null)
    await push(fcmEnvelope(agentReply()))
    expect(visible()).toHaveLength(0)
  })

  test("a dropped push with no visible page leaves no notification behind (shown then closed)", async () => {
    await withContext(CTX)
    await push(fcmEnvelope(agentReply({ email: CTX.selfEmail })))
    expect(sw.shown).toHaveLength(1)
    expect(sw.shown[0]!.closed).toBe(true)
  })

  test("a dropped push while a page is visible shows nothing at all", async () => {
    await withContext(CTX)
    sw.windows.push({ url: ORIGIN + "/widget.html", focused: false, visibilityState: "visible" })
    await push(fcmEnvelope(agentReply({ type: "system_event" })))
    expect(sw.shown).toHaveLength(0)
  })

  test("chat page focused -> the page already shows it, no notification", async () => {
    await withContext(CTX)
    sw.windows.push({ url: ORIGIN + "/widget.html?source=pwa", focused: true, visibilityState: "visible" })
    await push(fcmEnvelope(agentReply()))
    expect(sw.shown).toHaveLength(0)
  })

  test("unknown payload shape fails open to a generic notification (missed replies are worse)", async () => {
    await withContext(CTX)
    await sw.dispatch("push", { data: { json: () => { throw new Error("not json") }, text: () => "garbage" } })
    await sw.dispatch("push", { data: null })
    expect(visible().length).toBeGreaterThanOrEqual(1)
    expect(visible()[0]!.options.body).toBe("Ada balasan baru dari agen. Ketuk untuk membuka percakapan.")
  })

  test("hostile payload fields never reach the notification or the click target", async () => {
    await withContext(CTX)
    await push({
      notification: { title: "Evil title", body: "Evil body", icon: "https://evil.example/x.png", click_action: "https://evil.example" },
      data: { qiscus_room_id: "500", url: "https://evil.example", payload: JSON.stringify(agentReply({ id: "<script>", username: "Evil Agent" })) },
    })
    const n = visible()[0]!
    const dump = JSON.stringify(n)
    expect(dump).not.toContain("evil")
    expect(dump).not.toContain("Evil")
    expect(n.options.tag).toBe("handoff-500-x") // non-numeric comment id is not trusted
  })
})

describe("sw.js notification click (synthetic)", () => {
  test("focuses an open chat page instead of opening another", async () => {
    sw.windows.push({ url: ORIGIN + "/widget.html", focused: false, visibilityState: "hidden" })
    let closed = false
    await sw.dispatch("notificationclick", { notification: { close: () => (closed = true), data: { url: "https://evil.example" } } })
    expect(closed).toBe(true)
    expect(sw.focused).toEqual([ORIGIN + "/widget.html"])
    expect(sw.opened).toEqual([])
  })

  test("opens the fixed same-origin resume URL when nothing is open", async () => {
    sw.windows.push({ url: ORIGIN + "/", focused: false, visibilityState: "hidden" })
    await sw.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://evil.example" } } })
    expect(sw.opened).toEqual(["/widget.html?source=notification"])
  })
})

describe("sw.js cache scope (synthetic)", () => {
  test("install precaches only the static shell", async () => {
    await sw.dispatch("install", {})
    const cached = [...sw.cache.values()].flatMap((c) => [...c.keys()]).map((u) => new URL(u).pathname).sort()
    expect(cached).toEqual(["/img/pwa/icon-192.png", "/img/pwa/icon-512.png", "/manifest.webmanifest", "/offline.html"])
  })

  test("activate removes only older handoff shell caches", async () => {
    sw.cache.set("handoff-shell-v0", new Map())
    sw.cache.set("someone-else", new Map())
    await sw.dispatch("activate", {})
    expect([...sw.cache.keys()].sort()).toEqual(["someone-else"])
  })

  const req = (url: string, mode = "no-cors", method = "GET") => ({ url, mode, method }) as unknown as Request

  test("private and cross-origin requests are never intercepted", async () => {
    await sw.dispatch("install", {})
    for (const url of [
      ORIGIN + "/push/config",
      "https://api3.qiscus.com/api/v2/sdk/load_comments",
      ORIGIN + "/iframes/v5/app1/live-handover-room?resume=1",
      ORIGIN + "/js/qiscus-sdk.3.2.12.js",
    ]) {
      const ev: any = { request: req(url) }
      await sw.dispatch("fetch", ev)
      expect(ev.handled).toBe(false)
    }
    const post: any = { request: req(ORIGIN + "/manifest.webmanifest", "cors", "POST") }
    await sw.dispatch("fetch", post)
    expect(post.handled).toBe(false)
  })

  test("chat page navigation is network-first with an offline fallback, never cached", async () => {
    await sw.dispatch("install", {})
    const online: any = { request: req(ORIGIN + "/widget.html?source=pwa", "navigate") }
    await sw.dispatch("fetch", online)
    expect(await online.response.text()).toBe("network:" + ORIGIN + "/widget.html?source=pwa")
    const offline: any = { request: req(ORIGIN + "/widget.html?offline-test=1", "navigate") }
    await sw.dispatch("fetch", offline)
    expect(await offline.response.text()).toBe("cached:/offline.html")
    const cachedPaths = [...sw.cache.values()].flatMap((c) => [...c.keys()]).map((u) => new URL(u).pathname)
    expect(cachedPaths).not.toContain("/widget.html")
  })

  test("shell assets are network-first and refresh the cached copy (a deploy is never pinned)", async () => {
    await sw.dispatch("install", {})
    const ev: any = { request: req(ORIGIN + "/manifest.webmanifest") }
    await sw.dispatch("fetch", ev)
    expect(await ev.response.text()).toBe("network:" + ORIGIN + "/manifest.webmanifest")
    await new Promise((r) => setTimeout(r, 0))
    const stored = [...sw.cache.values()].map((c) => c.get(ORIGIN + "/manifest.webmanifest")).find(Boolean)
    expect(await stored!.clone().text()).toBe("network:" + ORIGIN + "/manifest.webmanifest")
  })

  test("shell assets fall back to the cached copy only when the network fails", async () => {
    await sw.dispatch("install", {})
    const ev: any = { request: req(ORIGIN + "/offline.html?offline-test=1") }
    await sw.dispatch("fetch", ev)
    expect(await ev.response.text()).toBe("cached:/offline.html")
  })

  test("a new sw.js takes over immediately: skipWaiting on install, clients.claim on activate", () => {
    expect(SW_SOURCE).toMatch(/install\(\)\.then\(\(\) => self\.skipWaiting\(\)\)/)
    expect(SW_SOURCE).toContain("await clients.claim()")
  })
})

describe("page <-> SW context contract", () => {
  test("sw.js reads the same IndexedDB names the page writes", () => {
    expect(SW_SOURCE).toContain(`"${CTX_DB}"`)
    expect(SW_SOURCE).toContain(`"${CTX_STORE}"`)
    expect(SW_SOURCE).toContain(`"${CTX_KEY}"`)
  })
})

describe("sw.js served under a path prefix (synthetic)", () => {
  // qismo-api serves the app under a sub-path; the worker's prefix is its own scope.
  const PREFIX = "/api/v2/live_handover/w/"

  test("icons, the notification click and the offline shell all live under the prefix", async () => {
    sw = await loadServiceWorker(SW_SOURCE, ORIGIN, PREFIX)
    await withContext(CTX)
    await push(fcmEnvelope(agentReply()))
    expect(visible()[0]!.options.icon).toBe(`${PREFIX}img/pwa/icon-192.png`)
    expect(visible()[0]!.options.badge).toBe(`${PREFIX}img/pwa/badge-96.png`)
    await sw.dispatch("notificationclick", { notification: { close() {}, data: visible()[0]!.options.data } })
    expect(sw.opened).toEqual([`${PREFIX}widget.html?source=notification`])
  })
})

