# Qiscus WhatsApp → Live Chat Handoff — Sample

This repository is a **sample client page** for continuing a WhatsApp conversation
in a Qiscus Live Chat widget after a handoff. It demonstrates how to receive the
handoff token, exchange it with the Qiscus API, and show the resulting Live Chat
room in a full-page iframe.

This is an implementation sample, not a complete handoff product or a production
deployment for a specific customer. It does **not** create invites, send WhatsApp
messages, configure channels, or replace the backend/bot integration. Those parts
must already be implemented and enabled in the selected Qiscus environment.

## Flow

1. The backend creates a one-time handoff invite and sends the customer to this
   page with the token in the URL fragment (`#t=...`).
2. The page exchanges that token through `POST /api/v2/live_handover/exchange`.
3. On success, the page opens the existing Live Chat room in a full-page iframe.

The backend adds the token fragment to the configured `page_url`; do not add or
copy a token into the page URL yourself. The fragment is not sent in HTTP requests.

## Page URL configuration

The sample defaults to Qiscus production:

- Widget bundle: `/js/qismo-full-v5.js`, served by this same Worker
- API base URL: `https://qismo.qiscus.com`
- Live Chat iframe host: `https://omnichannel.qiscus.com`

Use the resulting Worker URL as the `page_url` in the WhatsApp handoff settings:

```text
https://<worker-host>/widget.html
```

The page loads `public/js/qismo-full-v5.js`, a copy of the `qismo-full-v5.js`
bundle built in `multichannel-frontend` (`qismo-widget`). Bundling it here keeps
the widget working while the Qiscus-hosted copy is missing or outdated. To
update it, rebuild in `multichannel-frontend` and copy `public/js/qismo-full-v5.js`
(and its `.map`) into `public/js/` here, then redeploy.

The page reads the invite token and optional `scriptUrl` / `baseUrl` /
`iframeUrl` overrides from the page URL, exchanges the token with the configured
API, then opens the returned room. Production hosts are used when no overrides
are present. No app ID needs to be embedded in this handoff-only page.

For another environment, the settings URL can override the API and iframe hosts:

```text
https://<worker-host>/widget.html?baseUrl=<api-base-url>&iframeUrl=<iframe-host>
```

For staging, override only the API and iframe hosts; the bundled script stays:

```text
https://<worker-host>/widget.html?baseUrl=https%3A%2F%2Fqismo-stag2.qiscus.io&iframeUrl=https%3A%2F%2Fqismo-stag2.qiscus.io
```

`scriptUrl` can still point at another bundle (e.g. a Qiscus-hosted build).

`scriptUrl`, `baseUrl` and `iframeUrl` only accept HTTPS URLs on `qiscus.com` /
`qiscus.io` (and their subdomains), or `localhost` / `127.0.0.1` for local
builds; `scriptUrl` also accepts this page's own origin. Anything else is
refused so a crafted link cannot inject arbitrary
JavaScript or send the invite token to a foreign host. The page passes
`baseUrl` / `iframeUrl` to `QismoFull` as options, so it works with bundles that
do not parse those query params themselves.

Never put an app secret or a raw invite token in query parameters.

The selected backend must have the handoff exchange endpoint enabled and must
allow the deployed page origin through CORS. Deploying this Worker alone does not
enable the backend feature.

## PWA and push notifications for agent replies

The hosted page can be installed as a PWA and can notify the customer when an
agent replies, even with the page closed. It reuses **Qiscus's existing push
pipeline**: this Worker sends nothing, polls nothing, and holds no sender
credential.

```text
customer clicks "Aktifkan notifikasi" (explicit opt-in, top page)
  -> Notification permission
  -> FCM web token: firebase/messaging getToken() with the PUBLIC Firebase web
     config + VAPID public key from GET /push/config, minted against /sw.js
  -> POST https://api3.qiscus.com/api/v2/sdk/set_user_device_token
       {device_token, device_platform: "web", is_development: false}
     authenticated as the handoff CUSTOMER (their own SDK session)

agent replies in the Omnichannel dashboard
  -> qiscus-sdk-api post_comment -> sendPN() -> Flash POST /v1/pn/room
  -> FCM -> browser push service -> /sw.js "push" event
  -> notification "Live Chat" with the agent's message as body, click opens /widget.html
```

