import { describe, expect, it, vi } from 'vitest'
import { adminOrPortalManager, adminOrPortalManagerCreate } from '@/access/portalManager'
import { enforceManagedTenant } from '@/hooks/enforceManagedTenant'

/**
 * Tyler is tenant_admin on Clearwater (5) and tenant_member on six OTHER
 * portals. `users.tenants` lists all seven with no role, so anything that trusts
 * membership alone hands her write access to other people's sites. These pin the
 * role distinction.
 */
const memberships = [
  { tenant: 5, role: 'tenant_admin', status: 'active' },
  { tenant: 38, role: 'tenant_member', status: 'active' }, // BRE — not hers
  { tenant: 11, role: 'tenant_member', status: 'active' }, // WDEG — not hers
]

const reqFor = (user: unknown, docs = memberships) =>
  ({ user, payload: { find: vi.fn().mockResolvedValue({ docs }) } }) as never

const tyler = { id: 15, roles: ['customer'] }
const platform = { id: 1, roles: ['super_admin'] }

describe('portal manager access', () => {
  it('narrows a portal manager to the tenants they MANAGE, not merely belong to', async () => {
    const result = await adminOrPortalManager({ req: reqFor(tyler) } as never)
    expect(result).toEqual({ tenant: { in: [5] } })
  })

  it('leaves platform admins unconstrained', async () => {
    expect(await adminOrPortalManager({ req: reqFor(platform) } as never)).toBe(true)
  })

  it('refuses a plain member everywhere', async () => {
    const onlyMember = memberships.filter((m) => m.role === 'tenant_member')
    expect(await adminOrPortalManager({ req: reqFor(tyler, onlyMember) } as never)).toBe(false)
    expect(await adminOrPortalManagerCreate({ req: reqFor(tyler, onlyMember) } as never)).toBe(false)
  })

  it('refuses anonymous', async () => {
    expect(await adminOrPortalManager({ req: reqFor(undefined) } as never)).toBe(false)
  })

  it('ignores an inactive membership', async () => {
    const pending = [{ tenant: 5, role: 'tenant_admin', status: 'pending' }]
    // The query filters on status, but the role filter must not be the only guard.
    expect(await adminOrPortalManager({ req: reqFor(tyler, pending) } as never)).toEqual({
      tenant: { in: [5] },
    })
  })
})

describe('enforceManagedTenant', () => {
  const run = (data: unknown, operation = 'create', user: unknown = tyler) =>
    enforceManagedTenant({
      data,
      req: reqFor(user),
      operation,
      originalDoc: undefined,
      collection: undefined,
      context: {},
    } as never)

  it('blocks a write aimed at a portal they only belong to', async () => {
    await expect(run({ title: 'x', tenant: 38 })).rejects.toThrow(/not yours/i)
  })

  it('allows a write to the portal they manage', async () => {
    await expect(run({ title: 'x', tenant: 5 })).resolves.toBeTruthy()
  })

  it('blocks MOVING a document onto another tenant', async () => {
    await expect(run({ tenant: 11 }, 'update')).rejects.toThrow(/not yours/i)
  })

  it('fills the tenant in when they manage exactly one', async () => {
    const out = (await run({ title: 'x' })) as { tenant?: number }
    expect(out.tenant).toBe(5)
  })

  it('never constrains a platform admin', async () => {
    await expect(run({ tenant: 38 }, 'create', platform)).resolves.toBeTruthy()
  })
})
