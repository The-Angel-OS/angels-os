/**
 * generatePreviewPath — Unit Tests
 *
 * Builds a /next/preview URL with encoded query params for CMS preview.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { generatePreviewPath } from '@/utilities/generatePreviewPath'

describe('generatePreviewPath', () => {
  const fakeReq = {} as any

  beforeEach(() => {
    process.env.PREVIEW_SECRET = 'test-preview-secret'
  })

  afterEach(() => {
    delete process.env.PREVIEW_SECRET
  })

  it('returns a URL starting with /next/preview', () => {
    const url = generatePreviewPath({ collection: 'posts', slug: 'hello-world', req: fakeReq })
    expect(url.startsWith('/next/preview?')).toBe(true)
  })

  it('includes the slug in the query string', () => {
    const url = generatePreviewPath({ collection: 'posts', slug: 'hello-world', req: fakeReq })
    expect(url).toContain('slug=hello-world')
  })

  it('includes the collection in the query string', () => {
    const url = generatePreviewPath({ collection: 'posts', slug: 'test', req: fakeReq })
    expect(url).toContain('collection=posts')
  })

  it('sets path to /posts/{slug} for posts collection', () => {
    const url = generatePreviewPath({ collection: 'posts', slug: 'my-post', req: fakeReq })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('path')).toBe('/posts/my-post')
  })

  it('sets path to /{slug} for pages collection (empty prefix)', () => {
    const url = generatePreviewPath({ collection: 'pages', slug: 'about', req: fakeReq })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('path')).toBe('/about')
  })

  it('sets path to /products/{slug} for products collection', () => {
    const url = generatePreviewPath({ collection: 'products', slug: 'widget', req: fakeReq })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('path')).toBe('/products/widget')
  })

  it('includes previewSecret from PREVIEW_SECRET env var', () => {
    const url = generatePreviewPath({ collection: 'posts', slug: 'test', req: fakeReq })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('previewSecret')).toBe('test-preview-secret')
  })

  it('uses empty string for previewSecret when env var is absent', () => {
    delete process.env.PREVIEW_SECRET
    const url = generatePreviewPath({ collection: 'posts', slug: 'test', req: fakeReq })
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('previewSecret')).toBe('')
  })
})
