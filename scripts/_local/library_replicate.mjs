#!/usr/bin/env node
/**
 * library_replicate.mjs — Works Engine slice #2: export / verify / import.
 *
 * Proves the sovereignty thesis on one machine: a sealed Work can be exported as
 * a self-contained bundle, its provenance + integrity VERIFIED by a receiving
 * node, and IMPORTED into that node's library — after which the node needs
 * nothing from the origin (offline, sovereign).
 *
 *   export <slug> <destDir>          bundle manifest + referenced CAS assets + text
 *   verify <bundleDir>               check signature, manifestCid, and every asset hash
 *   import <bundleDir> <nodeRoot>    verify, then replicate into nodeRoot/{cas,<slug>}
 *
 * A bundle is portable and self-contained:
 *   <bundle>/manifest.json
 *   <bundle>/cas/<cid>.webp ...
 *   <bundle>/text/<lang>.json ...
 *
 * Verification mirrors src/federation/protocol.ts (hex SPKI Ed25519). See
 * docs/WORKS_ENGINE.md.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const LIBRARY = path.join(ROOT, 'public', 'library')

// ── primitives (mirror protocol.ts / seal) ──────────────────────────────────
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
function stable(o) {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'
  if (o && typeof o === 'object')
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'
  return JSON.stringify(o)
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
const cp = (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

// Resolve a CAS asset across both layouts: a self-contained BUNDLE keeps cas/
// inside the work dir; a NODE shares cas/ at its root (one dir up). Try both.
function resolveCas(workDir, cid, ext) {
  const local = path.join(workDir, 'cas', `${cid}.${ext}`)
  if (fs.existsSync(local)) return local
  const shared = path.join(workDir, '..', 'cas', `${cid}.${ext}`)
  if (fs.existsSync(shared)) return shared
  return null
}

// ── canonical form (must match seal exactly: strip the 3 release fields) ─────
function canonicalOf(m) {
  // eslint-disable-next-line no-unused-vars
  const { manifestCid, signerPublicKey, signature, ...release } = m
  return stable(release)
}

// ── verify: signature + manifestCid + every asset hash ───────────────────────
function verifyBundle(bundleDir) {
  const m = JSON.parse(fs.readFileSync(path.join(bundleDir, 'manifest.json'), 'utf8'))
  const checks = []
  const ok = (label, pass, extra = '') => checks.push({ label, pass, extra })

  // 1. manifestCid = sha256(canonical)
  const canonical = canonicalOf(m)
  ok('manifestCid matches canonical hash', sha256(Buffer.from(canonical, 'utf8')) === m.manifestCid)

  // 2. signature verifies against signerPublicKey
  ok('Ed25519 signature valid (origin provenance)',
    verifySignature(canonical, m.signature, m.signerPublicKey),
    `origin ${String(m.signerPublicKey).slice(0, 16)}…`)

  // 3. every page image asset hashes to its cid
  let imgOk = true
  for (const p of m.pages || []) {
    if (!p.imageCid) continue
    const f = resolveCas(bundleDir, p.imageCid, 'webp')
    if (!f || sha256(fs.readFileSync(f)) !== p.imageCid) { imgOk = false; break }
  }
  ok(`all ${(m.pages || []).length} image assets hash-verified`, imgOk)

  // 4. every language text file hashes to its cid
  let txtOk = true
  for (const [lang, cid] of Object.entries(m.textCids || {})) {
    const f = path.join(bundleDir, 'text', `${lang}.json`)
    if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== cid) { txtOk = false; break }
  }
  ok(`all ${Object.keys(m.textCids || {}).length} language texts hash-verified`, txtOk)

  return { manifest: m, checks, pass: checks.every((c) => c.pass) }
}

// ── export ───────────────────────────────────────────────────────────────────
function doExport(slug, destDir) {
  const srcDir = path.join(LIBRARY, slug)
  const m = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'))
  const out = path.join(destDir, slug)
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2))
  // referenced image assets from the shared CAS
  for (const p of m.pages || []) {
    if (p.imageCid) cp(path.join(LIBRARY, 'cas', `${p.imageCid}.webp`), path.join(out, 'cas', `${p.imageCid}.webp`))
  }
  // language texts
  for (const lang of Object.keys(m.textCids || {})) {
    cp(path.join(srcDir, 'text', `${lang}.json`), path.join(out, 'text', `${lang}.json`))
  }
  const n = (m.pages || []).length + Object.keys(m.textCids || {}).length
  console.log(`  exported '${m.title}' -> ${out}  (${n} assets, manifestCid ${m.manifestCid.slice(0, 16)}…)`)
}

// ── import (verify, then replicate into a node) ──────────────────────────────
function doImport(bundleDir, nodeRoot) {
  const { manifest: m, checks, pass } = verifyBundle(bundleDir)
  printChecks(checks)
  if (!pass) {
    console.error('  [!] verification FAILED — refusing to import (would not trust this work).')
    process.exit(1)
  }
  // Replicate assets into the node's shared CAS + install the work.
  for (const p of m.pages || []) {
    if (p.imageCid) cp(path.join(bundleDir, 'cas', `${p.imageCid}.webp`), path.join(nodeRoot, 'cas', `${p.imageCid}.webp`))
  }
  const workDir = path.join(nodeRoot, m.slug)
  for (const lang of Object.keys(m.textCids || {})) {
    cp(path.join(bundleDir, 'text', `${lang}.json`), path.join(workDir, 'text', `${lang}.json`))
  }
  fs.mkdirSync(workDir, { recursive: true })
  fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(m, null, 2))
  console.log(`  imported '${m.title}' into node at ${nodeRoot} — sovereign copy, offline-ready.`)
}

function printChecks(checks) {
  for (const c of checks) console.log(`    ${c.pass ? '✓' : '✗'} ${c.label}${c.extra ? '  (' + c.extra + ')' : ''}`)
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const [cmd, a, b] = process.argv.slice(2)
if (cmd === 'export' && a && b) doExport(a, b)
else if (cmd === 'verify' && a) {
  const { checks, pass } = verifyBundle(a)
  printChecks(checks)
  console.log(pass ? '  RESULT: VALID ✓' : '  RESULT: INVALID ✗')
  process.exit(pass ? 0 : 1)
} else if (cmd === 'import' && a && b) doImport(a, b)
else {
  console.log('Usage:')
  console.log('  node library_replicate.mjs export <slug> <destDir>')
  console.log('  node library_replicate.mjs verify <bundleDir>')
  console.log('  node library_replicate.mjs import <bundleDir> <nodeRoot>')
}
