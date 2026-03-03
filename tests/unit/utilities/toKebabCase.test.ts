/**
 * toKebabCase — Unit Tests
 */
import { describe, it, expect } from 'vitest'

import { toKebabCase } from '@/utilities/toKebabCase'

describe('toKebabCase', () => {
  it('converts camelCase to kebab-case', () => {
    expect(toKebabCase('camelCase')).toBe('camel-case')
  })

  it('converts PascalCase to kebab-case', () => {
    expect(toKebabCase('PascalCase')).toBe('pascal-case')
  })

  it('replaces spaces with hyphens', () => {
    expect(toKebabCase('hello world')).toBe('hello-world')
  })

  it('converts to lowercase', () => {
    expect(toKebabCase('HELLO')).toBe('hello')
  })

  it('handles multiple spaces between words', () => {
    expect(toKebabCase('hello   world')).toBe('hello-world')
  })

  it('handles mixed camelCase and spaces', () => {
    expect(toKebabCase('myComponent Name')).toBe('my-component-name')
  })

  it('leaves already kebab-case strings unchanged (no consecutive changes)', () => {
    expect(toKebabCase('already-kebab')).toBe('already-kebab')
  })

  it('handles a single word', () => {
    expect(toKebabCase('word')).toBe('word')
  })
})