- `device_platform: "web"` (ClientPlatformWeb = 5) is accepted by qiscus-sdk-api
  since `1.79.1-qismo-stable`.
- **Delivery to `web` tokens by Flash is unverified.** Flash's source was not
  available to check. Note that `pushnotif/default.go` in qiscus-sdk-api is not
  the live sender: `Push()` has no call sites, and the comment paths call
  `flash.PostPNRoomV1`. The omnichannel-fe-monorepo notes report web push
  working in production with `web` tokens (2026-08-05). Confirm it end-to-end
  with an internal app before relying on it.
- The FCM token must come from the **same Firebase project** as an FCM
  service-account JSON uploaded to that Qiscus app (Settings → Notifications,
  or the Omnichannel mobile-PN activation, which uploads Qiscus's own
  `mulchanfcm.json`). Otherwise the token registers but never delivers.

### Required configuration (public values, names only)

> **Multi-app Workers:** these env values are the *global* config (one Firebase
> web app for the whole Worker). To serve several apps (e.g. production and
> stag2) from one deployment, let each app's config come from qismo-api instead,
> see [Multiple apps](#multiple-apps-per-app-push-config-from-qismo-api). The
> env stays as the fallback and keeps working unchanged.

Set these in the environment when running `alchemy deploy`. Each one that is
set is bound to the Worker as `plain_text`. None of them is secret: they are the
Firebase **web app** config and the Web Push certificate **public** key. Never
put the Firebase service-account JSON (or any private key) here, in the page,
or in the Worker.

| Env var                        | Where it comes from                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `FIREBASE_API_KEY`             | Firebase console → Project settings → General → your **web** app      |
| `FIREBASE_PROJECT_ID`          | same                                                                  |
| `FIREBASE_MESSAGING_SENDER_ID` | same (project number; must match the one inside `FIREBASE_APP_ID`)    |
| `FIREBASE_APP_ID`              | same (`1:<number>:web:<hex>`)                                         |
| `FIREBASE_VAPID_KEY`           | Project settings → Cloud Messaging → Web Push certificates (public key) |
| `FIREBASE_AUTH_DOMAIN`         | optional                                                              |
| `PUSH_APP_CODES`               | optional, comma-separated Qiscus app codes allowed to enable push     |
| `PUSH_ROOM_ORIGINS`            | optional, TEMPORARY: comma-separated origins of a cross-origin room iframe for which push is still allowed (see Limitations). An entry may be a wildcard `https://*.qiscus.io`: it matches every subdomain (qismo-stag2, -stag3, ...) but not the apex, other ports, or http, so a new staging host needs no env change |

If any required value is missing or malformed, push stays off. `GET
/push/config` returns `{"status":"unconfigured","missing":[…],"invalid":[…]}`
(names only), and the page logs the same to the console. No new Cloudflare
resource or storage binding is needed.

**Console trail.** Every reason push stays off (`unconfigured`,
`cross-origin-room`, `app-not-enabled`, `unsupported`) is logged with
`console.info("[handoff-push] …")`. Each step (start, exchange seen, state
changes, permission, FCM token, `set_user_device_token` status, service worker
registration/updates) is logged with `console.debug`, so enable the **Verbose**
level in DevTools. No token, e-mail or message text is ever logged.

### Multiple apps (per-app push config from qismo-api)

One deployed Worker can serve several Qiscus apps, each with **its own Firebase
project** (e.g. a production app and a stag2 app), without any per-app env.

**Where the config comes from.** An app's Firebase **web** config + VAPID public
key are stored in qismo-api, set per FCM key in **Omnichannel → Settings →
Notifications**, and served publicly per app:

```text
GET {baseUrl}/api/v2/live_handover/push_config?app_code=<code>
  200 {"status":"configured","firebase":{"apiKey","authDomain"?,"projectId","messagingSenderId","appId"},"vapidKey":"…"}
  200 {"status":"unconfigured"}        400 malformed app_code
  CORS allowed, Cache-Control: public, max-age=300
```

(The endpoint is being built in qismo-api; this repo only consumes it. Until it
is deployed, every app simply falls back to the Worker env, see below.)

**Setup per app.** Give each app its own `page_url`; the host in `baseUrl` is
the qismo-api that exchanges the invite *and* serves that app's push config:

```text
# production app (defaults): no query needed
https://<worker-host>/widget.html

# stag2 app
https://<worker-host>/widget.html?baseUrl=https%3A%2F%2Fqismo-stag2.qiscus.io&iframeUrl=https%3A%2F%2Fqismo-stag2.qiscus.io
```

There is no `/a/<app>/widget.html` page form: the app code only arrives with the
invite exchange, and the backend host (prod vs stag2) cannot be derived from it,
so `baseUrl` stays in the page URL. `/a/<app>/sw.js` exists only as the
per-app service-worker script (below).

**Flow.** After the exchange tells the page the app code (for a first invite:
from the room iframe path `/iframes/v5/<app>/live-handover-room` that QismoFull
builds from the exchange, before the room is mounted), the page fetches that
app's config from `{baseUrl}/api/v2/live_handover/push_config` (4 s timeout,
no cookies), validates it with the **same rules as the Worker env**
(`invalidFirebaseFields` in `src/push/config.ts`), and uses it.

