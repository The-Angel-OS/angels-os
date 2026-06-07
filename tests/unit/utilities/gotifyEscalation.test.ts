/**
 * gotifyEscalation — policy matcher + dispatcher (fan-out, rate-limit, cooldown).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the transport + connector lookup the dispatcher depends on.
vi.mock('@/utilities/gotifyNotify', () => ({
  gotifyNotify: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}))
vi.mock('@/utilities/resolveConnector', () => ({
  findAllConnectors: vi.fn(),
}))

import { policyAdmits, dispatchToGotify, __resetEscalationState } from '@/utilities/gotifyEscalation'
import { gotifyNotify } from '@/utilities/gotifyNotify'
import { findAllConnectors } from '@/utilities/resolveConnector'

const onPolicy = (extra: Record<string, unknown> = {}) => ({
  enabled: true,
  events: { error: { enabled: true, minPriority: 8 } },
  ...extra,
})

describe('policyAdmits', () => {
  it('rejects when policy missing or disabled', () => {
    expect(policyAdmits(undefined, { eventType: 'error' }).admit).toBe(false)
    expect(policyAdmits({ enabled: false }, { eventType: 'error' }).admit).toBe(false)
  })

  it('rejects event types not enabled', () => {
    expect(policyAdmits(onPolicy(), { eventType: 'warning' }).admit).toBe(false)
  })

  it('admits enabled event and applies minPriority floor', () => {
    const v = policyAdmits(onPolicy(), { eventType: 'error', priority: 3 })
    expect(v.admit).toBe(true)
    expect(v.priority).toBe(8) // floored up to minPriority
  })

  it('keeps higher requested priority above the floor, clamped to 10', () => {
    expect(policyAdmits(onPolicy(), { eventType: 'error', priority: 11 }).priority).toBe(10)
    expect(policyAdmits(onPolicy(), { eventType: 'error', priority: 9 }).priority).toBe(9)
  })
})

describe('dispatchToGotify', () => {
  const payload = {} as never
  beforeEach(() => {
    vi.clearAllMocks()
    __resetEscalationState()
    ;(gotifyNotify as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 })
  })

  it('fans out to every matching connector for the tenant using its own token', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://a', appToken: 'A1', escalation: onPolicy() } },
      { id: 'c2', tenantId: '5', config: { serverUrl: 'https://b', appToken: 'A2', escalation: onPolicy() } },
      { id: 'c3', tenantId: '9', config: { serverUrl: 'https://c', appToken: 'A3', escalation: onPolicy() } }, // other tenant
    ])

    const r = await dispatchToGotify(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.matched).toBe(2)
    expect(r.sent).toBe(2)
    expect(gotifyNotify).toHaveBeenCalledTimes(2)
    const tokensUsed = (gotifyNotify as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1].appToken).sort()
    expect(tokensUsed).toEqual(['A1', 'A2'])
  })

  it('skips connectors whose policy does not admit the event', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://a', appToken: 'A1', escalation: { enabled: true, events: { warning: { enabled: true } } } } },
    ])
    const r = await dispatchToGotify(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.matched).toBe(0)
    expect(gotifyNotify).not.toHaveBeenCalled()
  })

  it('cooldown suppresses an identical event within the window', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://a', appToken: 'A1', escalation: onPolicy({ cooldownSeconds: 300 }) } },
    ])
    const ev = { tenantId: 5, eventType: 'error' as const, title: 'same', message: 'm', dedupeKey: 'k' }
    const r1 = await dispatchToGotify(payload, ev, 1000)
    const r2 = await dispatchToGotify(payload, ev, 1000 + 60_000) // 60s later, < 300s cooldown
    expect(r1.sent).toBe(1)
    expect(r2.sent).toBe(0)
    expect(r2.suppressed).toBe(1)
    expect(gotifyNotify).toHaveBeenCalledTimes(1)
  })

  it('rate-limits per connector within a rolling minute', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://a', appToken: 'A1', escalation: onPolicy({ rateLimitPerMin: 2, cooldownSeconds: 0 }) } },
    ])
    // Distinct dedupeKeys so cooldown doesn't fire; same connector → rate limit.
    const mk = (k: string, t: number) => dispatchToGotify(payload, { tenantId: 5, eventType: 'error', title: k, message: 'm', dedupeKey: k }, t)
    const a = await mk('a', 1000)
    const b = await mk('b', 1001)
    const c = await mk('c', 1002) // 3rd within the minute → suppressed
    expect(a.sent + b.sent).toBe(2)
    expect(c.suppressed).toBe(1)
  })

  it('counts a send failure as failed, not sent', async () => {
    ;(gotifyNotify as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, error: 'boom' })
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', tenantId: '5', config: { serverUrl: 'https://a', appToken: 'A1', escalation: onPolicy() } },
    ])
    const r = await dispatchToGotify(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.sent).toBe(0)
    expect(r.failed).toBe(1)
  })

  it('returns zeroed result (no throw) when connector lookup fails', async () => {
    ;(findAllConnectors as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db down'))
    const r = await dispatchToGotify(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r).toEqual({ matched: 0, sent: 0, suppressed: 0, failed: 0 })
  })
})
