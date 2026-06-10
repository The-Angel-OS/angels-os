/**
 * cookieDomainForHost — the apex the auth cookie is scoped to (cross-subdomain SSO).
 */
import { describe, it, expect } from 'vitest'
import { cookieDomainForHost } from '@/utilities/cookieDomain'

describe('cookieDomainForHost', () => {
  it('shares across spacesangels.com subdomains', () => {
    expect(cookieDomainForHost('clearwater-cruisin.spacesangels.com')).toBe('.spacesangels.com')
    expect(cookieDomainForHost('www.spacesangels.com')).toBe('.spacesangels.com')
    expect(cookieDomainForHost('spacesangels.com')).toBe('.spacesangels.com')
  })

  it('works for any vendor custom domain + its subdomains (replicable-everyone)', () => {
    expect(cookieDomainForHost('app.vendor.com')).toBe('.vendor.com')
    expect(cookieDomainForHost('haulpro.kendev.co')).toBe('.kendev.co')
    expect(cookieDomainForHost('vendor.com')).toBe('.vendor.com')
  })

  it('handles multi-part TLDs (registrable = last 3 labels)', () => {
    expect(cookieDomainForHost('portal.acme.co.uk')).toBe('.acme.co.uk')
    expect(cookieDomainForHost('acme.co.uk')).toBe('.acme.co.uk')
    expect(cookieDomainForHost('shop.biz.com.au')).toBe('.biz.com.au')
  })

  it('strips a port', () => {
    expect(cookieDomainForHost('app.vendor.com:3000')).toBe('.vendor.com')
  })

  it('localhost + dev subdomains → host-only (null)', () => {
    expect(cookieDomainForHost('localhost')).toBeNull()
    expect(cookieDomainForHost('clearwater-cruisin.localhost')).toBeNull()
    expect(cookieDomainForHost('localhost:3000')).toBeNull()
  })

  it('bare IPs → host-only (null)', () => {
    expect(cookieDomainForHost('192.168.1.10')).toBeNull()
    expect(cookieDomainForHost('127.0.0.1:3000')).toBeNull()
  })

  it('preview/platform suffixes → host-only (null)', () => {
    expect(cookieDomainForHost('angels-os-abc123.vercel.app')).toBeNull()
    expect(cookieDomainForHost('vercel.app')).toBeNull()
    expect(cookieDomainForHost('foo.pages.dev')).toBeNull()
  })

  it('empty / nullish → null', () => {
    expect(cookieDomainForHost('')).toBeNull()
    expect(cookieDomainForHost(undefined)).toBeNull()
    expect(cookieDomainForHost(null)).toBeNull()
  })
})
