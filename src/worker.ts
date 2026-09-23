/**
 * Live Handover widget host — full-page Live Chat surface (WA -> Live Chat
 * handoff, spec §6/§8) served as a Cloudflare Worker via Hono.
 *
 * This is the "halaman client" from the spec's §8 table — the page a
 * WhatsApp invite link's redirector (`GET /c/:token` -> 302) points at. It
 * loads the same hosted `qismo-full-v5.js` (`QismoFull`) bundle as the
 * Installation Code snippet. The bundle owns token exchange and room mounting.
 *
 * `widget.html` (static asset, served at `/widget.html`) does the actual
 * work: the page loads the Qiscus-hosted bundle from staging2, and passes
 * staging2 API/iframe defaults (overridable via `?baseUrl=` and `?iframeUrl=`).
 * Switch these hosts to production after the feature is promoted.
 *
 * This Worker itself only serves `/` (a landing note) and static assets
 * (`/widget.html`) — no server logic, no secrets.
 */
import { Hono } from "hono"

const app = new Hono<{ Bindings: { ASSETS: Fetcher } }>()

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
  <code>/widget.html</code>. Bundle, API, dan iframe memakai host staging2
  sementara fitur belum dipromosikan. Setelah promosi, ganti host ke production.
  Override <code>baseUrl</code> dan <code>iframeUrl</code> via query parameter.</p>
  <p>Backend menambahkan token sekali-pakai di fragment <code>#t=...</code> saat
  membuat link. Jangan menambahkan token secara manual.</p>
</body>
</html>`)
})

// widget.html is served
// directly from Cloudflare's asset layer (Worker `assets` binding) — this
// fallback only fires for paths the asset layer didn't already claim, which
// with `runWorkerFirst` off (the default) never actually happens for files
// that exist in public/. Kept for a clear 404 on genuinely missing paths.
app.notFound((c) => c.text("Not found", 404))

export default app
