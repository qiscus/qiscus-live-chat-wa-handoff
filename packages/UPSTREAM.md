# Forked sources

The handoff page bundles two front-end projects that originally live in
`multichannel-frontend` (MCF, Bitbucket `qiscus/multichannel-frontend`). They are
copied here so the handoff widget builds and deploys without MCF.

| Package | Output used here | MCF path | Forked from |
| --- | --- | --- | --- |
| `qiscus-ui-vue` 3.2.13 | `public/js/qiscus-handoff.js(.map)`, `public/css/qiscus-handoff.css` (webpack's `qiscus-sdk.<v>.*`, renamed at copy) | `qiscus-ui-vue/` | `e33d0a9a2` (master, 2026-10-22) |
| `qismo-widget` | `public/js/qismo-full-v5.js(.map)` | `qismo-widget/` | `e33d0a9a2` (master, 2026-10-22) |

At the fork commit, a build of either package here is byte-identical to the
artefact MCF commits in its own `public/` (`qiscus-sdk.3.2.12.js/.css`,
`qismo-full-v5.js`).

Removed from the copy: `qiscus-ui-vue/screenshots/` and `qiscus-ui-vue/.claude/`.
Nothing else was changed at the fork commit.

## Rules

- From the fork commit on, handoff changes to these packages are made here.
  MCF keeps its own copy for the general widget (`qismo-v5.js`), so the two
  copies diverge.
- Fixes that land in MCF (for example security fixes) are NOT picked up
  automatically. Port them by hand and add a row to the log below.
- Build with `bun run build:vendor` (see `scripts/build-vendor.ts`). It runs the
  packages' own build scripts unchanged under Node 16.15.1 (`.nvmrc`) and
  copies only the files above into `public/`.

## Reviewed against MCF master, not ported

Checked 2026-10-26 against MCF `origin/master` `9125f1c14` (fork point `e33d0a9a2`). Each item
touches code the handoff page does not load (`FullWidget.svelte` and the room page only):

- PR #2445 `bugfix/qismo-v5-null-channel-widget`: guards a null `channel_widget` in `App.svelte`
  (the general widget, `qismo-v5.js`). `FullWidget.svelte` never reads `live_channel`.
- PR #2444 `fix/ads-tracker-no-data-spinner`: `AdsTrackerConverter.vue`, an inbox feature.
- `fix/widget-logout-clear-qws`, `fix/widget-logout-site-storage` (not merged in MCF): logout in
  `App.svelte`/`main.js`. `FullWidget.svelte` has no logout.
- `fix/1638-safari-guard-handoff-pages` (not merged in MCF): Blade/PHP browser guard for dashboard pages.

## Port log

| Date | MCF commit | What |
| --- | --- | --- |
| 2026-10-22 | `e33d0a9a2` | Initial fork (includes PR #2436, qiscus-sdk 3.2.10–3.2.12, iOS composer fixes). |
| 2026-10-22 | — (uncommitted MCF work, `improvement/live-handover-customer-end-chat-v2` on `1d0f411d2`) | Customer End chat (TC-KL-05) + EN/ID customer locale, qiscus-ui-vue 3.2.13. Never merged in MCF; developed here from now on. Tests that read MCF Blade views now read `public/live-handover-room.html` / `public/widget.html`. |
| 2026-10-23 | — | Scrubbed demo credentials versus upstream. Deleted unreferenced `qiscus-ui-vue/indexOLD.html` (SDK `setUser` logins). In the remaining demo pages and docs, replaced `@qiscus.com` user ids, literal user keys, the ads-tracker secret, assistant authorization values, and identity-token samples with placeholders (`user@example.com`, `YOUR_USER_KEY`, `YOUR_SECRET_TOKEN`, `YOUR_AUTHORIZATION`, `YOUR_IDENTITY_TOKEN`). History was not rewritten, so the fork commit still has the old text. |
