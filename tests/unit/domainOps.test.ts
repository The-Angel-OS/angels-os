import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeDomain } from '@/endpoints/domain-ops'
import {
  getCustomHostnameByName,
  isCloudflareSaaSConfigured,
  normalizeCloudflareHostnameStatus,
  provisionCustomHostname,
} from '@/lib/domains/cloudflareSaaS'

const ok = (input: string) => {
  const r = normalizeDomain(input)
  if ('error' in r) throw new Error(`expected ${input} to be accepted, got: ${r.error}`)
  return r.domain
}
const err = (input: string) => {
  const r = normalizeDomain(input)
  if (!('error' in r)) throw new Error(`expected ${input} to be rejected, got: ${r.domain}`)
  return r.error
}

describe('normalizeDomain', () => {
  it('takes what an owner actually pastes', () => {
    expect(ok('WhereDidEveryoneGo.net')).toBe('wheredideveryonego.net')
    expect(ok('https://www.example.com/about?x=1')).toBe('www.example.com')
    expect(ok('  example.com.  ')).toBe('example.com')
    expect(ok('example.com:3000')).toBe('example.com')
  })

  it('rejects what is not a hostname', () => {
    expect(err('')).toMatch(/enter a domain/i)
    expect(err('example')).toMatch(/not a valid/i)
    expect(err('-bad.com')).toMatch(/not a valid/i)
    expect(err('exa mple.com')).toMatch(/not a valid/i)
  })

  // The whole reason this panel was read-only: a portal must not be able to
  // bind an address the platform mints from someone else's slug.
  it('refuses platform addresses', () => {
    expect(err('spacesangels.com')).toMatch(/platform address/i)
    expect(err('someoneelse.spacesangels.com')).toMatch(/platform address/i)
    expect(err('foo.kendev.co')).toMatch(/platform address/i)
    expect(err('bar.up.railway.app')).toMatch(/platform address/i)
  })

  it('does not refuse a domain that merely CONTAINS a platform apex', () => {
    expect(ok('notspacesangels.com')).toBe('notspacesangels.com')
  })
})

describe('Cloudflare for SaaS Custom Hostnames', () => {
  const origZone = process.env.CLOUDFLARE_ZONE_ID
  const origTok = process.env.CLOUDFLARE_API_TOKEN

  beforeEach(() => {
    delete process.env.CLOUDFLARE_ZONE_ID
    delete process.env.CLOUDFLARE_API_TOKEN
  })

  afterEach(() => {
    if (origZone !== undefined) process.env.CLOUDFLARE_ZONE_ID = origZone
    else delete process.env.CLOUDFLARE_ZONE_ID
    if (origTok !== undefined) process.env.CLOUDFLARE_API_TOKEN = origTok
    else delete process.env.CLOUDFLARE_API_TOKEN
    vi.restoreAllMocks()
  })

  it('falls back cleanly to dns_manual when Cloudflare env vars are not set', async () => {
    expect(isCloudflareSaaSConfigured()).toBe(false)
    const status = await getCustomHostnameByName('shop.creator.com')
    expect(status.status).toBe('dns_manual')
    expect(status.cnameTarget).toBe('core.spacesangels.com')
  })

  it('provisions and normalizes Cloudflare Custom Hostnames with validation records', async () => {
    process.env.CLOUDFLARE_ZONE_ID = 'zone_123'
    process.env.CLOUDFLARE_API_TOKEN = 'cf_tok_secret'
    expect(isCloudflareSaaSConfigured()).toBe(true)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: {
            id: 'cf_host_99',
            hostname: 'shop.creator.com',
            status: 'pending',
            ownership_verification: {
              type: 'txt',
              name: '_cf-custom-hostname.shop.creator.com',
              value: 'verify-xyz',
            },
            ssl: {
              status: 'pending_validation',
              validation_records: [
                {
                  status: 'pending',
                  txt_name: '_acme-challenge.shop.creator.com',
                  txt_value: 'acme-xyz',
                },
              ],
            },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const provisioned = await provisionCustomHostname('shop.creator.com', { tenantSlug: 'creator' })
    expect(provisioned.cloudflareId).toBe('cf_host_99')
    expect(provisioned.status).toBe('pending')
    expect(provisioned.sslStatus).toBe('pending_validation')
    expect(provisioned.ownershipVerification?.value).toBe('verify-xyz')
    expect(provisioned.sslValidationRecords?.[0]?.txtName).toBe('_acme-challenge.shop.creator.com')

    const active = normalizeCloudflareHostnameStatus('shop.creator.com', {
      id: 'cf_host_99',
      status: 'active',
      ssl: { status: 'active' },
    })
    expect(active.status).toBe('active')
    expect(active.sslStatus).toBe('active')
  })
})
