/**
 * Works Engine slice #2 — seal + translate unit tests.
 *
 * Covers the load-bearing invariants:
 *   - sign/verify round-trip (Ed25519, hex, mirrors federation protocol)
 *   - canonical-form stability (sorted keys, reproducible manifestCid)
 *   - base-language IMMUTABILITY: adding a translation re-seals at version+1 with a
 *     new signature, but baseContentCid is unchanged (same work identity)
 *   - tamper detection (text + signature)
 *   - translateWorkDraft orchestration (additive, idempotent, base never touched)
 */
import { describe, it, expect } from 'vitest'
import {
  sealWork,
  verifyWorkManifest,
  buildTexts,
  computeBaseContentCid,
  textCid,
  stable,
  sha256,
  type WorkDraft,
} from '@/utilities/worksSeal'
import { translateWorkDraft } from '@/utilities/worksTranslate'
import { generateFederationKeyPair } from '@/federation/protocol'

const KEYS = generateFederationKeyPair()

function baseDraft(): WorkDraft {
  return {
    title: 'Where Did Everyone Go',
    subtitle: 'A primer',
    media: 'doc',
    defaultLanguage: 'en',
    languages: [{ code: 'en', name: 'English' }],
    pages: [
      { id: 'p1', order: 0, title: 'Chapter One', markdown: '# The Window\n\nIt was open again.' },
      { id: 'p2', order: 1, title: 'Chapter Two', markdown: '## Morning\n\nThe street was quiet.' },
    ],
  }
}

function seal(draft: WorkDraft, previousVersion = 0) {
  return sealWork({
    draft,
    slug: 'wdeg-test',
    signerPublicKey: KEYS.publicKey,
    signerPrivateKey: KEYS.privateKey,
    previousVersion,
  })
}

describe('worksSeal — sign / verify round-trip', () => {
  it('produces a self-verified manifest', () => {
    const { manifest, verified } = seal(baseDraft())
    expect(verified).toBe(true)
    expect(verifyWorkManifest(manifest).pass).toBe(true)
  })

  it('manifestCid equals sha256 of the canonical form', () => {
    const { manifest, canonical } = seal(baseDraft())
    expect(manifest.manifestCid).toBe(sha256(canonical))
  })

  it('version starts at previousVersion + 1', () => {
    expect(seal(baseDraft(), 0).manifest.version).toBe(1)
    expect(seal(baseDraft(), 4).manifest.version).toBe(5)
  })

  it('carries the signer public key as origin', () => {
    const { manifest } = seal(baseDraft())
    expect(manifest.origin).toBe(KEYS.publicKey)
    expect(manifest.signerPublicKey).toBe(KEYS.publicKey)
  })
})

describe('worksSeal — canonical stability', () => {
  it('stable() sorts object keys deterministically', () => {
    expect(stable({ b: 1, a: 2 })).toBe(stable({ a: 2, b: 1 }))
    expect(stable({ a: 2, b: 1 })).toBe('{"a":2,"b":1}')
  })

  it('re-sealing identical content yields an identical manifestCid', () => {
    const a = seal(baseDraft())
    const b = seal(baseDraft())
    expect(a.manifest.manifestCid).toBe(b.manifest.manifestCid)
  })

  it('buildTexts puts base text under the default language, keyed by order', () => {
    const texts = buildTexts(baseDraft())
    expect(Object.keys(texts)).toEqual(['en'])
    expect(texts.en['0']).toContain('The Window')
    expect(texts.en['1']).toContain('Morning')
  })
})

