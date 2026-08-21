/**
 * inviteOwner mints tenant_admin access — the one thing that must not
 * double-issue on a re-run, and must not throw on a bad email send.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utilities/sendTenantInvitationEmail', () => ({
  sendTenantInvitationEmail: vi.fn(async () => true),
}))

import { inviteOwner } from '@/utilities/inviteOwner'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

function fakePayload(existing: unknown[], opts: { noSuperAdmin?: boolean } = {}) {
  const created: unknown[] = []
  return {
    created,
    payload: {
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
        if (collection !== 'users') return { docs: existing, totalDocs: existing.length }
        // The super_admin lookup is the filtered one; the bare find is the fallback.
        const isAdminLookup = Boolean((where as { roles?: unknown })?.roles)
        if (isAdminLookup) {
          return opts.noSuperAdmin ? { docs: [], totalDocs: 0 } : { docs: [{ id: 3 }], totalDocs: 1 }
        }
        return { docs: [{ id: 162 }], totalDocs: 1 }
      }),
      create: vi.fn(async (args: unknown) => {
        created.push(args)
        return { id: 99 }
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  }
}

describe('inviteOwner', () => {
  // The email spy is module-level; without this it carries calls between tests.
  beforeEach(() => vi.clearAllMocks())

  it('mints one pending tenant_admin invite on a fresh tenant', async () => {
    const { payload, created } = fakePayload([])
    const res = await inviteOwner(payload, {
      email: 'Owner@Example.com',
      tenantId: 7,
      tenantDomain: 'acme.spacesangels.com',
    })

    expect(created).toHaveLength(1)
    const data = (created[0] as { data: Record<string, unknown> }).data
    expect(data.role).toBe('tenant_admin')
    expect(data.status).toBe('pending')
    expect(data.tenant).toBe(7)
    expect(res.email).toBe('owner@example.com') // normalized
    expect(res.emailSent).toBe(true)
    expect(res.inviteUrl).toMatch(/^https:\/\/acme\.spacesangels\.com\/tenant-invite\/.+/)
  })

  it('does not duplicate when an active/pending membership already exists', async () => {
    const { payload, created } = fakePayload([
      { status: 'pending', invitationDetails: { invitationToken: 'tok', invitationExpiresAt: '2030-01-01' } },
    ])
    const res = await inviteOwner(payload, { email: 'o@e.com', tenantId: 7 })

    expect(created).toHaveLength(0)
    expect(res.alreadyInvited).toBe(true)
    expect(res.inviteUrl).toBe('/tenant-invite/tok')
  })

  it('mints a phone-only invite and leaves delivery to the inviter', async () => {
    const { payload, created } = fakePayload([])
    const res = await inviteOwner(payload, {
      phone: '+13525550142',
      tenantId: 7,
      tenantDomain: 'bre.spacesangels.com',
    })

    const data = (created[0] as { data: Record<string, unknown> }).data
    const details = data.invitationDetails as Record<string, unknown>
    expect(details.invitationPhone).toBe('+13525550142')
    expect(details.invitationEmail).toBeUndefined()
    expect(sendTenantInvitationEmail).not.toHaveBeenCalled()
    // The URL is the whole deliverable when there is nowhere to mail it.
    expect(res.emailSent).toBe(false)
    expect(res.inviteUrl).toMatch(/^https:\/\/bre\.spacesangels\.com\/tenant-invite\/.+/)
  })

  it('attributes the invite to a super_admin, not whoever the users table returns first', async () => {
    // The invite page renders this user's name to the prospect. Taking the bare
    // first row put a random member's name on a portal we were pitching.
    const { payload, created } = fakePayload([])
    await inviteOwner(payload, { phone: '+13522085428', tenantId: 38 })

    expect((created[0] as { data: { invitedBy: number } }).data.invitedBy).toBe(3)
  })

  it('still satisfies the FK when the node has no super_admin', async () => {
    const { payload, created } = fakePayload([], { noSuperAdmin: true })
    await inviteOwner(payload, { phone: '+13522085428', tenantId: 38 })

    expect((created[0] as { data: { invitedBy: number } }).data.invitedBy).toBe(162)
  })

  it('refuses an invite addressed to nobody', async () => {
    const { payload, created } = fakePayload([])
    const res = await inviteOwner(payload, { tenantId: 7 })

    expect(created).toHaveLength(0)
    expect(res.error).toMatch(/email or a phone/)
  })

  it('reports a send failure instead of throwing — the portal still exists', async () => {
    vi.mocked(sendTenantInvitationEmail).mockRejectedValueOnce(new Error('smtp down'))
    const { payload } = fakePayload([])
    const res = await inviteOwner(payload, { email: 'o@e.com', tenantId: 7 })

    expect(res.error).toBe('smtp down')
    expect(res.emailSent).toBe(false)
  })
})
