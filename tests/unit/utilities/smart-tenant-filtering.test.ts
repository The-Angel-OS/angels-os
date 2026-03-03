/**
 * smart-tenant-filtering — Unit Tests
 *
 * Tests pure/structural functions: applySmartTenantFiltering,
 * applySmartTenantFilteringToAll, makeSmartTenantFieldInvisible
 */
import { describe, it, expect } from 'vitest'

import {
  applySmartTenantFiltering,
  applySmartTenantFilteringToAll,
  makeSmartTenantFieldInvisible,
} from '@/utilities/smart-tenant-filtering'

// ── makeSmartTenantFieldInvisible ─────────────────────────────────────────────

describe('makeSmartTenantFieldInvisible', () => {
  it('returns field unchanged for unknown collection', () => {
    const field = { name: 'tenant', type: 'relationship', relationTo: 'tenants' }
    const result = makeSmartTenantFieldInvisible(field, 'unknown-collection')
    expect(result).toEqual(field)
  })

  it('returns field unchanged when field name does not match tenant field', () => {
    const field = { name: 'title', type: 'text' }
    const result = makeSmartTenantFieldInvisible(field, 'products')
    expect(result).toEqual(field)
  })

  it('hides tenant relationship field for known collections', () => {
    const field = {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {},
    }
    const result = makeSmartTenantFieldInvisible(field, 'products')
    // admin.condition should be set to hide the field
    expect(typeof result.admin?.condition).toBe('function')
    expect(result.admin.condition()).toBe(false)
  })
})

// ── applySmartTenantFiltering ─────────────────────────────────────────────────

describe('applySmartTenantFiltering', () => {
  const baseCollection = {
    slug: 'products',
    fields: [{ name: 'title', type: 'text' }],
    access: {},
  }

  it('returns a collection object', () => {
    const result = applySmartTenantFiltering(baseCollection)
    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
  })

  it('preserves the slug', () => {
    const result = applySmartTenantFiltering(baseCollection)
    expect(result.slug).toBe('products')
  })

  it('adds access control functions for known collection', () => {
    const result = applySmartTenantFiltering(baseCollection)
    expect(typeof result.access?.read).toBeDefined()
  })

  it('returns collection unchanged for unknown slug (no pattern)', () => {
    const unknownCollection = { slug: 'unknown', fields: [], access: {} }
    const result = applySmartTenantFiltering(unknownCollection)
    expect(result).toEqual(unknownCollection)
  })
})

// ── applySmartTenantFilteringToAll ────────────────────────────────────────────

describe('applySmartTenantFilteringToAll', () => {
  it('processes every collection in the array', () => {
    const collections = [
      { slug: 'products', fields: [], access: {} },
      { slug: 'orders', fields: [], access: {} },
      { slug: 'unknown-col', fields: [], access: {} },
    ]
    const results = applySmartTenantFilteringToAll(collections)
    expect(results).toHaveLength(3)
  })

  it('returns an array', () => {
    expect(Array.isArray(applySmartTenantFilteringToAll([]))).toBe(true)
  })

  it('preserves collection count', () => {
    const collections = [{ slug: 'spaces', fields: [], access: {} }]
    expect(applySmartTenantFilteringToAll(collections)).toHaveLength(1)
  })
})
