import { describe, it, expect } from 'vitest'
import { isPageViewable, type ViewerStanding } from '@/utilities/pageAccess'

const anon: ViewerStanding = { isAdmin: false, isAuthenticated: false, isMember: false, inGoodStanding: false }
const authed: ViewerStanding = { isAdmin: false, isAuthenticated: true, isMember: false, inGoodStanding: false }
const lapsing: ViewerStanding = { isAdmin: false, isAuthenticated: true, isMember: true, inGoodStanding: false }
const good: ViewerStanding = { isAdmin: false, isAuthenticated: true, isMember: true, inGoodStanding: true }
const admin: ViewerStanding = { isAdmin: true, isAuthenticated: true, isMember: false, inGoodStanding: false }

describe('isPageViewable', () => {
  it('public is viewable by everyone, incl. anonymous', () => {
    for (const v of [anon, authed, lapsing, good, admin]) expect(isPageViewable('public', v)).toBe(true)
  })

  it('null/undefined access defaults to public', () => {
    expect(isPageViewable(undefined, anon)).toBe(true)
    expect(isPageViewable(null, anon)).toBe(true)
  })

  it('admin passes every non-public level', () => {
    for (const a of ['authenticated', 'members', 'good_standing']) expect(isPageViewable(a, admin)).toBe(true)
  })

  it('anonymous is denied every non-public level', () => {
    for (const a of ['authenticated', 'members', 'good_standing']) expect(isPageViewable(a, anon)).toBe(false)
  })

  it('authenticated: any signed-in user passes, but not membership levels', () => {
    expect(isPageViewable('authenticated', authed)).toBe(true)
    expect(isPageViewable('members', authed)).toBe(false)
    expect(isPageViewable('good_standing', authed)).toBe(false)
  })

  it('members: a lapsing (past_due) member passes', () => {
    expect(isPageViewable('members', lapsing)).toBe(true)
    expect(isPageViewable('good_standing', lapsing)).toBe(false)
  })

  it('good_standing: only active/trialing members pass', () => {
    expect(isPageViewable('good_standing', good)).toBe(true)
    expect(isPageViewable('members', good)).toBe(true)
  })

  it('unknown access level denies (deny-by-default)', () => {
    expect(isPageViewable('nonsense', good)).toBe(false)
  })
})
