# Forked sources

The handoff page bundles two front-end projects that originally live in
`multichannel-frontend` (MCF, Bitbucket `qiscus/multichannel-frontend`). They are
copied here so the handoff widget builds and deploys without MCF.

| Package | Output used here | MCF path | Forked from |
| --- | --- | --- | --- |
| `qiscus-ui-vue` 3.2.12 | `public/js/qiscus-sdk.<v>.js(.map)`, `public/css/qiscus-sdk.<v>.css` | `qiscus-ui-vue/` | `e33d0a9a2` (master, 2026-10-22) |
| `qismo-widget` | `public/js/qismo-full-v5.js(.map)` | `qismo-widget/` | `e33d0a9a2` (master, 2026-10-22) |

At the fork commit, a build of either package here is byte-identical to the
artefact MCF commits in its own `public/` (`qiscus-sdk.3.2.12.js/.css`,
`qismo-full-v5.js`).

Removed from the copy: `qiscus-ui-vue/screenshots/` and `qiscus-ui-vue/.claude/`.
Nothing else was changed.

## Rules

- From the fork commit on, handoff changes to these packages are made here.
  MCF keeps its own copy for the general widget (`qismo-v5.js`), so the two
  copies diverge.
- Fixes that land in MCF (for example security fixes) are NOT picked up
  automatically. Port them by hand and add a row to the log below.
- Build with `bun run build:vendor` (see `scripts/build-vendor.ts`). It runs the
  packages' own build scripts unchanged under Node 16.15.1 (`.nvmrc`) and
  copies only the files above into `public/`.

## Port log

| Date | MCF commit | What |
| --- | --- | --- |
| 2026-10-22 | `e33d0a9a2` | Initial fork (includes PR #2436, qiscus-sdk 3.2.10–3.2.12, iOS composer fixes). |
| 2026-10-23 | — | Scrubbed demo credentials versus upstream. Deleted unreferenced `qiscus-ui-vue/indexOLD.html` (SDK `setUser` logins). In the remaining demo pages and docs, replaced `@qiscus.com` user ids, literal user keys, the ads-tracker secret, assistant authorization values, and identity-token samples with placeholders (`user@example.com`, `YOUR_USER_KEY`, `YOUR_SECRET_TOKEN`, `YOUR_AUTHORIZATION`, `YOUR_IDENTITY_TOKEN`). History was not rewritten, so the fork commit still has the old text. |
