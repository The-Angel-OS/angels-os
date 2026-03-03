/**
 * capitaliseFirstLetter — Unit Tests
 */
import { describe, it, expect } from 'vitest'

import { capitaliseFirstLetter } from '@/utilities/capitaliseFirstLetter'

describe('capitaliseFirstLetter', () => {
  it('returns the original value for empty string', () => {
    expect(capitaliseFirstLetter('')).toBe('')
  })

  it('capitalises the first letter of a lowercase string', () => {
    expect(capitaliseFirstLetter('hello')).toBe('Hello')
  })

  it('leaves an already-capitalised string unchanged', () => {
    expect(capitaliseFirstLetter('Hello')).toBe('Hello')
  })

  it('capitalises only the first letter, leaving the rest unchanged', () => {
    expect(capitaliseFirstLetter('hELLO wORLD')).toBe('HELLO wORLD')
  })

  it('works for single character strings', () => {
    expect(capitaliseFirstLetter('a')).toBe('A')
    expect(capitaliseFirstLetter('Z')).toBe('Z')
  })

  it('works for strings starting with a digit', () => {
    expect(capitaliseFirstLetter('123abc')).toBe('123abc')
  })
})
