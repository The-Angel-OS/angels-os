import { describe, it, expect } from 'vitest'
import { buildSection } from '@/utilities/provisionPagesFromSpec'

describe('buildSection — subscription surfaces', () => {
  it('builds a membership block so a provisioned site can take recurring money', () => {
    // The block always existed and worked; it just could not be reached from a
    // spec, so it lived on two hand-built pages and no provisioned tenant ever
    // got a way to subscribe. That is why recurring revenue was manual.
    const block = buildSection({ membership: { heading: 'Support the crew' } }, null)
    expect(block.blockType).toBe('membership')
    expect(JSON.stringify(block.richText)).toContain('Support the crew')
  })

  it('does not carry plans in the spec — they belong to the tenant', () => {
    // Plans live in the membership-plans settings bag per tenant. Baking them
    // into a page spec would make the same page sell different things depending
    // on when it was provisioned.
    const block = buildSection({ membership: {} }, null)
    expect(JSON.stringify(block)).not.toContain('amountCents')
    expect(block.ctaText).toBe('Become a member')
  })

  it('builds a donation block for one-off giving', () => {
    const block = buildSection({ donation: { heading: 'Chip in', presetAmounts: '5,10,20' } }, null)
    expect(block.blockType).toBe('donation')
    expect(block.presetAmounts).toBe('5,10,20')
  })

  it('leaves the existing section types working', () => {
    expect(buildSection({ content: [{ h2: 'Hi' }] }, null).blockType).toBe('content')
    expect(buildSection({ trustRow: { heading: 'Why us' } }, null).blockType).toBe('trustRow')
  })
})
