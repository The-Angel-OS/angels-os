import { describe, it, expect } from 'vitest'
import { dmLabel, dmPartner } from '@/components/ChatControl/dmLabel'

const KEN = { id: '3', name: 'Kenneth Courtney', email: 'kenneth.courtney@gmail.com' }
const TYLER = { id: '15', name: 'Tyler Suzanne', email: 'tylersuzanne84@gmail.com' }
const pair = {
  slug: 'dm-15-3',
  name: 'Kenneth Courtney ↔ Tyler Suzanne',
  members: [KEN, TYLER],
}

describe('dmLabel', () => {
  it('names the thread after the other person, from the same row, for both people', () => {
    expect(dmLabel(pair, '3')).toBe('Tyler Suzanne')
    expect(dmLabel(pair, '15')).toBe('Kenneth Courtney')
  })

  it('does not care whether the id is a string or a number', () => {
    expect(dmLabel(pair, 3)).toBe('Tyler Suzanne')
  })

  it('falls back to email when a member has no name yet', () => {
    const ch = { ...pair, members: [KEN, { id: '15', email: 'tylersuzanne84@gmail.com' }] }
    expect(dmLabel(ch, '3')).toBe('tylersuzanne84@gmail.com')
  })

  it('labels agent threads by the agent', () => {
    expect(dmLabel({ slug: 'dm-3-leo', name: 'LEO ↔ Kenneth Courtney', members: [KEN] }, '3')).toBe('LEO')
    expect(dmLabel({ slug: 'dm-3-nimue', name: 'Nimue ↔ Kenneth', members: [KEN] }, '3')).toBe('Nimue')
  })

  it('strips your own side out of a legacy symmetric name when members are thin', () => {
    const ch = { slug: 'dm-15-3', name: 'Kenneth Courtney ↔ Tyler Suzanne', members: [KEN] }
    expect(dmLabel(ch, '3')).toBe('Tyler Suzanne')
  })

  it('keeps the stored name rather than showing nothing when it cannot be split', () => {
    expect(dmLabel({ slug: 'dm-15-3', name: 'Direct Message', members: [] }, '3')).toBe('Direct Message')
  })

  it('never shows the reader their own name back', () => {
    for (const self of ['3', '15']) {
      expect(dmLabel(pair, self)).not.toBe(
        self === '3' ? 'Kenneth Courtney' : 'Tyler Suzanne',
      )
    }
  })

  it('dmPartner is undefined for a thread with only you in it', () => {
    expect(dmPartner({ slug: 'dm-3-leo', members: [KEN] }, '3')).toBeUndefined()
  })
})
