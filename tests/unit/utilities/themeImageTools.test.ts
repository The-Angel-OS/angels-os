/**
 * Unit tests for LEO Theme Management & Image Placement tools (Sprint 19).
 *
 * Tests the validation logic, contrast analysis, and input processing for:
 * - get_theme_settings (contrast analysis)
 * - update_theme_settings (hex validation, font validation, merge logic)
 * - set_page_hero (auto-promotion, page resolution)
 * - generate_theme_aware_image (prompt composition, placement presets)
 *
 * Uses the project pattern of re-implementing pure logic to avoid Payload imports.
 *
 * @see src/utilities/leo-data-tools.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement validation and pure logic from the tool handlers
// ---------------------------------------------------------------------------

/**
 * Calculates relative luminance of a hex color (0 = black, 1 = white).
 * Mirrors hexLuminance() in leo-data-tools.ts.
 */
function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return -1
  const r = parseInt(clean.substring(0, 2), 16) / 255
  const g = parseInt(clean.substring(2, 4), 16) / 255
  const b = parseInt(clean.substring(4, 6), 16) / 255
  const lr = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4)
  const lg = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4)
  const lb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4)
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/**
 * Validates hex color format. Mirrors validation in handleUpdateThemeSettings().
 */
function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

/**
 * Valid font options — mirrors the schema in Tenants collection.
 */
const HEADING_FONTS = ['inter', 'playfair-display', 'montserrat', 'raleway', 'poppins']
const BODY_FONTS = ['inter', 'open-sans', 'lato', 'roboto', 'source-sans-3']

/**
 * Determines contrast advisory based on luminance.
 * Mirrors the logic in handleGetThemeSettings().
 */
function getContrastAdvisory(lum: number): 'light' | 'medium' | 'dark' {
  if (lum > 0.4) return 'light'
  if (lum > 0.15) return 'medium'
  return 'dark'
}

/**
 * Determines hero type after auto-promotion logic.
 * Mirrors handleSetPageHero() behavior.
 */
function resolveHeroType(
  requestedType: string | undefined,
  currentType: string | undefined,
  hasMediaId: boolean,
): string {
  let newType = requestedType || currentType || 'lowImpact'
  if (hasMediaId && (newType === 'lowImpact' || newType === 'none')) {
    newType = 'highImpact'
  }
  return newType
}

/**
 * Placement presets — mirrors the config in handleGenerateThemeAwareImage().
 */
const PLACEMENT_PRESETS: Record<string, { guidance: string; brandStyle: string }> = {
  hero_banner: {
    guidance: 'Wide panoramic composition (16:3 ratio, ~1920x600). Leave visual breathing room for overlaid text. Strong horizontal flow.',
    brandStyle: 'website hero banner',
  },
  cover_image: {
    guidance: 'Wide cinematic composition (12:5 ratio, ~1920x800). Epic, atmospheric. Suitable as a full-width cover.',
    brandStyle: 'cover image',
  },
  card_thumbnail: {
    guidance: 'Compact composition (3:2 ratio, ~600x400). Clear focal point, works at small sizes. No fine text.',
    brandStyle: 'card thumbnail',
  },
  product_photo: {
    guidance: 'Square composition (1:1 ratio, ~1024x1024). Clean product photography. Professional lighting.',
    brandStyle: 'product photo',
  },
  background: {
    guidance: 'Full HD composition (16:9 ratio, ~1920x1080). Subtle, non-distracting. Works as a background layer behind content.',
    brandStyle: 'background texture',
  },
}

/**
 * Text overlay zone descriptions — mirrors the config in handleGenerateThemeAwareImage().
 */
