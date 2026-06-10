import { describe, it, expect } from 'vitest'
import { dmSlugFor, buildDmRoster } from '@/utilities/dmRoster'

describe('dmRoster', () => {
  describe('dmSlugFor', () => {
    it('LEO slug is dm-{self}-leo (not sorted)', () => {
      expect(dmSlugFor(4, 'leo')).toBe('dm-4-leo')
    })
    it('user↔user slug is deterministic regardless of who opens it', () => {
      // Must match dmChannels.findOrCreateDM: lexicographic sort of string ids.
      expect(dmSlugFor(4, 2)).toBe(dmSlugFor(2, 4))
      expect(dmSlugFor(2, 4)).toBe('dm-2-4')
    })
    it('sorts lexicographically (string), matching the channel util', () => {
      expect(dmSlugFor(10, 2)).toBe('dm-10-2') // "10" < "2" as strings
    })
  })

  describe('buildDmRoster', () => {
    const members = [
      { userId: 2, name: 'Clearwater', email: 'clearwatercruisin@gmail.com' },
      { userId: 3, name: 'Tyler', email: 'tylersuzanne84@gmail.com' },
      { userId: 1, name: 'Kenneth', email: 'kenneth.courtney@gmail.com' },
    ]

    it('always puts LEO first and excludes self', () => {
      const roster = buildDmRoster(1, members, new Set())
      expect(roster[0]).toMatchObject({ userId: 'leo', isLeo: true, dmSlug: 'dm-1-leo' })
      expect(roster.some((r) => String(r.userId) === '1')).toBe(false) // self excluded
      expect(roster).toHaveLength(3) // leo + 2 others (self removed)
    })

    it('marks existing channels and floats them above un-started ones', () => {
      const existing = new Set(['dm-1-3']) // a DM with Tyler already exists
      const roster = buildDmRoster(1, members, existing)
      const people = roster.filter((r) => !r.isLeo)
      expect(people[0]).toMatchObject({ userId: 3, hasChannel: true })
      expect(people[1]).toMatchObject({ hasChannel: false })
    })

    it('computes the right pairwise slug for each member', () => {
      const roster = buildDmRoster(1, members, new Set())
      expect(roster.find((r) => r.userId === 2)?.dmSlug).toBe('dm-1-2')
      expect(roster.find((r) => r.userId === 3)?.dmSlug).toBe('dm-1-3')
    })

    it('dedupes repeated members', () => {
      const dupes = [...members, { userId: 2, name: 'Clearwater', email: 'x' }]
      const roster = buildDmRoster(1, dupes, new Set())
      expect(roster.filter((r) => String(r.userId) === '2')).toHaveLength(1)
    })

    it('reflects LEO existing-channel state', () => {
      const roster = buildDmRoster(4, [], new Set(['dm-4-leo']))
      expect(roster[0]).toMatchObject({ isLeo: true, hasChannel: true })
    })
  })
})
