/**
 * The active-endeavor override decides WHICH PORTAL LEO WRITES TO, so its gate
 * is a security boundary, not a convenience. A forged or stale cookie must never
 * move a user into a tenant they don't belong to.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserTenantMembership = vi.fn()
vi.mock('@/access/getUserTenantRoles', () => ({ getUserTenantMembership }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

const { resolveActiveTenantFromCookieHeader, ACTIVE_ENDEAVOR_COOKIE } = await import(
  '@/utilities/resolveActiveTenant'
)

const MEMBER = { id: 42, roles: ['customer'] }
const ADMIN = { id: 1, roles: ['super_admin'] }
const cookie = (v: string | number) => `foo=bar; ${ACTIVE_ENDEAVOR_COOKIE}=${v}; baz=qux`

beforeEach(() => {
  getUserTenantMembership.mockReset().mockResolvedValue(null)
})

describe('resolveActiveTenantFromCookieHeader', () => {
  it('ignores the cookie for anonymous callers', async () => {
    expect(await resolveActiveTenantFromCookieHeader(cookie(7), null)).toBeUndefined()
    expect(getUserTenantMembership).not.toHaveBeenCalled()
  })

  it('DENIES a tenant the user holds no membership in — the forged-cookie case', async () => {
    getUserTenantMembership.mockResolvedValue(null)
    expect(await resolveActiveTenantFromCookieHeader(cookie(999), MEMBER)).toBeUndefined()
  })

  it('allows a tenant the user has an active membership in', async () => {
    getUserTenantMembership.mockResolvedValue({ id: 5, role: 'tenant_admin' })
    expect(await resolveActiveTenantFromCookieHeader(cookie(7), MEMBER)).toBe(7)
  })

  it('lets super_admins switch without a membership lookup', async () => {
    expect(await resolveActiveTenantFromCookieHeader(cookie(7), ADMIN)).toBe(7)
    expect(getUserTenantMembership).not.toHaveBeenCalled()
  })

  it('is a no-op when the override equals the host tenant', async () => {
    expect(await resolveActiveTenantFromCookieHeader(cookie(7), ADMIN, 7)).toBeUndefined()
  })

  it('ignores junk, negatives and a missing cookie', async () => {
    for (const raw of ['abc', '-3', '0', '']) {
      expect(await resolveActiveTenantFromCookieHeader(cookie(raw), ADMIN)).toBeUndefined()
    }
    expect(await resolveActiveTenantFromCookieHeader('other=1', ADMIN)).toBeUndefined()
    expect(await resolveActiveTenantFromCookieHeader(null, ADMIN)).toBeUndefined()
  })

  it('does not match a cookie whose name merely ends with the same suffix', async () => {
    expect(await resolveActiveTenantFromCookieHeader(`not-active-endeavor=999`, ADMIN)).toBeUndefined()
  })
})
