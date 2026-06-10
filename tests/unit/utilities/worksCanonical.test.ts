import { describe, it, expect } from 'vitest'
import {
  resolveCanonicalOrigin,
  buildWorkCanonicalUrl,
  isCanonicalHost,
} from '@/utilities/worksCanonical'

const WDEG = { origin: 'https://wheredideveryonego.spacesangels.com', endeavor: 'wdeg' }
const SERVING = 'https://clearwater-cruisin.spacesangels.com'

describe('worksCanonical', () => {
  describe('resolveCanonicalOrigin', () => {
    it('uses the declared publisher origin when set', () => {
      expect(resolveCanonicalOrigin(WDEG, SERVING)).toBe('https://wheredideveryonego.spacesangels.com')
    })
    it('falls back to the serving origin when no canonical declared', () => {
      expect(resolveCanonicalOrigin(undefined, SERVING)).toBe(SERVING)
      expect(resolveCanonicalOrigin({}, SERVING)).toBe(SERVING)
    })
    it('strips trailing slashes from either source', () => {
      expect(resolveCanonicalOrigin({ origin: 'https://pub.example/' }, SERVING)).toBe('https://pub.example')
      expect(resolveCanonicalOrigin(undefined, 'https://serve.example//')).toBe('https://serve.example')
    })
  })

  describe('buildWorkCanonicalUrl', () => {
    it('points a subscriber-served page at the publisher root', () => {
      // WDEG rendered ON Clearwater Cruisin's domain still canonicalizes to WDEG's home.
      expect(buildWorkCanonicalUrl(WDEG, 'wdeg', '11-the-name', SERVING)).toBe(
        'https://wheredideveryonego.spacesangels.com/learn/wdeg/11-the-name',
      )
    })
    it('self-canonicalizes when the work declares no publisher', () => {
      expect(buildWorkCanonicalUrl(undefined, 'gpt-psychosis', 'readme', SERVING)).toBe(
        'https://clearwater-cruisin.spacesangels.com/learn/gpt-psychosis/readme',
      )
    })
  })

  describe('isCanonicalHost', () => {
    it('true when serving origin IS the declared canonical home', () => {
      expect(isCanonicalHost(WDEG, 'https://wheredideveryonego.spacesangels.com')).toBe(true)
    })
    it('false when a subscriber renders someone else’s work', () => {
      expect(isCanonicalHost(WDEG, SERVING)).toBe(false)
    })
    it('true for self-canonical (undeclared) works', () => {
      expect(isCanonicalHost(undefined, SERVING)).toBe(true)
    })
  })
})
