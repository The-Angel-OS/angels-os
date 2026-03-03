/**
 * Federation Suitcase Endpoint — Unit Tests
 *
 * POST /api/federation/suitcase/export — Export an Endeavor's full data
 * POST /api/federation/suitcase/import — Import a suitcase into this Enterprise
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockVerifySignature = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock('@/federation/protocol', () => ({
  verifySignature: mockVerifySignature,
}))

import {
  federationSuitcaseExportHandler,
  federationSuitcaseImportHandler,
} from '@/endpoints/federation-suitcase'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_TENANT = { id: 1, name: 'Clearwater', slug: 'clearwater', domain: 'clearwater.test', type: 'enterprise', status: 'active' }

const EMPTY_FIND = { docs: [], totalDocs: 0 }
const TENANT_FIND = { docs: [FAKE_TENANT], totalDocs: 1 }

const VALID_MANIFEST = {
  version: '1.0',
  angelOS: '1.1',
  exportedAt: '2025-01-15T00:00:00Z',
  sourceMinistry: 'fed-1',
  tenant: { name: 'Clearwater', slug: 'clearwater', domain: 'clearwater.test', type: 'enterprise', status: 'active' },
  contents: { spaces: 0, channels: 0, messages: 0, users: 0, posts: 0, products: 0, media: 0, bookings: 0, orders: 0 },
  constitutional: { isAngel: true, antiDemonic: true, revenueModel: 'toward-53' },
  checksum: 'abc123',
}

const VALID_DATA = { spaces: [], channels: [], messages: [], posts: [], products: [], media: [], bookings: [], orders: [], users: [], endeavor: null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants') return Promise.resolve(TENANT_FIND)
      return Promise.resolve(EMPTY_FIND)
    }),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    ...overrides,
  }
}

function makeExportReq(
  body: Record<string, unknown> | null = { tenantSlug: 'clearwater' },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/suitcase/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

function makeImportReq(
  user: Record<string, unknown> | null = { id: 1, roles: ['admin'] },
  body: Record<string, unknown> | null = { targetTenantSlug: 'clearwater', manifest: VALID_MANIFEST, data: VALID_DATA },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/suitcase/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Export Handler Tests ───────────────────────────────────────────────────────

describe('federationSuitcaseExportHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = makeExportReq(null)
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when tenantSlug is missing', async () => {
    const req = makeExportReq({ otherField: 'value' })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/tenantSlug/i)
  })

  it('returns 404 when tenant is not found', async () => {
    const req = makeExportReq({ tenantSlug: 'missing' }, {
      find: vi.fn().mockResolvedValue(EMPTY_FIND),
    })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 403 when signature is invalid', async () => {
    mockVerifySignature.mockReturnValue(false)
    const req = makeExportReq({ tenantSlug: 'clearwater', signature: 'bad-sig', publicKey: 'pub-key' })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/invalid operator signature/i)
  })

  it('skips signature check when no signature is provided', async () => {
    const req = makeExportReq({ tenantSlug: 'clearwater' })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(200)
    expect(mockVerifySignature).not.toHaveBeenCalled()
  })

  it('returns 200 with manifest and data on success', async () => {
    const req = makeExportReq({ tenantSlug: 'clearwater' })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.manifest).toBeDefined()
    expect(body.manifest.constitutional.isAngel).toBe(true)
    expect(body.manifest.constitutional.antiDemonic).toBe(true)
    expect(body.manifest.checksum).toBeTruthy()
    expect(body.data).toBeDefined()
  })

  it('proceeds when signature is valid', async () => {
    mockVerifySignature.mockReturnValue(true)
    const req = makeExportReq({ tenantSlug: 'clearwater', signature: 'valid-sig', publicKey: 'pub-key' })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(200)
    expect(mockVerifySignature).toHaveBeenCalledOnce()
  })

  it('resolves tenantSlug from x-tenant-id header when body field absent', async () => {
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/suitcase/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'clearwater' },
      body: JSON.stringify({}),
    })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 500 when an unexpected error occurs', async () => {
    const req = makeExportReq({ tenantSlug: 'clearwater' }, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve(TENANT_FIND)
        return Promise.reject(new Error('DB exploded'))
      }),
    })
    const res = await federationSuitcaseExportHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/export failed/i)
  })
})

// ── Import Handler Tests ───────────────────────────────────────────────────────

describe('federationSuitcaseImportHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const req = makeImportReq(null)
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 403 when user lacks admin role', async () => {
    const req = makeImportReq({ id: 1, roles: ['member'] })
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/admin role required/i)
  })

  it('allows super_admin role', async () => {
    const req = makeImportReq({ id: 1, roles: ['super_admin'] })
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid JSON', async () => {
    const req = makeImportReq({ id: 1, roles: ['admin'] }, null)
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = makeImportReq({ id: 1, roles: ['admin'] }, { targetTenantSlug: 'clearwater' })
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing required fields/i)
  })

  it('returns 400 when manifest is not Angel OS compliant (isAngel=false)', async () => {
    const badManifest = { ...VALID_MANIFEST, constitutional: { isAngel: false, antiDemonic: true } }
    const req = makeImportReq(
      { id: 1, roles: ['admin'] },
      { targetTenantSlug: 'clearwater', manifest: badManifest, data: VALID_DATA },
    )
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/constitutional check failed/i)
  })

  it('returns 400 when manifest is not Angel OS compliant (antiDemonic=false)', async () => {
    const badManifest = { ...VALID_MANIFEST, constitutional: { isAngel: true, antiDemonic: false } }
    const req = makeImportReq(
      { id: 1, roles: ['admin'] },
      { targetTenantSlug: 'clearwater', manifest: badManifest, data: VALID_DATA },
    )
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/constitutional check failed/i)
  })

  it('returns 404 when target tenant is not found', async () => {
    const req = makeImportReq(
      { id: 1, roles: ['admin'] },
      { targetTenantSlug: 'missing', manifest: VALID_MANIFEST, data: VALID_DATA },
      { find: vi.fn().mockResolvedValue(EMPTY_FIND) },
    )
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/target tenant not found/i)
  })

  it('returns 200 with imported counts on success', async () => {
    const req = makeImportReq()
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.imported).toBeDefined()
    expect(body.message).toMatch(/clearwater/i)
  })

  it('imports spaces and posts from data', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 99 })
    const data = {
      ...VALID_DATA,
      spaces: [{ id: 10, name: 'Main Space', tenant: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01' }],
      posts: [{ id: 20, title: 'Post 1', tenant: 1, createdAt: '2025-01-01', updatedAt: '2025-01-01' }],
    }
    const req = makeImportReq(
      { id: 1, roles: ['admin'] },
      { targetTenantSlug: 'clearwater', manifest: VALID_MANIFEST, data },
      { create: createMock },
    )
    const res = await federationSuitcaseImportHandler(req)
    expect(res.status).toBe(200)
    // create called for space + post + audit log
    expect(createMock).toHaveBeenCalled()
  })
})