describe('worksSeal — base language immutability', () => {
  it('keeps baseContentCid stable when a translation is added, but bumps version + changes signature', () => {
    const v1 = seal(baseDraft(), 0)

    // Add a Spanish translation (additive) and re-seal at the next version.
    const translated: WorkDraft = {
      ...baseDraft(),
      languages: [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Español' },
      ],
      translations: { es: { '0': '# La Ventana\n\nEstaba abierta otra vez.', '1': '## Mañana\n\nLa calle estaba tranquila.' } },
      machineTranslated: ['es'],
    }
    const v2 = sealWork({
      draft: translated,
      slug: 'wdeg-test',
      signerPublicKey: KEYS.publicKey,
      signerPrivateKey: KEYS.privateKey,
      previousVersion: v1.manifest.version,
    })

    // Identity is preserved; the release is a new signed snapshot.
    expect(v2.manifest.baseContentCid).toBe(v1.manifest.baseContentCid)
    expect(v2.manifest.version).toBe(2)
    expect(v2.manifest.signature).not.toBe(v1.manifest.signature)
    expect(v2.manifest.manifestCid).not.toBe(v1.manifest.manifestCid)

    // The new language is present + integrity-hashed + honestly marked.
    expect(v2.manifest.languages.map((l) => l.code).sort()).toEqual(['en', 'es'])
    expect(v2.manifest.machineTranslated).toEqual(['es'])
    expect(textCid(v2.manifest.texts.es)).toBe(v2.manifest.textCids.es)
    expect(verifyWorkManifest(v2.manifest).pass).toBe(true)
  })

  it('baseContentCid ignores translations and version entirely', () => {
    const a = computeBaseContentCid(baseDraft(), buildTexts(baseDraft()))
    const withTranslation: WorkDraft = { ...baseDraft(), translations: { es: { '0': 'x', '1': 'y' } } }
    const b = computeBaseContentCid(withTranslation, buildTexts(withTranslation))
    expect(a).toBe(b)
  })

  it('baseContentCid changes when the base content changes', () => {
    const a = computeBaseContentCid(baseDraft(), buildTexts(baseDraft()))
    const edited = baseDraft()
    edited.pages[0].markdown = '# A different opening'
    const b = computeBaseContentCid(edited, buildTexts(edited))
    expect(a).not.toBe(b)
  })
})

describe('worksSeal — tamper detection', () => {
  it('rejects a manifest whose text was altered after signing', () => {
    const { manifest } = seal(baseDraft())
    const tampered = structuredClone(manifest)
    tampered.texts.en['0'] = 'Injected content'
    const result = verifyWorkManifest(tampered)
    expect(result.pass).toBe(false)
    // text-hash and/or base-content checks must fail
    expect(result.checks.filter((c) => !c.pass).length).toBeGreaterThan(0)
  })

  it('rejects a manifest with a forged signature', () => {
    const { manifest } = seal(baseDraft())
    const tampered = structuredClone(manifest)
    tampered.signature = 'deadbeef'.repeat(16)
    const sigCheck = verifyWorkManifest(tampered).checks.find((c) => c.label.includes('signature'))
    expect(sigCheck?.pass).toBe(false)
  })
})

describe('worksTranslate — orchestration', () => {
  // Deterministic fake translator: tags text with the target language.
  const fakeTranslate = async (text: string, lang: string) => `[${lang}] ${text}`

  it('adds requested languages, skipping the base language', async () => {
    const { added, skipped, draft } = await translateWorkDraft(baseDraft(), {
      targetLangs: ['en', 'es', 'fr'],
      translateFn: fakeTranslate,
    })
    expect(added.sort()).toEqual(['es', 'fr'])
    expect(skipped).toContain('en')
    expect(draft.translations?.es?.['0']).toContain('[Spanish]')
    expect(draft.languages.map((l) => l.code).sort()).toEqual(['en', 'es', 'fr'])
    expect(draft.machineTranslated?.sort()).toEqual(['es', 'fr'])
  })

  it('is idempotent — already-translated languages are skipped unless forced', async () => {
    const once = await translateWorkDraft(baseDraft(), { targetLangs: ['es'], translateFn: fakeTranslate })
    const twice = await translateWorkDraft(once.draft, { targetLangs: ['es'], translateFn: fakeTranslate })
    expect(twice.added).toEqual([])
    expect(twice.skipped).toContain('es')

    const forced = await translateWorkDraft(once.draft, { targetLangs: ['es'], translateFn: fakeTranslate, force: true })
    expect(forced.added).toEqual(['es'])
  })

  it('translated draft seals cleanly with all languages verified', async () => {
    const { draft } = await translateWorkDraft(baseDraft(), {
      targetLangs: ['es', 'fr'],
      translateFn: fakeTranslate,
    })
    const { manifest, verified } = seal(draft)
    expect(verified).toBe(true)
    expect(manifest.languages.map((l) => l.code).sort()).toEqual(['en', 'es', 'fr'])
    expect(verifyWorkManifest(manifest).pass).toBe(true)
  })
})
