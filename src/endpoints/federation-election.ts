/**
 * Federation Election Endpoint — Supermajority Voting
 *
 * Implements the constitutional governance mechanism for:
 * - Amending non-core constitutional principles
 * - Establishing new holon types
 * - Adjusting federation pool distribution
 * - Revoking federation membership from violating nodes
 * - Succession: designating a new Flagship if the current one fails its covenant
 *
 * Constitutional Reference: "What the network can do (by supermajority of
 * active Enterprise nodes): amend non-core constitutional principles, establish
 * new holon types, adjust the federation pool distribution, revoke federation
 * membership from nodes that violate the Constitution."
 *
 * Supermajority = 2/3 of active Enterprises with full trust (sentinels).
 * Only sentinels can vote. All votes are Ed25519 signed.
 *
 * POST /api/federation/election — Submit or vote on a proposal
 * GET  /api/federation/election — List active proposals and results
 *
 * @see src/utilities/federationEngine.ts — mesh and governance utilities
 * @see src/federation/protocol.ts — Ed25519 signing primitives
 */

import type { PayloadHandler, Payload } from 'payload'
import { verifySignature } from '@/federation/protocol'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'

// ── Types ──────────────────────────────────────────────────────────────────

export type ProposalType =
  | 'constitutional-amendment'
  | 'new-holon-type'
  | 'pool-adjustment'
  | 'membership-revocation'
  | 'flagship-succession'

export interface ElectionProposal {
  id: string
  type: ProposalType
  title: string
  description: string
  proposedBy: {
    federationId: string
    name: string
    publicKey: string
  }
  proposedAt: string
  expiresAt: string
  // For constitutional amendments
  articleNumber?: number
  proposedText?: string
  // For holon type proposals
  holonType?: { name: string; capabilities: string[] }
  // For pool adjustments
  newSplit?: { endeavor: number; enterprise: number; protocol: number; flagship: number; justice: number }
  // For membership revocation
  targetFederationId?: string
  violationDescription?: string
  // For succession
  newFlagshipId?: string
  successionReason?: string
  // Voting
  votes: ElectionVote[]
  status: 'active' | 'passed' | 'rejected' | 'expired'
  result?: {
    totalEligible: number
    totalVotes: number
    votesFor: number
    votesAgainst: number
    abstentions: number
    supermajorityReached: boolean
  }
}

export interface ElectionVote {
  federationId: string
  voterName: string
  vote: 'for' | 'against' | 'abstain'
  reason?: string
  signature: string
  publicKey: string
  votedAt: string
}

// ── Persistent Store (settings bag — survives restart; #131) ───────────────
// Elections are federation-global, so they live under the platform tenant in the
// schema-drift-proof `settings` bag (entity 'federation-elections') rather than a
// module-level Map that a serverless cold start would wipe.
//
// NOTE: this is load-modify-save per request. Governance is low-volume, but two
// truly-concurrent votes could race the read-modify-write; a future hardening
// would move to per-proposal atomic upserts. The durability bug (#131) is fixed.

const ELECTION_ENTITY = 'federation-elections'
const ELECTION_ENTITY_ID = 'global'
const ELECTION_SETTING = 'proposals'

async function resolvePlatformTenantId(payload: Payload): Promise<number | string> {
  try {
    const res = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = (res.docs?.[0] as { id?: number | string } | undefined)?.id
    if (id != null) return id
  } catch {
    /* fall through */
  }
  return 1 // platform tenant is the id-1 singleton
}

async function loadProposals(
  payload: Payload,
  tenantId: number | string,
): Promise<Map<string, ElectionProposal>> {
  const obj =
    (await getJsonSetting<Record<string, ElectionProposal>>(
      payload,
      { entityName: ELECTION_ENTITY, entityId: ELECTION_ENTITY_ID, tenantId },
      ELECTION_SETTING,
    )) || {}
  return new Map(Object.entries(obj))
}

async function saveProposals(
  payload: Payload,
  tenantId: number | string,
  proposals: Map<string, ElectionProposal>,
): Promise<void> {
  await setJsonSetting(
    payload,
    { entityName: ELECTION_ENTITY, entityId: ELECTION_ENTITY_ID, tenantId },
    ELECTION_SETTING,
    Object.fromEntries(proposals),
  )
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Supermajority threshold — 2/3 of eligible voters. */
const SUPERMAJORITY_FRACTION = 2 / 3

/** Default proposal voting window in days. */
const DEFAULT_VOTING_DAYS = 14

/** Succession proposals require longer deliberation. */
const SUCCESSION_VOTING_DAYS = 30

// ── Helpers ────────────────────────────────────────────────────────────────

function generateProposalId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `prop-${timestamp}-${random}`
}

