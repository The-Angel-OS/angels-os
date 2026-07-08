import { describe, it, expect } from 'vitest'
import { resolveContact, type AddressBookEntry } from '@/utilities/addressBook'

const entry = (over: Partial<AddressBookEntry>): AddressBookEntry => ({
  kind: 'user',
  id: 1,
  name: 'Test',
  email: null,
  avatarUrl: null,
  channelSlug: 'dm-1-2',
  spaceId: 1,
  lastMessageAt: null,
  affordances: ['message', 'call'],
  ...over,
})

const book: AddressBookEntry[] = [
  entry({ id: 2, name: 'Maria Garcia', email: 'maria@example.com' }),
  entry({ id: 3, name: 'Mario Rossi', email: 'mario@example.com' }),
  entry({ id: 4, name: 'Ernesto', email: 'ernesto@example.com' }),
  entry({ kind: 'contact', id: 99, name: 'Tyler Lead', email: 'tyler@lead.com', channelSlug: null }),
]

describe('resolveContact', () => {
  it('resolves an exact email', () => {
    const r = resolveContact(book, 'maria@example.com')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(2)
  })

  it('resolves an exact name case-insensitively', () => {
    const r = resolveContact(book, 'ernesto')
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Ernesto')
  })

  it('resolves a numeric userId to the user entry', () => {
    const r = resolveContact(book, '3')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(3)
  })

  it('returns multiple matches for an ambiguous substring (caller must disambiguate)', () => {
    const r = resolveContact(book, 'mar')
    // "mar" matches Maria + Mario
    expect(r.length).toBeGreaterThan(1)
  })

  it('returns empty for no match', () => {
    expect(resolveContact(book, 'nobody')).toHaveLength(0)
  })

  it('prefers an exact name over substring matches', () => {
    const withExact = [...book, entry({ id: 5, name: 'Mar', email: 'mar@x.com' })]
    const r = resolveContact(withExact, 'Mar')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(5)
  })
})
