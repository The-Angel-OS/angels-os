#!/usr/bin/env node
/**
 * library_seal.mjs — Works Engine slice #1: content-address + sign a release.
 *
 * Takes an already-built static book (public/library/<slug>/ with optimized
 * webp pages + text/<lang>.json + manifest.json) and turns it into a sovereign,
 * verifiable RELEASE:
 *
 *   1. Content-addresses every asset (SHA-256) into a shared CAS
 *      (public/library/cas/<cid>.<ext>) — immutable, deduplicated.
 *   2. Rewrites the manifest to reference assets by cid (+ keeps reader-facing
 *      fields intact, so BookReader needs no change).
 *   3. Signs the canonical manifest with an Ed25519 key in the EXACT format of
 *      src/federation/protocol.ts (hex SPKI/PKCS8 DER, crypto.sign(null,...)),
 *      so Library signatures are federation-verifiable.
 *   4. Self-verifies and writes the signed manifest.
 *
 * The private key lives gitignored at scripts/_local/.keys/ — only the public
 * key + signature are committed. See docs/WORKS_ENGINE.md.
 *
 *   node scripts/_local/library_seal.mjs wdeg
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const LIBRARY = path.join(ROOT, 'public', 'library')
const CAS = path.join(LIBRARY, 'cas')
const KEY_DIR = path.join(__dirname, '.keys')
const SIGNERS_DIR = path.join(LIBRARY, '_signers')

const MEDIA_BY_SLUG = { wdeg: 'primer' } // default 'doc' otherwise

// ── Ed25519 (mirrors src/federation/protocol.ts exactly) ─────────────────────
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })
  return { publicKey: publicKey.toString('hex'), privateKey: privateKey.toString('hex') }
}
function signData(data, privateKeyHex) {
  const keyObject = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, 'hex'), format: 'der', type: 'pkcs8',
  })
  return crypto.sign(null, Buffer.from(data, 'utf8'), keyObject).toString('hex')
}
function verifySignature(data, signatureHex, publicKeyHex) {
  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKeyHex, 'hex'), format: 'der', type: 'spki',
    })
    return crypto.verify(null, Buffer.from(data, 'utf8'), keyObject, Buffer.from(signatureHex, 'hex'))
  } catch {
    return false
  }
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// Deterministic JSON (sorted keys) so the signature is reproducible.
function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'
  if (o && typeof o === 'object') {
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'
  }
  return JSON.stringify(o)
}

// ── Key management (gitignored private key) ──────────────────────────────────
function loadOrCreatePlatformKey() {
  fs.mkdirSync(KEY_DIR, { recursive: true })
  const keyFile = path.join(KEY_DIR, 'platform_ed25519.json')
  if (fs.existsSync(keyFile)) return JSON.parse(fs.readFileSync(keyFile, 'utf8'))
  const kp = generateKeyPair()
  fs.writeFileSync(keyFile, JSON.stringify(kp, null, 2))
  // Publish ONLY the public key for verifiers.
  fs.mkdirSync(SIGNERS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(SIGNERS_DIR, 'platform.json'),
    JSON.stringify({ id: 'platform', publicKey: kp.publicKey }, null, 2),
  )
  console.log('  generated new platform signing key (private key gitignored)')
  return kp
}

function casStore(srcPath, ext) {
  const buf = fs.readFileSync(srcPath)
  const cid = sha256(buf)
  fs.mkdirSync(CAS, { recursive: true })
  const dest = path.join(CAS, `${cid}.${ext}`)
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, buf)
  return cid
}

// ── Seal ─────────────────────────────────────────────────────────────────────
function seal(slug) {
  const dir = path.join(LIBRARY, slug)
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error(`[!] No manifest at ${manifestPath} — run book_import.py first.`)
    process.exit(1)
  }
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const key = loadOrCreatePlatformKey()

  // 1. Content-address page images into CAS; rewrite page.image -> cas url.
  const oldPageFiles = []
  for (const p of m.pages) {
    const localName = `page_${String(p.order).padStart(3, '0')}.webp`
    const srcPath = path.join(dir, localName)
    if (fs.existsSync(srcPath)) {
      const cid = casStore(srcPath, 'webp')
      p.imageCid = cid
      p.image = `/library/cas/${cid}.webp`
      oldPageFiles.push(srcPath)
    }
  }

  // 2. Content-address each language's text file (kept in place for the reader;
  //    cid recorded for integrity + replication).
  const textCids = {}
  const textDir = path.join(dir, 'text')
  if (fs.existsSync(textDir)) {
    for (const f of fs.readdirSync(textDir)) {
      if (f.endsWith('.json')) {
        textCids[f.replace('.json', '')] = sha256(fs.readFileSync(path.join(textDir, f)))
      }
    }
  }

  // 3. Build the release manifest (reader fields preserved; release fields added).
  const release = {
    slug: m.slug,
    title: m.title,
    subtitle: m.subtitle ?? null,
    media: MEDIA_BY_SLUG[slug] || 'doc',
    origin: key.publicKey,
    version: (m.version || 0) + 1,
    pageCount: m.pageCount,
    languages: m.languages || [],
    defaultLanguage: m.defaultLanguage || 'en',
    textBase: m.textBase,
    textCids,
    pages: m.pages,
  }

  // 4. Canonical hash + signature (signature/manifestCid excluded from canonical).
  const canonical = stable(release)
  const manifestCid = sha256(Buffer.from(canonical, 'utf8'))
  const signature = signData(canonical, key.privateKey)
  const signed = { ...release, manifestCid, signerPublicKey: key.publicKey, signature }

  // Self-verify.
  if (!verifySignature(canonical, signature, key.publicKey)) {
    console.error('[!] Self-verification FAILED — aborting.')
    process.exit(1)
  }

  fs.writeFileSync(manifestPath, JSON.stringify(signed, null, 2))

  // Remove the now-redundant per-work page files (manifest points to CAS).
  for (const f of oldPageFiles) fs.unlinkSync(f)

  const casCount = fs.existsSync(CAS) ? fs.readdirSync(CAS).length : 0
  console.log(`  sealed '${release.title}'`)
  console.log(`  media=${release.media}  version=${release.version}  pages=${release.pages.length}  langs=${release.languages.length}`)
  console.log(`  manifestCid: ${manifestCid}`)
  console.log(`  signature:   ${signature.slice(0, 32)}…  (verified ✓)`)
  console.log(`  origin pubkey: ${key.publicKey.slice(0, 32)}…`)
  console.log(`  CAS objects: ${casCount}`)
}

const slug = process.argv[2]
if (!slug) {
  console.log('Usage: node scripts/_local/library_seal.mjs <slug>')
  process.exit(0)
}
console.log(`Sealing library/${slug} ...`)
seal(slug)
