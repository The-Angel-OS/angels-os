/**
 * Regenerate every app icon from the two SVG sources. Run after editing either:
 *   node scripts/gen-icons.mjs
 *
 * Sources (the only files to hand-edit):
 *   public/angel-mark.svg        full mark — halo, winged head, smile
 *   public/angel-mark-small.svg  simplified — the wings blob out below ~48px
 *
 * Outputs:
 *   src/app/[locale]/(app)/icon.svg   Next file-convention icon (copy of small)
 *   src/app/[locale]/(app)/favicon.ico 16/32/48, each rendered at its own size
 *   public/favicon-32x32.png, favicon.png (64), icon-512.png, apple-touch-icon.png
 *
 * Tab icons are transparent so the amber reads on a light OR dark tab strip.
 * apple-touch-icon gets a dark plate — iOS composites transparency onto white.
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const APP = 'src/app/[locale]/(app)'
const full = readFileSync('public/angel-mark.svg')
const small = readFileSync('public/angel-mark-small.svg')
const render = (src, size) => sharp(src, { density: 900 }).resize(size, size).png().toBuffer()

for (const [file, size, src] of [
  ['public/favicon-32x32.png', 32, small],
  // 64 gets WINGS — Ken's call. It is the dashboard layout's declared icon and
  // the largest size a tab ever renders, so it can carry the full mark.
  ['public/favicon.png', 64, full],
  ['public/icon-512.png', 512, full],
]) {
  writeFileSync(file, await render(src, size))
  console.log(file, size)
}

const plate = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><rect width="180" height="180" rx="40" fill="#0a0a14"/></svg>',
)
writeFileSync(
  'public/apple-touch-icon.png',
  await sharp(plate)
    .composite([{ input: await render(full, 140), top: 20, left: 20 }])
    .png()
    .toBuffer(),
)
console.log('public/apple-touch-icon.png 180')

copyFileSync('public/angel-mark-small.svg', `${APP}/icon.svg`)
console.log(`${APP}/icon.svg`)

// An .ico is a directory of embedded PNGs. Pillow/sharp helpers resize from one
// base image, which throws away a hand-tuned 16px render — so pack it directly.
const sizes = [16, 32, 48]
const pngs = await Promise.all(sizes.map((s) => render(small, s)))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = 6 + 16 * sizes.length
const dir = sizes.map((size, i) => {
  const e = Buffer.alloc(16)
  e.writeUInt8(size, 0)
  e.writeUInt8(size, 1)
  e.writeUInt16LE(1, 4) // colour planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[i].length
  return e
})
writeFileSync(`${APP}/favicon.ico`, Buffer.concat([header, ...dir, ...pngs]))
console.log(`${APP}/favicon.ico 16/32/48`)
