/**
 * `maxInline: 0` is the only way to say "the bar holds exactly what I pinned".
 * normalizeNavOverrides used to drop it as falsy, silently restoring the
 * default and letting Discovery back into a business's nav.
 */
import { describe, expect, it } from 'vitest'
import { normalizeNavOverrides } from '@/utilities/navOverrides'

describe('normalizeNavOverrides maxInline', () => {
  it('preserves a deliberate zero when something is pinned', () => {
    expect(normalizeNavOverrides({ maxInline: 0, pinned: ['/'] }).maxInline).toBe(0)
  })

  it('still drops a zero with no pins, which would render an empty bar', () => {
    expect(normalizeNavOverrides({ maxInline: 0 }).maxInline).toBeUndefined()
  })

  it('still drops absent and invalid values', () => {
    expect(normalizeNavOverrides({}).maxInline).toBeUndefined()
    expect(normalizeNavOverrides({ maxInline: 'lots' as never }).maxInline).toBeUndefined()
    expect(normalizeNavOverrides({ maxInline: -1 }).maxInline).toBeUndefined()
  })

  it('keeps positive values intact', () => {
    expect(normalizeNavOverrides({ maxInline: 6 }).maxInline).toBe(6)
  })
})
