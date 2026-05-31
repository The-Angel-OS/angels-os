/**
 * Tenant Isolation — "Filter Never Leaks" regression guard.
 *
 * BACKGROUND (Sprint 44 outage): tenant columns were added to the Tenants
 * collection but no migration was generated/applied. Every tenant query then
 * failed against the missing columns and fell through to the platform filter,
 * so every tenant subdomain rendered the platform home page. The proximate code
 * contract that protects us is buildTenantFilter: it must ALWAYS return an
 * explicit, scoped `tenant` filter and NEVER an empty/absent one (an empty
 * filter under overrideAccess:true returns documents from ALL tenants —
 * cross-tenant data leakage).
 *
 * This suite locks that contract as an executable invariant across every input
 * shape, so a future refactor of buildTenantFilter can't silently reintroduce a
 * leaky (empty) filter. The schema-drift half of the lesson is enforced in CI
 * (.github/workflows/ci.yml → schema-sync job).
 */
import { describe, it, expect } from 'vitest'
import { buildTenantFilter } from '@/utilities/buildTenantFilter'

const TENANT_INPUTS: Array<number | string> = [1, 2, 42, '1', 'abc-slug', 0, '']
const PLATFORM_INPUTS: Array<null | undefined> = [null, undefined]

function hasExplicitTenantClause(filter: unknown): boolean {
  if (filter == null || typeof filter !== 'object') return false
  const tenant = (filter as Record<string, unknown>).tenant
  if (tenant == null || typeof tenant !== 'object') return false
  const t = tenant as Record<string, unknown>
  // Must be a concrete scope: equals <id>  OR  exists:false (platform-only).
  const isEquals = 'equals' in t && t.equals !== undefined
  const isPlatform = t.exists === false
  return isEquals || isPlatform
}

describe('Tenant filter never leaks (Sprint 44 regression)', () => {
  it('NEVER returns an empty object for any input', () => {
    for (const input of [...TENANT_INPUTS, ...PLATFORM_INPUTS]) {
      const filter = buildTenantFilter(input)
      expect(filter, `input=${String(input)}`).not.toEqual({})
    }
  })

  it('ALWAYS returns an explicit tenant clause (equals or exists:false)', () => {
    for (const input of [...TENANT_INPUTS, ...PLATFORM_INPUTS]) {
      const filter = buildTenantFilter(input)
      expect(
        hasExplicitTenantClause(filter),
        `leaky filter for input=${String(input)}: ${JSON.stringify(filter)}`,
      ).toBe(true)
    }
  })

  it('scopes real tenant ids to equals (never exists:false)', () => {
    for (const input of TENANT_INPUTS) {
      const filter = buildTenantFilter(input) as { tenant: Record<string, unknown> }
      expect(filter.tenant.equals, `input=${String(input)}`).toBe(input)
      expect(filter.tenant.exists).toBeUndefined()
    }
  })

  it('treats null/undefined as platform-only (exists:false), not all-tenants', () => {
    for (const input of PLATFORM_INPUTS) {
      const filter = buildTenantFilter(input) as { tenant: Record<string, unknown> }
      expect(filter.tenant.exists).toBe(false)
      expect(filter.tenant.equals).toBeUndefined()
    }
  })

  it('id 0 and empty-string slug are scoped, not collapsed to platform', () => {
    // Falsy-but-not-null ids must still scope (they are valid tenant keys),
    // otherwise a 0/'' id would leak platform content into a tenant context.
    expect(buildTenantFilter(0)).toEqual({ tenant: { equals: 0 } })
    expect(buildTenantFilter('')).toEqual({ tenant: { equals: '' } })
  })
})
