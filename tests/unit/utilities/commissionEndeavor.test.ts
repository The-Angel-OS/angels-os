/**
 * commission_endeavor — Unit Tests
 *
 * The "talk to LEO/Nimue → minted site → link delivered" tool. Drives it through
 * the public executeToolCall entry with provisionPortal mocked. Verifies the
 * deliberate auth posture (any signed-in user, NOT super_admin), the name gate,
 * the runaway cap, guaranteed-unique slugs (findOrCreateTenant is idempotent, so
 * a collision would hand back someone else's portal), and the handoff link.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const provisionPortalMock = vi.fn()
vi.mock('@/utilities/provisionPortal', () => ({
  provisionPortal: (...args: unknown[]) => provisionPortalMock(...args),
}))

import { executeToolCall, type ToolExecutorContext } from '@/utilities/leo-data-tools'

function mockPayload(over: Partial<{ ownedCount: number; findDocs: unknown[][] }> = {}) {
  const findQueue = [...(over.findDocs ?? [])]
  return {
    count: vi.fn(async () => ({ totalDocs: over.ownedCount ?? 0 })),
    find: vi.fn(async () => ({ docs: findQueue.length ? findQueue.shift() : [] })),
  } as never
}

const ctx = (payload: unknown, userId?: number): ToolExecutorContext =>
  ({ payload, userId, roles: [] }) as never

beforeEach(() => {
  provisionPortalMock.mockReset()
  process.env.COMMERCE_BASE_DOMAIN = 'test.commerce'
  provisionPortalMock.mockImplementation(async (_p: unknown, input: { slug: string; domain: string }) => ({
    ok: true,
    tenant: { id: 99, slug: input.slug, domain: input.domain },
    url: `https://${input.domain}`,
    log: [],
  }))
})

describe('commission_endeavor', () => {
  it('refuses when the caller is not signed in — and provisions nothing', async () => {
    const out = await executeToolCall('commission_endeavor', { name: 'Bob Plumbing' }, ctx(mockPayload(), undefined))
    expect(out).toMatch(/signed in/i)
    expect(provisionPortalMock).not.toHaveBeenCalled()
  })

  it('asks for a name when none is given', async () => {
    const out = await executeToolCall('commission_endeavor', {}, ctx(mockPayload(), 7))
    expect(out).toMatch(/called|name/i)
    expect(provisionPortalMock).not.toHaveBeenCalled()
  })

  it('mints an endeavor for a signed-in user and returns a clickable link', async () => {
    const out = await executeToolCall(
      'commission_endeavor',
      { name: 'Bay Area Pressure Washing' },
      ctx(mockPayload(), 7),
    )
    expect(provisionPortalMock).toHaveBeenCalledTimes(1)
    const [, input, opts] = provisionPortalMock.mock.calls[0]
    expect(input.slug).toBe('bay-area-pressure-washing')
    expect(input.domain).toBe('bay-area-pressure-washing.test.commerce')
    expect(input.isGuardianAngel).toBe(false)
    expect(input.networkVisible).toBe(true)
    expect(opts.actingUserId).toBe(7) // the caller becomes owner
    expect(out).toMatch(/is live/i)
    expect(out).toContain('https://bay-area-pressure-washing.test.commerce')
    expect(out).toContain('<!--nav:') // handoff link marker
  })

  it('enforces the runaway cap — a user at the limit gets a polite refusal', async () => {
    const out = await executeToolCall(
      'commission_endeavor',
      { name: 'Another One' },
      ctx(mockPayload({ ownedCount: 10 }), 7),
    )
    expect(out).toMatch(/limit|already own/i)
    expect(provisionPortalMock).not.toHaveBeenCalled()
  })

  it('suffixes the slug when the base is already taken (no silent hijack of an existing portal)', async () => {
    // First uniqueness probe returns a clash; second is clear.
    const payload = mockPayload({ findDocs: [[{ id: 1 }]] })
    await executeToolCall('commission_endeavor', { name: 'Grace Church' }, ctx(payload, 7))
    expect(provisionPortalMock).toHaveBeenCalledTimes(1)
    const [, input] = provisionPortalMock.mock.calls[0]
    expect(input.slug).toMatch(/^grace-church-[a-z0-9]{4}$/)
    expect(input.domain).toBe(`${input.slug}.test.commerce`)
  })

  it('rejects an invalid vanity handle without provisioning', async () => {
    const out = await executeToolCall(
      'commission_endeavor',
      { name: 'Fine Name', handle: 'ab' },
      ctx(mockPayload(), 7),
    )
    expect(out).toMatch(/won't work|handle/i)
    expect(provisionPortalMock).not.toHaveBeenCalled()
  })
})
