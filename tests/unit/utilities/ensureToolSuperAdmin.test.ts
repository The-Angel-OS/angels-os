/**
 * ensureToolSuperAdmin — Unit Tests
 *
 * The executor-layer gate for platform-level LEO tools (provision_tenant,
 * research_and_provision). The HTTP endpoint was gated but the tool path was not;
 * this closes that seam by reading the acting user's roles off ToolExecutorContext.
 */
import { describe, it, expect } from 'vitest'
import { ensureToolSuperAdmin, type ToolExecutorContext } from '@/utilities/leo-data-tools'

const ctx = (roles?: string[]): ToolExecutorContext => ({ payload: {} as any, roles })

describe('ensureToolSuperAdmin', () => {
  it('allows a super_admin (returns null)', () => {
    expect(ensureToolSuperAdmin(ctx(['super_admin']), 'Provisioning')).toBeNull()
  })

  it('allows super_admin among other roles', () => {
    expect(ensureToolSuperAdmin(ctx(['admin', 'super_admin']), 'Provisioning')).toBeNull()
  })

  it('denies a plain admin (not super_admin)', () => {
    const out = ensureToolSuperAdmin(ctx(['admin']), 'Provisioning a portal/tenant')
    expect(out).toMatch(/super_admin/i)
    expect(out).toMatch(/Provisioning a portal\/tenant/)
  })

  it('denies an empty/undefined roles context', () => {
    expect(ensureToolSuperAdmin(ctx([]), 'Provisioning')).toMatch(/super_admin/i)
    expect(ensureToolSuperAdmin(ctx(undefined), 'Provisioning')).toMatch(/super_admin/i)
  })

  it('denies when roles is missing entirely', () => {
    expect(ensureToolSuperAdmin({ payload: {} as any }, 'Provisioning')).toMatch(/super_admin/i)
  })
})
