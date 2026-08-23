/**
 * Accepting an invitation has to put the person somewhere.
 *
 * It used to return `{ spaceId }` as JSON and the client dropped them on the
 * generic Spaces list — they were a member, and nothing showed them the room.
 * These pin the two things that matter: the destination is the actual channel,
 * and saying hello is never allowed to fail the acceptance.
 *
 * @see src/utilities/invitationSystem.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { acceptInvitation } from '@/utilities/invitationSystem'

const future = new Date(Date.now() + 86_400_000).toISOString()

const membership = {
  id: 12,
  status: 'pending',
  role: 'member',
  space: { id: 6, name: 'Community' },
  tenant: { id: 5 },
  invitedBy: { name: 'Ron' },
  invitationDetails: { invitationExpiresAt: future, invitationEmail: 'sam@example.com' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payloadWith = (over: Record<string, any> = {}) => {
  const base = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    find: vi.fn(async ({ collection }: any) => {
      if (collection === 'space-memberships') return { docs: [membership] }
      if (collection === 'channels') {
        return { docs: [{ id: 16, isDefault: false }, { id: 17, isDefault: true }] }
      }
      if (collection === 'messages') return { docs: [{ channel: 'welcome' }] }
      return { docs: [] }
    }),
    update: vi.fn(async () => ({})),
    create: vi.fn(async () => ({ id: 1 })),
    findByID: vi.fn(async () => ({ id: 7, name: 'Sam', email: 'sam@example.com' })),
    ...over,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return base as any
}

describe('arriving after an invitation', () => {
  it('points at the space AND its default channel, not the list', async () => {
    const payload = payloadWith()
    const res = await acceptInvitation(payload, 'tok', 7)
    expect(res.destination).toBe('/dashboard/spaces/6/17')
    expect(res.channelId).toBe(17)
  })

  it('says hello in the channel the space is actually talking in', async () => {
    const payload = payloadWith()
    await acceptInvitation(payload, 'tok', 7)
    const hello = payload.create.mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c[0]?.collection === 'messages',
    )?.[0]
    expect(hello).toBeTruthy()
    expect(hello.data.channel).toBe('welcome')
    expect(hello.data.content.text).toContain('Sam')
    expect(hello.data.content.text).toContain('Ron')
  })

  it('still falls back to the space when it has no channels yet', async () => {
    const payload = payloadWith({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      find: vi.fn(async ({ collection }: any) =>
        collection === 'space-memberships' ? { docs: [membership] } : { docs: [] },
      ),
    })
    const res = await acceptInvitation(payload, 'tok', 7)
    expect(res.destination).toBe('/dashboard/spaces/6')
    expect(res.channelId).toBeNull()
  })

  it('a failed hello does NOT fail the acceptance', async () => {
    const payload = payloadWith({
      create: vi.fn(async () => {
        throw new Error('messages table on fire')
      }),
    })
    const res = await acceptInvitation(payload, 'tok', 7)
    expect(res.membershipId).toBe(12)
    expect(res.destination).toBe('/dashboard/spaces/6/17')
  })
})
