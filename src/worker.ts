/**
 * Live Handover widget host — full-page Live Chat surface (WA -> Live Chat
 * handoff, spec §6/§8) served as a Cloudflare Worker via Hono.
 *
 * This is the "halaman client" from the spec's §8 table — the page a
 * WhatsApp invite link's redirector (`GET /c/:token` -> 302) points at. It
 * loads the `qismo-full-v5.js` (`QismoFull`) bundle, a copy of the
 * multichannel-frontend build served from this Worker at
 * `/js/qismo-full-v5.js`. The bundle owns token exchange and room mounting.
 *
 * `widget.html` (static asset, served at `/widget.html`) does the actual
 * work: it loads the bundled script and passes production API/iframe
 * defaults (the API host is overridable via `?baseUrl=`; the bundle and the
 * room iframe always come from this Worker).
 *
 * This Worker itself only serves `/` (a landing note), the handoff room at
 * `/iframes/v5/:app_code/live-handover-room`, `GET /push/config` (public FCM
 * web config for the push opt-in, see README) and static assets
 * (`/widget.html`, `/sw.js`, `/manifest.webmanifest`, `/js/*`, `/css/*`,
 * `/img/*`). It sends no push and holds no secrets.
 */
import { Hono } from "hono"
import { type PushEnv, readPushConfig } from "./push/config"

const APP_CODE = /^[A-Za-z0-9_-]{1,64}$/

type Bindings = { ASSETS: Fetcher } & PushEnv

const app = new Hono<{ Bindings: Bindings }>()

// Public Web Push (FCM) config for the page: Firebase web-app config + VAPID
// public key, or `unconfigured` with the missing/invalid env NAMES. Only
// public identifiers leave here; the Worker holds no sender credentials and
// sends no push — the existing Qiscus sender does. Same-origin only (no CORS).
app.get("/push/config", (c) => {
  c.header("Cache-Control", "no-store")
  return c.json(readPushConfig(c.env))
})

// Per-app service-worker script. A push subscription is bound to one service
// worker registration and one VAPID key, so each app whose Firebase config
// comes from qismo-api registers the same sw.js from its own path, giving it
// its own scope (/a/<app>/) and subscription. The path alone limits the scope
// (a worker may control its own directory), so no Service-Worker-Allowed header
// is sent: a fixed "/a/<app>/" there would be wrong when this app is served under
// a sub-path by a reverse proxy. Never cached, like /sw.js.
app.get("/a/:appCode/sw.js", async (c) => {
  const appCode = c.req.param("appCode")
  if (!APP_CODE.test(appCode)) return c.text("Not found", 404)
  const url = new URL(c.req.url)
  url.pathname = "/sw.js"
  url.search = ""
  const asset = await c.env.ASSETS.fetch(new Request(url, { method: "GET" }))
  if (!asset.ok) return c.text("Not found", 404)
  return new Response(asset.body, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
})

app.get("/", (c) => {
  return c.html(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Live Handover Widget</title>
  <style>
    body { font: 15px/1.6 -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #141b2d; }
    code { background: #f1f3f8; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Live Handover Widget</h1>
  <p>Sample page untuk implementasi WhatsApp → Live Chat handoff. Halaman ini
  hanya menerima invite yang sudah dibuat backend; tidak membuat invite atau
  mengirim pesan WhatsApp.</p>
  <p>Atur <code>page_url</code> ke
  <code>/widget.html</code>. Bundle dan iframe room selalu dilayani Worker ini;
  API memakai production kecuali di-override lewat query parameter
  <code>baseUrl</code> (mis. host staging).</p>
  <p>Backend menambahkan token sekali-pakai di fragment <code>#t=...</code> saat
  membuat link. Jangan menambahkan token secara manual.</p>
</body>
</html>`)
})

// Handoff room iframe (port of multichannel-frontend's
// iframes/v5/live-handover-room.blade.php). QismoFull builds
// `${iframeUrl}/iframes/v5/<app_code>/live-handover-room?...`; the page reads
// its query itself, so the Worker only maps the path to the static file.
app.get("/iframes/v5/:appCode/live-handover-room", (c) => {
  const url = new URL(c.req.url)
  url.pathname = "/live-handover-room.html"
  return c.env.ASSETS.fetch(new Request(url, c.req.raw))
})

// widget.html is served
// directly from Cloudflare's asset layer (Worker `assets` binding) — this
// fallback only fires for paths the asset layer didn't already claim, which
// with `runWorkerFirst` off (the default) never actually happens for files
// that exist in public/. Kept for a clear 404 on genuinely missing paths.
app.notFound((c) => c.text("Not found", 404))

export default app
