/**
 * Patreon-Style Join-to-Unlock & Return-Path Guard — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/payments/config', () => ({ generateCheckoutRef: () => 'ref_1' }))
vi.mock('@/lib/payments/registry', () => ({ startHostedCheckout: vi.fn() }))
vi.mock('@/utilities/billingMode', () => ({ getBillingMode: vi.fn(async () => 'connect') }))
vi.mock('@/utilities/getURL', () => ({ getServerSideURL: () => 'https://www.spacesangels.com' }))
vi.mock('@/utilities/logError', () => ({ logError: vi.fn(async () => {}) }))
vi.mock('@/utilities/membershipPlans', () => ({ getMembershipPlan: vi.fn() }))
vi.mock('@/utilities/originFromHeaders', () => ({ originFromHeaderValues: () => 'https://www.spacesangels.com' }))
vi.mock('@/utilities/platformFee', () => ({ feeCents: () => 0, getPlatformFeeBps: async () => 500 }))

const { sanitizeReturnPath } = await import('@/endpoints/membership-checkout')
const { isPostLockedForViewer } = await import('@/lib/memberships/access')

describe('sanitizeReturnPath', () => {
  it('accepts valid relative post/page paths and strips hash fragments', () => {
    expect(sanitizeReturnPath('/posts/my-exclusive-video')).toBe('/posts/my-exclusive-video')
    expect(sanitizeReturnPath('/posts/ep-42?autoplay=1#transcript')).toBe('/posts/ep-42?autoplay=1')
    expect(sanitizeReturnPath('/support')).toBe('/support')
  })

  it('rejects open redirects, protocol-relative URLs, backslashes, and control chars', () => {
    expect(sanitizeReturnPath('https://evil.example/steal')).toBe('/')
    expect(sanitizeReturnPath('http://evil.example')).toBe('/')
    expect(sanitizeReturnPath('//evil.example/phish')).toBe('/')
    expect(sanitizeReturnPath('javascript:alert(1)')).toBe('/')
    expect(sanitizeReturnPath('/posts\\..\\evil')).toBe('/')
    expect(sanitizeReturnPath('/posts/test\r\nSet-Cookie: a=b')).toBe('/')
    expect(sanitizeReturnPath('')).toBe('/')
    expect(sanitizeReturnPath(null)).toBe('/')
  })
})

describe('isPostLockedForViewer', () => {
  const guest = { isAdmin: false, isAuthenticated: false, isMember: false, inGoodStanding: false }
  const authed = { isAdmin: false, isAuthenticated: true, isMember: false, inGoodStanding: false }
  const lapsing = { isAdmin: false, isAuthenticated: true, isMember: true, inGoodStanding: false }
  const good = { isAdmin: false, isAuthenticated: true, isMember: true, inGoodStanding: true }
  const admin = { isAdmin: true, isAuthenticated: true, isMember: false, inGoodStanding: false }

  it('keeps public posts unlocked for everyone including guests', () => {
    expect(isPostLockedForViewer('public', guest)).toBe(false)
    expect(isPostLockedForViewer(null, guest)).toBe(false)
  })

  it('locks authenticated, members, and good_standing for guests', () => {
    expect(isPostLockedForViewer('authenticated', guest)).toBe(true)
    expect(isPostLockedForViewer('members', guest)).toBe(true)
    expect(isPostLockedForViewer('good_standing', guest)).toBe(true)
  })

  it('enforces tier standing cleanly across signed-in, lapsing, good standing, and admins', () => {
    expect(isPostLockedForViewer('authenticated', authed)).toBe(false)
    expect(isPostLockedForViewer('members', authed)).toBe(true)
    expect(isPostLockedForViewer('members', lapsing)).toBe(false)
    expect(isPostLockedForViewer('good_standing', lapsing)).toBe(true)
    expect(isPostLockedForViewer('good_standing', good)).toBe(false)
    expect(isPostLockedForViewer('good_standing', admin)).toBe(false)
  })
})