**Precedence.**

| Backend answer for the app                              | Result                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `configured` and valid                                  | **Backend wins**: that Firebase config, app counts as enabled (our same-origin room on the first invite, no `PUSH_APP_CODES` entry needed), own SW scope `/a/<app>/` |
| `unconfigured`, 400/404/5xx, unreachable, timeout, garbage, any invalid field | **Exactly the Worker env behaviour** (global config, `PUSH_APP_CODES`, `PUSH_ROOM_ORIGINS`, root scope): Weaper on prod is unchanged, before and after qismo-api deploys the endpoint |

If the env has no Firebase config either, push is off for that app (`unconfigured`
in the console). `PUSH_ROOM_ORIGINS` is still read from the env only.

> Keep `PUSH_APP_CODES` set on a multi-app Worker that still has global
> `FIREBASE_*`. Without it, an app with no backend config falls back to the
> *global* Firebase project, and its tokens never deliver unless that project
> matches the app's FCM key.

**Security.** Firebase config is accepted only from the Worker env or from
qismo-api at the page's validated `baseUrl` (HTTPS `qiscus.com` / `qiscus.io`,
or localhost; re-checked inside the bundle). It is never read from the URL
query or from `postMessage`. A config is only ever used for the app code it
was fetched for; a service worker refuses a context that belongs to another app.

**One service-worker scope per app.** A push subscription belongs to one
service-worker registration and one VAPID key, so two Firebase projects must not
share one. An app with backend config registers `/a/<app>/sw.js` (the same
`sw.js`, served by the Worker under that path, `Service-Worker-Allowed` set,
never cached) with scope `/a/<app>/`; its subscription, Firebase token and SW
context (IndexedDB key `/a/<app>/`) are separate from every other app's.
A notification click reopens `/widget.html?source=notification&baseUrl=…&iframeUrl=…`
for that app's own backend (stored by the page, never taken from the push
payload). The root worker (`/sw.js`, scope `/`) stays registered for the PWA
shell and for apps still on the Worker env.

- **Existing Weaper registrations (Worker env, root scope) are untouched** on
  upgrade: no re-subscribe, same IndexedDB key, same notification data.
- If the backend later starts serving config for an app that was on the env, the
  next load registers it under `/a/<app>/` with the new project, then removes
  the old token (`remove_user_device_token`) and unsubscribes the old root
  subscription: one automatic re-subscribe, no user action. If the app's
  permission is still granted and the opt-in flag is set this happens silently.
- **One active customer session per browser** (unchanged): the stored session,
  registration and opt-in flag are single-slot. A new invite from another app
  replaces the previous identity, whose push registration is first removed in
  *its own* scope and with its own credentials. Two apps are therefore never
  subscribed at the same time in one browser; they just cannot clobber each
  other's subscription when switching.

