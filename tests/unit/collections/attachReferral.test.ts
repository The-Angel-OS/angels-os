/**
 * The referral snapshot is money, so the two ways it can be wrong both have a
 * test: attributing an order to the wrong partner, and losing the attribution
 * entirely because something threw on the way to a payment.
 */
import { describe, it, expect, vi } from 'vitest'
import { attachReferral, parseReferralCookie, REFERRAL_COOKIE } from '@/collections/Orders/hooks/attachReferral'

const cookieHeader = (obj: unknown) =>
  `other=1; ${REFERRAL_COOKIE}=${encodeURIComponent(JSON.stringify(obj))}; another=2`

const req = (cookie: string | null, docs: unknown[] = []) =>
  ({
    headers: { get: (k: string) => (k === 'cookie' ? cookie : null) },
    payload: { find: vi.fn().mockResolvedValue({ docs }) },
  }) as never

const run = (data: Record<string, unknown>, r: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (attachReferral as any)({ data, operation: 'create', req: r })

describe('parseReferralCookie', () => {
  it('reads our cookie out of a header with others in it', () => {
    expect(parseReferralCookie(cookieHeader({ c: 'jane', t: '2026-08-13T00:00:00.000Z', p: '/pelvic-floor' }))?.c).toBe('jane')
  })

  it('treats junk as no cookie rather than throwing', () => {
    expect(parseReferralCookie(`${REFERRAL_COOKIE}=not-json`)).toBeNull()
    expect(parseReferralCookie(`${REFERRAL_COOKIE}=${encodeURIComponent('{"t":"x"}')}`)).toBeNull()
    expect(parseReferralCookie(null)).toBeNull()
  })
})

describe('attachReferral', () => {
  it('snapshots code, rate and commission from the matched partner', async () => {
    const data = await run(
      { total: 599, tenant: 30 },
      req(cookieHeader({ c: 'jane', t: '2026-08-13T00:00:00.000Z', p: '/pelvic-floor' }), [{ id: 7, rate: 10 }]),
    )
    expect(data.referral).toMatchObject({
      partner: 7,
      code: 'jane',
      rate: 10,
      commission: 59.9,
      landingPath: '/pelvic-floor',
      payoutStatus: 'pending',
    })
  })

  it('keeps an unmatched code — that is how a typo in a partner link is found', async () => {
    const data = await run({ total: 599 }, req(cookieHeader({ c: 'jaen' }), []))
    expect(data.referral).toMatchObject({ partner: null, code: 'jaen', rate: null, commission: null })
  })

  it('does nothing without a cookie', async () => {
    expect((await run({ total: 599 }, req(null))).referral).toBeUndefined()
  })

  it('never rewrites attribution on update — that is someone’s commission', async () => {
    const data = { total: 599, referral: { code: 'original' } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out = await (attachReferral as any)({ data, operation: 'update', req: req(cookieHeader({ c: 'thief' }), [{ id: 9, rate: 50 }]) })
    expect(out.referral.code).toBe('original')
  })

  it('swallows a lookup failure — attribution is never worth a failed checkout', async () => {
    const failing = {
      headers: { get: () => cookieHeader({ c: 'jane' }) },
      payload: { find: vi.fn().mockRejectedValue(new Error('db down')) },
    } as never
    await expect(run({ total: 599 }, failing)).resolves.toBeDefined()
  })
})
