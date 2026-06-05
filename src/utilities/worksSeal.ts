/**
 * worksSeal — Works Engine slice #2: seal a DB-backed Work into a sovereign,
 * verifiable, multilingual release.
 *
 * This is the server-side port of `scripts/_local/library_seal.mjs`, generalized
 * for the editable Work drafts authored in Work Studio (stored as a Channel's
 * `data.workDraft`). It is PURE — zero Payload / fs / network imports — so it is
 * fully unit-testable and edge-safe. The endpoint (`works-seal.ts`) injects the
 * signing key (from `keyStore`) and any content-addressed image assets.
 *
 * ── The base-language-is-immutable thesis ────────────────────────────────────
 * A Work's identity is its BASE LANGUAGE content. We content-address that into a
 * permanent `baseContentCid` that is signed into the manifest and stays stable
 * across every re-seal. Translations are ADDITIVE, verifiable addenda: each
 * language's text is integrity-hashed (`textCids[lang]`) and carried inline
 * (`texts[lang]`). Adding the 18th translation re-seals at version+1 with a new
 * signature, but `baseContentCid` is unchanged — proving it is the same work.
 *
 * Canonical form & signature mirror `src/federation/protocol.ts` (hex Ed25519)
 * and `library_replicate.mjs` exactly (strip the 3 release fields, sort keys),
 * so Library releases stay federation-verifiable.
 *
 * See docs/WORKS_ENGINE.md.
 */
import crypto from 'crypto'
import { signData, verifySignature } from '@/federation/protocol'

// ── Draft (input) shapes — mirror Work Studio's WorkDraft ────────────────────
export interface WorkDraftPage {
  id?: string
  order: number
  title?: string
  /** Base-language body (Markdown). */
  markdown?: string
  caption?: string
  /** Payload Media id, if this page carries an illustration (primer works). */
  imageMediaId?: string | number
}

export interface WorkLanguage {
  code: string
  name: string
  rtl?: boolean
}

export interface WorkDraft {
  title: string
  subtitle?: string
  media: string
  languages: WorkLanguage[]
  defaultLanguage: string
  pages: WorkDraftPage[]
  /** lang -> { pageOrder -> translated text }. Base language never lives here. */
  translations?: Record<string, Record<string, string>>
  /** lang codes that were machine-translated (provenance / honesty). */
  machineTranslated?: string[]
}

/** A content-addressed image asset, keyed by page order (resolved by the endpoint). */
export interface CasAsset {
  cid: string
  url: string
}

// ── Output: the signed release manifest ──────────────────────────────────────
export interface SealedPage {
  order: number
  title?: string
  caption?: string
  imageCid?: string
  image?: string
}

export interface SealedManifest {
  // identity
  slug: string
  /** Permanent identity: sha256 of canonical base-language content+structure. */
  baseContentCid: string
  baseLanguage: string
  // reader fields
  title: string
  subtitle: string | null
  media: string
  pageCount: number
  languages: WorkLanguage[]
  defaultLanguage: string
  pages: SealedPage[]
  /** Integrity hash per language: sha256 of canonical { order: text }. */
  textCids: Record<string, string>
  /** Inline per-language text: lang -> { order -> text }. */
  texts: Record<string, Record<string, string>>
  /** lang codes that were machine-translated. */
  machineTranslated: string[]
  // release / provenance
  version: number
  origin: string
  // — release fields excluded from the canonical signing form (below) —
  manifestCid: string
  signerPublicKey: string
  signature: string
}

/** The 3 fields stripped before computing the canonical signing form. */
type ReleaseManifest = Omit<SealedManifest, 'manifestCid' | 'signerPublicKey' | 'signature'>

// ── Primitives (mirror protocol.ts / library_seal.mjs) ───────────────────────
export function sha256(input: string | Buffer): string {
  const data = typeof input === 'string' ? input : new Uint8Array(input)
  return crypto.createHash('sha256').update(data).digest('hex')
}

/** Deterministic JSON (sorted keys) so signatures are reproducible. */
export function stable(o: unknown): string {
  if (Array.isArray(o)) return '[' + o.map(stable).join(',') + ']'
  if (o && typeof o === 'object') {
    return (
      '{' +
      Object.keys(o as Record<string, unknown>)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stable((o as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    )
  }
  return JSON.stringify(o)
}

// ── Text assembly ────────────────────────────────────────────────────────────

/**
 * Build the full per-language text map from a draft.
 * Base language text comes from the pages' markdown; other languages from
 * `draft.translations`. Only orders that exist in the base are kept (a
 * translation can never invent a page that the immutable base lacks).
 */
export function buildTexts(draft: WorkDraft): Record<string, Record<string, string>> {
  const base = draft.defaultLanguage
  const orders = draft.pages.map((p) => String(p.order))
  const texts: Record<string, Record<string, string>> = {}

  // Base language: authoritative, from the page bodies.
  const baseMap: Record<string, string> = {}
  for (const p of draft.pages) baseMap[String(p.order)] = p.markdown ?? ''
  texts[base] = baseMap

  // Translations: filtered to the base's page orders.
  for (const [lang, map] of Object.entries(draft.translations ?? {})) {
    if (lang === base) continue
    const filtered: Record<string, string> = {}
    for (const order of orders) {
      if (map[order] != null) filtered[order] = map[order]
    }
    texts[lang] = filtered
  }
  return texts
}

/** Content-address one language's text (canonical JSON of { order: text }). */
export function textCid(langText: Record<string, string>): string {
  return sha256(stable(langText))
}

/**
 * The permanent identity of a Work: a hash over ONLY the base language content
 * and page structure. Stable across re-seals as long as the base is unchanged,
 * even as translations, version, and signatures change.
 */
export function computeBaseContentCid(draft: WorkDraft, texts: Record<string, Record<string, string>>): string {
  const base = draft.defaultLanguage
  const structure = [...draft.pages]
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ order: p.order, title: p.title ?? '' }))
  return sha256(
    stable({
      baseLanguage: base,
      pages: structure,
      baseText: texts[base] ?? {},
    }),
  )
}

