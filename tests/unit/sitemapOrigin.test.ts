import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The sitemap's origin must come from the request, not from NEXT_PUBLIC_SERVER_URL.
 * That env var bakes at build time and is unset in the container build, which is
 * how every portal ended up publishing `http://localhost:3000` to search engines.
 */

const hdrs = { get: vi.fn() }
vi.mock('next/headers', () => ({ headers: async () => hdrs }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/utilities/resolveTenantFromHeaders', () => ({
  resolveTenantFromHeaders: async () => ({ tenantFilter: { tenant: { equals: 1 } } }),
}))
vi.mock('payload', () => ({
  getPayload: async () => ({ find: async () => ({ docs: [] }) }),
}))

import sitemap from '@/app/sitemap'

const withHeaders = (h: Record<string, string>) => {
  hdrs.get.mockImplementation((k?: string) => (k ? (h[String(k).toLowerCase()] ?? null) : null))
}

describe('sitemap origin', () => {
  beforeEach(() => hdrs.get.mockReset())

  it('uses the portal that was actually asked, not the canonical build-time origin', async () => {
    withHeaders({ 'x-forwarded-host': 'wheredideveryonego.spacesangels.com', 'x-forwarded-proto': 'https' })
    const entries = await sitemap()
    expect(entries[0]!.url).toBe('https://wheredideveryonego.spacesangels.com')
    expect(entries.every((e) => !e.url.includes('localhost'))).toBe(true)
  })

  it('falls back to host when the proxy header is absent', async () => {
    withHeaders({ host: 'gracechapel.spacesangels.com' })
    const entries = await sitemap()
    expect(entries[0]!.url).toBe('https://gracechapel.spacesangels.com')
  })

  it('does not force https onto local development', async () => {
    withHeaders({ host: 'localhost:3001' })
    const entries = await sitemap()
    expect(entries[0]!.url).toBe('http://localhost:3001')
  })
})
