/**
 * canUseDOM — Unit Tests
 *
 * Boolean indicating whether the DOM APIs are available (browser-only).
 */
import { describe, it, expect } from 'vitest'

import canUseDOM from '@/utilities/canUseDOM'

describe('canUseDOM', () => {
  it('is a boolean value', () => {
    expect(typeof canUseDOM).toBe('boolean')
  })

  it('is true in the jsdom test environment (window is available)', () => {
    // vitest uses jsdom, so window is defined → canUseDOM is true
    expect(canUseDOM).toBe(true)
  })
})
