/**
 * ensureTenantSpaces — personal vs business channel differentiation.
 *
 * A guardian-angel / personal portal must be "sorted separate from the other
 * endeavors": it gets the PERSONAL channel set (timeline/journal/reminders) via
 * createPersonalSpace, NOT a business's endeavor-typed community hub. Verifies the
 * branch on `personal`, both at create time and on backfill.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSpaceFromTemplate = vi.fn(async () => ({ spaceId: 10, channelIds: [] }))
const createPersonalSpace = vi.fn(async () => ({ spaceId: 20, channelIds: [] }))
const addChannelToSpace = vi.fn(async () => 99)

vi.mock('@/utilities/spaceProvisioning', () => ({
  createSpaceFromTemplate: (...a: unknown[]) => createSpaceFromTemplate(...(a as [])),
  createPersonalSpace: (...a: unknown[]) => createPersonalSpace(...(a as [])),
  addChannelToSpace: (...a: unknown[]) => addChannelToSpace(...(a as [])),
  PERSONAL_CHANNELS: [
    { name: 'timeline', type: 'general', description: '', isDefault: true },
    { name: 'journal', type: 'general', description: '' },
    { name: 'reminders', type: 'general', description: '' },
  ],
}))

import { ensureTenantSpaces } from '@/utilities/ensureTenantSpaces'

function makePayload(spacesDocs: unknown[], channelsDocs: unknown[] = []) {
  return {
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'spaces') return { docs: spacesDocs }
      if (collection === 'channels') return { docs: channelsDocs }
      return { docs: [] } // endeavors, etc.
    }),
  } as never
}

beforeEach(() => {
  createSpaceFromTemplate.mockClear()
  createPersonalSpace.mockClear()
  addChannelToSpace.mockClear()
})

describe('ensureTenantSpaces — personal differentiation', () => {
  it('a personal portal gets a personal space, not a business community hub', async () => {
    const res = await ensureTenantSpaces(makePayload([]), 5, { personal: true })
    expect(createPersonalSpace).toHaveBeenCalledTimes(1)
    expect(createSpaceFromTemplate).not.toHaveBeenCalled()
    expect(res).toEqual({ spaceId: 20, createdSpace: true, addedChannels: [] })
  })

  it('a business endeavor gets the endeavor-typed community space', async () => {
    const res = await ensureTenantSpaces(makePayload([]), 6, { endeavorType: 'creator-content' })
    expect(createSpaceFromTemplate).toHaveBeenCalledTimes(1)
    const args = createSpaceFromTemplate.mock.calls[0] as unknown[]
    expect(args[1]).toBe('creator-content') // endeavorType
    expect(createPersonalSpace).not.toHaveBeenCalled()
    expect(res.spaceId).toBe(10)
  })

  it('backfills the PERSONAL baseline (journal/reminders) on an existing personal space', async () => {
    // Space exists with only 'timeline'; journal + reminders are missing.
    const payload = makePayload([{ id: 7 }], [{ name: 'timeline' }])
    const res = await ensureTenantSpaces(payload, 5, { personal: true })
    expect(res.createdSpace).toBe(false)
    expect(res.addedChannels).toEqual(['journal', 'reminders'])
    // Never backfills the business 'general'/'announcements' onto a personal space.
    const backfilled = addChannelToSpace.mock.calls.map((c) => (c[3] as { name: string }).name)
    expect(backfilled).toEqual(['journal', 'reminders'])
  })
})
