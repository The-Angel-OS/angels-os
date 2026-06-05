/**
 * worksCas — content-addressed storage for Works Engine release assets.
 *
 * An asset's address is the sha256 of its bytes (the "cid"). Immutable and
 * deduplicated: the same bytes always map to the same object, so re-sealing a
 * Work that reuses an image writes nothing new.
 *
 * Two backends, chosen at runtime:
 *   - prod (BLOB_READ_WRITE_TOKEN set) → Vercel Blob at `library/cas/<cid>.<ext>`
 *     (Vercel's filesystem is read-only, so we cannot write under public/).
 *   - dev (no token) → `public/library/cas/<cid>.<ext>`, served statically,
 *     identical layout to `scripts/_local/library_seal.mjs`.
 *
 * Text-only Works never call this (their text is carried inline in the manifest),
 * so the common seal path performs zero blob writes.
 */
import crypto from 'crypto'
import { put } from '@vercel/blob'

export interface CasResult {
  cid: string
  url: string
}

const sha256 = (buf: Buffer): string => crypto.createHash('sha256').update(new Uint8Array(buf)).digest('hex')

/**
 * Store a buffer in the content-addressed store, returning its cid + public URL.
 * Idempotent: an existing object with the same cid is reused, not rewritten.
 */
export async function casPutBuffer(buf: Buffer, ext: string): Promise<CasResult> {
  const cid = sha256(buf)
  const key = `library/cas/${cid}.${ext}`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Prod: Vercel Blob. allowOverwrite keeps the call idempotent for identical
    // bytes; addRandomSuffix:false keeps the URL deterministic on the cid.
    const blob = await put(key, buf, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { cid, url: blob.url }
  }

  // Dev: write under public/ (mirrors the seal script's CAS layout).
  const fs = await import('node:fs')
  const path = await import('node:path')
  const dir = path.join(process.cwd(), 'public', 'library', 'cas')
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `${cid}.${ext}`)
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, new Uint8Array(buf))
  return { cid, url: `/library/cas/${cid}.${ext}` }
}
