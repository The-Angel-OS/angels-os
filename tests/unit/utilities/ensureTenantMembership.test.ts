/**
 * ensureTenantMembership — the idempotent, non-fatal utility that auto-creates a
 * TenantMembership when a user first interacts with an Endeavor.
 *
 * The previous version of this file tested a signature that no longer exists
 * — `(payload, userId, tenantId, trigger)` returning `{ created, skipped }` —
 * so all 28 of its cases failed on `undefined.created`, and the ones that got
 * far enough tried to open a real Postgres connection through getPayload().
 * That was a third of the entire suite's failures.
 *
 * The function now takes `(userId, tenantId)`, resolves its own payload, and
 * returns void. Three behaviours are worth pinning: the idempotency guard, the
 * shape of what it creates, and that it never throws — callers rely on
 * fire-and-forget.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const find = vi.fn()
const create = vi.fn()

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find, create })),
}))

const { ensureTenantMembership } = await import('@/utilities/ensureTenantMembership')

beforeEach(() => {
  find.mockReset().mockResolvedValue({ docs: [] })
  create.mockReset().mockResolvedValue({ id: 1 })
})

describe('ensureTenantMembership', () => {
  it('creates an active tenant_member membership when none exists', async () => {
    await ensureTenantMembership(7, 3)

    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0]![0] as { collection: string; data: Record<string, unknown> }
    expect(arg.collection).toBe('tenant-memberships')
    expect(arg.data).toMatchObject({
      user: 7,
      tenant: 3,
      role: 'tenant_member',
      status: 'active',
    })
    expect(Number.isNaN(Date.parse(arg.data.joinedAt as string))).toBe(false)
  })

  it('coerces string ids to numbers — relationship ids are compared numerically', async () => {
    await ensureTenantMembership('7', '3')
    const { data } = create.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data.user).toBe(7)
    expect(data.tenant).toBe(3)
  })

  it('is idempotent: an existing row of ANY status stops the create', async () => {
    find.mockResolvedValue({ docs: [{ id: 99, status: 'left' }] })
    await ensureTenantMembership(7, 3)
    expect(create).not.toHaveBeenCalled()
  })

  it('scopes the idempotency check to this user AND this tenant', async () => {
    await ensureTenantMembership(7, 3)
    const arg = find.mock.calls[0]![0] as { where: { and: unknown[] } }
    expect(arg.where.and).toEqual([{ user: { equals: 7 } }, { tenant: { equals: 3 } }])
  })

  it('never throws — it runs fire-and-forget behind user-facing work', async () => {
    find.mockRejectedValue(new Error('DB find error'))
    await expect(ensureTenantMembership(7, 3)).resolves.toBeUndefined()

    find.mockResolvedValue({ docs: [] })
    create.mockRejectedValue(new Error('DB create error'))
    await expect(ensureTenantMembership(7, 3)).resolves.toBeUndefined()
  })
})
