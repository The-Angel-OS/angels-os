import { describe, it, expect } from 'vitest'
import { tenantFilterOptions } from '@/fields/tenantFilterOptions'

// FilterOptions is called by Payload with a large arg bag; only `data` is read.
const call = (data: unknown) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tenantFilterOptions as any)({ data })

describe('tenantFilterOptions', () => {
  it('scopes the picker to the document tenant', () => {
    expect(call({ tenant: 11 })).toEqual({ tenant: { equals: 11 } })
  })

  it('accepts a populated tenant object', () => {
    expect(call({ tenant: { id: 5, slug: 'clearwater-cruisin' } })).toEqual({
      tenant: { equals: 5 },
    })
  })

  it('coerces a string id to Number — the plugin compares ids in JS', () => {
    expect(call({ tenant: '11' })).toEqual({ tenant: { equals: 11 } })
  })

  it('does not constrain an unsaved page that has no tenant yet', () => {
    expect(call({})).toBe(true)
    expect(call(undefined)).toBe(true)
    expect(call({ tenant: null })).toBe(true)
    expect(call({ tenant: '' })).toBe(true)
  })

  it('falls back to unconstrained rather than matching nothing on junk', () => {
    expect(call({ tenant: 'not-a-number' })).toBe(true)
  })
})
