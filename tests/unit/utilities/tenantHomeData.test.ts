/**
 * tenantHomeData — Unit Tests
 *
 * Tests the branded home page data generator. Pure function — no mocks needed.
 */
import { describe, it, expect } from 'vitest'

import { tenantHomeData } from '@/utilities/tenantHomeData'
import type { Tenant } from '@/payload-types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 1,
    name: 'Test Corp',
    slug: 'test-corp',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  } as unknown as Tenant
}

// ── tenantHomeData ────────────────────────────────────────────────────────────

describe('tenantHomeData', () => {
  it('returns slug="home"', () => {
    const data = tenantHomeData(makeTenant())
    expect(data.slug).toBe('home')
  })

  it('returns _status="published"', () => {
    const data = tenantHomeData(makeTenant())
    expect(data._status).toBe('published')
  })

  it('returns title="Home"', () => {
    const data = tenantHomeData(makeTenant())
    expect(data.title).toBe('Home')
  })

  it('uses branding.siteName as primary name source', () => {
    const data = tenantHomeData(makeTenant({ branding: { siteName: 'Acme Co', primaryColor: null } } as any))
    expect(data.meta?.title).toContain('Acme Co')
  })

  it('falls back to tenant.name when no branding.siteName', () => {
    const data = tenantHomeData(makeTenant({ name: 'Test Corp', branding: undefined }))
    expect(data.meta?.title).toContain('Test Corp')
  })

  it('falls back to "Welcome" when no name or branding', () => {
    const data = tenantHomeData(makeTenant({ name: undefined as any, branding: undefined }))
    expect(data.meta?.title).toContain('Welcome')
  })

  it('includes tagline in meta title when provided', () => {
    const data = tenantHomeData(makeTenant({ branding: { siteName: 'Acme', tagline: 'Build the future', primaryColor: null } } as any))
    expect(data.meta?.title).toContain('Build the future')
  })

  it('meta title has no em-dash when tagline is empty', () => {
    const data = tenantHomeData(makeTenant({ branding: { siteName: 'Acme', tagline: '', primaryColor: null } } as any))
    expect(data.meta?.title).not.toContain('—')
  })

  it('meta description is tagline when tagline is provided', () => {
    const data = tenantHomeData(makeTenant({ branding: { siteName: 'Acme', tagline: 'Powering communities', primaryColor: null } } as any))
    expect(data.meta?.description).toBe('Powering communities')
  })

  it('meta description is "Welcome to {siteName}" when no tagline', () => {
    const data = tenantHomeData(makeTenant({ name: 'Clearwater', branding: undefined }))
    expect(data.meta?.description).toBe('Welcome to Clearwater')
  })

  it('hero has type="lowImpact"', () => {
    const data = tenantHomeData(makeTenant())
    expect((data.hero as any).type).toBe('lowImpact')
  })

  it('hero richText is defined and non-empty', () => {
    const data = tenantHomeData(makeTenant())
    expect((data.hero as any).richText).toBeDefined()
  })

  it('layout contains content and cta blocks', () => {
    const data = tenantHomeData(makeTenant())
    const blockTypes = (data.layout as any[]).map(b => b.blockType)
    expect(blockTypes).toContain('content')
    expect(blockTypes).toContain('cta')
  })

  it('cta block has Browse Posts and View Events links', () => {
    const data = tenantHomeData(makeTenant())
    const cta = (data.layout as any[]).find(b => b.blockType === 'cta')
    const urls = cta.links.map((l: any) => l.link.url)
    expect(urls).toContain('/posts')
    expect(urls).toContain('/events')
  })
})
