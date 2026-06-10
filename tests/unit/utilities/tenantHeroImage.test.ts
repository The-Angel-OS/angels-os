/**
 * tenantHeroImage — resolves storefront.coverImage URL (or a per-section
 * override), else null (so heroes fall back to the brand gradient).
 */
import { describe, it, expect } from 'vitest'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'

describe('tenantHeroImage', () => {
  it('returns the storefront cover image url when hydrated', () => {
    const tenant = { storefront: { coverImage: { url: 'https://cdn/x.jpg' } } }
    expect(tenantHeroImage(tenant)).toBe('https://cdn/x.jpg')
  })

  it('returns null when coverImage is just an id (not hydrated)', () => {
    expect(tenantHeroImage({ storefront: { coverImage: 42 } })).toBeNull()
  })

  it('returns null when no coverImage / no storefront / no tenant', () => {
    expect(tenantHeroImage({ storefront: {} })).toBeNull()
    expect(tenantHeroImage({})).toBeNull()
    expect(tenantHeroImage(null)).toBeNull()
    expect(tenantHeroImage(undefined)).toBeNull()
  })

  describe('per-section override', () => {
    it('uses the section image when set', () => {
      const tenant = {
        storefront: {
          coverImage: { url: 'https://cdn/cover.jpg' },
          postsHeroImage: { url: 'https://cdn/posts.jpg' },
        },
      }
      expect(tenantHeroImage(tenant, 'posts')).toBe('https://cdn/posts.jpg')
    })

    it('falls back to coverImage when the section image is unset', () => {
      const tenant = { storefront: { coverImage: { url: 'https://cdn/cover.jpg' } } }
      expect(tenantHeroImage(tenant, 'events')).toBe('https://cdn/cover.jpg')
    })

    it('falls back to coverImage when the section field does not exist (pre-migration)', () => {
      const tenant = { storefront: { coverImage: { url: 'https://cdn/cover.jpg' } } }
      expect(tenantHeroImage(tenant, 'shop')).toBe('https://cdn/cover.jpg')
    })
  })
})
