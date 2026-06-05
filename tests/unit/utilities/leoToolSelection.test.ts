/**
 * leoToolSelection — subsetting must only ever REMOVE admin tools from confirmed
 * non-admins, and parallelization must only fire when every tool is a pure read.
 */
import { describe, it, expect } from 'vitest'
import { selectToolsForUser, allReadOnly, ADMIN_ONLY_TOOLS, READ_ONLY_TOOLS } from '@/utilities/leoToolSelection'

const tools = [
  { name: 'query_products' },
  { name: 'create_post' },
  { name: 'issue_refund' }, // admin-only
  { name: 'payload_delete' }, // admin-only
]

describe('selectToolsForUser', () => {
  it('gives the FULL set to super_admin', () => {
    expect(selectToolsForUser(tools, ['super_admin'])).toHaveLength(4)
  })
  it('gives the FULL set to admin', () => {
    expect(selectToolsForUser(tools, ['admin'])).toHaveLength(4)
  })
  it('strips admin-only tools from confirmed non-admins', () => {
    const names = selectToolsForUser(tools, ['user']).map((t) => t.name)
    expect(names).toContain('query_products')
    expect(names).toContain('create_post')
    expect(names).not.toContain('issue_refund')
    expect(names).not.toContain('payload_delete')
  })
  it('keeps EVERYTHING when roles are unknown (never strip what we are unsure about)', () => {
    expect(selectToolsForUser(tools, undefined)).toHaveLength(4)
    expect(selectToolsForUser(tools, [])).toHaveLength(4)
  })
})

describe('allReadOnly', () => {
  it('is true when every tool is a known pure read', () => {
    expect(allReadOnly(['query_products', 'view_cart'])).toBe(true)
  })
  it('is false if any tool is not a known read', () => {
    expect(allReadOnly(['query_products', 'create_post'])).toBe(false)
  })
  it('is false for an empty round (nothing to parallelize)', () => {
    expect(allReadOnly([])).toBe(false)
  })
})

describe('catalog sanity', () => {
  it('read-only and admin-only sets do not overlap (a tool cannot be both)', () => {
    const overlap = [...READ_ONLY_TOOLS].filter((t) => ADMIN_ONLY_TOOLS.has(t))
    expect(overlap).toEqual([])
  })
})
