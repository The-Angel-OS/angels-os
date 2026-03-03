/**
 * String Utility Functions — Unit Tests
 *
 * Tests for capitaliseFirstLetter, toKebabCase, and createUrl.
 * These are pure functions with no external dependencies.
 */
import { describe, it, expect } from 'vitest'
import { capitaliseFirstLetter } from '@/utilities/capitaliseFirstLetter'
import { toKebabCase } from '@/utilities/toKebabCase'
import { createUrl } from '@/utilities/createUrl'

// ── capitaliseFirstLetter ─────────────────────────────────────────────────────

describe('capitaliseFirstLetter', () => {
  it('capitalises the first letter of a lowercase string', () => {
    expect(capitaliseFirstLetter('hello')).toBe('Hello')
  })

  it('capitalises the first letter of a mixed-case string', () => {
    expect(capitaliseFirstLetter('hELLO')).toBe('HELLO')
  })

  it('does not change an already-capitalised string', () => {
    expect(capitaliseFirstLetter('Hello')).toBe('Hello')
  })

  it('returns an empty string unchanged', () => {
    expect(capitaliseFirstLetter('')).toBe('')
  })

  it('handles a single lowercase character', () => {
    expect(capitaliseFirstLetter('a')).toBe('A')
  })

  it('handles a single uppercase character', () => {
    expect(capitaliseFirstLetter('A')).toBe('A')
  })

  it('handles strings starting with a digit', () => {
    expect(capitaliseFirstLetter('123abc')).toBe('123abc')
  })

  it('handles strings starting with whitespace', () => {
    expect(capitaliseFirstLetter(' hello')).toBe(' hello')
  })
})

// ── toKebabCase ───────────────────────────────────────────────────────────────

describe('toKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebabCase('myVariableName')).toBe('my-variable-name')
  })

  it('converts PascalCase to kebab-case', () => {
    expect(toKebabCase('MyVariableName')).toBe('my-variable-name')
  })

  it('replaces spaces with hyphens', () => {
    expect(toKebabCase('hello world')).toBe('hello-world')
  })

  it('replaces multiple consecutive spaces with a single hyphen', () => {
    expect(toKebabCase('hello   world')).toBe('hello-world')
    // Note: consecutive spaces each become a hyphen (replace /\s+/ → '-')
  })

  it('lowercases the entire string', () => {
    expect(toKebabCase('HELLO')).toBe('hello')
  })

  it('handles an already kebab-case string', () => {
    expect(toKebabCase('already-kebab')).toBe('already-kebab')
  })

  it('handles a string with mixed camelCase and spaces', () => {
    expect(toKebabCase('myName here')).toBe('my-name-here')
  })

  it('handles an empty string', () => {
    expect(toKebabCase('')).toBe('')
  })
})

// ── createUrl ─────────────────────────────────────────────────────────────────

describe('createUrl', () => {
  it('returns pathname only when params are empty', () => {
    const params = new URLSearchParams()
    expect(createUrl('/products', params)).toBe('/products')
  })

  it('appends query string when params are present', () => {
    const params = new URLSearchParams({ q: 'coffee', page: '2' })
    const url = createUrl('/search', params)
    expect(url).toBe('/search?q=coffee&page=2')
  })

  it('includes the leading ? separator', () => {
    const params = new URLSearchParams({ tab: 'settings' })
    const url = createUrl('/profile', params)
    expect(url).toContain('?')
    expect(url).toBe('/profile?tab=settings')
  })

  it('handles a single parameter', () => {
    const params = new URLSearchParams({ id: '42' })
    expect(createUrl('/item', params)).toBe('/item?id=42')
  })

  it('preserves pathname with trailing slash', () => {
    const params = new URLSearchParams()
    expect(createUrl('/products/', params)).toBe('/products/')
  })

  it('handles special characters in param values (URL-encoded)', () => {
    const params = new URLSearchParams({ q: 'hello world' })
    const url = createUrl('/search', params)
    expect(url).toContain('q=hello+world')
  })
})
