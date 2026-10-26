/**
 * Container / plain-Bun entrypoint. Runs the SAME Hono app as the Cloudflare
 * Worker (`src/worker.ts`); only the platform pieces differ:
 *   - the `ASSETS` binding becomes `createStaticAssets("public")`
 *   - Worker env bindings become process environment variables (`PUSH_*`, `FIREBASE_*`)
 * Like the Worker's asset layer, a file in `public/` is answered before the app.
 *
 *   PORT   listen port (default 8080)
 *   HOST   listen address (default 0.0.0.0)
 *   PUBLIC_DIR  static root (default ./public next to the working directory)
 */
import { createStaticAssets } from "./static"
import app from "./worker"

export function createHandler(publicDir: string, env: Record<string, string | undefined>) {
  const assets = createStaticAssets(publicDir)
  const bindings = { ...env, ASSETS: assets }
  return async (req: Request): Promise<Response> => {
    const file = await assets.fetch(req)
    if (file.status !== 404 && file.status !== 405) return file
    return app.fetch(req, bindings)
  }
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 8080)
  const server = Bun.serve({
    port,
    hostname: process.env.HOST ?? "0.0.0.0",
    fetch: createHandler(process.env.PUBLIC_DIR ?? "public", process.env),
  })
  console.log(`handoff widget listening on ${server.url}`)
  for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => void server.stop().then(() => process.exit(0)))
}
