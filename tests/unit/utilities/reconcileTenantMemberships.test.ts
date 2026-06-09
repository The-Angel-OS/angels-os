/**
 * reconcileTenantMemberships — "one person, one membership" merge logic.
 * Regression guard for the "Tyler is both a pending Admin invite AND an active
 * Member" duplicate.
 */
import { describe, it, expect } from 'vitest'
import {
  chooseMembershipMerge,
  membershipEmailKey,
  type MembershipLike,
} from '@/utilities/reconcileTenantMemberships'

const m = (over: Partial<MembershipLike>): MembershipLike => ({
  id: 1,
  status: 'active',
  role: 'tenant_member',
  hasUser: true,
  ...over,
})

describe('chooseMembershipMerge', () => {
  it('no merge for a singleton or empty group', () => {
    expect(chooseMembershipMerge([])).toBeNull()
    expect(chooseMembershipMerge([m({})])).toBeNull()
  })

  it('THE Tyler case: active member (real user) + pending admin invite → one active admin', () => {
    const active = m({ id: 'A', status: 'active', role: 'tenant_member', hasUser: true })
    const invite = m({ id: 'B', status: 'pending', role: 'tenant_admin', hasUser: false })
    const d = chooseMembershipMerge([active, invite])!
    expect(d.keepId).toBe('A') // the real-user row is canonical
    expect(d.role).toBe('tenant_admin') // honor the explicit admin invite
    expect(d.status).toBe('active')
    expect(d.rolePromoted).toBe(true)
    expect(d.deleteIds).toEqual(['B'])
  })

  it('keeps the real-user row even when the invite is "more progressed" by status alone', () => {
    const invite = m({ id: 'B', status: 'pending', role: 'tenant_member', hasUser: false })
    const active = m({ id: 'A', status: 'active', role: 'tenant_member', hasUser: true })
    const d = chooseMembershipMerge([invite, active])!
    expect(d.keepId).toBe('A')
    expect(d.deleteIds).toEqual(['B'])
  })

  it('unions permissions across duplicates', () => {
    const a = m({ id: 'A', permissions: ['manage_users'] })
    const b = m({ id: 'B', hasUser: false, status: 'pending', permissions: ['manage_orders', 'manage_users'] })
    const d = chooseMembershipMerge([a, b])!
    expect([...d.permissions].sort()).toEqual(['manage_orders', 'manage_users'])
  })

  it('does not promote when the kept row already holds the highest role', () => {
    const a = m({ id: 'A', role: 'tenant_admin', hasUser: true })
    const b = m({ id: 'B', role: 'tenant_member', hasUser: false, status: 'pending' })
    const d = chooseMembershipMerge([a, b])!
    expect(d.role).toBe('tenant_admin')
    expect(d.rolePromoted).toBe(false)
  })

  it('active beats pending for the resulting status', () => {
    const a = m({ id: 'A', status: 'pending', hasUser: false })
    const b = m({ id: 'B', status: 'active', hasUser: true })
    expect(chooseMembershipMerge([a, b])!.status).toBe('active')
  })
})

describe('membershipEmailKey', () => {
  it('reads + normalizes the linked user email', () => {
    expect(membershipEmailKey({ user: { email: ' Tyler@Example.COM ' } })).toBe('tyler@example.com')
  })
  it('falls back to the invitation email for a userless invite', () => {
    expect(membershipEmailKey({ user: null, invitationDetails: { invitationEmail: 'INV@x.com' } })).toBe('inv@x.com')
  })
  it('returns null when no email is resolvable', () => {
    expect(membershipEmailKey({ user: 42 })).toBeNull()
  })
})
