/**
 * createUrl — Unit Tests
 *
 * Combines a pathname with URLSearchParams into a full URL string.
 */
import { describe, it, expect } from 'vitest'

import { createUrl } from '@/utilities/createUrl'

describe('createUrl', () => {
  it('returns just the pathname when params are empty', () => {
    const params = new URLSearchParams()
    expect(createUrl('/products', params)).toBe('/products')
  })

  it('appends a single query param with ?', () => {
    const params = new URLSearchParams({ q: 'hello' })
    expect(createUrl('/search', params)).toBe('/search?q=hello')
  })

  it('appends multiple query params', () => {
    const params = new URLSearchParams({ page: '2', limit: '10' })
    const result = createUrl('/items', params)
    expect(result).toContain('/items?')
    expect(result).toContain('page=2')
    expect(result).toContain('limit=10')
  })

  it('URL-encodes special characters in params', () => {
    const params = new URLSearchParams({ q: 'hello world' })
    expect(createUrl('/search', params)).toBe('/search?q=hello+world')
  })

  it('works with an absolute pathname', () => {
    const params = new URLSearchParams({ id: '42' })
    expect(createUrl('https://example.com/api', params)).toBe('https://example.com/api?id=42')
  })
})
