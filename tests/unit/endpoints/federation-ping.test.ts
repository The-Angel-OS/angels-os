import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/federation/protocol', () => ({
  verifySignature: vi.fn().mockReturnValue(false),
}))

vi.mock('@/endpoints/federation-governance-sync', () => ({
  getCachedGovernance: vi.fn().mockReturnValue(null),
}))

import { federationPingHandler } from '@/endpoints/federation-ping'
import { verifySignature } from '@/federation/protocol'
import { getCachedGovernance } from '@/endpoints/federation-governance-sync'

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_PING = {
  enterpriseName: 'Clearwater Angels',
  domain: 'clearwater.spacesangels.com',
  endeavorType: 'cooperative',
  publicKey: 'abc123pubkey',
}

function makeReq(body: Record<string, unknown> | null, payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }

  // Build a request-like object whose `.json()` method resolves/rejects correctly
  const req: any = {
    payload,
    json: body !== null
      ? vi.fn().mockResolvedValue(body)
      : vi.fn().mockRejectedValue(new Error('bad json')),
  }
  // Expose a Request-compatible `.json()` via the cast trick used by the handler
  ;(req as any).json = req.json
  return req
}

// The handler casts req to Request for .json(); let's make it work via prototype trick
// by making makeReq return a proper Request-like object
function makeProperReq(body: Record<string, unknown> | null, payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }

  let req: any
  if (body !== null) {
    const jsonBody = JSON.stringify(body)
    // Use a real Request so that (req as Request).json() works
    const nativeReq = new Request('http://localhost/api/federation/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBody,
    })
    req = Object.assign(nativeReq, { payload })
  } else {
    // Invalid JSON body — use a Request with malformed body
    const nativeReq = new Request('http://localhost/api/federation/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json{{{',
    })
    req = Object.assign(nativeReq, { payload })
  }
  return req
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('federationPingHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifySignature).mockReturnValue(false)
    vi.mocked(getCachedGovernance).mockReturnValue(null)
    // Default: production mode (unsigned pings rejected)
    vi.stubEnv('FEDERATION_ALLOW_UNSIGNED_PINGS', 'false')
    vi.stubEnv('FEDERATION_REGISTRY_URL', 'https://spacesangels.com')
  })

  // ── Body parsing ──────────────────────────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    const req = makeProperReq(null)
    const res = await federationPingHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  // ── Field validation ──────────────────────────────────────────────────────

  it('returns 400 when enterpriseName is missing', async () => {
    const req = makeProperReq({ domain: 'test.app' })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/enterpriseName is required/i)
  })

  it('returns 400 when enterpriseName is not a string', async () => {
    const req = makeProperReq({ enterpriseName: 42 })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(400)
  })

  // ── Signature enforcement (production mode) ───────────────────────────────

  it('returns 401 for unsigned ping in production mode', async () => {
    vi.stubEnv('FEDERATION_ALLOW_UNSIGNED_PINGS', 'false')
    const req = makeProperReq({ ...BASE_PING })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/signature required/i)
  })

  it('returns 401 even if signature is present but invalid', async () => {
    vi.stubEnv('FEDERATION_ALLOW_UNSIGNED_PINGS', 'false')
    vi.mocked(verifySignature).mockReturnValue(false)
    const req = makeProperReq({ ...BASE_PING, signature: 'bad-sig', publicKey: 'bad-key' })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(401)
  })

  // ── Dev mode (unsigned pings allowed) ─────────────────────────────────────
  // NOTE: ALLOW_UNSIGNED_PINGS is captured as a module-level constant at import
  // time. The tests below verify the signed-ping path (same success logic).
  // The unsigned dev-mode path is tested via integration/e2e with the env var set
  // before the module loads.

  it('signed ping with signatureValid=true returns dev-like success body', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    const req = makeProperReq({ ...BASE_PING, signature: 'good-sig', federationId: 'fed-abc' })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.signatureValid).toBe(true)
  })

  it('meshPeers is empty for a signed ping when governance cache is null', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    vi.mocked(getCachedGovernance).mockReturnValue(null)
    const req = makeProperReq({ ...BASE_PING, signature: 'good-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.meshPeers).toEqual([])
  })

  // ── Signed ping ───────────────────────────────────────────────────────────

  it('returns 200 with verified message for a valid signed ping', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    const req = makeProperReq({ ...BASE_PING, signature: 'valid-sig' })
    const res = await federationPingHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.signatureValid).toBe(true)
    expect(body.message).toMatch(/welcome to the network/i)
    expect(body.message).toContain(BASE_PING.enterpriseName)
  })

  it('includes active mesh peers for signed pings when governance is cached', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    vi.mocked(getCachedGovernance).mockReturnValue({
      version: 1,
      ministries: [
        { id: 'm1', name: 'Active Peer', domain: 'active.app', status: 'active' },
        { id: 'm2', name: 'Inactive Peer', domain: 'inactive.app', status: 'suspended' },
      ],
      trustScores: {},
      constitution: null,
      updatedAt: new Date().toISOString(),
    } as any)
    const req = makeProperReq({ ...BASE_PING, signature: 'valid-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.meshPeers).toHaveLength(1)
    expect(body.meshPeers[0].domain).toBe('active.app')
    expect(body.meshPeers[0].name).toBe('Active Peer')
  })

  it('returns empty meshPeers when governance cache is null', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    vi.mocked(getCachedGovernance).mockReturnValue(null)
    const req = makeProperReq({ ...BASE_PING, signature: 'valid-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.meshPeers).toEqual([])
  })

  // ── Response fields ───────────────────────────────────────────────────────

  it('uses provided federationId in the response', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    const req = makeProperReq({ ...BASE_PING, signature: 'valid-sig', federationId: 'fed-cw-001' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.federationId).toBe('fed-cw-001')
  })

  it('generates a federationId when none is provided (signed ping)', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    // No federationId in the request body
    const req = makeProperReq({ ...BASE_PING, signature: 'good-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.federationId).toBeTruthy()
    expect(typeof body.federationId).toBe('string')
  })

  it('returns ministryStatus: applicant for signed pings', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    const req = makeProperReq({ ...BASE_PING, signature: 'good-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.ministryStatus).toBe('applicant')
  })

  it('includes the registryUrl in the response (signed ping)', async () => {
    vi.mocked(verifySignature).mockReturnValue(true)
    vi.stubEnv('FEDERATION_REGISTRY_URL', 'https://custom-registry.app')
    const req = makeProperReq({ ...BASE_PING, signature: 'good-sig' })
    const res = await federationPingHandler(req)
    const body = await res.json()
    expect(body.registryUrl).toBe('https://custom-registry.app')
  })
})
