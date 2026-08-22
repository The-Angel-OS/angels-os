import { describe, expect, it } from 'vitest'
import { buildSection } from '@/utilities/provisionPagesFromSpec'

/**
 * The membership block existed and worked for months while being unreachable
 * from a spec, so no provisioned site ever got one. featuredPosts is the same
 * shape of gap for the Archive block — these pin the wiring, not the styling.
 */
describe('featuredPosts spec section', () => {
  it('defaults to the three most recent posts, three across', () => {
    const b = buildSection({ featuredPosts: {} }, null)
    expect(b.blockType).toBe('archive')
    expect(b.populateBy).toBe('collection')
    expect(b.relationTo).toBe('posts')
    expect(b.limit).toBe(3)
    expect(b.columns).toBe('3')
  })

  it('pins exact documents when `selected` is given', () => {
    const b = buildSection({ featuredPosts: { of: 'products', selected: [7, 9] } }, null)
    expect(b.populateBy).toBe('selection')
    expect(b.selectedDocs).toEqual([
      { relationTo: 'products', value: 7 },
      { relationTo: 'products', value: 9 },
    ])
    // A pinned selection must not also carry a collection query.
    expect(b.limit).toBeUndefined()
  })

  it('columns is the block enum ("4"), not the number 4', () => {
    expect(buildSection({ featuredPosts: { columns: 4 } }, null).columns).toBe('4')
  })
})
