/**
 * Live Handover — service worker (Web Push via the existing Qiscus FCM path).
 *
 * No Firebase SDK here: FCM delivers an ordinary Web Push message, so a plain
 * `push` listener handles it. The page (/js/push/handoff-push.js) mints the FCM
 * token through this registration and registers it with Qiscus.
 *
 * What it announces: a message in THE handoff room that is not the customer's
 * own and not a system event. The customer's SDK user is the same one the
 * WhatsApp room uses, so pushes for other rooms are expected and dropped.
 * The notification body is a plain-text preview of the agent's message (at most
 * PREVIEW_MAX characters; attachments use a localized label; no agent name.
 * Title, icon and click target are fixed: nothing else from the payload is ever
 * used for display or navigation.
 *
 * Caching: only the static shell below, and only as an OFFLINE fallback: every
 * shell request goes to the network first and refreshes the cached copy, so a
 * deploy is visible on the next load without bumping any cache name. The chat
 * page itself is network-first and never cached; APIs, the room iframe and
 * anything cross-origin are never intercepted.
 *
 * Updates: install -> skipWaiting, activate -> clients.claim, so a changed
 * sw.js takes over at once instead of waiting for every tab to close. The page
 * registers with updateViaCache "none" and calls registration.update() when it
 * becomes visible again (src/client/main.ts).
 */

/* global self, clients, caches, indexedDB */

const TITLE = "Live Chat"
const BODY_EN = "You have a new reply. Tap to open Live Chat."
const BODY_ID = "Ada balasan baru dari agen. Ketuk untuk membuka percakapan."
const PREVIEW_MAX = 120
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)(\?|#|$)/i
const HOUSEKEEPING_TAG = "handoff-housekeeping"

const SHELL_CACHE = "handoff-shell-v2"
const SHELL_PREFIX = "handoff-shell-"

// MUST match src/client/swContext.ts.
const CTX_DB = "qiscus-handoff-push"
const CTX_STORE = "ctx"
const CTX_KEY = "current"

// One worker per scope: the legacy root worker (Worker-env config) and, per app
// whose Firebase config comes from qismo-api, a worker registered from
// /a/<app>/sw.js with scope /a/<app>/ (its own push subscription / VAPID key).
// A per-app worker only ever reads ITS app's context.
const SCOPE_PATH = new URL(self.registration.scope).pathname
const SCOPE_PARTS = /^(.*\/)a\/([A-Za-z0-9_-]{1,64})\/$/.exec(SCOPE_PATH)
const SCOPE_APP = SCOPE_PARTS ? SCOPE_PARTS[2] : null
const MY_CTX_KEY = SCOPE_APP ? SCOPE_PATH : CTX_KEY
// The path prefix the app is served under ("/" on its own domain, or a sub-path
// when another server proxies it): the root worker's scope is the prefix itself,
// a per-app worker's scope is <prefix>a/<app>/.
const BASE = SCOPE_PARTS ? SCOPE_PARTS[1] : SCOPE_PATH
const ICON = BASE + "img/pwa/icon-192.png"
const BADGE = BASE + "img/pwa/badge-96.png"
const RESUME_PATH = BASE + "widget.html"
const RESUME_URL = BASE + "widget.html?source=notification"
const SHELL = [BASE + "offline.html", BASE + "manifest.webmanifest", BASE + "img/pwa/icon-192.png", BASE + "img/pwa/icon-512.png"]
// The only shape a notification click may reopen (written by our own page).
const RESUME_OK = new RegExp("^" + RESUME_PATH.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "\\?[A-Za-z0-9_%.~=&:-]*$")

// ------------------------------------------------------------------ context

function loadContext() {
  return new Promise((resolve) => {
    let req
    try {
      req = indexedDB.open(CTX_DB, 1)
    } catch (e) {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CTX_STORE)) req.result.createObjectStore(CTX_STORE)
    }
    req.onerror = () => resolve(null)
    req.onsuccess = () => {
      const db = req.result
      try {
        const get = db.transaction(CTX_STORE, "readonly").objectStore(CTX_STORE).get(MY_CTX_KEY)
        get.onsuccess = () => {
          db.close()
          const v = get.result
          const ok = v && typeof v.roomId === "string" && typeof v.selfEmail === "string"
          // An entry for another app under this scope is stale or tampered: push off.
          resolve(ok && (!SCOPE_APP || v.appId === SCOPE_APP) ? v : null)
        }
        get.onerror = () => {
          db.close()
          resolve(null)
        }
      } catch (e) {
        db.close()
        resolve(null)
      }
    }
  })
}

// ------------------------------------------------------------------ payload

function readPushData(data) {
  if (!data) return {}
  try {
    return data.json() || {}
  } catch (e) {
    return {}
  }
}

function asObject(value) {
  if (value && typeof value === "object") return value
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch (e) {
      return {}
    }
  }
  return {}
}

function digits(value) {
  const s = value === undefined || value === null ? "" : String(value)
  return /^\d{1,20}$/.test(s) ? s : null
}

/** The fields the decision needs, plus the message preview for the body. */
function extract(raw, locale) {
  const data = asObject(raw && raw.data)
  const inner = asObject(data.payload !== undefined ? data.payload : raw && raw.payload)
  return {
    roomId: digits(inner.room_id) || digits(inner.room_id_str) || digits(data.qiscus_room_id) || digits(raw && raw.qiscus_room_id),
    commentId: digits(inner.id) || digits(inner.id_str),
    type: typeof inner.type === "string" ? inner.type : null,
    email: typeof inner.email === "string" ? inner.email : null,
    preview: preview(inner, locale),
  }
}

