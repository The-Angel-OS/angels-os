/**
 * tenantHeroImage — resolves branding.coverImage URL, else null (so heroes fall
 * back to the brand gradient).
 */
import { describe, it, expect } from 'vitest'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'

describe('tenantHeroImage', () => {
  it('returns the cover image url when hydrated', () => {
    const tenant = { branding: { coverImage: { url: 'https://cdn/x.jpg' } } }
    expect(tenantHeroImage(tenant)).toBe('https://cdn/x.jpg')
  })

  it('returns null when coverImage is just an id (not hydrated)', () => {
    expect(tenantHeroImage({ branding: { coverImage: 42 } })).toBeNull()
  })

  it('returns null when no coverImage / no branding / no tenant', () => {
    expect(tenantHeroImage({ branding: {} })).toBeNull()
    expect(tenantHeroImage({})).toBeNull()
    expect(tenantHeroImage(null)).toBeNull()
    expect(tenantHeroImage(undefined)).toBeNull()
  })
})
