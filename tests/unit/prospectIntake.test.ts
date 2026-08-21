import { describe, it, expect, vi } from 'vitest'
import { draftOutreach } from '@/utilities/prospectIntake'

describe('draftOutreach', () => {
  const base = {
    businessName: 'The Concrete Cowboy of North Florida',
    url: 'https://concretecowboy.spacesangels.com',
    inviteUrl: 'https://concretecowboy.spacesangels.com/tenant-invite/abc',
    city: 'Gainesville, FL',
  }

  it('addresses the owner by first name when the ad gives one', () => {
    const { sms, email } = draftOutreach({ ...base, contactName: 'AJ Sanders' })
    expect(sms).toContain('Hi AJ')
    expect(email).toContain('Hi AJ,')
  })

  it('falls back to a neutral greeting when it does not', () => {
    expect(draftOutreach(base).sms).toContain('Hi there')
  })

  it('always carries the live URL, and the invite link only when one exists', () => {
    const withInvite = draftOutreach(base)
    expect(withInvite.sms).toContain(base.url)
    expect(withInvite.sms).toContain(base.inviteUrl)

    const without = draftOutreach({ ...base, inviteUrl: undefined })
    expect(without.sms).toContain(base.url)
    expect(without.sms).not.toContain('/tenant-invite/')
    expect(without.email).not.toContain('makes you the owner')
  })

  it('uses no product vocabulary — a stranger reads this cold', () => {
    const { sms, subject, email } = draftOutreach({ ...base, contactName: 'AJ' })
    const jargon = /angel os|portal|endeavor|tenant|provision/i
    // Links are not prose — /tenant-invite/ is a URL the reader clicks, not a
    // word they have to understand.
    const prose = (t: string) => t.replace(/https?:\/\/\S+/g, '')
    for (const text of [sms, subject, email]) expect(prose(text)).not.toMatch(jargon)
  })

  it('keeps the text message short enough to send as one', () => {
    // Two SMS segments; anything longer arrives fragmented and reads like spam.
    expect(draftOutreach({ ...base, contactName: 'AJ' }).sms.length).toBeLessThan(320)
  })
})

describe('prospectIntake', () => {
  it('does not fail the intake when the CRM record cannot be filed', async () => {
    vi.resetModules()
    vi.doMock('@/utilities/runDemoSite', () => ({
      runDemoSite: vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://x.spacesangels.com',
        tenant: { id: 9, slug: 'x' },
        trade: 'concrete',
        invite: { inviteUrl: 'https://x.spacesangels.com/tenant-invite/t' },
        log: ['built'],
      }),
    }))
    const { prospectIntake } = await import('@/utilities/prospectIntake')
    const payload = {
      // no platform tenant on this node — the filing step must swallow it
      find: vi.fn().mockResolvedValue({ docs: [] }),
      create: vi.fn(),
      update: vi.fn(),
    }
    const r = await prospectIntake(payload as never, { businessName: 'X Co', phone: '352-555-0100' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.url).toBe('https://x.spacesangels.com')
    expect(r.contactId).toBeUndefined()
    expect(r.log.join(' ')).toContain('prospect record failed')
    expect(r.outreach.sms).toContain('https://x.spacesangels.com')
  })
})

describe('samePhone', () => {
  it('matches the same number written differently', async () => {
    const { samePhone } = await import('@/utilities/googlePlaceLookup')
    expect(samePhone('(352) 278-4770', '352-278-4770')).toBe(true)
    expect(samePhone('+1 352 278 4770', '3522784770')).toBe(true)
  })

  it('does not match a different number, or a partial one', async () => {
    const { samePhone } = await import('@/utilities/googlePlaceLookup')
    expect(samePhone('352-278-4770', '352-681-3341')).toBe(false)
    // Too few digits to be a real match — never guess from a fragment.
    expect(samePhone('4770', '352-278-4770')).toBe(false)
    expect(samePhone(undefined, '352-278-4770')).toBe(false)
  })
})

describe('checkWebsite', () => {
  it('calls a 4xx dead, and names where the domain actually points', async () => {
    // The real case: a prospect's domain 301s to an expired Craigslist post.
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 410,
      url: 'https://www.craigslist.org/view/d/expired',
    } as Response)
    const { checkWebsite } = await import('@/utilities/googlePlaceLookup')
    const r = await checkWebsite('southerncomputersolutions.com')
    expect(r.dead).toBe(true)
    expect(r.redirectsOffDomain).toBe(true)
    expect(r.note).toContain('410')
    expect(r.note).toContain('craigslist.org')
    spy.mockRestore()
  })

  it('treats unreachable as dead — to a customer it is the same thing', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ENOTFOUND'))
    const { checkWebsite } = await import('@/utilities/googlePlaceLookup')
    const r = await checkWebsite('nope.example')
    expect(r.dead).toBe(true)
    expect(r.note).toContain('unreachable')
    spy.mockRestore()
  })

  it('a working site on its own domain is just fine', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      url: 'https://www.example.com/',
    } as Response)
    const { checkWebsite } = await import('@/utilities/googlePlaceLookup')
    const r = await checkWebsite('https://example.com')
    expect(r.dead).toBe(false)
    expect(r.redirectsOffDomain).toBe(false)
    expect(r.note).toBe('loads')
    spy.mockRestore()
  })
})

describe('extractPlaceId / placeIdProblem', () => {
  it('passes a real Place ID through', async () => {
    const { extractPlaceId, placeIdProblem } = await import('@/utilities/googlePlacesReviews')
    const id = extractPlaceId('ChIJGVrNKqjxwogRW1k749HD9cM')
    expect(id).toBe('ChIJGVrNKqjxwogRW1k749HD9cM')
    expect(placeIdProblem(id)).toBeNull()
  })

  it('pulls the id out of a pasted maps URL', async () => {
    const { extractPlaceId } = await import('@/utilities/googlePlacesReviews')
    expect(extractPlaceId('https://www.google.com/maps/place/?q=place_id:ChIJabc12345678901234567')).toBe(
      'ChIJabc12345678901234567',
    )
  })

  it('names a CID as a CID instead of failing at the API', async () => {
    // The real broken row: a merchant pasted the number from their ?cid= URL.
    const { extractPlaceId, placeIdProblem } = await import('@/utilities/googlePlacesReviews')
    const bare = extractPlaceId('3045784746739549862')
    expect(bare).toBe('cid:3045784746739549862')
    expect(placeIdProblem(bare)).toContain('CID')

    expect(extractPlaceId('https://maps.google.com/?cid=3045784746739549862')).toBe(
      'cid:3045784746739549862',
    )
  })

  it('refuses to spend an API call on something that cannot be a Place ID', async () => {
    const { fetchPlaceReviews } = await import('@/utilities/googlePlacesReviews')
    const spy = vi.spyOn(globalThis, 'fetch')
    const r = await fetchPlaceReviews('3045784746739549862')
    expect(r.error).toContain('CID')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
