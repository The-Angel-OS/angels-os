/**
 * Federation Holons Endpoint — Unit Tests
 *
 * GET /api/federation/holons
 * Public endpoint — no auth required.
 * Returns network-visible Endeavors with filtering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLogFederationAction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/federation/auditLog', () => ({
  logFederationAction: mockLogFederationAction,
}))

import { federationHolonsHandler } from '@/endpoints/federation-holons'

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_HOLONS = [
  {
    id: 1,
    name: 'Acme Studio',
    tagline: 'Creative services',
    description: 'We make things',
    endeavorType: 'service-provider',
    holonTypes: ['designer', 'printer'],
    missionStatement: 'Serve with excellence',
    status: 'active',
    capabilities: [{ skill: 'graphic-design', description: 'Logos and branding' }],
    region: { city: 'Tampa', state: 'FL', country: 'US' },
    federation: { federationId: 'fed-001', ministryStatus: 'active' },
    logo: { url: 'https://cdn.example.com/logo.png' },
    coverImage: null,
  },
]

function makeReq(
  queryString: string = '',
  payloadOverrides: Record<string, unknown> = {},
  federationIdHeader?: string,
) {
  const url = `http://localhost/api/federation/holons${queryString}`
  const nativeReq = new Request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(federationIdHeader ? { 'x-federation-id': federationIdHeader } : {}),
    },
  })

  const payload = {
    find: vi.fn().mockResolvedValue({
      docs: MOCK_HOLONS,
      totalDocs: MOCK_HOLONS.length,
    }),
    ...payloadOverrides,
  }

  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('federationHolonsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with holons and total on a basic request', async () => {
    const req = makeReq()
    const res = await federationHolonsHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.holons).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('includes query echo in the response', async () => {
    const req = makeReq('?type=retailer&region=FL&q=music&limit=10')
    const res = await federationHolonsHandler(req)
    const body = await res.json()
    expect(body.query.type).toBe('retailer')
    expect(body.query.region).toBe('FL')
    expect(body.query.q).toBe('music')
    expect(body.query.limit).toBe(10)
  })

  it('transforms docs into the public-safe shape', async () => {
    const req = makeReq()
    const res = await federationHolonsHandler(req)
    const body = await res.json()
    const holon = body.holons[0]
    expect(holon.id).toBe(1)
    expect(holon.name).toBe('Acme Studio')
    expect(holon.region.state).toBe('FL')
    expect(holon.federation.ministryStatus).toBe('active')
    expect(holon.logo).toBe('https://cdn.example.com/logo.png')
    expect(holon.coverImage).toBeNull()
  })

  it('capabilities are mapped to { skill, description }', async () => {
    const req = makeReq()
    const res = await federationHolonsHandler(req)
    const body = await res.json()
    expect(body.holons[0].capabilities).toEqual([
      { skill: 'graphic-design', description: 'Logos and branding' },
    ])
  })

  it('passes type filter to payload.find where clause', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = makeReq('?type=retailer', { find: findMock })
    await federationHolonsHandler(req)
    const whereArg = findMock.mock.calls[0][0].where
    // Should contain a holonTypes condition
    expect(JSON.stringify(whereArg)).toContain('holonTypes')
    expect(JSON.stringify(whereArg)).toContain('retailer')
  })

  it('passes region filter to payload.find where clause', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = makeReq('?region=FL', { find: findMock })
    await federationHolonsHandler(req)
    const whereArg = findMock.mock.calls[0][0].where
    expect(JSON.stringify(whereArg)).toContain('FL')
  })

  it('passes text search (q) to payload.find where clause', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = makeReq('?q=music', { find: findMock })
    await federationHolonsHandler(req)
    const whereArg = findMock.mock.calls[0][0].where
    expect(JSON.stringify(whereArg)).toContain('music')
  })

  it('clamps limit to max 100', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = makeReq('?limit=9999', { find: findMock })
    await federationHolonsHandler(req)
    expect(findMock.mock.calls[0][0].limit).toBe(100)
  })

  it('uses default limit of 20 when not specified', async () => {
    const findMock = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = makeReq('', { find: findMock })
    await federationHolonsHandler(req)
    expect(findMock.mock.calls[0][0].limit).toBe(20)
  })

  it('fires logFederationAction when x-federation-id header is present', async () => {
    const req = makeReq('', {}, 'fed-remote-123')
    await federationHolonsHandler(req)
    expect(mockLogFederationAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'catalog_browse',
        sourceFederationId: 'fed-remote-123',
      }),
    )
  })

  it('does NOT fire logFederationAction when no x-federation-id header', async () => {
    const req = makeReq()
    await federationHolonsHandler(req)
    expect(mockLogFederationAction).not.toHaveBeenCalled()
  })

  it('returns 500 with safe error message when payload.find throws', async () => {
    const req = makeReq('', {
      find: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    })
    const res = await federationHolonsHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/temporarily unavailable/i)
    expect(body.holons).toEqual([])
    expect(body.total).toBe(0)
  })

  it('handles docs with missing optional fields gracefully (fallback defaults)', async () => {
    const sparseDoc = { id: 99 } // everything else undefined
    const req = makeReq('', {
      find: vi.fn().mockResolvedValue({ docs: [sparseDoc], totalDocs: 1 }),
    })
    const res = await federationHolonsHandler(req)
    const body = await res.json()
    const holon = body.holons[0]
    expect(holon.name).toBe('Unnamed Enterprise')
    expect(holon.holonTypes).toEqual([])
    expect(holon.capabilities).toEqual([])
    expect(holon.region.country).toBe('US')
    expect(holon.federation.ministryStatus).toBe('applicant')
    expect(holon.logo).toBeNull()
  })
})
