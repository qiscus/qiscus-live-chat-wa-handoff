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

The sample currently uses Qiscus staging2 while the handoff feature is being
promoted:

- Hosted widget bundle: `https://qismo-stag2.qiscus.io/js/qismo-full-v5.js`
- API base URL: `https://qismo-stag2.qiscus.io`
- Live Chat iframe host: `https://qismo-stag2.qiscus.io`

Use the resulting Worker URL as the `page_url` in the WhatsApp handoff settings:

```text
https://<worker-host>/widget.html
```

The page loads the same `qismo-full-v5.js` bundle as the FE Installation Code
snippet. The bundle reads the invite token from the URL fragment, exchanges it
with the configured API, then opens the returned room. No app ID needs to be
embedded in this handoff-only page.

For another environment, the settings URL can override the API and iframe hosts:

```text
https://<worker-host>/widget.html?baseUrl=<api-base-url>&iframeUrl=<iframe-host>
```

When the feature is promoted to production, switch the hosted bundle URL and the
default API/iframe hosts in `public/widget.html` to production. Never put an app
secret or a raw invite token in query parameters.

The selected backend must have the handoff exchange endpoint enabled and must
allow the deployed page origin through CORS. Deploying this Worker alone does not
enable the backend feature.

## Develop and deploy

Prerequisites: Bun for dependency installation/typechecking, Node.js for the
Alchemy CLI, and a Cloudflare account configured for Alchemy.

```bash
bun install
bun run typecheck
node node_modules/.bin/alchemy dev
```

The local dev command prints the local Worker URL. To deploy to your own
Cloudflare account, first review the Alchemy plan, then deploy:

```bash
node node_modules/.bin/alchemy plan --detailed
node node_modules/.bin/alchemy deploy --yes --no-input
```

The sample uses the account's `workers.dev` URL and intentionally does not bind
to a Qiscus- or customer-specific custom domain. Configure a custom domain only
in an account and zone you control.