**Console trail.** `[handoff-push] push config {appId, source}` says whether an
app used the backend or the Worker env.

### Service worker updates

The page registers `/sw.js` (and, per app, `/a/<app>/sw.js`) with `updateViaCache: "none"` and calls
`registration.update()` when it becomes visible again (at most every 30
minutes); the browser also re-checks on every navigation. A changed `sw.js`
installs with `skipWaiting()` and takes over with `clients.claim()`, without
waiting for tabs to close. The shell (offline page, manifest, icons) is
network-first and only falls back to the cache offline, so a deploy is never
pinned by an old cache. Bump `SHELL_CACHE` only to force old shell copies out.

### Session resume

The invite token stays in the address bar (`#t=`, a fragment, so it never
reaches a server): `widget.html` puts it back after QismoFull strips it. A
refresh, or "open in browser" from WhatsApp's in-app browser (a new browser
session with no stored login), re-exchanges the same link and qismo-api answers
`resumed` until the session ends; after that the link is refused
(`session_over`). Neither the invite token nor the 120-second `identity_token`
is ever written to storage. After the room iframe logs in with the identity token **and**
loads the room, it stores the customer's Qiscus SDK login in `localStorage` on
this origin (`qiscus-handoff:session:v1`, max 48 h, the longest qismo-api
session window). The standard Qiscus widget keeps the same login there. A
refresh, a notification click, or a Home Screen launch (`/widget.html` without
`#t=`) mounts the room with `?resume=1` and reuses that login. Nothing sensitive
is put in a URL, the manifest or a cache.

- A **new invite** moves the previous identity aside before the exchange. If it
  turns out to be a different customer, or the exchange fails, that identity's
  push registration is removed **with its own credentials** before anything new
  is registered.
- **Conversation resolved**, **expiry**, an upstream rejection on resume,
  **revoked/denied permission**, or the user turning push off all remove the
  registration (`remove_user_device_token`) and unsubscribe the push
  subscription.
- The customer's SDK user is the **same one as their WhatsApp room**, so Flash
  also pushes WhatsApp-room messages to the token. The service worker only
  announces messages in the handoff room that are neither the customer's own nor
  `system_event`, and dedupes per comment id (duplicates appear when an app has
  several FCM credentials). Any other push is shown silently and closed at once,
  because browsers penalise pushes that show nothing.

### Limitations

- **Cross-origin room (TEMPORARY allowance).** With the default `iframeUrl`
  (`https://omnichannel.qiscus.com`) the room's own login is unreachable. When
  that origin is listed in `PUSH_ROOM_ORIGINS`, the page reads QismoFull's own
  exchange response once (in memory), calls `verify_identity_token` itself, and
  stores the session as the same-origin room would. The nonce is not consumed
  and an existing user's SDK token is not rotated, so the room's login is
  unaffected. Resume after a refresh or notification click mounts the
  same-origin room. The room cannot report "resolved" across origins, so the
  session then ends only by TTL or a new invite. Without the allowance the page
  reports `cross-origin-room`. Intended source of the list: the WA handoff
  **Allowed domains** setting (`frame_ancestors`), which qismo-api exposes only
  to authenticated callers today.
- **Push guidance is a local-only chat bubble.** With the room on this origin
  (our `live-handover-room`), the offer / iOS steps / enable button are drawn
  as the last item of the room's message list, labelled "Hanya terlihat oleh
  Anda". It is plain DOM in this browser: never sent with `sendComment`, never
  stored in Omnichannel, invisible to the agent. With a cross-origin room
  (`omnichannel.qiscus.com`) the page cannot touch the frame, so the same
  content is shown as a floating banner instead. For apps enabled for
  push (backend config for the app, or `PUSH_APP_CODES`) the page moves a first invite's room from the default
  `omnichannel.qiscus.com` to this origin (same path and query; the remote
  frame is held on `about:blank` until the config answers (`/push/config` and the
  per-app endpoint, at most 4 s), so it never spends the identity token), so the bubble also shows on the first visit,
  e.g. in WhatsApp's in-app browser. Other apps keep the remote room.