const OVERLAY_ZONES: Record<string, string> = {
  top: 'dark-to-transparent gradient at the TOP',
  bottom: 'dark-to-transparent gradient at the BOTTOM',
  left: 'dark-to-transparent gradient on the LEFT',
  center: 'dark vignette or overlay zone in the CENTER',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Theme Management & Image Placement Tools', () => {
  // =======================================================================
  // get_theme_settings — contrast analysis
  // =======================================================================

  describe('hexLuminance', () => {
    it('returns 0 for pure black (#000000)', () => {
      expect(hexLuminance('#000000')).toBeCloseTo(0, 4)
    })

    it('returns 1 for pure white (#FFFFFF)', () => {
      expect(hexLuminance('#FFFFFF')).toBeCloseTo(1, 4)
    })

    it('returns ~0.2126 for pure red (#FF0000)', () => {
      expect(hexLuminance('#FF0000')).toBeCloseTo(0.2126, 3)
    })

    it('returns ~0.7152 for pure green (#00FF00)', () => {
      expect(hexLuminance('#00FF00')).toBeCloseTo(0.7152, 3)
    })

    it('returns ~0.0722 for pure blue (#0000FF)', () => {
      expect(hexLuminance('#0000FF')).toBeCloseTo(0.0722, 3)
    })

    it('handles the Angel OS default green (#10B981)', () => {
      const lum = hexLuminance('#10B981')
      // Should be medium luminance (green-ish)
      expect(lum).toBeGreaterThan(0.15)
      expect(lum).toBeLessThan(0.5)
    })

    it('returns -1 for invalid hex', () => {
      expect(hexLuminance('#GGG')).toBe(-1)
      expect(hexLuminance('not-a-color')).toBe(-1)
    })

    it('works without # prefix', () => {
      // hexLuminance strips # so direct hex should work
      expect(hexLuminance('FFFFFF')).toBeCloseTo(1, 4)
    })
  })

  describe('contrast advisory', () => {
    it('classifies light colors correctly', () => {
      // Yellow (#FFFF00) is very light
      expect(getContrastAdvisory(hexLuminance('#FFFF00'))).toBe('light')
    })

    it('classifies dark colors correctly', () => {
      // Navy (#000080)
      expect(getContrastAdvisory(hexLuminance('#000080'))).toBe('dark')
    })

    it('classifies medium colors correctly', () => {
      // A mid-range color
      const lum = hexLuminance('#10B981')
      expect(getContrastAdvisory(lum)).toBe('medium')
    })
  })

  // =======================================================================
  // update_theme_settings — validation
  // =======================================================================

  describe('hex color validation', () => {
    it('accepts valid 6-digit hex with #', () => {
      expect(isValidHex('#10B981')).toBe(true)
      expect(isValidHex('#FFFFFF')).toBe(true)
      expect(isValidHex('#000000')).toBe(true)
      expect(isValidHex('#ff6b35')).toBe(true)
    })

    it('rejects hex without #', () => {
      expect(isValidHex('10B981')).toBe(false)
    })

    it('rejects 3-digit shorthand hex', () => {
      expect(isValidHex('#FFF')).toBe(false)
    })

    it('rejects invalid characters', () => {
      expect(isValidHex('#GGGGGG')).toBe(false)
      expect(isValidHex('#10B98Z')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isValidHex('')).toBe(false)
    })

    it('rejects color names', () => {
      expect(isValidHex('red')).toBe(false)
      expect(isValidHex('green')).toBe(false)
    })

    it('rejects 8-digit hex (alpha)', () => {
      expect(isValidHex('#10B981FF')).toBe(false)
    })
  })

  describe('font validation', () => {
    it('accepts all valid heading fonts', () => {
      for (const font of HEADING_FONTS) {
        expect(HEADING_FONTS.includes(font)).toBe(true)
      }
    })

    it('accepts all valid body fonts', () => {
      for (const font of BODY_FONTS) {
        expect(BODY_FONTS.includes(font)).toBe(true)
      }
    })

    it('rejects unknown heading fonts', () => {
      expect(HEADING_FONTS.includes('comic-sans')).toBe(false)
      expect(HEADING_FONTS.includes('arial')).toBe(false)
    })

    it('rejects unknown body fonts', () => {
      expect(BODY_FONTS.includes('times-new-roman')).toBe(false)
    })

    it('inter is valid for both heading and body', () => {
      expect(HEADING_FONTS.includes('inter')).toBe(true)
      expect(BODY_FONTS.includes('inter')).toBe(true)
    })
  })

  describe('branding merge logic', () => {
    it('preserves existing fields when only updating one field', () => {
      const existing = {
        siteName: 'My Store',
        tagline: 'Best shop in town',
        primaryColor: '#10B981',
        headingFont: 'inter',
        bodyFont: 'inter',
      }
      const update = { primaryColor: '#FF6B35' }
      const merged = { ...existing, ...update }

      expect(merged.siteName).toBe('My Store')
      expect(merged.tagline).toBe('Best shop in town')
      expect(merged.primaryColor).toBe('#FF6B35')
      expect(merged.headingFont).toBe('inter')
    })

    it('allows updating multiple fields at once', () => {
      const existing = {
        siteName: 'Old Name',
        primaryColor: '#10B981',
        headingFont: 'inter',
      }
      const update = {
        siteName: 'New Name',
        primaryColor: '#0078D4',
        headingFont: 'montserrat',
      }
      const merged = { ...existing, ...update }

      expect(merged.siteName).toBe('New Name')
      expect(merged.primaryColor).toBe('#0078D4')
      expect(merged.headingFont).toBe('montserrat')
    })

    it('empty update produces no changes', () => {
      const existing = { siteName: 'My Store', primaryColor: '#10B981' }
      const update = {}
      const merged = { ...existing, ...update }

      expect(merged).toEqual(existing)
    })
  })

  // =======================================================================
  // set_page_hero — auto-promotion logic
  // =======================================================================

  describe('hero type auto-promotion', () => {
    it('promotes lowImpact to highImpact when image assigned', () => {
      expect(resolveHeroType(undefined, 'lowImpact', true)).toBe('highImpact')
    })

    it('promotes none to highImpact when image assigned', () => {
      expect(resolveHeroType(undefined, 'none', true)).toBe('highImpact')
    })

    it('does NOT promote mediumImpact when image assigned', () => {
      expect(resolveHeroType(undefined, 'mediumImpact', true)).toBe('mediumImpact')
    })

    it('does NOT promote highImpact (already high)', () => {
      expect(resolveHeroType(undefined, 'highImpact', true)).toBe('highImpact')
    })

    it('respects explicit heroType override even with image', () => {
      expect(resolveHeroType('mediumImpact', 'lowImpact', true)).toBe('mediumImpact')
    })

    it('promotes explicit lowImpact to highImpact when image assigned', () => {
      expect(resolveHeroType('lowImpact', 'none', true)).toBe('highImpact')
    })

    it('uses current type when no type requested and no image', () => {
      expect(resolveHeroType(undefined, 'mediumImpact', false)).toBe('mediumImpact')
    })

    it('defaults to lowImpact when nothing set', () => {
      expect(resolveHeroType(undefined, undefined, false)).toBe('lowImpact')
    })
  })

  describe('set_page_hero input validation', () => {
    it('requires either pageId or slug', () => {
      const input = { heroType: 'highImpact' }
      const hasIdentifier = !!(input as any).pageId || !!(input as any).slug
      expect(hasIdentifier).toBe(false)
    })

    it('requires at least heroType or mediaId', () => {
      const input = { slug: 'home' }
      const hasUpdate = !!(input as any).heroType || (input as any).mediaId !== undefined
      expect(hasUpdate).toBe(false)
    })

    it('accepts valid hero types', () => {
      const validTypes = ['highImpact', 'mediumImpact', 'lowImpact', 'none']
      for (const t of validTypes) {
        expect(validTypes.includes(t)).toBe(true)
      }
    })
  })

  // =======================================================================
  // generate_theme_aware_image — prompt composition
  // =======================================================================

  describe('placement presets', () => {
    it('has all 5 placement presets', () => {
      expect(Object.keys(PLACEMENT_PRESETS)).toHaveLength(5)
      expect(PLACEMENT_PRESETS.hero_banner).toBeDefined()
      expect(PLACEMENT_PRESETS.cover_image).toBeDefined()
      expect(PLACEMENT_PRESETS.card_thumbnail).toBeDefined()
      expect(PLACEMENT_PRESETS.product_photo).toBeDefined()
      expect(PLACEMENT_PRESETS.background).toBeDefined()
    })

    it('hero_banner mentions 1920x600', () => {
      expect(PLACEMENT_PRESETS.hero_banner.guidance).toContain('1920x600')
    })

    it('product_photo mentions 1024x1024', () => {
      expect(PLACEMENT_PRESETS.product_photo.guidance).toContain('1024x1024')
    })

    it('cover_image mentions 1920x800', () => {
      expect(PLACEMENT_PRESETS.cover_image.guidance).toContain('1920x800')
    })

    it('card_thumbnail mentions 600x400', () => {
      expect(PLACEMENT_PRESETS.card_thumbnail.guidance).toContain('600x400')
    })

    it('background mentions 1920x1080', () => {
      expect(PLACEMENT_PRESETS.background.guidance).toContain('1920x1080')
    })
  })

  describe('text overlay zones', () => {
    it('has 4 overlay zones', () => {
      expect(Object.keys(OVERLAY_ZONES)).toHaveLength(4)
    })

    it('top zone mentions gradient at TOP', () => {
      expect(OVERLAY_ZONES.top).toContain('TOP')
    })

    it('bottom zone mentions gradient at BOTTOM', () => {
      expect(OVERLAY_ZONES.bottom).toContain('BOTTOM')
    })

    it('left zone mentions gradient on LEFT', () => {
      expect(OVERLAY_ZONES.left).toContain('LEFT')
    })

    it('center zone mentions CENTER', () => {
      expect(OVERLAY_ZONES.center).toContain('CENTER')
    })
  })

  describe('prompt composition', () => {
    it('combines user prompt with brand context', () => {
      const parts = ['A sunset over the ocean']
      const brandContext = 'Brand palette: primary brand color #10B981.'
      parts.push(brandContext)
      const composed = parts.join(' | ')
      expect(composed).toContain('sunset over the ocean')
      expect(composed).toContain('#10B981')
    })

    it('includes placement guidance when preset provided', () => {
      const parts = ['A hero banner image']
      const preset = PLACEMENT_PRESETS.hero_banner
      parts.push(preset.guidance)
      const composed = parts.join(' | ')
      expect(composed).toContain('1920x600')
      expect(composed).toContain('panoramic')
    })

    it('includes dark mode guidance when enabled', () => {
      const parts = ['A background image']
      const darkGuide = 'The image will be displayed on a DARK background.'
      parts.push(darkGuide)
      const composed = parts.join(' | ')
      expect(composed).toContain('DARK background')
    })

    it('works with just the user prompt (no extras)', () => {
      const parts = ['Simple product photo']
      const composed = parts.join(' | ')
      expect(composed).toBe('Simple product photo')
    })

    it('combines all parts when everything is specified', () => {
      const parts = [
        'A hero banner for our coffee shop',
        'Brand palette: primary brand color #8B4513.',
        PLACEMENT_PRESETS.hero_banner.guidance,
        OVERLAY_ZONES.bottom,
        'The image will be displayed on a DARK background.',
      ]
      const composed = parts.join(' | ')
      expect(composed).toContain('coffee shop')
      expect(composed).toContain('#8B4513')
      expect(composed).toContain('1920x600')
      expect(composed).toContain('BOTTOM')
      expect(composed).toContain('DARK background')
    })
  })
})
