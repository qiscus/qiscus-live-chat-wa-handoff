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
  -> generic notification ("Ada balasan baru dari agen…"), click opens /widget.html
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
| `PUSH_ROOM_ORIGINS`            | optional, TEMPORARY: comma-separated origins of a cross-origin room iframe for which push is still allowed (see Limitations) |

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

### Service worker updates

The page registers `/sw.js` with `updateViaCache: "none"` and calls
`registration.update()` when it becomes visible again (at most every 30
minutes); the browser also re-checks on every navigation. A changed `sw.js`
installs with `skipWaiting()` and takes over with `clients.claim()`, without
waiting for tabs to close. The shell (offline page, manifest, icons) is
network-first and only falls back to the cache offline, so a deploy is never
pinned by an old cache. Bump `SHELL_CACHE` only to force old shell copies out.

### Session resume

The invite token (`#t=`) and the 120-second `identity_token` are single-use and
are never stored. After the room iframe logs in with the identity token **and**
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
- **iOS/iPadOS:** Web Push only works in a Home Screen web app (iOS 16.4+). A
  Safari tab shows Add-to-Home-Screen guidance. The Home Screen app does not
  share storage with Safari, so it offers a "paste the WhatsApp invite link"
  form. This relies on qismo-api resuming a reused invite within its session
  window.
- The stored SDK login is not refreshed when the SDK rotates its token. If the
  upstream rejects it on resume, the customer is asked for a new link.
- Whether Flash removes FCM tokens that come back `UNREGISTERED` is not visible
  from here. The page removes its own registration on every teardown path.
- Notification content is deliberately generic, with no message text on the
  lock screen.

### Testing limits

`bun test` runs the unit tests and, when Chrome is installed, the headless
end-to-end test `e2e/pwa.browser.test.ts`. Everything external is
**synthetic**: the qismo exchange and the api3 SDK REST are in-test fakes
(single-use identity tokens, SDK-token auth, room membership). A stub stands in
for the Qiscus SDK inside the room. FCM token minting is replaced through a
localhost-only seam (`window.__HANDOFF_PUSH_TEST__`), and pushes are injected
into the real service worker via CDP. No real Qiscus app, Firebase project, FCM
or Flash was exercised.

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
