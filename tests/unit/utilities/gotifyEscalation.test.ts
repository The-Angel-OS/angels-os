/**
 * escalation — policy matcher + connector-agnostic dispatcher
 * (fan-out across mediums, rate-limit, cooldown).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The gotify transport calls gotifyNotify under the hood — mock it.
vi.mock('@/utilities/gotifyNotify', () => ({
  gotifyNotify: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
}))

import {
  policyAdmits,
  dispatchEscalation,
  dispatchToGotify,
  __resetEscalationState,
} from '@/utilities/gotifyEscalation'
import { gotifyNotify } from '@/utilities/gotifyNotify'

const onPolicy = (extra: Record<string, unknown> = {}) => ({
  enabled: true,
  events: { error: { enabled: true, minPriority: 8 } },
  ...extra,
})

// A fake payload whose .find returns the given connector docs (the DB query
// already scopes by tenant/enabled, so the docs passed here are "what survived").
const payloadWith = (docs: unknown[]) =>
  ({ find: vi.fn().mockResolvedValue({ docs }) }) as never

const gotifyConn = (id: string, appToken: string, escalation: unknown) => ({
  id,
  type: 'gotify',
  config: { serverUrl: 'https://a', appToken, escalation },
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
    expect(v.priority).toBe(8)
  })

  it('keeps higher requested priority above the floor, clamped to 10', () => {
    expect(policyAdmits(onPolicy(), { eventType: 'error', priority: 11 }).priority).toBe(10)
    expect(policyAdmits(onPolicy(), { eventType: 'error', priority: 9 }).priority).toBe(9)
  })
})

describe('dispatchEscalation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetEscalationState()
    ;(gotifyNotify as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200 })
  })

  it('fans out to every matching connector using its own token', async () => {
    const payload = payloadWith([
      gotifyConn('c1', 'A1', onPolicy()),
      gotifyConn('c2', 'A2', onPolicy()),
    ])
    const r = await dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.matched).toBe(2)
    expect(r.sent).toBe(2)
    expect(gotifyNotify).toHaveBeenCalledTimes(2)
    const tokensUsed = (gotifyNotify as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[1].appToken).sort()
    expect(tokensUsed).toEqual(['A1', 'A2'])
  })

  it('skips connectors whose policy does not admit the event', async () => {
    const payload = payloadWith([gotifyConn('c1', 'A1', { enabled: true, events: { warning: { enabled: true } } })])
    const r = await dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.matched).toBe(0)
    expect(gotifyNotify).not.toHaveBeenCalled()
  })

  it('skips connector types with no transport (unsupported medium)', async () => {
    const payload = payloadWith([
      { id: 'x1', type: 'livekit', config: { escalation: onPolicy() } }, // no transport
      gotifyConn('c1', 'A1', onPolicy()),
    ])
    const r = await dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.matched).toBe(1) // only the gotify one
    expect(r.sent).toBe(1)
  })

  it('cooldown suppresses an identical event within the window', async () => {
    const payload = payloadWith([gotifyConn('c1', 'A1', onPolicy({ cooldownSeconds: 300 }))])
    const ev = { tenantId: 5, eventType: 'error' as const, title: 'same', message: 'm', dedupeKey: 'k' }
    const r1 = await dispatchEscalation(payload, ev, 1000)
    const r2 = await dispatchEscalation(payload, ev, 1000 + 60_000)
    expect(r1.sent).toBe(1)
    expect(r2.suppressed).toBe(1)
    expect(gotifyNotify).toHaveBeenCalledTimes(1)
  })

  it('rate-limits per connector within a rolling minute', async () => {
    const payload = payloadWith([gotifyConn('c1', 'A1', onPolicy({ rateLimitPerMin: 2, cooldownSeconds: 0 }))])
    const mk = (k: string, t: number) =>
      dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: k, message: 'm', dedupeKey: k }, t)
    const a = await mk('a', 1000)
    const b = await mk('b', 1001)
    const c = await mk('c', 1002)
    expect(a.sent + b.sent).toBe(2)
    expect(c.suppressed).toBe(1)
  })

  it('counts a send failure as failed, not sent', async () => {
    ;(gotifyNotify as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, error: 'boom' })
    const payload = payloadWith([gotifyConn('c1', 'A1', onPolicy())])
    const r = await dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r.sent).toBe(0)
    expect(r.failed).toBe(1)
  })

  it('returns zeroed result (no throw) when connector lookup fails', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('db down')) } as never
    const r = await dispatchEscalation(payload, { tenantId: 5, eventType: 'error', title: 't', message: 'm' }, 1000)
    expect(r).toEqual({ matched: 0, sent: 0, suppressed: 0, failed: 0 })
  })

  it('dispatchToGotify remains a back-compat alias for dispatchEscalation', () => {
    expect(dispatchToGotify).toBe(dispatchEscalation)
  })
})
