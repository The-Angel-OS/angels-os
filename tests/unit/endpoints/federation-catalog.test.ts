/**
 * Federation Catalog Endpoint — Unit Tests
 *
 * GET /api/federation/catalog
 * Public endpoint — no auth required.
 * Returns published products visible to federation peers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSearchCatalog = vi.hoisted(() => vi.fn())
const mockRankCatalogEntries = vi.hoisted(() => vi.fn())
const mockLogFederationAction = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/utilities/federationEngine', () => ({
  searchCatalog: mockSearchCatalog,
  rankCatalogEntries: mockRankCatalogEntries,
}))
vi.mock('@/federation/auditLog', () => ({ logFederationAction: mockLogFederationAction }))

import { federationCatalogHandler } from '@/endpoints/federation-catalog'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_TENANT = {
  id: 1,
  name: 'Angel OS Clearwater',
  domain: 'clearwater.spacesangels.com',
  setup: { federationId: 'fed-clearwater-001' },
}

const DEFAULT_PRODUCT = {
  id: 10,
  title: 'Custom T-Shirt',
  description: 'Screen-printed tee',
  price: 2500,
  averageRating: 4.5,
  type: 'physical',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  url: string = 'http://localhost/api/federation/catalog',
  headers: Record<string, string> = {},
  payloadOverrides: Record<string, unknown> = {},
) {
  const findMock = vi.fn().mockImplementation(({ collection }: any) => {
    if (collection === 'tenants')
      return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
    if (collection === 'products')
      return Promise.resolve({ docs: [DEFAULT_PRODUCT], totalDocs: 1 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })

  const payload = { find: findMock, ...payloadOverrides }
  const nativeReq = new Request(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationCatalogHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchCatalog.mockImplementation((entries: any) => entries)
    mockRankCatalogEntries.mockImplementation((entries: any) => entries)
    mockLogFederationAction.mockResolvedValue(undefined)
  })

  it('returns 200 with entries array and total', async () => {
    const req = makeReq()
    const res = await federationCatalogHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.entries)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  it('includes federation metadata in response', async () => {
    const req = makeReq()
    const res = await federationCatalogHandler(req)
    const body = await res.json()
    expect(body.federationId).toBe('fed-clearwater-001')
    expect(body.enterprise).toBe('Angel OS Clearwater')
  })

  it('calls searchCatalog and rankCatalogEntries in the pipeline', async () => {
    const req = makeReq()
    await federationCatalogHandler(req)
    expect(mockSearchCatalog).toHaveBeenCalledOnce()
    expect(mockRankCatalogEntries).toHaveBeenCalledOnce()
  })

  it('calls logFederationAction when x-federation-id header is present', async () => {
    const req = makeReq(
      'http://localhost/api/federation/catalog',
      { 'X-Federation-Id': 'peer-fed-id' },
    )
    await federationCatalogHandler(req)
    expect(mockLogFederationAction).toHaveBeenCalledOnce()
    expect(mockLogFederationAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'catalog_browse', direction: 'inbound' }),
    )
  })

  it('does not call logFederationAction when no federation header present', async () => {
    const req = makeReq()
    await federationCatalogHandler(req)
    expect(mockLogFederationAction).not.toHaveBeenCalled()
  })

  it('forwards query params as searchCatalog filters', async () => {
    const req = makeReq(
      'http://localhost/api/federation/catalog?capability=bookings&maxPrice=5000&minRating=4',
    )
    await federationCatalogHandler(req)
    expect(mockSearchCatalog).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        capability: 'bookings',
        maxPrice: 5000,
        minRating: 4,
      }),
    )
  })

  it('returns empty entries when no products exist', async () => {
    const req = makeReq('http://localhost/api/federation/catalog', {}, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants')
          return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await federationCatalogHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.entries).toEqual([])
    expect(body.total).toBe(0)
  })

  it('includes query params summary in response', async () => {
    const req = makeReq(
      'http://localhost/api/federation/catalog?capability=bookings&limit=5',
    )
    const res = await federationCatalogHandler(req)
    const body = await res.json()
    expect(body.query).toMatchObject({ capability: 'bookings', limit: 5 })
  })

  it('returns 500 when payload.find throws', async () => {
    const req = makeReq('http://localhost/api/federation/catalog', {}, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await federationCatalogHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/catalog temporarily unavailable/i)
  })
})
