/**
 * enforceReviewAuthority — Unit Tests
 *
 * Server-side integrity gate on QuestParticipations. Must: reject self-review,
 * require an admin-OF-THE-QUEST'S-TENANT or the quest owner, enforce a valid state
 * machine, block protected-field tampering + direct `paid`, server-stamp the
 * reviewer, and trust req-less internal (overrideAccess) calls.
 */
import { describe, it, expect, vi } from 'vitest'
import { enforceReviewAuthority } from '@/collections/QuestParticipations/hooks/enforceReviewAuthority'

function ctx(opts: {
  data: any
  originalDoc?: any
  operation?: 'create' | 'update'
  user?: any
  questOwnerId?: any
  questTenantId?: any
  isMember?: boolean
}) {
  return {
    data: opts.data,
    originalDoc: opts.originalDoc,
    operation: opts.operation ?? 'update',
    req: {
      user: opts.user ?? null,
      payload: {
        findByID: vi
          .fn()
          .mockResolvedValue({ id: 7, postedBy: opts.questOwnerId ?? null, tenant: opts.questTenantId ?? 1 }),
        find: vi
          .fn()
          .mockResolvedValue(opts.isMember === false ? { totalDocs: 0, docs: [] } : { totalDocs: 1, docs: [{ id: 1 }] }),
      },
    },
  } as any
}

const admin = { id: 100, roles: ['admin'] } // global admin (membership decided per-test)
const superAdmin = { id: 200, roles: ['super_admin'] }
const owner = { id: 50, roles: ['user'] }
const participant = { id: 9, roles: ['user'] }

describe('enforceReviewAuthority', () => {
  it('passes through benign non-review updates', async () => {
    const data = { status: 'in_progress' }
    const out = await enforceReviewAuthority(ctx({ data, originalDoc: { status: 'accepted', participant: 9 }, user: participant }))
    expect(out).toBe(data)
  })

  it('passes through create operations', async () => {
    const data = { status: 'approved', participant: 9 }
    const out = await enforceReviewAuthority(ctx({ data, operation: 'create', user: admin }))
    expect(out).toBe(data)
  })

  it('trusts internal/system calls with no req.user (overrideAccess path)', async () => {
    // creditQuestPayout sets payoutStatus via overrideAccess with no user; external
    // unauthenticated writes are already blocked by access:authenticated.
    const data = { payoutStatus: 'paid', payoutAmount: 300 }
    const out = await enforceReviewAuthority(ctx({ data, originalDoc: { status: 'approved', participant: 9 }, user: null }))
    expect(out).toBe(data)
  })

  it('lets super_admin override every rule (break-glass)', async () => {
    const data = { status: 'approved' }
    const out = await enforceReviewAuthority(
      ctx({ data, originalDoc: { status: 'approved', participant: 200 }, user: superAdmin }),
    )
    expect(out).toBe(data)
  })

  it('rejects self-approval (reviewer is the participant)', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'approved' }, originalDoc: { status: 'submitted', participant: 9, quest: 7 }, user: participant }),
      ),
    ).rejects.toThrow(/your own/i)
  })

  it('rejects a cross-tenant admin (global admin NOT a member of the quest tenant)', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({
          data: { status: 'approved' },
          originalDoc: { status: 'submitted', participant: 9, quest: 7 },
          user: admin,
          isMember: false, // admin on some other tenant — not this quest's tenant
        }),
      ),
    ).rejects.toThrow(/admin of this tenant or the quest owner/i)
  })

  it('rejects a non-admin non-owner reviewer', async () => {
    const stranger = { id: 999, roles: ['user'] }
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'approved' }, originalDoc: { status: 'submitted', participant: 9, quest: 7 }, user: stranger, questOwnerId: 50 }),
      ),
    ).rejects.toThrow(/admin of this tenant or the quest owner/i)
  })

  it('rejects an invalid state transition (paid → approved) by a tenant admin', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'approved' }, originalDoc: { status: 'paid', participant: 9, quest: 7 }, user: admin }),
      ),
    ).rejects.toThrow(/Cannot transition/i)
  })

  it('denies a review when the prior state is unknown (no skip)', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'approved' }, originalDoc: { participant: 9, quest: 7 }, user: admin }),
      ),
    ).rejects.toThrow(/Cannot transition/i)
  })

  it('allows a tenant admin to approve + server-stamps reviewedBy', async () => {
    const data: any = { status: 'approved' }
    const out: any = await enforceReviewAuthority(
      ctx({ data, originalDoc: { status: 'submitted', participant: 9, quest: 7 }, user: admin, isMember: true }),
    )
    expect(out.status).toBe('approved')
    expect(out.reviewedBy).toBe(100) // stamped from req.user.id, not client input
    expect(out.reviewedAt).toBeTruthy()
  })

  it('allows the quest owner (not the participant) to approve', async () => {
    const data: any = { status: 'approved' }
    const out: any = await enforceReviewAuthority(
      ctx({ data, originalDoc: { status: 'under_review', participant: 9, quest: 7 }, user: owner, questOwnerId: 50 }),
    )
    expect(out.status).toBe('approved')
    expect(out.reviewedBy).toBe(50)
  })

  it('rejects the quest owner reviewing their OWN participation', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'approved' }, originalDoc: { status: 'submitted', participant: 50, quest: 7 }, user: owner, questOwnerId: 50 }),
      ),
    ).rejects.toThrow(/your own/i)
  })

  it('allows rejection by a tenant admin from under_review', async () => {
    const data: any = { status: 'rejected' }
    const out: any = await enforceReviewAuthority(
      ctx({ data, originalDoc: { status: 'under_review', participant: 9, quest: 7 }, user: admin }),
    )
    expect(out.status).toBe('rejected')
  })

  it('blocks a non-privileged caller from tampering with a protected field', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { reviewedBy: 100 }, originalDoc: { status: 'submitted', participant: 9, reviewedBy: null, quest: 7 }, user: participant }),
      ),
    ).rejects.toThrow(/modify 'reviewedBy'/i)
  })

  it('blocks a non-privileged caller from jumping straight to paid', async () => {
    await expect(
      enforceReviewAuthority(
        ctx({ data: { status: 'paid' }, originalDoc: { status: 'approved', participant: 9, quest: 7 }, user: participant }),
      ),
    ).rejects.toThrow(/mark a participation paid/i)
  })
})
