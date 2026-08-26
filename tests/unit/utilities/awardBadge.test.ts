/**
 * A badge is awarded once, at 100%, and never fails the progress write.
 */
import { describe, it, expect, vi } from 'vitest'
import { awardBadgeForWork } from '@/utilities/awardBadge'

function fakePayload(opts: {
  badge?: { name?: string | null; image?: { url?: string } | string | null } | null
  existing?: Array<{ work: string }>
  throwOnUpdate?: boolean
}) {
  const update = vi.fn(async () => {
    if (opts.throwOnUpdate) throw new Error('db down')
    return {}
  })
  return {
    update,
    find: async () => ({ docs: [{ badge: opts.badge ?? null }] }),
    findByID: async () => ({ badges: opts.existing ?? [] }),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const award = (p: any, score?: number) => awardBadgeForWork(p, 5, 'wdeg', score)

describe('awardBadgeForWork', () => {
  it('awards the badge and appends it to the user', async () => {
    const p = fakePayload({ badge: { name: 'Reader', image: { url: '/b.png' } } })
    const badge = await award(p, 90)

    expect(badge).toMatchObject({ work: 'wdeg', name: 'Reader', image: '/b.png', score: 90 })
    expect(p.update).toHaveBeenCalledOnce()
    const data = p.update.mock.calls[0][0].data as { badges: unknown[] }
    expect(data.badges).toHaveLength(1)
  })

  it('does not award the same badge twice', async () => {
    const p = fakePayload({ badge: { name: 'Reader' }, existing: [{ work: 'wdeg' }] })
    expect(await award(p)).toBeNull()
    expect(p.update).not.toHaveBeenCalled()
  })

  it('is a no-op, not an error, for a Work that awards nothing', async () => {
    const p = fakePayload({ badge: null })
    expect(await award(p)).toBeNull()
    expect(p.update).not.toHaveBeenCalled()
  })

  it('keeps existing badges when appending a new one', async () => {
    const p = fakePayload({ badge: { name: 'Reader' }, existing: [{ work: 'answer53' }] })
    await award(p)
    const data = p.update.mock.calls[0][0].data as { badges: Array<{ work: string }> }
    expect(data.badges.map((b) => b.work)).toEqual(['answer53', 'wdeg'])
  })

  it('swallows a write failure — a gift must never fail the progress it rode in on', async () => {
    const p = fakePayload({ badge: { name: 'Reader' }, throwOnUpdate: true })
    expect(await award(p)).toBeNull()
  })
})
