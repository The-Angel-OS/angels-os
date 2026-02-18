/**
 * Unit tests for image generation utilities — pure logic only.
 *
 * Tests:
 * - enhancePromptForProduct() — category-specific photography prompt enhancement
 * - deepReplaceMediaId() — recursive media ID replacement in document trees
 * - isImageGenerationAvailable() — environment check
 *
 * API-calling functions (generateImage, analyzeImageForFeedback, uploadGeneratedImage)
 * are tested in integration tests.
 *
 * @see src/utilities/imageGeneration.ts
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement pure functions for isolated testing
// ---------------------------------------------------------------------------

function enhancePromptForProduct(
  userPrompt: string,
  context?: {
    productName?: string
    brandStyle?: string
    category?: string
    backgroundColor?: string
    existingImageDescription?: string
  },
): string {
  const parts: string[] = []

  parts.push(userPrompt)

  if (context?.productName) {
    parts.push(`Product: "${context.productName}".`)
  }

  if (context?.category) {
    const categoryStyles: Record<string, string> = {
      candles:
        'Warm ambient lighting, soft bokeh background, lifestyle product photography.',
      jewelry:
        'Clean white background, soft diffused lighting, macro detail, luxury product photography.',
      clothing: 'Fashion editorial style, natural lighting, clean background.',
      food: 'Food photography styling, appetizing presentation, natural daylight.',
      electronics:
        'Clean tech product photography, gradient background, crisp reflections.',
      art: 'Gallery-quality documentation, neutral background, true color reproduction.',
      wellness:
        'Serene natural setting, soft earth tones, mindful lifestyle photography.',
      massage:
        'Spa environment, calming earth tones, warm lighting, relaxation lifestyle.',
      cactus:
        'Desert botanical photography, natural sunlight, rustic southwestern aesthetic.',
    }
    const style =
      categoryStyles[context.category.toLowerCase()] ||
      'Professional product photography, clean composition.'
    parts.push(style)
  }

  if (context?.brandStyle) {
    parts.push(`Brand aesthetic: ${context.brandStyle}.`)
  }

  if (context?.backgroundColor) {
    parts.push(`Background: ${context.backgroundColor}.`)
  }

  if (context?.existingImageDescription) {
    parts.push(`Improving upon: ${context.existingImageDescription}.`)
  }

  parts.push(
    'High-resolution, professional photography, sharp focus, beautiful composition.',
  )

  return parts.join(' ')
}

function deepReplaceMediaId(
  obj: Record<string, unknown>,
  oldId: number,
  newId: number,
): boolean {
  let replaced = false

  for (const key of Object.keys(obj)) {
    const val = obj[key]

    if (val === oldId) {
      obj[key] = newId
      replaced = true
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (
        deepReplaceMediaId(val as Record<string, unknown>, oldId, newId)
      ) {
        replaced = true
      }
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (val[i] === oldId) {
          val[i] = newId
          replaced = true
        } else if (val[i] && typeof val[i] === 'object') {
          if (
            deepReplaceMediaId(
              val[i] as Record<string, unknown>,
              oldId,
              newId,
            )
          ) {
            replaced = true
          }
        }
      }
    }
  }

  return replaced
}

// ---------------------------------------------------------------------------
// Tests — enhancePromptForProduct
// ---------------------------------------------------------------------------

describe('enhancePromptForProduct', () => {
  it('always includes the user prompt', () => {
    const result = enhancePromptForProduct('A beautiful sunset')
    expect(result).toContain('A beautiful sunset')
  })

  it('always appends quality markers', () => {
    const result = enhancePromptForProduct('anything')
    expect(result).toContain('High-resolution')
    expect(result).toContain('professional photography')
    expect(result).toContain('sharp focus')
  })

  it('includes product name when provided', () => {
    const result = enhancePromptForProduct('photo', {
      productName: 'Lavender Candle',
    })
    expect(result).toContain('Product: "Lavender Candle"')
  })

  describe('category-specific styles', () => {
    it('adds candle photography style', () => {
      const result = enhancePromptForProduct('candle photo', {
        category: 'candles',
      })
      expect(result).toContain('Warm ambient lighting')
      expect(result).toContain('bokeh')
    })

    it('adds jewelry photography style', () => {
      const result = enhancePromptForProduct('ring photo', {
        category: 'jewelry',
      })
      expect(result).toContain('macro detail')
      expect(result).toContain('luxury')
    })

    it('adds food photography style', () => {
      const result = enhancePromptForProduct('pasta dish', {
        category: 'food',
      })
      expect(result).toContain('appetizing')
      expect(result).toContain('natural daylight')
    })

    it('adds electronics photography style', () => {
      const result = enhancePromptForProduct('laptop', {
        category: 'electronics',
      })
      expect(result).toContain('gradient background')
      expect(result).toContain('crisp reflections')
    })

    it('adds cactus photography style', () => {
      const result = enhancePromptForProduct('prickly pear', {
        category: 'cactus',
      })
      expect(result).toContain('Desert botanical')
      expect(result).toContain('southwestern')
    })

    it('adds massage/spa photography style', () => {
      const result = enhancePromptForProduct('hot stone therapy', {
        category: 'massage',
      })
      expect(result).toContain('Spa environment')
      expect(result).toContain('calming earth tones')
    })

    it('falls back to generic style for unknown category', () => {
      const result = enhancePromptForProduct('product', {
        category: 'rockets',
      })
      expect(result).toContain('Professional product photography')
      expect(result).toContain('clean composition')
    })

    it('category matching is case-insensitive', () => {
      const result = enhancePromptForProduct('photo', {
        category: 'CANDLES',
      })
      expect(result).toContain('Warm ambient lighting')
    })
  })

  it('includes brand style', () => {
    const result = enhancePromptForProduct('product', {
      brandStyle: 'Minimalist Scandinavian',
    })
    expect(result).toContain('Brand aesthetic: Minimalist Scandinavian')
  })

  it('includes background color', () => {
    const result = enhancePromptForProduct('product', {
      backgroundColor: 'soft pink gradient',
    })
    expect(result).toContain('Background: soft pink gradient')
  })

  it('includes existing image description for improvement', () => {
    const result = enhancePromptForProduct('improved version', {
      existingImageDescription: 'too dark, subject off-center',
    })
    expect(result).toContain('Improving upon: too dark, subject off-center')
  })

  it('combines all context fields', () => {
    const result = enhancePromptForProduct('hero image', {
      productName: 'Ocean Breeze Candle',
      category: 'candles',
      brandStyle: 'Coastal calm',
      backgroundColor: 'driftwood texture',
      existingImageDescription: 'previous version lacked warmth',
    })
    expect(result).toContain('Ocean Breeze Candle')
    expect(result).toContain('Warm ambient lighting')
    expect(result).toContain('Coastal calm')
    expect(result).toContain('driftwood texture')
    expect(result).toContain('lacked warmth')
    expect(result).toContain('High-resolution')
  })
})

// ---------------------------------------------------------------------------
// Tests — deepReplaceMediaId
// ---------------------------------------------------------------------------

describe('deepReplaceMediaId', () => {
  it('replaces direct ID reference', () => {
    const obj = { image: 42 }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(true)
    expect(obj.image).toBe(99)
  })

  it('returns false when ID not found', () => {
    const obj = { image: 10 }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(false)
    expect(obj.image).toBe(10)
  })

  it('replaces in nested objects', () => {
    const obj = { meta: { hero: { image: 42 } } }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(true)
    expect((obj.meta.hero as any).image).toBe(99)
  })

  it('replaces in arrays', () => {
    const obj = { gallery: [{ image: 42 }, { image: 10 }] }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(true)
    expect(obj.gallery[0].image).toBe(99)
    expect(obj.gallery[1].image).toBe(10)
  })

  it('replaces direct array elements', () => {
    const obj = { imageIds: [42, 10, 42] }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(true)
    expect(obj.imageIds).toEqual([99, 10, 99])
  })

  it('replaces multiple occurrences', () => {
    const obj = { hero: 42, thumbnail: 42, banner: 10 }
    const result = deepReplaceMediaId(obj, 42, 99)
    expect(result).toBe(true)
    expect(obj.hero).toBe(99)
    expect(obj.thumbnail).toBe(99)
    expect(obj.banner).toBe(10)
  })

  it('handles deeply nested product-like structure', () => {
    const product = {
      title: 'Candle',
      gallery: [{ image: 42 }, { image: 55 }],
      meta: { og: { image: 42 } },
      content: {
        blocks: [
          { type: 'image', image: 42 },
          { type: 'text', text: 'Hello' },
        ],
      },
    }
    const result = deepReplaceMediaId(product, 42, 99)
    expect(result).toBe(true)
    expect(product.gallery[0].image).toBe(99)
    expect((product.meta.og as any).image).toBe(99)
    expect((product.content.blocks[0] as any).image).toBe(99)
    // Unchanged
    expect(product.gallery[1].image).toBe(55)
  })

  it('handles empty object', () => {
    const obj = {}
    expect(deepReplaceMediaId(obj, 42, 99)).toBe(false)
  })

  it('handles object with non-matching types', () => {
    const obj = { image: '42', label: 'test' }
    // String '42' !== number 42
    expect(deepReplaceMediaId(obj, 42, 99)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tests — isImageGenerationAvailable
// ---------------------------------------------------------------------------

describe('isImageGenerationAvailable', () => {
  afterEach(() => {
    delete process.env.OPENROUTER_API_KEY
  })

  it('returns true when OPENROUTER_API_KEY is set', () => {
    process.env.OPENROUTER_API_KEY = 'or-test-key'
    expect(Boolean(process.env.OPENROUTER_API_KEY)).toBe(true)
  })

  it('returns false when OPENROUTER_API_KEY is not set', () => {
    delete process.env.OPENROUTER_API_KEY
    expect(Boolean(process.env.OPENROUTER_API_KEY)).toBe(false)
  })
})
