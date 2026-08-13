/**
 * buildDeletePlan — what a space delete will actually do.
 *
 * Grounded in the real case that prompted it: The Angel OS portal accumulated
 * three "Community" spaces across separate provisionings, each with its own
 * `general` and `announcements`.
 *
 * @see src/endpoints/space-delete.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { buildDeletePlan } from '@/endpoints/space-delete'

type Channel = { id: number; slug: string; name: string; space: number }
type Membership = { id: number; user: number; space: number }

/** Payload stand-in over fixed channel/message/membership tables. */
function fakePayload(opts: {
  spaces: Array<{ id: number; name: string }>
  channels: Channel[]
  /** channelId → message count */
  messages?: Record<number, number>
  memberships?: Membership[]
  looseMessages?: number
}) {
  const { spaces, channels, messages = {}, memberships = [], looseMessages = 0 } = opts
  return {
    logger: { warn: vi.fn() },
    findByID: vi.fn(async ({ id }: { id: number }) => spaces.find((s) => s.id === Number(id)) ?? null),
    find: vi.fn(async ({ collection, where }: { collection: string; where: any }) => {
      if (collection === 'channels') {
        const sid = Number(where?.space?.equals)
        return { docs: channels.filter((c) => c.space === sid) }
      }
      if (collection === 'space-memberships') {
        const sid = Number(where?.space?.equals)
        return { docs: memberships.filter((m) => m.space === sid) }
      }
      return { docs: [] }
    }),
    count: vi.fn(async ({ where }: { where: any }) => {
      const ref = where?.channelRef?.equals
      if (ref !== undefined) return { totalDocs: messages[Number(ref)] ?? 0 }
      return { totalDocs: looseMessages }
    }),
  } as never
}

const THREE_COMMUNITIES = {
  spaces: [
    { id: 33, name: 'Community' },
    { id: 44, name: 'Community Hub' },
    { id: 47, name: 'Community' },
  ],
  channels: [
    { id: 163, slug: 'general', name: 'general', space: 33 },
    { id: 164, slug: 'announcements', name: 'announcements', space: 33 },
    { id: 508, slug: 'town-square', name: 'Town Square', space: 47 },
    { id: 541, slug: 'main', name: 'main', space: 47 },
    { id: 542, slug: 'announcements', name: 'announcements', space: 47 },
  ],
  messages: { 163: 18, 541: 6 },
}

describe('buildDeletePlan', () => {
  it('merges a channel whose slug already exists at the destination', async () => {
    const payload = fakePayload(THREE_COMMUNITIES)
    const plan = await buildDeletePlan(payload, 33, 47)

    const ann = plan.channels.find((c) => c.slug === 'announcements')!
    expect(ann.action).toBe('merge')
    expect(ann.mergeIntoChannelId).toBe(542) // #47's announcements
  })

  it('moves a channel the destination does not have, messages and all', async () => {
    const payload = fakePayload(THREE_COMMUNITIES)
    const plan = await buildDeletePlan(payload, 33, 47)

    const general = plan.channels.find((c) => c.slug === 'general')!
    expect(general.action).toBe('move')
    expect(general.messageCount).toBe(18)
  })

  // Two sources both carrying `general` is the trap: if the plan says "move"
  // twice, the destination ends up with two #general and the slug that messages
  // key on stops identifying one channel.
  it('does not let two same-slug channels both claim the destination', async () => {
    const payload = fakePayload({
      spaces: [
        { id: 33, name: 'Community' },
        { id: 47, name: 'Community' },
      ],
      channels: [
        { id: 163, slug: 'general', name: 'general', space: 33 },
        { id: 999, slug: 'general', name: 'general (dupe)', space: 33 },
      ],
      messages: { 163: 18, 999: 5 },
    })
    const plan = await buildDeletePlan(payload, 33, 47)

    const generals = plan.channels.filter((c) => c.slug === 'general')
    expect(generals).toHaveLength(2)
    expect(generals.filter((c) => c.action === 'move')).toHaveLength(1)
    expect(generals.filter((c) => c.action === 'merge')).toHaveLength(1)
    expect(generals.find((c) => c.action === 'merge')!.mergeIntoChannelId).toBe(163)
  })

  it('counts members to carry over, skipping people already there', async () => {
    const payload = fakePayload({
      ...THREE_COMMUNITIES,
      memberships: [
        { id: 1, user: 3, space: 33 },
        { id: 2, user: 15, space: 33 },
        { id: 3, user: 3, space: 47 }, // Ken is in both
      ],
    })
    const plan = await buildDeletePlan(payload, 33, 47)

    expect(plan.membersMoved).toBe(1) // Tyler
    expect(plan.membersAlreadyThere).toBe(1) // Ken
  })

  it('reports every channel as deleted when there is no destination', async () => {
    const payload = fakePayload(THREE_COMMUNITIES)
    const plan = await buildDeletePlan(payload, 33, undefined)

    expect(plan.destination).toBeNull()
    expect(plan.channels).toHaveLength(2)
    expect(plan.channels.every((c) => c.action === 'move')).toBe(true) // no merge target exists
  })

  it('refuses to move a space into itself', async () => {
    const payload = fakePayload(THREE_COMMUNITIES)
    await expect(buildDeletePlan(payload, 33, 33)).rejects.toThrow(/into itself/i)
  })

  it('errors clearly when the destination does not exist', async () => {
    const payload = fakePayload(THREE_COMMUNITIES)
    await expect(buildDeletePlan(payload, 33, 4242)).rejects.toThrow(/Destination space not found/i)
  })
})
