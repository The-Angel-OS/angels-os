/**
 * getWorkJson reads `work-chapters` rows, and still reads the old message rows
 * for a Work whose chapters have not moved (or a rolled-back deploy).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const work = {
  id: 'answer53',
  rowId: 7,
  title: 'Answer 53',
  subtitle: '',
  description: '',
  status: '',
  statusColor: '',
  tags: [],
  defaultDoc: 'one',
  docs: [],
  links: [],
  owner: 'platform',
  subscribers: [],
  availableGlobally: true,
  optOuts: [],
  published: true,
  storageRef: { kind: 'rows', space: 30, channel: 'work-answer53' },
} as Record<string, unknown>

vi.mock('@/works/registry', () => ({
  getWork: vi.fn(async () => work),
  isWorkAvailable: () => true,
}))

const { getWorkJson } = await import('@/utilities/getWorkJson')

/** A payload double: one canned result per collection, recording the queries. */
function fakePayload(byCollection: Record<string, unknown[]>) {
  const calls: Array<Record<string, unknown>> = []
  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    find: async (args: any) => {
      calls.push(args)
      return { docs: byCollection[args.collection] ?? [] }
    },
  }
}

beforeEach(() => {
  work.rowId = 7
  work.bookSlug = undefined
  work.storageRef = { kind: 'rows', space: 30, channel: 'work-answer53' }
})

describe('getWorkJson', () => {
  it('assembles a document Work from work-chapters rows', async () => {
    const payload = fakePayload({
      'work-chapters': [
        { id: 1, order: 0, slug: 'one', title: 'One', body: '# one', tier: 'chapter' },
        { id: 2, order: 1, slug: 'two', title: 'Two', body: '# two', image: '/x.webp' },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await getWorkJson({ payload: payload as any, soulId: 'answer53', origin: 'https://n.test' })

    expect(res?.unitCount).toBe(2)
    expect(res?.docs.map((d: { id: string }) => d.id)).toEqual(['one', 'two'])
    expect(res?.docs[0].body).toBe('# one')
    // Media is absolutized against the serving origin.
    expect(res?.cover).toBe('https://n.test/x.webp')
    expect(payload.calls[0].collection).toBe('work-chapters')
    // Messages are never touched once the rows are there.
    expect(payload.calls.some((c) => c.collection === 'messages')).toBe(false)
  })

  it('windows a book by order when given a range, and omits the checksum', async () => {
    work.bookSlug = 'holy-bible'
    const payload = fakePayload({
      'work-chapters': [
        { id: 9, order: 40, slug: '41', title: 'Gen 41', translations: { web: 'a' } },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await getWorkJson({ payload: payload as any, soulId: 'answer53', origin: '', range: { from: 40, to: 60 } })

    expect(res?.pages[0].order).toBe(40)
    // A window is not the Work — checksumming or gossiping one would be a lie.
    expect(res?.checksum).toBe('')
    const where = payload.calls[0].where as { and?: Array<Record<string, unknown>> }
    expect(where.and).toEqual([
      { order: { greater_than_equal: 40 } },
      { order: { less_than: 60 } },
    ])
  })

  it('falls back to the old message rows when a Work has no chapter rows yet', async () => {
    work.storageRef = { kind: 'messages', space: 30, channel: 'work-answer53' }
    const payload = fakePayload({
      'work-chapters': [],
      messages: [
        { id: 5, content: { text: 'legacy' }, metadata: { kind: 'work_chapter', order: 0, chapterSlug: 'one', title: 'One' } },
        { id: 6, content: { text: 'ignored' }, metadata: { kind: 'chat' } },
      ],
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await getWorkJson({ payload: payload as any, soulId: 'answer53', origin: '' })

    expect(res?.unitCount).toBe(1)
    expect(res?.docs[0].body).toBe('legacy')
  })

  it('returns null when a Work has no chapters anywhere', async () => {
    const payload = fakePayload({ 'work-chapters': [], messages: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getWorkJson({ payload: payload as any, soulId: 'answer53', origin: '' })).toBeNull()
  })
})
