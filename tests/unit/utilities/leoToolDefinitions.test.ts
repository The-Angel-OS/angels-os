/**
 * Unit tests for LEO Tool Definitions — validates that all 49 tools are properly
 * defined with correct shapes, required fields, and matching switch cases.
 *
 * Tests tool registration, schema validation, and category completeness.
 *
 * @see src/utilities/leo-data-tools.ts
 */
import { describe, it, expect, vi } from 'vitest'

// Mock external dependencies to allow import
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('@payloadcms/richtext-lexical', () => ({
  consolidateHTMLConverters: vi.fn(),
  convertLexicalToHTML: vi.fn(),
  defaultEditorConfig: { resolvedFeatureMap: new Map() },
  defaultEditorFeatures: [],
  lexicalEditor: vi.fn(() => ({})),
  FixedToolbarFeature: vi.fn(() => ({})),
  HeadingFeature: vi.fn(() => ({})),
  InlineToolbarFeature: vi.fn(() => ({})),
}))

import { LEO_TOOLS, executeToolCall } from '@/utilities/leo-data-tools'
import type { ToolExecutorContext } from '@/utilities/leo-data-tools'

// ---------------------------------------------------------------------------
// Tool Registry Validation
// ---------------------------------------------------------------------------

describe('LEO Tool Definitions', () => {
  it('exports LEO_TOOLS as a non-empty array', () => {
    expect(Array.isArray(LEO_TOOLS)).toBe(true)
    expect(LEO_TOOLS.length).toBeGreaterThan(0)
  })

  it('has exactly 49 tools defined', () => {
    expect(LEO_TOOLS.length).toBe(49)
  })

  it('every tool has a unique name', () => {
    const names = LEO_TOOLS.map((t) => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('every tool has required fields: name, description, input_schema', () => {
    for (const tool of LEO_TOOLS) {
      expect(tool.name).toBeTruthy()
      expect(typeof tool.name).toBe('string')
      expect(tool.description).toBeTruthy()
      expect(typeof tool.description).toBe('string')
      expect(tool.input_schema).toBeDefined()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  it('every input_schema has a properties object', () => {
    for (const tool of LEO_TOOLS) {
      expect(tool.input_schema.properties).toBeDefined()
      expect(typeof tool.input_schema.properties).toBe('object')
    }
  })

  it('every input_schema.required is an array (if present)', () => {
    for (const tool of LEO_TOOLS) {
      if (tool.input_schema.required !== undefined) {
        expect(Array.isArray(tool.input_schema.required)).toBe(true)
      }
    }
  })

  it('tool descriptions are at least 30 characters (meaningful)', () => {
    for (const tool of LEO_TOOLS) {
      expect(tool.description!.length).toBeGreaterThanOrEqual(30)
    }
  })
})

// ---------------------------------------------------------------------------
// Category Completeness — verify all expected tools exist
// ---------------------------------------------------------------------------

describe('LEO Tool Categories', () => {
  const toolNames = () => LEO_TOOLS.map((t) => t.name)

  describe('Content Querying tools', () => {
    it.each([
      'query_products',
      'query_posts',
      'query_bookings',
      'query_events',
      'query_event_registrations',
      'query_spaces',
      'query_projects',
      'query_availability',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Commerce tools', () => {
    it.each([
      'add_to_cart',
      'view_cart',
      'create_product',
      'update_product',
      'suggest_products',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Image & Media tools', () => {
    it.each([
      'generate_image',
      'improve_image',
      'attach_image_to_product',
      'replace_image',
      'query_media',
      'analyze_image',
      'generate_theme_aware_image',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Booking & Orders tools', () => {
    it.each([
      'create_booking',
      'update_booking_status',
      'query_orders',
      'route_order',
      'accept_order',
      'update_fulfillment',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Federation tools', () => {
    it.each([
      'sign_constitution',
      'ping_federation',
      'check_fees',
      'browse_network',
      'find_producers',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Community tools', () => {
    it.each([
      'create_space',
      'invite_member',
      'onboard_vendor',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Content Management tools', () => {
    it.each([
      'create_post',
      'update_post',
      'create_page',
      'update_page',
      'set_page_hero',
      'manage_categories',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Theme Management tools (Sprint 19)', () => {
    it.each([
      'get_theme_settings',
      'update_theme_settings',
      'set_page_hero',
      'generate_theme_aware_image',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Knowledge & Analysis tools', () => {
    it.each([
      'extract_pdf_pages',
      'query_knowledge',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Vendor & Production tools', () => {
    it.each([
      'generate_cad_instructions',
      'fetch_reviews',
      'draft_review_response',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Business Setup tools', () => {
    it.each([
      'configure_business',
      'connect_stripe_account',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })
})

// ---------------------------------------------------------------------------
// Execute Tool Call — dispatch validation
// ---------------------------------------------------------------------------

describe('executeToolCall', () => {
  it('exports executeToolCall as a function', () => {
    expect(typeof executeToolCall).toBe('function')
  })

  it('returns "Unknown tool" for non-existent tool', async () => {
    const ctx: ToolExecutorContext = {
      payload: {} as any,
      tenantId: 1,
    }
    const result = await executeToolCall('nonexistent_tool', {}, ctx)
    expect(result).toContain('Unknown tool')
  })

  it('handles errors gracefully (returns error string, does not throw)', async () => {
    // Calling a real tool with a fake Payload that throws should return error string
    const fakePayload = {
      find: () => { throw new Error('Test error') },
      findByID: () => { throw new Error('Test error') },
    }
    const ctx: ToolExecutorContext = {
      payload: fakePayload as any,
      tenantId: 1,
    }
    const result = await executeToolCall('query_products', { search: 'test' }, ctx)
    expect(result).toContain('Error')
  })
})

// ---------------------------------------------------------------------------
// Tool Input Schema Validation
// ---------------------------------------------------------------------------

describe('Tool Input Schemas', () => {
  const getToolByName = (name: string) => LEO_TOOLS.find((t) => t.name === name)

  describe('create_product requires title via description', () => {
    it('has title in properties', () => {
      const tool = getToolByName('create_product')
      expect(tool?.input_schema.properties).toHaveProperty('title')
    })

    it('has price in properties', () => {
      const tool = getToolByName('create_product')
      expect(tool?.input_schema.properties).toHaveProperty('price')
    })
  })

  describe('generate_theme_aware_image schema', () => {
    it('requires prompt', () => {
      const tool = getToolByName('generate_theme_aware_image')
      expect(tool?.input_schema.required).toContain('prompt')
    })

    it('has placement enum', () => {
      const tool = getToolByName('generate_theme_aware_image')
      const placement = (tool?.input_schema.properties as any)?.placement
      expect(placement?.enum).toContain('hero_banner')
      expect(placement?.enum).toContain('cover_image')
      expect(placement?.enum).toContain('card_thumbnail')
      expect(placement?.enum).toContain('product_photo')
      expect(placement?.enum).toContain('background')
    })

    it('has textOverlayZone enum', () => {
      const tool = getToolByName('generate_theme_aware_image')
      const zone = (tool?.input_schema.properties as any)?.textOverlayZone
      expect(zone?.enum).toContain('top')
      expect(zone?.enum).toContain('bottom')
      expect(zone?.enum).toContain('left')
      expect(zone?.enum).toContain('center')
    })
  })

  describe('set_page_hero schema', () => {
    it('has heroType enum', () => {
      const tool = getToolByName('set_page_hero')
      const heroType = (tool?.input_schema.properties as any)?.heroType
      expect(heroType?.enum).toContain('highImpact')
      expect(heroType?.enum).toContain('mediumImpact')
      expect(heroType?.enum).toContain('lowImpact')
      expect(heroType?.enum).toContain('none')
    })
  })

  describe('update_theme_settings schema', () => {
    it('has all 6 color properties', () => {
      const tool = getToolByName('update_theme_settings')
      const props = tool?.input_schema.properties as any
      expect(props).toHaveProperty('primaryColor')
      expect(props).toHaveProperty('secondaryColor')
      expect(props).toHaveProperty('accentColor')
      expect(props).toHaveProperty('backgroundColor')
      expect(props).toHaveProperty('foregroundColor')
      expect(props).toHaveProperty('borderColor')
    })

    it('has both font properties with enums', () => {
      const tool = getToolByName('update_theme_settings')
      const props = tool?.input_schema.properties as any
      expect(props?.headingFont?.enum).toContain('inter')
      expect(props?.headingFont?.enum).toContain('montserrat')
      expect(props?.bodyFont?.enum).toContain('inter')
      expect(props?.bodyFont?.enum).toContain('open-sans')
    })
  })

  describe('sign_constitution schema', () => {
    const tool = () => getToolByName('sign_constitution')
    it('exists', () => {
      expect(tool()).toBeDefined()
    })
  })

  describe('query_bookings schema has status enum', () => {
    it('includes all booking statuses', () => {
      const tool = getToolByName('query_bookings')
      const status = (tool?.input_schema.properties as any)?.status
      expect(status?.enum).toContain('pending')
      expect(status?.enum).toContain('confirmed')
      expect(status?.enum).toContain('completed')
      expect(status?.enum).toContain('cancelled')
    })
  })
})
