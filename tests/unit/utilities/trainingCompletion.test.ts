import { describe, it, expect } from 'vitest'
import { buildCompletionReport } from '@/utilities/trainingCompletion'

const WORKS = [
  { slug: 'safety', title: 'Safety' },
  { slug: 'handbook', title: 'Handbook' },
]

function fake(opts: {
  members?: Array<{ user: unknown }>
  settings?: Array<{ entityId: string; settingValue: string }>
} = {}) {
  return {
    find: async ({ collection }: { collection: string }) =>
      collection === 'tenant-memberships'
        ? { docs: opts.members ?? [] }
        : { docs: opts.settings ?? [] },
  } as never
}

describe('who has finished which training', () => {
  it('reports a percent for every training, including the untouched ones', async () => {
    const r = await buildCompletionReport(
      fake({
        members: [{ user: { id: 7, name: 'Ada' } }],
        settings: [{ entityId: '7', settingValue: JSON.stringify({ safety: { percent: 100 } }) }],
      }),
      1,
      WORKS,
    )
    expect(r.people).toEqual([
      { userId: 7, name: 'Ada', progress: { safety: 100, handbook: 0 } },
    ])
  })

  it('falls back to email, then to an id, for someone with no name', async () => {
    const r = await buildCompletionReport(
      fake({ members: [{ user: { id: 8, email: 'b@x.test' } }, { user: 9 }] }),
      1,
      WORKS,
    )
    expect(r.people.map((p) => p.name).sort()).toEqual(['User 9', 'b@x.test'])
  })

  it('treats a corrupt progress row as no progress, not as a broken report', async () => {
    const r = await buildCompletionReport(
      fake({
        members: [{ user: { id: 7, name: 'Ada' } }],
        settings: [{ entityId: '7', settingValue: '{not json' }],
      }),
      1,
      WORKS,
    )
    expect(r.people[0].progress).toEqual({ safety: 0, handbook: 0 })
  })

  it('clamps a nonsense percent rather than rendering it', async () => {
    const r = await buildCompletionReport(
      fake({
        members: [{ user: { id: 7, name: 'Ada' } }],
        settings: [
          { entityId: '7', settingValue: JSON.stringify({ safety: { percent: 940 }, handbook: { percent: -3 } }) },
        ],
      }),
      1,
      WORKS,
    )
    expect(r.people[0].progress).toEqual({ safety: 100, handbook: 0 })
  })

  it('does not query progress at all when the portal has no members', async () => {
    const r = await buildCompletionReport(fake(), 1, WORKS)
    expect(r).toEqual({ works: WORKS, people: [] })
  })
})
