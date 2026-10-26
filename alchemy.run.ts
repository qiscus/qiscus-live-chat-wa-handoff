/**
 * Alchemy IaC entrypoint for live-handover-widget.
 *
 * Provisions ONE Cloudflare Worker per stage (see STAGE_DOMAINS): the hosted WA -> Live Chat page (spec
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
import { PUSH_ENV_KEYS } from "./src/push/config"

// Custom domain per stage. The stage MUST be passed explicitly (--stage):
// Alchemy otherwise defaults to live_$USER, which would create a second Worker
// that tries to claim the production domain. Unknown stages fail the deploy.
//   live_afief -> production (the stage the Worker was first deployed under)
//   staging    -> trial deploys before production
export const STAGE_DOMAINS: Record<string, string> = {
  live_afief: "handoff.zroconf.web.id",
  staging: "handoff-stag.zroconf.web.id",
}

// Public Web Push (FCM) config, read from the deploying shell's environment.
// Only keys that are set are bound, as plain_text (they are public client
// identifiers: Firebase web-app config + VAPID PUBLIC key). Never put the
// Firebase service-account JSON here — the Worker does not send pushes.
// With none set, /push/config reports `unconfigured` and push stays off.
const pushEnv: Record<string, string> = {}
for (const key of PUSH_ENV_KEYS) {
  const value = process.env[key]?.trim()
  if (value) pushEnv[key] = value
}

export default Alchemy.Stack(
  "LiveHandoverWidget",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage
    const domain = STAGE_DOMAINS[stage]
    if (!domain) {
      return yield* Effect.die(
        new Error(`unknown stage "${stage}": pass --stage ${Object.keys(STAGE_DOMAINS).join(" | ")}`),
      )
    }
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
      env: pushEnv,
      domain: {
        name: domain,
        zoneName: "zroconf.web.id",
      },
    })

    return { url: worker.url }
  }),
)
