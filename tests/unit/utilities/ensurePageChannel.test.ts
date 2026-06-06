/**
 * ensurePageChannel — page-comment channels must surface in the Spaces viewer.
 * The created Channel's slug MUST equal the page: message channel exactly.
 */
import { describe, it, expect, vi } from 'vitest'
import { ensurePageChannel, pageChannelName } from '@/utilities/ensurePageChannel'

function makePayload(existingDocs: unknown[] = []) {
  const created: Array<{ collection: string; data: any }> = []
  const payload: any = {
    created,
    find: vi.fn(async () => ({ docs: existingDocs })),
    create: vi.fn(async ({ collection, data }: { collection: string; data: any }) => {
      created.push({ collection, data })
      return { id: 1, ...data }
    }),
  }
  return payload
}

describe('pageChannelName', () => {
  it('labels the homepage channel', () => expect(pageChannelName('page:/')).toBe('Page: Home'))
  it('labels a deep-link channel by path', () =>
    expect(pageChannelName('page:/learn/wdeg/3-x')).toBe('Page: /learn/wdeg/3-x'))
})

describe('ensurePageChannel', () => {
  it('creates a channel whose slug equals the page: channel exactly', async () => {
    const payload = makePayload([])
    await ensurePageChannel(payload, { channel: 'page:/learn/wdeg/3-x', spaceId: 6, tenantId: 5 })
    const ch = payload.created.find((c: any) => c.collection === 'channels')
    expect(ch?.data.slug).toBe('page:/learn/wdeg/3-x') // must match for the viewer to load messages
    expect(ch?.data.name).toBe('Page: /learn/wdeg/3-x')
    expect(ch?.data.space).toBe(6)
    expect(ch?.data.tenant).toBe(5)
    expect(ch?.data.type).toBe('social')
  })

  it('is a no-op when the channel already exists', async () => {
    const payload = makePayload([{ id: 99, slug: 'page:/' }])
    await ensurePageChannel(payload, { channel: 'page:/', spaceId: 6, tenantId: 5 })
    expect(payload.created.length).toBe(0)
  })

  it('ignores non-page channels', async () => {
    const payload = makePayload([])
    await ensurePageChannel(payload, { channel: 'general', spaceId: 6, tenantId: 5 })
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.created.length).toBe(0)
  })
})
