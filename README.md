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

- Hosted widget bundle: `https://qismo.qiscus.com/js/qismo-full-v5.js`
- API base URL: `https://qismo.qiscus.com`
- Live Chat iframe host: `https://omnichannel.qiscus.com`

Use the resulting Worker URL as the `page_url` in the WhatsApp handoff settings:

```text
https://<worker-host>/widget.html
```

The page loads the same `qismo-full-v5.js` bundle as the FE Installation Code
snippet. It reads the invite token and optional `scriptUrl` / `baseUrl` /
`iframeUrl` overrides from the page URL, exchanges the token with the configured
API, then opens the returned room. Production hosts are used when no overrides
are present. No app ID needs to be embedded in this handoff-only page.

For another environment, the settings URL can override the API and iframe hosts:

```text
https://<worker-host>/widget.html?baseUrl=<api-base-url>&iframeUrl=<iframe-host>
```

The bundle itself can be swapped with `scriptUrl`, e.g. the staging build:

```text
https://<worker-host>/widget.html?scriptUrl=https%3A%2F%2Fqismo-stag2.qiscus.io%2Fjs%2Fqismo-full-v5.js&baseUrl=https%3A%2F%2Fqismo-stag2.qiscus.io&iframeUrl=https%3A%2F%2Fqismo-stag2.qiscus.io
```

`scriptUrl`, `baseUrl` and `iframeUrl` only accept HTTPS URLs on `qiscus.com` /
`qiscus.io` (and their subdomains), or `localhost` / `127.0.0.1` for local
builds. Anything else is refused so a crafted link cannot inject arbitrary
JavaScript or send the invite token to a foreign host. The page passes
`baseUrl` / `iframeUrl` to `QismoFull` as options, so it works with bundles that
do not parse those query params themselves.

Never put an app secret or a raw invite token in query parameters.

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

The existing deployment also uses `handoff.zroconf.web.id` as a sample alias.
Before deploying your own copy, replace that domain and zone in `alchemy.run.ts`
with a domain in a Cloudflare zone you control, or remove the `domain` property.
