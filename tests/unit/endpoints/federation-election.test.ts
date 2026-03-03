/**
 * Federation Election Endpoint — Unit Tests
 *
 * GET  /api/federation/election — List proposals, lookup single
 * POST /api/federation/election — Submit proposal (propose) or cast vote (vote)
 *
 * Uses in-memory Map for proposals — state persists within a test run.
 * Describe blocks use beforeAll to set up proposals that later tests vote on.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockVerifySignature = vi.hoisted(() => vi.fn().mockReturnValue(true))

vi.mock('@/federation/protocol', () => ({ verifySignature: mockVerifySignature }))

import { federationElectionHandler } from '@/endpoints/federation-election'

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    ...overrides,
  }
}

function makeGetReq(url: string, payloadOverrides: Record<string, unknown> = {}) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request(url, { method: 'GET' })
  return Object.assign(nativeReq, { payload }) as any
}

function makePostReq(body: Record<string, unknown>, payloadOverrides: Record<string, unknown> = {}) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/election', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return Object.assign(nativeReq, { payload }) as any
}

const VALID_PROPOSAL_BODY = {
  action: 'propose',
  type: 'constitutional-amendment',
  title: 'Amend Article III',
  description: 'Expand the definition of a Holon to include digital-only entities.',
  federationId: 'fed-proposer-abc',
  name: 'Proposer Enterprise',
  publicKey: 'pub-key-hex',
  signature: 'sig-hex',
  articleNumber: 3,
  proposedText: 'New text for Article III',
}

// ── Tests: GET endpoint ────────────────────────────────────────────────────────

describe('federationElectionHandler — GET', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)
  })

  it('returns 405 for unsupported HTTP method', async () => {
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/election', { method: 'PUT' })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(405)
  })

  it('returns 404 for unknown proposal ID', async () => {
    const req = makeGetReq('http://localhost/api/federation/election?id=unknown-prop-id-xyz')
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/proposal not found/i)
  })

  it('returns 200 with proposals list and total', async () => {
    const req = makeGetReq('http://localhost/api/federation/election?status=all')
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('proposals')
    expect(body).toHaveProperty('total')
    expect(Array.isArray(body.proposals)).toBe(true)
  })
})

// ── Tests: POST propose ───────────────────────────────────────────────────────

describe('federationElectionHandler — POST propose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)
  })

  it('returns 400 for invalid JSON body', async () => {
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/election', {
      method: 'POST',
      body: 'NOT_VALID_JSON{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for unknown action', async () => {
    const req = makePostReq({ action: 'dance' })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/unknown action/i)
  })

  it('returns 400 when required proposal fields are missing', async () => {
    const req = makePostReq({ action: 'propose', type: 'constitutional-amendment' })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing required fields/i)
  })

  it('returns 403 when proposal signature is invalid', async () => {
    mockVerifySignature.mockReturnValue(false)
    const req = makePostReq(VALID_PROPOSAL_BODY)
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/invalid signature/i)
  })

  it('returns 400 for pool-adjustment violating Toward-53 principle', async () => {
    const req = makePostReq({
      ...VALID_PROPOSAL_BODY,
      type: 'pool-adjustment',
      newSplit: { endeavor: 40, enterprise: 20, protocol: 20, flagship: 10, justice: 10 }, // 40 < 53
    })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/53%/i)
  })

  it('returns 400 for pool-adjustment not summing to 100%', async () => {
    const req = makePostReq({
      ...VALID_PROPOSAL_BODY,
      type: 'pool-adjustment',
      newSplit: { endeavor: 60, enterprise: 20, protocol: 10, flagship: 5, justice: 3 }, // = 98
    })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/total 100%/i)
  })

  it('returns 200 with proposal shape on valid submission', async () => {
    const req = makePostReq(VALID_PROPOSAL_BODY)
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.proposal).toHaveProperty('id')
    expect(body.proposal.type).toBe('constitutional-amendment')
    expect(body.proposal.status).toBe('active')
    expect(body.proposal).toHaveProperty('expiresAt')
    expect(body.proposal.votingWindowDays).toBe(14)
  })

  it('succession proposals have 30-day voting window', async () => {
    const req = makePostReq({
      ...VALID_PROPOSAL_BODY,
      type: 'flagship-succession',
      newFlagshipId: 'fed-new-flagship',
      successionReason: 'Current flagship failed covenant',
    })
    const res = await federationElectionHandler(req)
    const body = await res.json()
    expect(body.proposal.votingWindowDays).toBe(30)
  })
})

// ── Tests: POST vote ──────────────────────────────────────────────────────────

describe('federationElectionHandler — POST vote', () => {
  let proposalId: string

  // Create a fresh proposal before voting tests
  beforeAll(async () => {
    mockVerifySignature.mockReturnValue(true)
    const req = makePostReq(VALID_PROPOSAL_BODY)
    const res = await federationElectionHandler(req)
    const body = await res.json()
    proposalId = body.proposal.id
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)
  })

  it('returns 400 when required vote fields are missing', async () => {
    const req = makePostReq({ action: 'vote', proposalId })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing required fields/i)
  })

  it('returns 400 for invalid vote value', async () => {
    const req = makePostReq({
      action: 'vote',
      proposalId,
      federationId: 'fed-voter-1',
      vote: 'maybe',
      signature: 'sig',
      publicKey: 'pub-key',
    })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/"for", "against", or "abstain"/i)
  })

  it('returns 404 when voting on non-existent proposal', async () => {
    const req = makePostReq({
      action: 'vote',
      proposalId: 'prop-does-not-exist',
      federationId: 'fed-voter',
      vote: 'for',
      signature: 'sig',
      publicKey: 'pub-key',
    })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/proposal not found/i)
  })

  it('returns 200 with tally on valid vote', async () => {
    const req = makePostReq({
      action: 'vote',
      proposalId,
      federationId: 'fed-voter-new-unique-1',
      voterName: 'Voter Enterprise A',
      vote: 'for',
      reason: 'Good proposal',
      signature: 'sig-voter-1',
      publicKey: 'pub-key-voter-1',
    })
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.vote).toBe('for')
    expect(body.currentTally).toHaveProperty('votesFor')
    expect(body.currentTally).toHaveProperty('votesAgainst')
    expect(body.currentTally).toHaveProperty('supermajorityReached')
  })

  it('returns 409 when same federation votes twice', async () => {
    // Vote once (different voter to avoid conflicts with prior test)
    const DUPE_FED_ID = 'fed-duplicate-voter-xyz'
    const firstReq = makePostReq({
      action: 'vote',
      proposalId,
      federationId: DUPE_FED_ID,
      vote: 'against',
      signature: 'sig-1',
      publicKey: 'pub-1',
    })
    await federationElectionHandler(firstReq)

    // Try to vote again
    const secondReq = makePostReq({
      action: 'vote',
      proposalId,
      federationId: DUPE_FED_ID,
      vote: 'for',
      signature: 'sig-2',
      publicKey: 'pub-2',
    })
    const res = await federationElectionHandler(secondReq)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already voted/i)
  })

  it('GET returns the proposal by ID with votes after voting', async () => {
    const req = makeGetReq(`http://localhost/api/federation/election?id=${proposalId}`)
    const res = await federationElectionHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.proposal.id).toBe(proposalId)
    expect(Array.isArray(body.proposal.votes)).toBe(true)
    expect(body.proposal.votes.length).toBeGreaterThan(0)
  })
})