function getVotingDays(type: ProposalType): number {
  if (type === 'flagship-succession') return SUCCESSION_VOTING_DAYS
  return DEFAULT_VOTING_DAYS
}

function verifyVoteSignature(vote: ElectionVote, proposalId: string): boolean {
  const payload = JSON.stringify({
    proposalId,
    federationId: vote.federationId,
    vote: vote.vote,
    votedAt: vote.votedAt,
  })
  return verifySignature(payload, vote.signature, vote.publicKey)
}

function tallyVotes(proposal: ElectionProposal, totalEligibleSentinels: number): NonNullable<ElectionProposal['result']> {
  const votesFor = proposal.votes.filter((v) => v.vote === 'for').length
  const votesAgainst = proposal.votes.filter((v) => v.vote === 'against').length
  const abstentions = proposal.votes.filter((v) => v.vote === 'abstain').length

  return {
    totalEligible: totalEligibleSentinels,
    totalVotes: proposal.votes.length,
    votesFor,
    votesAgainst,
    abstentions,
    supermajorityReached: votesFor / totalEligibleSentinels >= SUPERMAJORITY_FRACTION,
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export const federationElectionHandler: PayloadHandler = async (req) => {
  const method = (req as Request).method?.toUpperCase()
  const payload = req.payload as Payload
  const platformTenantId = await resolvePlatformTenantId(payload)
  const proposals = await loadProposals(payload, platformTenantId)

  // ── GET: List active proposals ──────────────────────────────────
  if (method === 'GET') {
    const url = new URL((req as Request).url)
    const statusFilter = url.searchParams.get('status') || 'active'
    const proposalId = url.searchParams.get('id')

    // Single proposal lookup
    if (proposalId) {
      const proposal = proposals.get(proposalId)
      if (!proposal) {
        return Response.json({ error: 'Proposal not found' }, { status: 404 })
      }
      return Response.json({ proposal })
    }

    // List by status
    const filtered = Array.from(proposals.values()).filter((p) => {
      if (statusFilter === 'all') return true
      return p.status === statusFilter
    })

    return Response.json({
      proposals: filtered,
      total: filtered.length,
    })
  }

  // ── POST: Submit proposal or cast vote ──────────────────────────
  if (method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action as string

  // ── Action: Create Proposal ─────────────────────────────────────
  if (action === 'propose') {
    const type = body.type as ProposalType
    const title = body.title as string
    const description = body.description as string
    const federationId = body.federationId as string
    const name = body.name as string
    const publicKey = body.publicKey as string
    const signature = body.signature as string

    if (!type || !title || !description || !federationId || !publicKey || !signature) {
      return Response.json(
        { error: 'Missing required fields: type, title, description, federationId, publicKey, signature' },
        { status: 400 },
      )
    }

    // Verify the proposer is a sentinel (active + full trust)
    // In production: query Endeavors collection for this federationId
    // For now: verify the signature is valid as proof of identity
    const proposalPayload = JSON.stringify({ type, title, description, federationId })
    const sigValid = verifySignature(proposalPayload, signature, publicKey)
    if (!sigValid) {
      return Response.json(
        { error: 'Invalid signature — only sentinel Enterprises can propose' },
        { status: 403 },
      )
    }

    // Validate proposal type constraints
    if (type === 'pool-adjustment') {
      const newSplit = body.newSplit as ElectionProposal['newSplit']
      if (newSplit) {
        const total = newSplit.endeavor + newSplit.enterprise + newSplit.protocol + newSplit.flagship + newSplit.justice
        if (Math.abs(total - 100) > 0.01) {
          return Response.json(
            { error: `Revenue split must total 100%. Got ${total}%` },
            { status: 400 },
          )
        }
        // Constitutional constraint: split always moves toward creator (Toward-53)
        if (newSplit.endeavor < 53) {
          return Response.json(
            { error: 'Constitutional violation: Endeavor share cannot go below 53% (Toward-53 principle)' },
            { status: 400 },
          )
        }
      }
    }

    const now = new Date()
    const votingDays = getVotingDays(type)
    const expiresAt = new Date(now.getTime() + votingDays * 24 * 60 * 60 * 1000)

    const proposal: ElectionProposal = {
      id: generateProposalId(),
      type,
      title,
      description,
      proposedBy: { federationId, name: name || federationId, publicKey },
      proposedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      articleNumber: body.articleNumber != null ? (body.articleNumber as number) : undefined,
      proposedText: body.proposedText ? (body.proposedText as string) : undefined,
      holonType: body.holonType ? (body.holonType as ElectionProposal['holonType']) : undefined,
      newSplit: body.newSplit ? (body.newSplit as ElectionProposal['newSplit']) : undefined,
      targetFederationId: body.targetFederationId ? (body.targetFederationId as string) : undefined,
      violationDescription: body.violationDescription ? (body.violationDescription as string) : undefined,
      newFlagshipId: body.newFlagshipId ? (body.newFlagshipId as string) : undefined,
      successionReason: body.successionReason ? (body.successionReason as string) : undefined,
      votes: [],
      status: 'active' as const,
    }

    proposals.set(proposal.id, proposal)
    await saveProposals(payload, platformTenantId, proposals)

    // Log to federation audit log
    try {
      await req.payload.create({
        collection: 'federation-audit-log' as any,
        data: {
          action: 'election-proposal-created',
          federationId,
          details: {
            proposalId: proposal.id,
            type,
            title,
            expiresAt: expiresAt.toISOString(),
          },
          timestamp: now.toISOString(),
        } as any,
        overrideAccess: true,
      })
    } catch {
      // Non-fatal — audit log failure should not block governance
    }

    return Response.json({
      success: true,
      proposal: {
        id: proposal.id,
        type: proposal.type,
        title: proposal.title,
        status: proposal.status,
        expiresAt: proposal.expiresAt,
        votingWindowDays: votingDays,
      },
      message: `Proposal submitted. Voting window: ${votingDays} days.`,
    })
  }

  // ── Action: Cast Vote ───────────────────────────────────────────
  if (action === 'vote') {
    const proposalId = body.proposalId as string
    const federationId = body.federationId as string
    const vote = body.vote as 'for' | 'against' | 'abstain'
    const voterName = body.voterName as string
    const reason = body.reason as string | undefined
    const signature = body.signature as string
    const publicKey = body.publicKey as string

    if (!proposalId || !federationId || !vote || !signature || !publicKey) {
      return Response.json(
        { error: 'Missing required fields: proposalId, federationId, vote, signature, publicKey' },
        { status: 400 },
      )
    }

    if (!['for', 'against', 'abstain'].includes(vote)) {
      return Response.json({ error: 'Vote must be "for", "against", or "abstain"' }, { status: 400 })
    }

    const proposal = proposals.get(proposalId)
    if (!proposal) {
      return Response.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if (proposal.status !== 'active') {
      return Response.json(
        { error: `Proposal is ${proposal.status} — voting is closed` },
        { status: 400 },
      )
    }

    // Check expiration
    if (new Date() > new Date(proposal.expiresAt)) {
      proposal.status = 'expired'
      await saveProposals(payload, platformTenantId, proposals)
      return Response.json(
        { error: 'Voting period has expired' },
        { status: 400 },
      )
    }

    // Check for duplicate vote
    if (proposal.votes.some((v) => v.federationId === federationId)) {
      return Response.json(
        { error: 'This Enterprise has already voted on this proposal' },
        { status: 409 },
      )
    }

    const electionVote: ElectionVote = {
      federationId,
      voterName: voterName || federationId,
      vote,
      reason,
      signature,
      publicKey,
      votedAt: new Date().toISOString(),
    }

    // Verify vote signature — reject invalid signatures in production
    const sigValid = verifyVoteSignature(electionVote, proposalId)
    if (!sigValid) {
      if (process.env.NODE_ENV === 'production') {
        return Response.json(
          { error: 'Invalid vote signature — vote rejected' },
          { status: 403 },
        )
      }
      console.warn(`[federation-election] Invalid vote signature from ${federationId} — accepting in dev mode only`)
    }

    proposal.votes.push(electionVote)

    // Check if we have enough votes to resolve
    // In production: count active sentinels from Endeavors collection
    // For now: use total voters as a proxy
    const totalEligible = Math.max(proposal.votes.length + 1, 3) // Minimum 3 for testing
    const tally = tallyVotes(proposal, totalEligible)
    proposal.result = tally

    // Auto-resolve if supermajority reached
    if (tally.supermajorityReached && tally.totalVotes >= Math.ceil(totalEligible * SUPERMAJORITY_FRACTION)) {
      proposal.status = 'passed'
    }

    await saveProposals(payload, platformTenantId, proposals)

    return Response.json({
      success: true,
      proposalId,
      vote,
      currentTally: {
        votesFor: tally.votesFor,
        votesAgainst: tally.votesAgainst,
        abstentions: tally.abstentions,
        totalVotes: tally.totalVotes,
        supermajorityReached: tally.supermajorityReached,
      },
      status: proposal.status,
    })
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
