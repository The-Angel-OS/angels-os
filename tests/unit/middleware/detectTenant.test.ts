/**
 * detectTenantFromHostname — hostname → tenant slug (or null = platform context).
 * Guards the reserved-subdomain fix (platform.* must behave like www.*).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { detectTenantFromHostname } from '@/middleware/detectTenant'

afterEach(() => {
  delete process.env.TENANT_DOMAINS
  delete process.env.DEFAULT_TENANT_SLUG
})

describe('detectTenantFromHostname', () => {
  it('reserved infra subdomains are platform context (null)', () => {
    expect(detectTenantFromHostname('www.spacesangels.com')).toBeNull()
    expect(detectTenantFromHostname('platform.spacesangels.com')).toBeNull() // the fix
    expect(detectTenantFromHostname('app.spacesangels.com')).toBeNull()
    expect(detectTenantFromHostname('admin.spacesangels.com')).toBeNull()
    expect(detectTenantFromHostname('api.kendev.co')).toBeNull()
  })

  it('a real tenant subdomain resolves to its slug', () => {
    expect(detectTenantFromHostname('clearwater-cruisin.spacesangels.com')).toBe('clearwater-cruisin')
    expect(detectTenantFromHostname('clearwater-wellness.kendev.co')).toBe('clearwater-wellness')
    expect(detectTenantFromHostname('haulpro.kendev.co')).toBe('haulpro')
  })

  it('main platform apex/domains → null', () => {
    expect(detectTenantFromHostname('spacesangels.com')).toBeNull()
    expect(detectTenantFromHostname('kendev.co')).toBeNull()
    expect(detectTenantFromHostname('angels-os.kendev.co')).toBeNull()
  })

  it('explicit TENANT_DOMAINS mapping wins', () => {
    process.env.TENANT_DOMAINS = 'wheredideveryonego.net:wdeg'
    expect(detectTenantFromHostname('wheredideveryonego.net')).toBe('wdeg')
    expect(detectTenantFromHostname('www.wheredideveryonego.net')).toBe('wdeg')
  })

  it('localhost is platform context unless DEFAULT_TENANT_SLUG set', () => {
    expect(detectTenantFromHostname('localhost')).toBeNull()
    process.env.DEFAULT_TENANT_SLUG = 'clearwater-cruisin'
    expect(detectTenantFromHostname('localhost')).toBe('clearwater-cruisin')
  })

  it('*.localhost dev subdomains resolve to the subdomain', () => {
    expect(detectTenantFromHostname('clearwater-cruisin.localhost')).toBe('clearwater-cruisin')
  })

  it('strips a port before parsing', () => {
    expect(detectTenantFromHostname('haulpro.kendev.co:3000')).toBe('haulpro')
  })

  it('unknown 2-part domains do not guess (null)', () => {
    expect(detectTenantFromHostname('unknown.com')).toBeNull()
  })
})
