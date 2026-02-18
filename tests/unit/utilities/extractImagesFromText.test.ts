/**
 * Unit tests for image URL extraction from LEO response text.
 *
 * These tests preserve the regex patterns that handle Vercel Blob URLs,
 * markdown images, and various URL formats LEO may include in responses.
 * Breaking these patterns breaks image display in ChatControl.
 *
 * @see src/components/ChatControl/useChat.ts — extractImagesFromText()
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// We re-implement the function here to test the regex logic in isolation.
// If useChat.ts is refactored to export this function, swap to the import.
// ---------------------------------------------------------------------------

function extractImagesFromText(
  text: string,
): Array<{ url: string; alt?: string; mediaId?: number }> {
  const images: Array<{ url: string; alt?: string; mediaId?: number }> = []
  const seen = new Set<string>()

  // Match markdown images: ![alt](url)
  const mdPattern = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = mdPattern.exec(text)) !== null) {
    const url = match[2]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url, alt: match[1] || undefined })
    }
  }

  // Match standalone image URLs
  const urlPattern = /(?:URL|Image|Preview|Generated):\s*(https?:\/\/[^\s"')]+)/gi
  while ((match = urlPattern.exec(text)) !== null) {
    const url = match[1]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Match Vercel Blob URLs
  const blobPattern =
    /(https?:\/\/[a-z0-9._-]+\.public\.blob\.vercel-storage\.com\/[^\s"')]+)/gi
  while ((match = blobPattern.exec(text)) !== null) {
    const url = match[1]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Match Payload media URLs (local dev or self-hosted)
  const mediaUrlPattern =
    /(?:\/api\/media\/file\/|\/media\/)[^\s"')]+\.(?:png|jpg|jpeg|webp|gif|svg)/gi
  while ((match = mediaUrlPattern.exec(text)) !== null) {
    const url = match[0].startsWith('http') ? match[0] : match[0]
    if (!seen.has(url)) {
      seen.add(url)
      images.push({ url })
    }
  }

  // Extract media IDs and associate with images
  const mediaIdPattern = /Media\s*(?:ID|#):\s*(\d+)/gi
  const mediaIds: number[] = []
  while ((match = mediaIdPattern.exec(text)) !== null) {
    mediaIds.push(parseInt(match[1], 10))
  }
  for (let i = 0; i < Math.min(mediaIds.length, images.length); i++) {
    images[i].mediaId = mediaIds[i]
  }

  return images
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractImagesFromText', () => {
  describe('markdown images', () => {
    it('extracts ![alt](url) pattern', () => {
      const text = 'Here is the image: ![product photo](https://example.com/img.png)'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe('https://example.com/img.png')
      expect(result[0].alt).toBe('product photo')
    })

    it('extracts multiple markdown images', () => {
      const text = '![a](https://a.com/1.png) and ![b](https://b.com/2.jpg)'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(2)
    })

    it('handles empty alt text', () => {
      const text = '![](https://example.com/img.png)'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].alt).toBeUndefined()
    })
  })

  describe('labeled URL patterns', () => {
    it('extracts "URL: https://..." pattern', () => {
      const text = 'Generated image URL: https://example.com/generated.png'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe('https://example.com/generated.png')
    })

    it('extracts "Image: https://..." pattern', () => {
      const text = 'Image: https://cdn.example.com/photo.jpg'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })

    it('extracts "Preview: https://..." pattern', () => {
      const text = 'Preview: https://preview.example.com/thumb.webp'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })

    it('extracts "Generated: https://..." pattern', () => {
      const text = 'Generated: https://api.example.com/output.png'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })

    it('is case-insensitive for labels', () => {
      const text = 'url: https://example.com/a.png\nIMAGE: https://example.com/b.png'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(2)
    })
  })

  describe('Vercel Blob URLs', () => {
    it('matches standard blob URL (may also match media pattern)', () => {
      const text =
        'https://abcdef123.public.blob.vercel-storage.com/media/image-abc123.png'
      const result = extractImagesFromText(text)
      // Blob pattern matches the full URL; Payload media pattern also matches /media/image-abc123.png
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].url).toContain('vercel-storage.com')
    })

    it('matches blob URL with hyphens in subdomain', () => {
      const text =
        'https://abc-def.public.blob.vercel-storage.com/media/photo.jpg'
      const result = extractImagesFromText(text)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].url).toContain('abc-def')
    })

    it('matches blob URL with dots in subdomain', () => {
      const text =
        'https://abc.def.public.blob.vercel-storage.com/media/photo.jpg'
      const result = extractImagesFromText(text)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].url).toContain('abc.def')
    })

    it('matches blob URL without file extension (no media pattern overlap)', () => {
      const text =
        'https://store123.public.blob.vercel-storage.com/uploads/abc123-randomhash'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })

    it('matches blob URL with complex path', () => {
      const text =
        'https://abc-def.public.blob.vercel-storage.com/uploads/products/hero-image-v2-abc123'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].url).toContain('hero-image')
    })
  })

  describe('Payload media URLs', () => {
    it('matches /api/media/file/ pattern', () => {
      const text = 'The image is at /api/media/file/product-photo.png in the server'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].url).toContain('/api/media/file/product-photo.png')
    })

    it('matches /media/ pattern with extension', () => {
      const text = 'See /media/uploads/hero.webp for the banner'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })
  })

  describe('Media ID extraction', () => {
    it('associates Media ID with image', () => {
      const text =
        'URL: https://example.com/img.png\nMedia ID: 42'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].mediaId).toBe(42)
    })

    it('associates Media #: format', () => {
      const text = 'URL: https://example.com/img.png\nMedia #: 99'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
      expect(result[0].mediaId).toBe(99)
    })

    it('associates multiple Media IDs positionally', () => {
      const text =
        '![a](https://a.com/1.png) ![b](https://b.com/2.png)\nMedia ID: 10\nMedia ID: 20'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(2)
      expect(result[0].mediaId).toBe(10)
      expect(result[1].mediaId).toBe(20)
    })
  })

  describe('deduplication', () => {
    it('does not duplicate the same URL', () => {
      const text =
        '![photo](https://example.com/img.png)\nURL: https://example.com/img.png'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(1)
    })

    it('returns distinct URLs', () => {
      const text =
        'URL: https://a.com/1.png\nURL: https://b.com/2.png\nURL: https://a.com/1.png'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    it('returns empty array for text with no images', () => {
      const text = 'Just a regular text message with no images.'
      const result = extractImagesFromText(text)
      expect(result).toHaveLength(0)
    })

    it('returns empty array for empty string', () => {
      expect(extractImagesFromText('')).toHaveLength(0)
    })

    it('handles multi-line LEO response with mixed patterns', () => {
      const text = `I've generated a product image for you!

![Product Hero](https://abc-def.public.blob.vercel-storage.com/uploads/product-hero-123.webp)

The image has been uploaded to the media library.
Media ID: 42

URL: https://abc-def.public.blob.vercel-storage.com/uploads/product-hero-123.webp

Would you like me to attach it to the product?`
      const result = extractImagesFromText(text)
      // The markdown image is extracted first; the URL: and blob patterns match the
      // same URL and are deduplicated by the seen Set
      expect(result).toHaveLength(1)
      expect(result[0].alt).toBe('Product Hero')
      expect(result[0].mediaId).toBe(42)
      expect(result[0].url).toContain('product-hero-123')
    })
  })
})