// ── Seal ─────────────────────────────────────────────────────────────────────

export interface SealInput {
  draft: WorkDraft
  slug: string
  signerPublicKey: string
  signerPrivateKey: string
  /** Prior sealed version (re-seal bumps to version+1). */
  previousVersion?: number
  /** Content-addressed image assets keyed by page order (primer works). */
  casAssets?: Record<string, CasAsset>
}

export interface SealResult {
  manifest: SealedManifest
  verified: boolean
  canonical: string
}

/**
 * Seal a Work draft into a signed, multilingual release manifest.
 * Self-verifies; `verified` is false if the round-trip signature check fails.
 */
export function sealWork(input: SealInput): SealResult {
  const { draft, slug, signerPublicKey, signerPrivateKey, previousVersion = 0, casAssets = {} } = input

  const base = draft.defaultLanguage
  const texts = buildTexts(draft)

  // Integrity hashes per language.
  const textCids: Record<string, string> = {}
  for (const [lang, map] of Object.entries(texts)) textCids[lang] = textCid(map)

  // Reader-facing page structure (text lives in `texts`, not on the page).
  const pages: SealedPage[] = [...draft.pages]
    .sort((a, b) => a.order - b.order)
    .map((p) => {
      const asset = casAssets[String(p.order)]
      const sp: SealedPage = { order: p.order }
      if (p.title) sp.title = p.title
      if (p.caption) sp.caption = p.caption
      if (asset) {
        sp.imageCid = asset.cid
        sp.image = asset.url
      }
      return sp
    })

  // Languages: base first, then the rest in stable (alphabetical) order so the
  // canonical form does not churn on insertion order.
  const langByCode = new Map(draft.languages.map((l) => [l.code, l]))
  const presentLangs = Object.keys(texts)
  const orderedLangCodes = [base, ...presentLangs.filter((c) => c !== base).sort()]
  const languages: WorkLanguage[] = orderedLangCodes.map(
    (code) => langByCode.get(code) ?? { code, name: code.toUpperCase() },
  )

  const baseContentCid = computeBaseContentCid(draft, texts)

  const release: ReleaseManifest = {
    slug,
    baseContentCid,
    baseLanguage: base,
    title: draft.title,
    subtitle: draft.subtitle?.trim() ? draft.subtitle : null,
    media: draft.media || 'doc',
    pageCount: pages.length,
    languages,
    defaultLanguage: base,
    pages,
    textCids,
    texts,
    machineTranslated: [...(draft.machineTranslated ?? [])].filter((c) => c !== base).sort(),
    version: previousVersion + 1,
    origin: signerPublicKey,
  }

  const canonical = stable(release)
  const manifestCid = sha256(canonical)
  const signature = signData(canonical, signerPrivateKey)
  const manifest: SealedManifest = { ...release, manifestCid, signerPublicKey, signature }

  const verified = verifySignature(canonical, signature, signerPublicKey)
  return { manifest, verified, canonical }
}

// ── Verify (mirror library_replicate.mjs canonicalOf + checks) ───────────────

export interface ManifestCheck {
  label: string
  pass: boolean
}

export interface VerifyResult {
  checks: ManifestCheck[]
  pass: boolean
}

/** Recompute the canonical signing form of a sealed manifest. */
export function canonicalOf(m: SealedManifest): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { manifestCid, signerPublicKey, signature, ...release } = m
  return stable(release)
}

/**
 * Verify a sealed manifest's provenance + integrity:
 *   1. manifestCid = sha256(canonical)
 *   2. Ed25519 signature valid against signerPublicKey
 *   3. every language's text hashes to its recorded textCid
 *   4. baseContentCid matches the recomputed base content hash
 */
export function verifyWorkManifest(m: SealedManifest): VerifyResult {
  const checks: ManifestCheck[] = []
  const canonical = canonicalOf(m)

  checks.push({ label: 'manifestCid matches canonical hash', pass: sha256(canonical) === m.manifestCid })
  checks.push({
    label: 'Ed25519 signature valid (origin provenance)',
    pass: verifySignature(canonical, m.signature, m.signerPublicKey),
  })

  let textsOk = true
  for (const [lang, cid] of Object.entries(m.textCids)) {
    if (textCid(m.texts[lang] ?? {}) !== cid) {
      textsOk = false
      break
    }
  }
  checks.push({ label: `all ${Object.keys(m.textCids).length} language texts hash-verified`, pass: textsOk })

  const structure = m.pages
    .map((p) => ({ order: p.order, title: p.title ?? '' }))
    .sort((a, b) => a.order - b.order)
  const recomputedBaseCid = sha256(
    stable({ baseLanguage: m.baseLanguage, pages: structure, baseText: m.texts[m.baseLanguage] ?? {} }),
  )
  checks.push({ label: 'baseContentCid matches base language content', pass: recomputedBaseCid === m.baseContentCid })

  return { checks, pass: checks.every((c) => c.pass) }
}
