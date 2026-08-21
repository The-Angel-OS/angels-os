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
