/**
 * Generates the PWA icons in public/img/pwa/ (a white chat bubble on the
 * widget's default teal). Deterministic; re-run with `bun run icons`.
 */
import { deflateSync } from "node:zlib"

const TEAL = [0x27, 0xb1, 0x99]
const WHITE = [0xff, 0xff, 0xff]

function crc32(buf: Uint8Array): number {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

function png(size: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size)
  dv.setUint32(4, size)
  ihdr.set([8, 6, 0, 0, 0], 8)
  const raw = new Uint8Array(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1)
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array()),
  ]
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) (out.set(p, o), (o += p.length))
  return out
}

function inRoundRect(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function inTriangle(px: number, py: number, a: number[], b: number[], c: number[]): boolean {
  const s = (p: number[], q: number[], r: number[]) => (p[0]! - r[0]!) * (q[1]! - r[1]!) - (q[0]! - r[0]!) * (p[1]! - r[1]!)
  const d1 = s([px, py], a, b)
  const d2 = s([px, py], b, c)
  const d3 = s([px, py], c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

/** Unit-square shapes (0..1). `inset` shrinks the bubble toward the centre. */
function bubble(x: number, y: number, inset: number): boolean {
  const m = (v: number) => 0.5 + (v - 0.5) * inset
  return (
    inRoundRect(x, y, m(0.2), m(0.24), m(0.8), m(0.68), 0.1 * inset) ||
    inTriangle(x, y, [m(0.32), m(0.6)], [m(0.5), m(0.66)], [m(0.28), m(0.82)])
  )
}

function render(size: number, opts: { background: "rounded" | "full" | "none"; inset: number }): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const SS = 4
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size
          const y = (py + (sy + 0.5) / SS) / size
          const inBg = opts.background === "full" || (opts.background === "rounded" && inRoundRect(x, y, 0, 0, 1, 1, 0.22))
          if (inBg) bg++
          if (bubble(x, y, opts.inset)) fg++
        }
      }
      const n = SS * SS
      const i = (py * size + px) * 4
      if (opts.background === "none") {
        out.set([...WHITE, Math.round((fg / n) * 255)], i)
      } else {
        const a = bg / n
        const f = fg / n
        const col = TEAL.map((t, k) => Math.round(t * (1 - f) + WHITE[k]! * f))
        out.set([...col, Math.round(Math.max(a, f) * 255)], i)
      }
    }
  }
  return out
}

const dir = new URL("../public/img/pwa/", import.meta.url)
const icons: [string, number, Parameters<typeof render>[1]][] = [
  ["icon-192.png", 192, { background: "rounded", inset: 1 }],
  ["icon-512.png", 512, { background: "rounded", inset: 1 }],
  ["maskable-512.png", 512, { background: "full", inset: 0.72 }],
  ["apple-touch-icon-180.png", 180, { background: "full", inset: 0.9 }],
  ["badge-96.png", 96, { background: "none", inset: 1.2 }],
]
for (const [name, size, opts] of icons) {
  await Bun.write(new URL(name, dir), png(size, render(size, opts)))
  console.log("wrote", name)
}