- **Android in-app browsers** (WhatsApp/Instagram/Facebook WebView, UA
  `; wv)` or an app token) have no Web Push: the bubble tells the customer to
  open the link in Chrome (menu ⋮ → open in Chrome, or "Salin link"). There is
  no `intent://` button: the invite token is in the URL fragment, which an
  intent URL cannot carry. Chrome itself (and a Chrome Custom Tab) gets the
  normal "Aktifkan notifikasi" offer; no install is needed on Android.
- **iOS/iPadOS:** Web Push only works in a Home Screen web app (iOS 16.4+), and
  "Add to Home Screen" exists only in Safari's share sheet, never in an in-app
  browser such as WhatsApp's. So:
  - an in-app browser (UA has an app token such as `WhatsApp`, or lacks
    `Safari/`) gets instructions: the ⋯ menu → open in Safari/browser, or
    "Salin link" and paste it into Safari (the copied link keeps the invite
    fragment). There is no "open in Safari" button: WhatsApp iOS ignores
    `x-safari-https://` (tested on a real iPhone), and a page cannot leave an
    in-app WKWebView any other way;
  - a Safari tab gets numbered steps: copy the link, add to Home Screen, open
    the app and tap "Tempel";
  - the Home Screen app does not share storage with Safari, so it offers a
    paste form with a "Tempel" button (clipboard read, falls back to typing).
  This relies on qismo-api resuming a reused invite within its session window.
  A Home Screen app cannot capture links on iOS: a WhatsApp invite always
  opens in WhatsApp/Safari first.
- The stored SDK login is not refreshed when the SDK rotates its token. If the
  upstream rejects it on resume, the customer is asked for a new link.
- Whether Flash removes FCM tokens that come back `UNREGISTERED` is not visible
  from here. The page removes its own registration on every teardown path.
- The notification body is the agent's message as plain text (whitespace
  collapsed, cut to 120 characters with "…", no agent name); attachments show
  "Mengirim gambar" / "Mengirim file"; an empty or unreadable payload falls back
  to "Ada balasan baru dari agen…". The message text is therefore visible on
  the lock screen.

### Testing limits

`bun test` runs the unit tests and, when Chrome is installed, the headless
end-to-end test `e2e/pwa.browser.test.ts`. Everything external is
**synthetic**: the qismo exchange and the api3 SDK REST are in-test fakes
(single-use identity tokens, SDK-token auth, room membership). A stub stands in
for the Qiscus SDK inside the room. FCM token minting is replaced through a
localhost-only seam (`window.__HANDOFF_PUSH_TEST__`), and pushes are injected
into the real service worker via CDP. No real Qiscus app, Firebase project, FCM
or Flash was exercised.

The per-app flow is tested against an in-test **stub** of
`GET /api/v2/live_handover/push_config` (two synthetic Firebase projects on one
origin, backend unconfigured/404/unreachable/invalid, no-env, hostile query and
`postMessage`). The real qismo-api endpoint, real FCM tokens and delivery per
app were **not** exercised.

### Rebuilding the browser bundles

`src/client/*` is bundled into `public/js/push/` by `bun run build:client`. The
outputs are committed, like `qismo-full-v5.js`, and a test fails if they are
stale. `bun run icons` regenerates `public/img/pwa/`.

## Develop and deploy

Prerequisites: Bun for dependency installation/typechecking, Node.js for the
Alchemy CLI, and a Cloudflare account configured for Alchemy.

```bash
bun install
bun run typecheck
bun test            # unit tests + headless Chrome e2e (skipped without Chrome)
node node_modules/.bin/alchemy dev
```

The local dev command prints the local Worker URL. To deploy to your own
Cloudflare account, first review the Alchemy plan, then deploy:

```bash
node node_modules/.bin/alchemy plan --detailed
node node_modules/.bin/alchemy deploy --yes --no-input
```

The existing deployment also uses `handoff.zroconf.web.id` as a sample alias.
Before deploying your own copy, replace that domain and zone in `alchemy.run.ts`
with a domain in a Cloudflare zone you control, or remove the `domain` property.
