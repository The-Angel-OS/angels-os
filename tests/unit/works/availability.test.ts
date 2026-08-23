/**
 * Works availability — the rules that decide which portals carry a Work.
 *
 * These used to read TypeScript manifests (src/souls/subscriptions.ts); the
 * rules are unchanged, but the record they read now comes from a `works` row,
 * so a portal owner can change it without a deploy.
 *
 * @see src/works/availability.ts
 */
import { describe, it, expect } from 'vitest'
import { homeForWork, tenantsForWork, isWorkAvailable, type WorkRecord } from '@/works/availability'

const work = (over: Partial<WorkRecord> = {}): WorkRecord => ({
  id: 'w', title: 'W', subtitle: '', description: '', status: '', statusColor: '',
  tags: [], defaultDoc: '', docs: [], links: [],
  owner: 'platform', subscribers: [], optOuts: [], availableGlobally: false, published: false,
  ...over,
})

describe('ownership', () => {
  it('owner is the row, falling back to the platform flagship', () => {
    expect(homeForWork(work({ owner: 'wheredideveryonego' }))).toBe('wheredideveryonego')
    expect(homeForWork(work({ owner: '' }))).toBe('platform')
    expect(homeForWork(null)).toBe('platform')
  })

  it('carrying endeavors are owner + subscribers, deduped', () => {
    expect(tenantsForWork(work({ owner: 'a', subscribers: ['b', 'a'] }))).toEqual(['a', 'b'])
  })
})

describe('the platform-index rule', () => {
  it('the flagship carries EVERY Work, even one it does not own', () => {
    expect(isWorkAvailable(work({ owner: 'wheredideveryonego' }), 'platform')).toBe(true)
  })

  it('scopes every other endeavor to owner + subscribers', () => {
    const w = work({ owner: 'platform', subscribers: ['clearwater-cruisin'] })
    expect(isWorkAvailable(w, 'clearwater-cruisin')).toBe(true)
    expect(isWorkAvailable(w, 'grace-chapel')).toBe(false)
  })

  it('availableGlobally overrides subscribers', () => {
    expect(isWorkAvailable(work({ availableGlobally: true }), 'grace-chapel')).toBe(true)
  })

  it('a portal can switch OFF a Work that is offered to everyone', () => {
    const w = work({ availableGlobally: true, optOuts: ['grace-chapel'] })
    expect(isWorkAvailable(w, 'grace-chapel')).toBe(false)
    expect(isWorkAvailable(w, 'clearwater-cruisin')).toBe(true)
  })

  it('the owner always carries its own Work, opt-out or not', () => {
    expect(isWorkAvailable(work({ owner: 'wdeg-co', optOuts: ['wdeg-co'] }), 'wdeg-co')).toBe(true)
  })

  it('unscoped context (no tenant) is unrestricted; a missing Work never is', () => {
    expect(isWorkAvailable(work(), null)).toBe(true)
    expect(isWorkAvailable(null, null)).toBe(false)
  })
})
