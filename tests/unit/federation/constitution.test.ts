/**
 * Angel OS Constitution — Unit Tests
 *
 * Pure crypto functions. No mocks needed — only Node.js built-in crypto.
 */
import { describe, it, expect } from 'vitest'

import {
  getConstitutionText,
  computeConstitutionChecksum,
  getActiveConstitution,
  getConstitutionVersion,
  ANGEL_OS_CONSTITUTION_V1_1,
} from '@/federation/constitution'

// ── getConstitutionVersion ─────────────────────────────────────────────────

describe('getConstitutionVersion', () => {
  it('returns the current constitution version', () => {
    expect(getConstitutionVersion()).toBe('1.1')
  })
})

// ── getActiveConstitution ─────────────────────────────────────────────────

describe('getActiveConstitution', () => {
  it('returns the same object as ANGEL_OS_CONSTITUTION_V1_1', () => {
    expect(getActiveConstitution()).toBe(ANGEL_OS_CONSTITUTION_V1_1)
  })

  it('has version 1.1', () => {
    expect(getActiveConstitution().version).toBe('1.1')
  })

  it('has a non-empty checksum', () => {
    const { checksum } = getActiveConstitution()
    expect(typeof checksum).toBe('string')
    expect(checksum.length).toBeGreaterThan(0)
  })

  it('has exactly 7 articles', () => {
    expect(getActiveConstitution().articles).toHaveLength(7)
  })

  it('article I is Dignity and Rights', () => {
    const art = getActiveConstitution().articles[0]
    expect(art.number).toBe('I')
    expect(art.title).toBe('Dignity and Rights')
  })

  it('article VII is Federation', () => {
    const art = getActiveConstitution().articles[6]
    expect(art.number).toBe('VII')
    expect(art.title).toBe('Federation')
  })

  it('article II is Anti-Demonic Safeguards', () => {
    const art = getActiveConstitution().articles[1]
    expect(art.number).toBe('II')
    expect(art.title).toContain('Anti-Demonic')
  })

  it('article V describes the Toward-53 Principle', () => {
    const art = getActiveConstitution().articles[4]
    expect(art.number).toBe('V')
    expect(art.title).toContain('53')
  })
})

// ── computeConstitutionChecksum ────────────────────────────────────────────

describe('computeConstitutionChecksum', () => {
  it('returns a 64-character hex SHA-256 string', () => {
    const { checksum, ...doc } = ANGEL_OS_CONSTITUTION_V1_1
    const result = computeConstitutionChecksum(doc)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same result on repeated calls', () => {
    const { checksum, ...doc } = ANGEL_OS_CONSTITUTION_V1_1
    const a = computeConstitutionChecksum(doc)
    const b = computeConstitutionChecksum(doc)
    expect(a).toBe(b)
  })

  it('matches the checksum stored in ANGEL_OS_CONSTITUTION_V1_1', () => {
    const { checksum, ...doc } = ANGEL_OS_CONSTITUTION_V1_1
    expect(computeConstitutionChecksum(doc)).toBe(checksum)
  })

  it('changes when articles change', () => {
    const { checksum, ...doc } = ANGEL_OS_CONSTITUTION_V1_1
    const modifiedDoc = {
      ...doc,
      articles: [
        ...doc.articles.slice(0, 6),
        { ...doc.articles[6], title: 'Modified Title' },
      ],
    }
    const original = computeConstitutionChecksum(doc)
    const modified = computeConstitutionChecksum(modifiedDoc)
    expect(modified).not.toBe(original)
  })
})

// ── getConstitutionText ────────────────────────────────────────────────────

describe('getConstitutionText', () => {
  const doc = ANGEL_OS_CONSTITUTION_V1_1

  it('starts with ANGEL OS CONSTITUTION header', () => {
    const text = getConstitutionText(doc)
    expect(text).toMatch(/^ANGEL OS CONSTITUTION v1\.1/)
  })

  it('includes the effective date', () => {
    const text = getConstitutionText(doc)
    expect(text).toContain(doc.effectiveDate)
  })

  it('includes Article I label', () => {
    const text = getConstitutionText(doc)
    expect(text).toContain('Article I: Dignity and Rights')
  })

  it('includes Article VII label', () => {
    const text = getConstitutionText(doc)
    expect(text).toContain('Article VII: Federation')
  })

  it('ends with the Answer 53 principle', () => {
    const text = getConstitutionText(doc)
    expect(text).toContain('Answer 53: The whole point of existence is to learn to love.')
  })

  it('includes the Suitcase Principle mention', () => {
    const text = getConstitutionText(doc)
    expect(text).toContain('Suitcase')
  })

  it('is deterministic — same result on repeated calls', () => {
    const a = getConstitutionText(doc)
    const b = getConstitutionText(doc)
    expect(a).toBe(b)
  })
})
