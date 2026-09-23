/**
 * Alchemy IaC entrypoint for live-handover-widget.
 *
 * Provisions ONE Cloudflare Worker: the hosted WA -> Live Chat page (spec
 * §8's "halaman client" host form), serving `src/worker.ts` (Hono, the
 * landing note at `/`) plus the static `widget.html` sample page from
 * `./public/`. The page loads the QismoFull bundle from qismo-stag2.
 *
 * This file only DEFINES the resource. Nothing here deploys automatically:
 * - `node node_modules/.bin/alchemy dev` — local dev server (miniflare).
 * - `node node_modules/.bin/alchemy plan --detailed` — review planned resources.
 * - `node node_modules/.bin/alchemy deploy --yes --no-input` — deploys to the
 *   authenticated Cloudflare account; run only with explicit authorization.
 */
import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

export default Alchemy.Stack(
  "LiveHandoverWidget",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Worker("widget", {
      main: "src/worker.ts",
      assets: {
        directory: "./public",
        // Default "auto-trailing-slash" strips .html and redirects
        // /widget.html -> /widget, which drops the invite token: the token
        // lives in the URL FRAGMENT (#t=...), and fragments never reach the
        // server, so the client only sees the redirect land on a fragment-
        // less URL. "none" serves /widget.html literally, no redirect.
        htmlHandling: "none",
      },
      workersDev: true,
      // Keep the existing sample alias attached when updating this Worker.
      // Replace with a domain/zone you control before deploying your own copy.
      domain: {
        name: "handoff.zroconf.web.id",
        zoneName: "zroconf.web.id",
      },
    })

    return { url: worker.url }
  }),
)
