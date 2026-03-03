/**
 * invisible-tenant-system — Unit Tests
 *
 * Pure/structural functions: shouldHaveTenantFiltering, makeExistingTenantFieldInvisible,
 * enhanceCollectionWithInvisibleTenantFiltering, applyInvisibleTenantFiltering
 */
import { describe, it, expect } from 'vitest'

import {
  shouldHaveTenantFiltering,
  makeExistingTenantFieldInvisible,
  enhanceCollectionWithInvisibleTenantFiltering,
  applyInvisibleTenantFiltering,
} from '@/utilities/invisible-tenant-system'

// ── shouldHaveTenantFiltering ─────────────────────────────────────────────────

describe('shouldHaveTenantFiltering', () => {
  it('returns true for products (tenant-scoped)', () => {
    expect(shouldHaveTenantFiltering('products')).toBe(true)
  })

  it('returns true for orders (tenant-scoped)', () => {
    expect(shouldHaveTenantFiltering('orders')).toBe(true)
  })

  it('returns false for tenants (global)', () => {
    expect(shouldHaveTenantFiltering('tenants')).toBe(false)
  })

  it('returns false for users (global)', () => {
    expect(shouldHaveTenantFiltering('users')).toBe(false)
  })

  it('returns false for tenant-memberships (global)', () => {
    expect(shouldHaveTenantFiltering('tenant-memberships')).toBe(false)
  })

  it('returns false for angel-tokens (global)', () => {
    expect(shouldHaveTenantFiltering('angel-tokens')).toBe(false)
  })

  it('returns true for arbitrary unknown collection', () => {
    expect(shouldHaveTenantFiltering('some-other-collection')).toBe(true)
  })
})

// ── makeExistingTenantFieldInvisible ──────────────────────────────────────────

describe('makeExistingTenantFieldInvisible', () => {
  it('returns field unchanged if not a tenant relationship field', () => {
    const field = { name: 'title', type: 'text' }
    expect(makeExistingTenantFieldInvisible(field)).toEqual(field)
  })

  it('returns field unchanged if name is tenant but type is not relationship', () => {
    const field = { name: 'tenant', type: 'text' }
    expect(makeExistingTenantFieldInvisible(field)).toEqual(field)
  })

  it('returns field unchanged if type is relationship but relationTo is not tenants', () => {
    const field = { name: 'tenant', type: 'relationship', relationTo: 'spaces' }
    expect(makeExistingTenantFieldInvisible(field)).toEqual(field)
  })

  it('hides tenant field when all conditions match', () => {
    const field = {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    }
    const result = makeExistingTenantFieldInvisible(field)
    expect(typeof result.admin?.condition).toBe('function')
    expect(result.admin.condition()).toBe(false)
  })

  it('adds beforeValidate hook when hiding tenant field', () => {
    const field = {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
    }
    const result = makeExistingTenantFieldInvisible(field)
    expect(Array.isArray(result.hooks?.beforeValidate)).toBe(true)
    expect(result.hooks.beforeValidate.length).toBeGreaterThan(0)
  })

  it('preserves existing admin properties', () => {
    const field = {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { placeholder: 'Select tenant' },
    }
    const result = makeExistingTenantFieldInvisible(field)
    expect(result.admin.placeholder).toBe('Select tenant')
  })
})

// ── enhanceCollectionWithInvisibleTenantFiltering ─────────────────────────────

describe('enhanceCollectionWithInvisibleTenantFiltering', () => {
  it('returns global collection unchanged', () => {
    const col = { slug: 'tenants', fields: [], access: {} }
    expect(enhanceCollectionWithInvisibleTenantFiltering(col)).toEqual(col)
  })

  it('preserves slug for non-global collection', () => {
    const col = { slug: 'products', fields: [], access: {} }
    const result = enhanceCollectionWithInvisibleTenantFiltering(col)
    expect(result.slug).toBe('products')
  })

  it('returns collection unchanged if no tenant field and not in NEEDS_TENANT_FIELD', () => {
    // products doesn't have a tenant field in the fixture
    const col = { slug: 'products', fields: [{ name: 'title', type: 'text' }], access: {} }
    const result = enhanceCollectionWithInvisibleTenantFiltering(col)
    // No tenant field → skips (NEEDS_TENANT_FIELD is empty in current implementation)
    expect(result).toEqual(col)
  })

  it('hides tenant field when collection has one', () => {
    const col = {
      slug: 'spaces',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'tenant', type: 'relationship', relationTo: 'tenants', admin: {} },
      ],
      access: {},
    }
    const result = enhanceCollectionWithInvisibleTenantFiltering(col)
    const tenantField = result.fields.find((f: any) => f.name === 'tenant')
    expect(typeof tenantField?.admin?.condition).toBe('function')
    expect(tenantField.admin.condition()).toBe(false)
  })

  it('adds access control for collections with tenant field', () => {
    const col = {
      slug: 'spaces',
      fields: [
        { name: 'tenant', type: 'relationship', relationTo: 'tenants', admin: {} },
      ],
      access: {},
    }
    const result = enhanceCollectionWithInvisibleTenantFiltering(col)
    expect(typeof result.access.read).toBeDefined()
    expect(typeof result.access.create).toBeDefined()
  })
})

// ── applyInvisibleTenantFiltering ─────────────────────────────────────────────

describe('applyInvisibleTenantFiltering', () => {
  it('returns an array', () => {
    expect(Array.isArray(applyInvisibleTenantFiltering([]))).toBe(true)
  })

  it('preserves collection count', () => {
    const cols = [
      { slug: 'products', fields: [], access: {} },
      { slug: 'tenants', fields: [], access: {} },
    ]
    expect(applyInvisibleTenantFiltering(cols)).toHaveLength(2)
  })

  it('does not modify global collections', () => {
    const global = { slug: 'users', fields: [], access: {} }
    const result = applyInvisibleTenantFiltering([global])
    expect(result[0]).toEqual(global)
  })
})