function attachmentLabel(url, locale) {
  if (locale === "id") return IMAGE_EXT.test(String(url || "")) ? "Mengirim gambar" : "Mengirim file"
  return IMAGE_EXT.test(String(url || "")) ? "Sending an image" : "Sending a file"
}

/**
 * Plain-text preview of an agent comment, or null (-> generic BODY).
 * Notification bodies are rendered as text by the browser, never as HTML.
 */
function preview(comment, locale) {
  const extra = asObject(comment.payload)
  if (comment.type === "file_attachment") return attachmentLabel(extra.url, locale)
  if (typeof comment.message !== "string") return null
  const file = /^\s*\[file\]\s*(\S+)\s*\[\/file\]\s*$/i.exec(comment.message) // legacy SDK attachment text
  if (file) return attachmentLabel(file[1], locale)
  const text = comment.message.replace(/\s+/g, " ").trim()
  if (!text) return null
  const chars = Array.from(text) // do not cut an emoji / surrogate pair in half
  return chars.length > PREVIEW_MAX ? chars.slice(0, PREVIEW_MAX - 1).join("").trimEnd() + "…" : text
}

function shouldAnnounce(c, ctx) {
  if (!ctx) return false // this device is not registered for anyone
  if (c.roomId && c.roomId !== ctx.roomId) return false // another room of the same SDK user
  if (c.email && c.email === ctx.selfEmail) return false // own message
  if (c.type === "system_event") return false
  return true // unknown shape fails open: a missed reply is worse than a vague one
}

// ------------------------------------------------------------------ push

function isChatPage(client) {
  try {
    const u = new URL(client.url)
    return u.origin === self.location.origin && u.pathname === RESUME_PATH
  } catch (e) {
    return false
  }
}

async function handlePush(raw) {
  const ctx = await loadContext()
  const c = extract(raw, ctx && ctx.locale)
  const list = await clients.matchAll({ type: "window", includeUncontrolled: true })

  if (shouldAnnounce(c, ctx)) {
    if (list.some((w) => w.focused && isChatPage(w))) return // the open chat shows it
    const tag = "handoff-" + (c.roomId || ctx.roomId) + "-" + (c.commentId || "x")
    const existing = await self.registration.getNotifications({ tag })
    if (existing.length) return // same message via another FCM credential
    await self.registration.showNotification(TITLE, {
      body: c.preview || (ctx.locale === "id" ? BODY_ID : BODY_EN),
      icon: ICON,
      badge: BADGE,
      tag,
      renotify: false,
      data: ctx.resume && RESUME_OK.test(ctx.resume) ? { v: 1, resume: ctx.resume } : { v: 1 },
    })
    return
  }

  // Nothing to announce. Browsers require a visible notification for a push
  // when no page is visible (Chrome shows its own, Safari revokes the
  // subscription after repeated silent pushes), so show one and close it.
  if (list.some((w) => w.visibilityState === "visible")) return
  await self.registration.showNotification(TITLE, { tag: HOUSEKEEPING_TAG, silent: true, data: { v: 1 } })
  const shown = await self.registration.getNotifications({ tag: HOUSEKEEPING_TAG })
  shown.forEach((n) => n.close())
}

async function handleClick(data) {
  const resume = data && typeof data.resume === "string" && RESUME_OK.test(data.resume) ? data.resume : RESUME_URL
  const list = await clients.matchAll({ type: "window", includeUncontrolled: true })
  const target = list.find(isChatPage)
  if (target) {
    await target.focus()
    return
  }
  await clients.openWindow(resume)
}

// ------------------------------------------------------------------ shell cache

async function install() {
  const cache = await caches.open(SHELL_CACHE)
  await cache.addAll(SHELL)
}

async function activate() {
  const names = await caches.keys()
  await Promise.all(names.filter((n) => n.startsWith(SHELL_PREFIX) && n !== SHELL_CACHE).map((n) => caches.delete(n)))
  await clients.claim()
}

function routeFetch(event) {
  const req = event.request
  if (req.method !== "GET") return
  let url
  try {
    url = new URL(req.url)
  } catch (e) {
    return
  }
  if (url.origin !== self.location.origin) return

  if (req.mode === "navigate" && url.pathname === RESUME_PATH) {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(BASE + "offline.html")) || new Response("Offline", { status: 503 })),
    )
    return
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(networkFirstShell(req, url.pathname))
  }
}

// Network first, cached copy only when the network fails. A fresh 200 replaces
// the cached copy, so the shell never pins an old deploy.
async function networkFirstShell(req, path) {
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const copy = res.clone()
      caches
        .open(SHELL_CACHE)
        .then((cache) => cache.put(path, copy))
        .catch(() => {})
    }
    return res
  } catch (e) {
    const hit = await caches.match(path)
    if (hit) return hit
    throw e
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(install().then(() => self.skipWaiting()))
})
self.addEventListener("activate", (event) => {
  event.waitUntil(activate())
})
self.addEventListener("fetch", routeFetch)
self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(readPushData(event.data)))
})
self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(handleClick(event.notification.data))
})
