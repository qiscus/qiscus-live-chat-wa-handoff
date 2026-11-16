/**
 * Builds the forked front-end packages (see packages/UPSTREAM.md) and copies
 * the files the handoff page serves into public/:
 *   packages/qiscus-ui-vue -> public/js/qiscus-handoff.js(.map), public/css/qiscus-handoff.css
 *   packages/qismo-widget  -> public/js/qismo-full-v5.js(.map)
 *
 * Each package is built with its own unchanged scripts under the Node version in
 * packages/qiscus-ui-vue/.nvmrc, via fnm. Old qiscus-sdk.<v> files in public/js and public/css are removed.
 *
 *   bun run build:vendor
 */
import { existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const root = new URL("../", import.meta.url).pathname
const packages = join(root, "packages")
const publicDir = join(root, "public")
const YARN = "yarn@1.22.22"

export const sdkVersion = async (): Promise<string> =>
  (await Bun.file(join(packages, "qiscus-ui-vue/package.json")).json()).version

async function nodeVersion(): Promise<string> {
  return (await Bun.file(join(packages, "qiscus-ui-vue/.nvmrc")).text()).trim()
}

async function run(cwd: string, args: string[]): Promise<void> {
  const node = await nodeVersion()
  const cmd = ["fnm", "exec", `--using=${node}`, "npx", "-y", YARN, ...args]
  console.log(`$ (${cwd.replace(root, "")}) ${cmd.join(" ")}`)
  const proc = Bun.spawn(cmd, { cwd, stdout: "inherit", stderr: "inherit" })
  if ((await proc.exited) !== 0) throw new Error(`failed: ${cmd.join(" ")} in ${cwd}`)
}

async function copy(from: string, to: string, rename: [string, string][] = []): Promise<void> {
  if (!existsSync(from)) throw new Error(`missing build output: ${from}`)
  if (rename.length === 0) await Bun.write(to, Bun.file(from))
  else await Bun.write(to, rename.reduce((text, [a, b]) => text.replaceAll(a, b), await Bun.file(from).text()))
  console.log(`wrote ${to.replace(root, "")}`)
}

export async function buildVendor(): Promise<void> {
  if (!Bun.which("fnm")) throw new Error("fnm is required (brew install fnm), then: fnm install " + (await nodeVersion()))

  // qiscus-sdk-core declares node >=20 but only runs in the browser bundle;
  // MCF builds this package under Node 16, so the engine check is skipped.
  const ui = join(packages, "qiscus-ui-vue")
  await run(ui, ["install", "--frozen-lockfile", "--non-interactive", "--ignore-engines"])
  await run(ui, ["build"])

  const widget = join(packages, "qismo-widget")
  await run(widget, ["install", "--frozen-lockfile", "--non-interactive"])
  await run(widget, ["build"])

  const v = await sdkVersion()
  // The room page loads fixed names (no version in the URL), so a new SDK version
  // never needs an HTML edit. Every qiscus-sdk.<v>.* left over from older builds is removed.
  for (const dir of ["js", "css"]) {
    for (const name of readdirSync(join(publicDir, dir))) {
      if (name.startsWith("qiscus-sdk.")) {
        rmSync(join(publicDir, dir, name))
        console.log(`removed public/${dir}/${name}`)
      }
    }
  }
  const dist = join(ui, "dist/static")
  // webpack names its output by version, and the bundle and map point at each other
  // by that name, so those references are rewritten while copying.
  const renamed: [string, string][] = [[`qiscus-sdk.${v}.js`, "qiscus-handoff.js"]]
  await copy(join(dist, `js/qiscus-sdk.${v}.js`), join(publicDir, "js/qiscus-handoff.js"), renamed)
  await copy(join(dist, `js/qiscus-sdk.${v}.js.map`), join(publicDir, "js/qiscus-handoff.js.map"), renamed)
  await copy(join(dist, `css/qiscus-sdk.${v}.css`), join(publicDir, "css/qiscus-handoff.css"))

  // qismo-widget's rollup config writes to ../public, i.e. packages/public.
  const out = join(packages, "public/js")
  await copy(join(out, "qismo-full-v5.js"), join(publicDir, "js/qismo-full-v5.js"))
  await copy(join(out, "qismo-full-v5.js.map"), join(publicDir, "js/qismo-full-v5.js.map"))
}

if (import.meta.main) await buildVendor()
