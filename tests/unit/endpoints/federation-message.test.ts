/**
 * Federation Message Endpoint — Unit Tests
 *
 * Tests the POST /api/federation/message handler for JWT verification,
 * trust enforcement, deduplication, and LEO routing.
 *
 * @vitest-environment node
 * @see src/endpoints/federation-message.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import crypto from 'crypto'

import {
  importPrivateKey,
  createFederatedMessageJWT,
} from '@/utilities/federatedAIBus'
import { federationMessageHandler } from '@/endpoints/federation-message'

// ── Test Key Pairs ───────────────────────────────────────────────────────────

let senderKeyHex: { publicKey: string; privateKey: string }

function generateHexKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })
  return {
    publicKey: (publicKey as Buffer).toString('hex'),
    privateKey: (privateKey as Buffer).toString('hex'),
  }
}

beforeAll(() => {
  senderKeyHex = generateHexKeyPair()
})

// ── Mock LEO ─────────────────────────────────────────────────────────────────

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: vi.fn().mockResolvedValue({
    text: 'Hello from the receiving LEO!',
    conversationId: 'conv-response-123',
  }),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createTestJWT(overrides: {
  message?: string
  senderFederationId?: string
  receiverDomain?: string
  conversationId?: string
} = {}) {
  const privateKey = importPrivateKey(senderKeyHex.privateKey)
  return createFederatedMessageJWT({
    message: overrides.message || 'Hello from Clearwater!',
    senderFederationId: overrides.senderFederationId || 'fed-clearwater-001',
    receiverDomain: overrides.receiverDomain || 'localhost',
    senderName: 'Clearwater Angels',
    senderDomain: 'clearwater.angelos.app',
    conversationId: overrides.conversationId,
    privateKey,
  })
}

function makeRequest(overrides: {
  body?: Record<string, unknown>
  headers?: Record<string, string>
  findResults?: Record<string, any>
  createResult?: any
  findError?: Error
} = {}) {
  const headerMap = new Map(Object.entries(overrides.headers ?? {}))

  const findMock = vi.fn().mockImplementation(({ collection, where }: any) => {
    if (overrides.findError) return Promise.reject(overrides.findError)
    if (overrides.findResults && collection in overrides.findResults) {
      return Promise.resolve(overrides.findResults[collection])
    }
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })

  const createMock = vi.fn().mockResolvedValue(overrides.createResult || { id: 'msg-1' })

  // Mock Request with json() method
  const bodyData = overrides.body ?? {}
  const mockReq = {
    headers: {
      get: (key: string) => headerMap.get(key) ?? null,
    },
    json: () => Promise.resolve(bodyData),
    payload: { find: findMock, create: createMock },
  }

  return mockReq as any
}

/** Standard find results for a successful flow */
function standardFindResults() {
  return {
    tenants: {
      docs: [{ id: 'tenant-1', name: 'Partner', slug: 'default', domain: 'localhost' }],
      totalDocs: 1,
    },
    endeavors: {
      docs: [{
        id: 'endeavor-1',
        name: 'Clearwater Angels',
        federation: {
          federationId: 'fed-clearwater-001',
          ministryStatus: 'active',
          publicKey: senderKeyHex.publicKey,
        },
      }],
      totalDocs: 1,
    },
    messages: { docs: [], totalDocs: 0 }, // no duplicates
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('federationMessageHandler', () => {
  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 400 when body has no jwt field', async () => {
    const req = makeRequest({ body: { publicKey: 'abc' } })
    const res = await federationMessageHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('jwt')
  })

  it('returns 400 when body has no publicKey field', async () => {
    const req = makeRequest({ body: { jwt: 'abc.def.ghi' } })
    const res = await federationMessageHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('publicKey')
  })

  it('returns 400 for invalid JSON body', async () => {
    const mockReq = {
      headers: { get: () => null },
      json: () => Promise.reject(new Error('bad json')),
      payload: { find: vi.fn(), create: vi.fn() },
    } as any

    const res = await federationMessageHandler(mockReq)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Invalid JSON')
  })

  // ── JWT Verification ───────────────────────────────────────────────────

  it('returns 401 for invalid JWT signature', async () => {
    const otherKey = generateHexKeyPair()
    const jwt = await createTestJWT()

    const req = makeRequest({
      body: { jwt, publicKey: otherKey.publicKey }, // wrong key!
      headers: { 'x-tenant-id': 'default' },
      findResults: standardFindResults(),
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('JWT verification failed')
  })

  it('returns 404 when tenant cannot be resolved', async () => {
    const jwt = await createTestJWT()
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'nonexistent' },
      findResults: {
        tenants: { docs: [], totalDocs: 0 },
      },
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(404)
  })

  // ── Trust Enforcement ──────────────────────────────────────────────────

  it('returns 403 for unknown federation peer', async () => {
    const jwt = await createTestJWT()
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Partner', slug: 'default', domain: 'localhost' }],
          totalDocs: 1,
        },
        endeavors: { docs: [], totalDocs: 0 }, // peer not found
        messages: { docs: [], totalDocs: 0 },
      },
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Unknown federation peer')
  })

  it('returns 403 for peer with insufficient trust (applicant)', async () => {
    const jwt = await createTestJWT()
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Partner', slug: 'default', domain: 'localhost' }],
          totalDocs: 1,
        },
        endeavors: {
          docs: [{
            id: 'endeavor-1',
            name: 'Newcomer',
            federation: {
              federationId: 'fed-clearwater-001',
              ministryStatus: 'applicant', // too low
            },
          }],
          totalDocs: 1,
        },
        messages: { docs: [], totalDocs: 0 },
      },
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Insufficient trust level')
    expect(body.actual).toBe('probationary')
  })

  // ── Deduplication ──────────────────────────────────────────────────────

  it('returns duplicate response for already-processed messages', async () => {
    const jwt = await createTestJWT()
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: {
        ...standardFindResults(),
        messages: { docs: [{ id: 'existing-msg' }], totalDocs: 1 }, // already exists
      },
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.duplicate).toBe(true)
  })

  // ── Successful Flow ────────────────────────────────────────────────────

  it('processes a valid federation message end-to-end', async () => {
    const jwt = await createTestJWT({ message: 'Do you have organic mangoes?' })
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: standardFindResults(),
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.response).toBe('Hello from the receiving LEO!')
    expect(body.conversationId).toBe('conv-response-123')
    expect(body.peerName).toBe('Clearwater Angels')
  })

  it('stores the message in the Messages collection', async () => {
    const jwt = await createTestJWT({ message: 'Store me!' })
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: standardFindResults(),
    })

    await federationMessageHandler(req)

    const createMock = req.payload.create
    expect(createMock).toHaveBeenCalledTimes(1)

    const createCall = createMock.mock.calls[0][0]
    expect(createCall.collection).toBe('messages')
    expect(createCall.data.messageType).toBe('federation_message')
    expect(createCall.data.content).toBe('Store me!')
    expect(createCall.data.metadata.senderFederationId).toBe('fed-clearwater-001')
    expect(createCall.data.metadata.senderName).toBe('Clearwater Angels')
    expect(createCall.overrideAccess).toBe(true)
  })

  it('probation peer with vouched status is allowed', async () => {
    const jwt = await createTestJWT()
    const req = makeRequest({
      body: { jwt, publicKey: senderKeyHex.publicKey },
      headers: { 'x-tenant-id': 'default' },
      findResults: {
        tenants: {
          docs: [{ id: 'tenant-1', name: 'Partner', slug: 'default', domain: 'localhost' }],
          totalDocs: 1,
        },
        endeavors: {
          docs: [{
            id: 'endeavor-1',
            name: 'Probation Peer',
            federation: {
              federationId: 'fed-clearwater-001',
              ministryStatus: 'probation', // maps to 'vouched' trust
            },
          }],
          totalDocs: 1,
        },
        messages: { docs: [], totalDocs: 0 },
      },
    })

    const res = await federationMessageHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
