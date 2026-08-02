/**
 * buildMediaMeta — relationship ids reach Payload as numbers.
 *
 * On 260801 every analyze_image from Nimue failed with "The following field is
 * invalid: Assigned Tenant" while the image itself uploaded fine. Payload
 * validates a relationship with `isValidID(value, 'number')` — a bare
 * `typeof value === 'number'` — so a string tenant id is rejected outright.
 * `mediaId` had already been coerced for this exact reason; `tenant` had not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildMediaMeta } from '@/utilities/mediaAnalysis'

const makePayload = () => {
  const create = vi.fn(async () => ({ id: 1 }))
  return {
    create,
    find: vi.fn(async () => ({ docs: [] })),
    update: vi.fn(async () => ({ id: 1 })),
  } as never
}

beforeEach(() => {
  // No vision provider → analyzeImage bails immediately, so the test never
  // touches the network. The 'processing' record is created before that point,
  // which is the write under test.
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GOOGLE_AI_API_KEY
})

describe('buildMediaMeta id coercion', () => {
  it('writes tenant and sourceMessage as numbers when given strings', async () => {
    const payload = makePayload()
    await buildMediaMeta(payload, {
      mediaDoc: { id: '490', mimeType: 'image/jpeg', url: 'https://example.test/a.jpg' },
      tenantId: '1' as unknown as number,
      sourceMessageId: '7438',
    })

    const data = (payload as unknown as { create: { mock: { calls: [{ data: Record<string, unknown> }][] } } })
      .create.mock.calls[0][0].data
    expect(data.media).toBe(490)
    expect(data.tenant).toBe(1)
    expect(data.sourceMessage).toBe(7438)
  })

  it('drops a non-numeric tenant instead of failing the whole record', async () => {
    const payload = makePayload()
    await buildMediaMeta(payload, {
      mediaDoc: { id: 490, mimeType: 'image/jpeg', url: 'https://example.test/a.jpg' },
      tenantId: 'not-an-id' as unknown as number,
    })

    const data = (payload as unknown as { create: { mock: { calls: [{ data: Record<string, unknown> }][] } } })
      .create.mock.calls[0][0].data
    expect(data.tenant).toBeUndefined()
    expect(data.media).toBe(490)
  })
})
