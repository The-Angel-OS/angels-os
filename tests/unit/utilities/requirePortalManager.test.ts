/**
 * requirePortalManager — the server gate for portal financials/orders/PII.
 *
 * Regression lock for the 2026-06-14 finding: /dashboard/admin/* + /dashboard/orders
 * were publicly renderable (unauth could read a tenant's financials). The gate must
 * redirect anyone who isn't a platform admin or a tenant_admin/tenant_manager of the
 * CURRENT portal to /dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('next-intl/server', () => ({ getLocale: vi.fn().mockResolvedValue('en') }))
vi.mock('next/navigation', () => ({
  // Real redirect() throws a NEXT_REDIRECT error; emulate so we can assert the target.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/utilities/resolveTenantFromHeaders', () => ({ resolveTenantFromHeaders: vi.fn() }))

import { requirePortalManager } from '@/utilities/requirePortalManager'
import { getPayload } from 'payload'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

const mockGetPayload = vi.mocked(getPayload)
const mockResolveTenant = vi.mocked(resolveTenantFromHeaders)

function setup(opts: {
  user: unknown
  tenantId?: number | string | null
  membershipRole?: string | null
}) {
  mockResolveTenant.mockResolvedValue({ tenantId: opts.tenantId ?? null } as never)
  mockGetPayload.mockResolvedValue({
    auth: vi.fn().mockResolvedValue({ user: opts.user }),
    find: vi.fn().mockResolvedValue({
      docs: opts.membershipRole ? [{ role: opts.membershipRole }] : [],
    }),
  } as never)
}

describe('requirePortalManager', () => {
  beforeEach(() => vi.clearAllMocks())

  it('anonymous → redirect to /dashboard', async () => {
    setup({ user: null })
    await expect(requirePortalManager()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('platform admin (super_admin) → allowed (no throw)', async () => {
    setup({ user: { id: 1, roles: ['super_admin'] } })
    await expect(requirePortalManager()).resolves.toBeUndefined()
  })

  it('plain customer, no membership → redirect to /dashboard', async () => {
    setup({ user: { id: 2, roles: ['customer'] }, tenantId: 5, membershipRole: null })
    await expect(requirePortalManager()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('customer who is only a tenant_member of the portal → redirect (not a manager)', async () => {
    setup({ user: { id: 3, roles: ['customer'] }, tenantId: 5, membershipRole: 'tenant_member' })
    await expect(requirePortalManager()).rejects.toThrow('REDIRECT:/dashboard')
  })

  it('tenant_admin of the current portal → allowed', async () => {
    setup({ user: { id: 4, roles: ['customer'] }, tenantId: 5, membershipRole: 'tenant_admin' })
    await expect(requirePortalManager()).resolves.toBeUndefined()
  })

  it('tenant_manager of the current portal → allowed', async () => {
    setup({ user: { id: 5, roles: ['customer'] }, tenantId: 5, membershipRole: 'tenant_manager' })
    await expect(requirePortalManager()).resolves.toBeUndefined()
  })

  it('authenticated but no current tenant resolved → redirect to /dashboard', async () => {
    setup({ user: { id: 6, roles: ['customer'] }, tenantId: null })
    await expect(requirePortalManager()).rejects.toThrow('REDIRECT:/dashboard')
  })
})
