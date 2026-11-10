/**
 * Builds the browser bundles served from public/js/:
 *   handoff-page.js       (IIFE) the whole /widget.html page: settings, QismoFull, push + resume
 *   push/handoff-room.js  (IIFE) session persist/resume helpers for the room iframe
 *   push/firebase.js      (ESM)  firebase/messaging token minting, loaded lazily
 *
 * The outputs are committed (like public/js/qismo-full-v5.js) because Alchemy
 * uploads public/ as-is. `bun run build:client` rewrites them; the test
 * src/client/bundles.test.ts fails if they are stale.
 */
const root = new URL("../", import.meta.url)

export const BUNDLES = [
  { entry: "src/client/page.ts", out: "handoff-page.js", format: "iife" },
  { entry: "src/client/room.ts", out: "push/handoff-room.js", format: "iife" },
  { entry: "src/client/firebase.ts", out: "push/firebase.js", format: "esm" },
] as const

export const OUT_DIR = new URL("public/js/", root)

export async function buildAll(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const b of BUNDLES) {
    const result = await Bun.build({
      entrypoints: [new URL(b.entry, root).pathname],
      target: "browser",
      format: b.format,
      minify: true,
      sourcemap: "none",
    })
    if (!result.success) throw new AggregateError(result.logs, `build failed: ${b.entry}`)
    if (result.outputs.length !== 1) throw new Error(`expected one output for ${b.entry}, got ${result.outputs.length}`)
    out.set(b.out, await result.outputs[0]!.text())
  }
  return out
}

if (import.meta.main) {
  for (const [name, code] of await buildAll()) {
    await Bun.write(new URL(name, OUT_DIR), code)
    console.log(`wrote public/js/${name} (${code.length} bytes)`)
  }
}
