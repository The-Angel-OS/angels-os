/**
 * ensureTenantSpaces — idempotent baseline-spaces self-heal. Must create a Space
 * when none exists, backfill only missing baseline channels when one does, and
 * be a no-op when everything is present.
 */
import { describe, it, expect, vi } from 'vitest'
import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'

function makePayload(overrides: Partial<Record<string, any>> = {}) {
  const created: Array<{ collection: string; data: any }> = []
  const payload: any = {
    created,
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (overrides[collection]) return overrides[collection]
      return { docs: [] }
    }),
    create: vi.fn(async ({ collection, data }: { collection: string; data: any }) => {
      created.push({ collection, data })
      return { id: created.length, ...data }
    }),
  }
  return payload
}

describe('ensureTenantSpaces', () => {
  it('creates a Community space + channels when the tenant has none', async () => {
    const payload = makePayload({
      spaces: { docs: [] },
      endeavors: { docs: [{ endeavorType: 'creator-content' }] },
    })
    const res = await ensureTenantSpaces(payload, 5)

    expect(res.createdSpace).toBe(true)
    const spaceCreate = payload.created.find((c: any) => c.collection === 'spaces')
    expect(spaceCreate?.data.name).toBe('Community')
    expect(spaceCreate?.data.tenant).toBe(5)
    // creator-content template => general, announcements, community, content-updates, premium
    const channels = payload.created.filter((c: any) => c.collection === 'channels').map((c: any) => c.data.name)
    expect(channels).toContain('general')
    expect(channels).toContain('community')
  })

  it('falls back to the custom template when the tenant has no endeavor', async () => {
    const payload = makePayload({ spaces: { docs: [] }, endeavors: { docs: [] } })
    await ensureTenantSpaces(payload, 7)
    const channels = payload.created.filter((c: any) => c.collection === 'channels').map((c: any) => c.data.name)
    // custom => just the common baseline
    expect(channels).toEqual(['general', 'announcements'])
  })

  it('backfills only the MISSING baseline channels when a space exists', async () => {
    const payload = makePayload({
      spaces: { docs: [{ id: 99 }] },
      channels: { docs: [{ name: 'general' }] }, // announcements missing
    })
    const res = await ensureTenantSpaces(payload, 3)

    expect(res.createdSpace).toBe(false)
    expect(res.spaceId).toBe(99)
    expect(res.addedChannels).toEqual(['announcements'])
    const created = payload.created.filter((c: any) => c.collection === 'channels').map((c: any) => c.data.name)
    expect(created).toEqual(['announcements'])
  })

  it('is a no-op when the space and baseline channels already exist', async () => {
    const payload = makePayload({
      spaces: { docs: [{ id: 1 }] },
      channels: { docs: [{ name: 'general' }, { name: 'announcements' }] },
    })
    const res = await ensureTenantSpaces(payload, 1)

    expect(res.createdSpace).toBe(false)
    expect(res.addedChannels).toEqual([])
    expect(payload.created.length).toBe(0)
  })
})
