/**
 * Site Export Endpoint Tests
 *
 * Tests pure helper functions and the PayloadHandler for tenant data export.
 *
 * @see src/endpoints/export-site/index.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  computeChecksum,
  EXPORT_COLLECTION_GROUPS,
  getAllExportCollections,
  getCollectionLimit,
  buildManifest,
  exportSite,
  type CollectionExportResult,
} from '@/endpoints/export-site'

// ═══════════════════════════════════════════════════════════════════════════
// 1. computeChecksum
// ═══════════════════════════════════════════════════════════════════════════

describe('computeChecksum', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const hash = computeChecksum({ foo: 'bar' })
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same data → same hash', () => {
    const data = { name: 'Clearwater', id: 42, items: [1, 2, 3] }
    const hash1 = computeChecksum(data)
    const hash2 = computeChecksum(data)
    expect(hash1).toBe(hash2)
  })

  it('different data → different hash', () => {
    const hash1 = computeChecksum({ a: 1 })
    const hash2 = computeChecksum({ a: 2 })
    expect(hash1).not.toBe(hash2)
  })

  it('sorts keys for deterministic output regardless of insertion order', () => {
    const hash1 = computeChecksum({ z: 1, a: 2, m: 3 })
    const hash2 = computeChecksum({ a: 2, m: 3, z: 1 })
    expect(hash1).toBe(hash2)
  })

  it('handles non-object primitives', () => {
    const hashNull = computeChecksum(null)
    const hashStr = computeChecksum('hello')
    const hashNum = computeChecksum(42)
    expect(hashNull).toHaveLength(64)
    expect(hashStr).toHaveLength(64)
    expect(hashNum).toHaveLength(64)
    // All different
    expect(hashNull).not.toBe(hashStr)
    expect(hashStr).not.toBe(hashNum)
  })

  it('empty array and empty object produce different checksums', () => {
    const hashArr = computeChecksum([])
    const hashObj = computeChecksum({})
    expect(hashArr).not.toBe(hashObj)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. EXPORT_COLLECTION_GROUPS + getAllExportCollections
// ═══════════════════════════════════════════════════════════════════════════

describe('EXPORT_COLLECTION_GROUPS', () => {
  it('has 9 domain groups', () => {
    expect(Object.keys(EXPORT_COLLECTION_GROUPS)).toHaveLength(9)
  })

  it('every group is non-empty', () => {
    for (const [group, slugs] of Object.entries(EXPORT_COLLECTION_GROUPS)) {
      expect(slugs.length, `group "${group}" should have at least one collection`).toBeGreaterThan(0)
    }
  })

  it('no duplicate slugs across groups', () => {
    const all = getAllExportCollections()
    const unique = new Set(all)
    expect(unique.size).toBe(all.length)
  })
})

describe('getAllExportCollections', () => {
  it('returns 35 tenant-scoped collections', () => {
    const all = getAllExportCollections()
    expect(all).toHaveLength(35)
  })

  it('includes key collections from every domain', () => {
    const all = getAllExportCollections()
    // Content
    expect(all).toContain('pages')
    expect(all).toContain('posts')
    expect(all).toContain('media')
    // Commerce
    expect(all).toContain('products')
    expect(all).toContain('orders')
    expect(all).toContain('bookings')
    // Community
    expect(all).toContain('spaces')
    expect(all).toContain('channels')
    expect(all).toContain('messages')
    // Events
    expect(all).toContain('events')
    // Organization
    expect(all).toContain('endeavors')
    expect(all).toContain('workflows')
    // Gamification
    expect(all).toContain('quests')
    // Justice
    expect(all).toContain('justice-fund-transactions')
    // Logistics
    expect(all).toContain('shipments')
    // Layout
    expect(all).toContain('header')
    expect(all).toContain('footer')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. getCollectionLimit
// ═══════════════════════════════════════════════════════════════════════════

describe('getCollectionLimit', () => {
  it('returns 50000 for messages', () => {
    expect(getCollectionLimit('messages')).toBe(50000)
  })

  it('returns 10000 for comments', () => {
    expect(getCollectionLimit('comments')).toBe(10000)
  })

  it('returns 5 for header and footer', () => {
    expect(getCollectionLimit('header')).toBe(5)
    expect(getCollectionLimit('footer')).toBe(5)
  })

  it('returns default 10000 for unlisted collections', () => {
    expect(getCollectionLimit('pages')).toBe(10000)
    expect(getCollectionLimit('products')).toBe(10000)
    expect(getCollectionLimit('spaces')).toBe(10000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. buildManifest
// ═══════════════════════════════════════════════════════════════════════════

describe('buildManifest', () => {
  const mockTenant = { id: 'tenant-1', name: 'Clearwater Angels', slug: 'clearwater' }

  function makeCollectionData(
    overrides: Record<string, CollectionExportResult> = {},
  ): Record<string, CollectionExportResult> {
    return {
      pages: { docs: [{ id: '1', title: 'Home' }], totalDocs: 1 },
      posts: { docs: [{ id: '2', title: 'First Post' }, { id: '3', title: 'Second Post' }], totalDocs: 2 },
      products: { docs: [], totalDocs: 0 },
      ...overrides,
    }
  }

  it('counts documents correctly', () => {
    const manifest = buildManifest(mockTenant, makeCollectionData(), 'admin@test.com')
    expect(manifest.counts.pages).toBe(1)
    expect(manifest.counts.posts).toBe(2)
    expect(manifest.counts.products).toBe(0)
    expect(manifest.totalDocuments).toBe(3)
    expect(manifest.totalCollections).toBe(3)
  })

  it('generates per-collection checksums', () => {
    const manifest = buildManifest(mockTenant, makeCollectionData(), 'admin@test.com')
    expect(manifest.checksums.pages).toHaveLength(64)
    expect(manifest.checksums.posts).toHaveLength(64)
    expect(manifest.checksums.products).toHaveLength(64)
    // Different content → different checksums
    expect(manifest.checksums.pages).not.toBe(manifest.checksums.posts)
    // Empty collection has a consistent checksum
    expect(manifest.checksums.products).toBe(computeChecksum([]))
  })

  it('overall checksum changes when data changes', () => {
    const manifest1 = buildManifest(mockTenant, makeCollectionData(), 'admin@test.com')
    const manifest2 = buildManifest(
      mockTenant,
      makeCollectionData({
        pages: { docs: [{ id: '1', title: 'Changed' }], totalDocs: 1 },
      }),
      'admin@test.com',
    )
    expect(manifest1.checksum).not.toBe(manifest2.checksum)
  })

  it('includes version 2.0 and tenant info', () => {
    const manifest = buildManifest(mockTenant, makeCollectionData(), 'admin@test.com')
    expect(manifest.version).toBe('2.0')
    expect(manifest.tenant.id).toBe('tenant-1')
    expect(manifest.tenant.slug).toBe('clearwater')
    expect(manifest.exportedBy).toBe('admin@test.com')
  })

  it('exportedAt is an ISO string', () => {
    const manifest = buildManifest(mockTenant, makeCollectionData(), 'admin@test.com')
    expect(() => new Date(manifest.exportedAt)).not.toThrow()
    expect(manifest.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('handles zero-collection export', () => {
    const manifest = buildManifest(mockTenant, {}, 'admin@test.com')
    expect(manifest.totalDocuments).toBe(0)
    expect(manifest.totalCollections).toBe(0)
    expect(Object.keys(manifest.counts)).toHaveLength(0)
    expect(manifest.checksum).toHaveLength(64)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. exportSite handler
// ═══════════════════════════════════════════════════════════════════════════

describe('exportSite handler', () => {
  /** Build a mock PayloadRequest */
  function makeRequest(
    overrides: {
      user?: any
      headers?: Record<string, string>
      findResults?: Record<string, any>
      findError?: Error
    } = {},
  ) {
    const headerMap = new Map(Object.entries(overrides.headers ?? {}))

    const findMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (overrides.findError) return Promise.reject(overrides.findError)
      if (overrides.findResults && collection in overrides.findResults) {
        return Promise.resolve(overrides.findResults[collection])
      }
      return Promise.resolve({ docs: [], totalDocs: 0 })
    })

    return {
      user: overrides.user ?? null,
      headers: { get: (key: string) => headerMap.get(key) ?? null },
      payload: { find: findMock },
    } as any
  }

  const adminUser = { email: 'admin@clearwater.com', roles: ['admin'] }
  const superAdminUser = { email: 'super@clearwater.com', roles: ['super_admin'] }
  const memberUser = { email: 'member@clearwater.com', roles: ['member'] }
  const tenantFindResult = {
    tenants: {
      docs: [{ id: 'tenant-1', name: 'Clearwater', slug: 'clearwater' }],
      totalDocs: 1,
    },
  }

  // ── Auth tests ──────────────────────────────────────────────────────────

  // ONE gate, TWO acceptable credentials: an admin session OR ?key=CRON_SECRET
  // (Teleport pulls a tenant's graph node-to-node with no interactive session).
  // So a non-admin session isn't "forbidden", it's "you haven't presented an
  // acceptable credential" — every rejection is a 401 naming both options. The
  // earlier two-tier 401/403 contract no longer exists.
  it('returns 401 when no user is present', async () => {
    const req = makeRequest({ user: null })
    const res = await exportSite(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toContain('requires admin role or ?key=CRON_SECRET')
  })

  it('returns 401 when user has no roles array', async () => {
    const req = makeRequest({ user: { email: 'test@test.com' } })
    const res = await exportSite(req)
    expect(res.status).toBe(401)
  })

  it('rejects a signed-in non-admin — a member session is not a credential here', async () => {
    const req = makeRequest({ user: memberUser, findResults: tenantFindResult })
    const res = await exportSite(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toContain('requires admin role')
  })

  // ── Tenant resolution ───────────────────────────────────────────────────

  it('returns 404 when tenant is not found', async () => {
    const req = makeRequest({
      user: adminUser,
      headers: { 'x-tenant-id': 'nonexistent' },
      findResults: { tenants: { docs: [], totalDocs: 0 } },
    })
    const res = await exportSite(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toBe('Tenant not found')
  })

  it('returns 500 when tenant lookup fails', async () => {
    const req = makeRequest({
      user: adminUser,
      findError: new Error('DB connection failed'),
    })
    const res = await exportSite(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toContain('Failed to resolve tenant')
    expect(body.details).toBe('DB connection failed')
  })

  // ── Successful export ─────────────────────────────────────────────────

  it('returns successful export with manifest and data', async () => {
    const req = makeRequest({
      user: superAdminUser,
      headers: { 'x-tenant-id': 'clearwater' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Clearwater', slug: 'clearwater' }],
          totalDocs: 1,
        },
        pages: {
          docs: [{ id: 'p1', title: 'Home' }],
          totalDocs: 1,
        },
        posts: {
          docs: [{ id: 'b1', title: 'Hello World' }],
          totalDocs: 1,
        },
      },
    })

    const res = await exportSite(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.manifest).toBeDefined()
    expect(body.manifest.version).toBe('2.0')
    expect(body.manifest.tenant.slug).toBe('clearwater')
    expect(body.manifest.exportedBy).toBe('super@clearwater.com')
    expect(body.manifest.checksum).toHaveLength(64)
    expect(body.manifest.totalCollections).toBe(35)

    // Per-collection checksums
    expect(body.manifest.checksums.pages).toHaveLength(64)
    expect(body.manifest.counts.pages).toBe(1)
    expect(body.manifest.counts.posts).toBe(1)

    // Data
    expect(body.data.pages).toHaveLength(1)
    expect(body.data.posts).toHaveLength(1)
    expect(body.data.pages[0].title).toBe('Home')

    // Message includes counts
    expect(body.message).toContain('2 documents')
    expect(body.message).toContain('35 collections')
  })

  it('uses overrideAccess: true for all collection fetches', async () => {
    const req = makeRequest({
      user: adminUser,
      headers: { 'x-tenant-id': 'clearwater' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Clearwater', slug: 'clearwater' }],
          totalDocs: 1,
        },
      },
    })

    await exportSite(req)

    const findMock = req.payload.find
    // First call is tenant lookup, rest are collection exports
    const collectionCalls = findMock.mock.calls.slice(1)
    for (const [args] of collectionCalls) {
      expect(args.overrideAccess).toBe(true)
    }
  })

  it('defaults to "default" tenant slug when header is absent', async () => {
    const req = makeRequest({
      user: adminUser,
      findResults: {
        tenants: { docs: [], totalDocs: 0 },
      },
    })

    await exportSite(req)

    const findMock = req.payload.find
    const tenantCall = findMock.mock.calls[0][0]
    expect(tenantCall.collection).toBe('tenants')
    expect(tenantCall.where.slug.equals).toBe('default')
  })

  // ── Resilience ──────────────────────────────────────────────────────────

  it('handles individual collection failures gracefully', async () => {
    let callCount = 0
    const findMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'tenants') {
        return Promise.resolve({
          docs: [{ id: 'tenant-1', name: 'Clearwater', slug: 'clearwater' }],
          totalDocs: 1,
        })
      }
      callCount++
      // Fail every 5th collection
      if (callCount % 5 === 0) {
        return Promise.reject(new Error(`Collection ${collection} unavailable`))
      }
      return Promise.resolve({ docs: [{ id: `doc-${callCount}` }], totalDocs: 1 })
    })

    const req = {
      user: adminUser,
      headers: { get: (key: string) => (key === 'x-tenant-id' ? 'clearwater' : null) },
      payload: { find: findMock },
    } as any

    const res = await exportSite(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    // Failed collections should still appear with empty docs
    expect(body.manifest.totalCollections).toBe(35)
  })

  it('tenant_admin role is authorized', async () => {
    const req = makeRequest({
      user: { email: 'ta@test.com', roles: ['tenant_admin'] },
      headers: { 'x-tenant-id': 'clearwater' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Clearwater', slug: 'clearwater' }],
          totalDocs: 1,
        },
      },
    })

    const res = await exportSite(req)
    expect(res.status).toBe(200)
  })
})
