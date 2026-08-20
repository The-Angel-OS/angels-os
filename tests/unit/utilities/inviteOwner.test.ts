/**
 * inviteOwner mints tenant_admin access — the one thing that must not
 * double-issue on a re-run, and must not throw on a bad email send.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utilities/sendTenantInvitationEmail', () => ({
  sendTenantInvitationEmail: vi.fn(async () => true),
}))

import { inviteOwner } from '@/utilities/inviteOwner'
import { sendTenantInvitationEmail } from '@/utilities/sendTenantInvitationEmail'

function fakePayload(existing: unknown[]) {
  const created: unknown[] = []
  return {
    created,
    payload: {
      find: vi.fn(async ({ collection }: { collection: string }) =>
        collection === 'users'
          ? { docs: [{ id: 1 }], totalDocs: 1 }
          : { docs: existing, totalDocs: existing.length },
      ),
      create: vi.fn(async (args: unknown) => {
        created.push(args)
        return { id: 99 }
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  }
}

describe('inviteOwner', () => {
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

  it('reports a send failure instead of throwing — the portal still exists', async () => {
    vi.mocked(sendTenantInvitationEmail).mockRejectedValueOnce(new Error('smtp down'))
    const { payload } = fakePayload([])
    const res = await inviteOwner(payload, { email: 'o@e.com', tenantId: 7 })

    expect(res.error).toBe('smtp down')
    expect(res.emailSent).toBe(false)
  })
})
