/**
 * ensurePageChannel — page-comment channels must surface in the Spaces viewer.
 * The created Channel's slug MUST equal the page: message channel exactly.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  ensurePageChannel,
  pageChannelName,
  reparentPageChannelsToAiBus,
} from '@/utilities/ensurePageChannel'

// AI Bus space id the resolver returns for the test tenant.
const AI_BUS_ID = 7

function makePayload(existingChannelDocs: unknown[] = []) {
  const created: Array<{ collection: string; data: any }> = []
  const payload: any = {
    created,
    // resolveAiBusSpaceId queries collection:'spaces' (slug ai-bus); the channel
    // dedup queries collection:'channels'. Route the mock by collection.
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'spaces') return { docs: [{ id: AI_BUS_ID }] }
      return { docs: existingChannelDocs }
    }),
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
  it('creates a channel on the AI Bus whose slug equals the page: channel exactly', async () => {
    const payload = makePayload([])
    await ensurePageChannel(payload, { channel: 'page:/learn/wdeg/3-x', tenantId: 5 })
    const ch = payload.created.find((c: any) => c.collection === 'channels')
    expect(ch?.data.slug).toBe('page:/learn/wdeg/3-x') // must match for the viewer to load messages
    expect(ch?.data.name).toBe('Page: /learn/wdeg/3-x')
    expect(String(ch?.data.space)).toBe(String(AI_BUS_ID)) // always homes on the AI Bus, not the caller's space
    expect(ch?.data.tenant).toBe(5)
    expect(ch?.data.type).toBe('social')
  })

  it('is a no-op when the channel already exists', async () => {
    const payload = makePayload([{ id: 99, slug: 'page:/' }])
    await ensurePageChannel(payload, { channel: 'page:/', tenantId: 5 })
    expect(payload.created.length).toBe(0)
  })

  it('ignores non-page channels', async () => {
    const payload = makePayload([])
    await ensurePageChannel(payload, { channel: 'general', tenantId: 5 })
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.created.length).toBe(0)
  })
})

// ── reparentPageChannelsToAiBus ────────────────────────────────────────────
// Mock that serves a fixed candidate list to the first 'channels' query and an
// "on-bus dedup" list keyed by slug to subsequent ones. Records update/delete.
function makeReparentPayload(
  candidates: Array<{ id: number | string; slug?: string; space?: unknown }>,
  onBusBySlug: Record<string, unknown[]> = {},
) {
  const updated: Array<{ id: unknown; data: any }> = []
  const deleted: Array<unknown> = []
  let candidateServed = false
  const payload: any = {
    updated,
    deleted,
    find: vi.fn(async ({ where }: any) => {
      // The first channels query (slug like 'page:') returns the candidate list;
      // later queries are the per-channel on-bus dedup lookups (slug equals).
      const andClauses = where?.and || []
      const slugEquals = andClauses.find((c: any) => c.slug?.equals)?.slug?.equals
      if (slugEquals !== undefined) return { docs: onBusBySlug[slugEquals] || [] }
      if (!candidateServed) {
        candidateServed = true
        return { docs: candidates }
      }
      return { docs: [] }
    }),
    update: vi.fn(async ({ id, data }: any) => {
      updated.push({ id, data })
      return { id, ...data }
    }),
    delete: vi.fn(async ({ id }: any) => {
      deleted.push(id)
      return { id }
    }),
  }
  return payload
}

describe('reparentPageChannelsToAiBus', () => {
  const AI_BUS = 7

  it('moves a drifted page channel onto the AI Bus', async () => {
    const payload = makeReparentPayload([{ id: 1, slug: 'page:/about', space: 6 }])
    const moved = await reparentPageChannelsToAiBus(payload, 5, AI_BUS)
    expect(moved).toBe(1)
    expect(payload.updated).toEqual([{ id: 1, data: { space: AI_BUS } }])
    expect(payload.deleted.length).toBe(0)
  })

  it('skips a channel already homed on the AI Bus', async () => {
    const payload = makeReparentPayload([{ id: 1, slug: 'page:/about', space: AI_BUS }])
    const moved = await reparentPageChannelsToAiBus(payload, 5, AI_BUS)
    expect(moved).toBe(0)
    expect(payload.updated.length).toBe(0)
    expect(payload.deleted.length).toBe(0)
  })

  it('deletes a drifted duplicate when an AI-Bus channel of the same slug exists', async () => {
    const payload = makeReparentPayload(
      [{ id: 1, slug: 'page:/about', space: 6 }],
      { 'page:/about': [{ id: 99 }] }, // already a page:/about on the bus
    )
    const moved = await reparentPageChannelsToAiBus(payload, 5, AI_BUS)
    expect(moved).toBe(1)
    expect(payload.deleted).toEqual([1])
    expect(payload.updated.length).toBe(0)
  })

  it('ignores non-page channels caught by the substring filter', async () => {
    const payload = makeReparentPayload([{ id: 1, slug: 'front-page:news', space: 6 }])
    const moved = await reparentPageChannelsToAiBus(payload, 5, AI_BUS)
    expect(moved).toBe(0)
    expect(payload.updated.length).toBe(0)
    expect(payload.deleted.length).toBe(0)
  })

  it('handles a populated (object) space relationship', async () => {
    const payload = makeReparentPayload([{ id: 1, slug: 'page:/x', space: { id: 6 } }])
    const moved = await reparentPageChannelsToAiBus(payload, 5, AI_BUS)
    expect(moved).toBe(1)
    expect(payload.updated).toEqual([{ id: 1, data: { space: AI_BUS } }])
  })
})
