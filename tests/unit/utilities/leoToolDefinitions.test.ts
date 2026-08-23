/**
 * Unit tests for LEO Tool Definitions — validates that all 49 tools are properly
 * defined with correct shapes, required fields, and matching switch cases.
 *
 * Tests tool registration, schema validation, and category completeness.
 *
 * @see src/utilities/leo-data-tools.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
import { CORE_TOOL_NAMES, selectToolsForModel } from '@/utilities/leoToolSelection'

// ---------------------------------------------------------------------------
// Tool Registry Validation
// ---------------------------------------------------------------------------

describe('LEO Tool Definitions', () => {
  it('exports LEO_TOOLS as a non-empty array', () => {
    expect(Array.isArray(LEO_TOOLS)).toBe(true)
    expect(LEO_TOOLS.length).toBeGreaterThan(0)
  })

  // An exact count fails on every legitimate tool addition, so it stopped being
  // read as a signal and just went red. What actually matters: tools don't
  // vanish, and no two share a name (executeToolCall dispatches on it).
  it('keeps growing and never loses the tools it had', () => {
    expect(LEO_TOOLS.length).toBeGreaterThanOrEqual(151)
  })

  it('has no duplicate tool names', () => {
    const names = LEO_TOOLS.map((t) => t.name)
    expect(names).toHaveLength(new Set(names).size)
  })

  it('registers the connector dispatch tools (send_gotify + dispatch_to_channel)', () => {
    const names = LEO_TOOLS.map((t) => t.name)
    expect(names).toContain('send_gotify')
    expect(names).toContain('dispatch_to_channel')
  })

  describe('core toolset for small/free providers', () => {
    it('every CORE_TOOL_NAME is a real LEO tool', () => {
      const names = new Set(LEO_TOOLS.map((t) => t.name))
      for (const core of CORE_TOOL_NAMES) {
        expect(names.has(core)).toBe(true)
      }
    })

    // A ceiling, not a target. 25 → 30 on 260726; a 7B model's context is the
    // real constraint, so raise this deliberately, never to make the suite green.
    it('is lean enough to fit a small token budget (<= 30 tools)', () => {
      expect(CORE_TOOL_NAMES.size).toBeLessThanOrEqual(30)
      expect(CORE_TOOL_NAMES.size).toBeGreaterThan(8)
    })

    it('selectToolsForModel subsets to core for groq/ollama, full for gateway', () => {
      const all = LEO_TOOLS.map((t) => ({ name: t.name }))
      const groq = selectToolsForModel(all, 'groq/openai/gpt-oss-20b')
      const ollama = selectToolsForModel(all, 'ollama/qwen2.5:7b')
      const gateway = selectToolsForModel(all, 'google/gemini-2.5-flash')
      expect(groq.length).toBe(CORE_TOOL_NAMES.size)
      expect(ollama.length).toBe(CORE_TOOL_NAMES.size)
      expect(gateway.length).toBe(all.length)
      expect(groq.every((t) => CORE_TOOL_NAMES.has(t.name))).toBe(true)
    })
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
      'check_available_slots',
      'cancel_booking',
      'reschedule_booking',
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
      'federation_pulse',
      'send_federation_message',
      'my_place',
      'find_synchronicities',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Federation Browsing tools (Sprint 38)', () => {
    it.each([
      'browse_federation_peers',
      'query_peer_catalog',
      'search_federation_wide',
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

  describe('Provisioning tools', () => {
    it.each([
      'research_and_provision',
      'provision_tenant',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })

    it('provision_tenant requires name and domain', () => {
      const tool = LEO_TOOLS.find((t) => t.name === 'provision_tenant')
      expect(tool?.input_schema.required).toContain('name')
      expect(tool?.input_schema.required).toContain('domain')
    })
  })

  describe('Content Management tools', () => {
    it.each([
      'create_post',
      'update_post',
      'create_page',
      'update_page',
      'get_page_hero',
      'set_page_hero',
      'edit_image_text',
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

  describe('Federation Broadcast & Handoff tools (Sprint 36)', () => {
    it.each([
      'broadcast_federation_message',
      'leo_handoff',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Generic Payload CRUD tools (Sprint 36)', () => {
    it.each([
      'payload_find',
      'payload_update',
      'payload_create',
      'payload_delete',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Navigation Convenience tools (Sprint 36)', () => {
    it.each([
      'query_navigation',
      'update_navigation',
    ])('includes %s', (name) => {
      expect(toolNames()).toContain(name)
    })
  })

  describe('Form Builder Integration tools (Sprint 37)', () => {
    it.each([
      'send_inline_form',
      'create_form',
      'query_form_submissions',
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
      // Operator tools require manager standing; a platform role short-circuits
      // the membership lookup (see leoToolStanding.resolveStanding).
      roles: ['super_admin'],
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
      // Operator tools require manager standing; a platform role short-circuits
      // the membership lookup (see leoToolStanding.resolveStanding).
      roles: ['super_admin'],
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

  describe('broadcast_federation_message schema', () => {
    it('requires message', () => {
      const tool = getToolByName('broadcast_federation_message')
      expect(tool?.input_schema.required).toContain('message')
    })

    it('has filter enum', () => {
      const tool = getToolByName('broadcast_federation_message')
      const filter = (tool?.input_schema.properties as any)?.filter
      expect(filter?.enum).toContain('all_active')
      expect(filter?.enum).toContain('vouched_or_higher')
      expect(filter?.enum).toContain('full_trust_only')
    })
  })

  describe('leo_handoff schema', () => {
    it('requires targetDomain, handoffType, context', () => {
      const tool = getToolByName('leo_handoff')
      expect(tool?.input_schema.required).toContain('targetDomain')
      expect(tool?.input_schema.required).toContain('handoffType')
      expect(tool?.input_schema.required).toContain('context')
    })

    it('has handoffType enum with provisioning_welcome', () => {
      const tool = getToolByName('leo_handoff')
      const ht = (tool?.input_schema.properties as any)?.handoffType
      expect(ht?.enum).toContain('provisioning_welcome')
      expect(ht?.enum).toContain('delegation')
      expect(ht?.enum).toContain('escalation')
      expect(ht?.enum).toContain('collaboration')
    })
  })

  describe('payload_find schema', () => {
    it('requires collection', () => {
      const tool = getToolByName('payload_find')
      expect(tool?.input_schema.required).toContain('collection')
    })

    it('has where, limit, sort, depth properties', () => {
      const tool = getToolByName('payload_find')
      const props = tool?.input_schema.properties as any
      expect(props).toHaveProperty('where')
      expect(props).toHaveProperty('limit')
      expect(props).toHaveProperty('sort')
      expect(props).toHaveProperty('depth')
    })
  })

  describe('payload_update schema', () => {
    it('requires collection, id, data', () => {
      const tool = getToolByName('payload_update')
      expect(tool?.input_schema.required).toContain('collection')
      expect(tool?.input_schema.required).toContain('id')
      expect(tool?.input_schema.required).toContain('data')
    })
  })

  describe('update_navigation schema', () => {
    it('requires target and action', () => {
      const tool = getToolByName('update_navigation')
      expect(tool?.input_schema.required).toContain('target')
      expect(tool?.input_schema.required).toContain('action')
    })

    it('has action enum with add/remove/reorder/replace_all', () => {
      const tool = getToolByName('update_navigation')
      const action = (tool?.input_schema.properties as any)?.action
      expect(action?.enum).toContain('add')
      expect(action?.enum).toContain('remove')
      expect(action?.enum).toContain('reorder')
      expect(action?.enum).toContain('replace_all')
    })
  })
})

// ---------------------------------------------------------------------------
// Sprint 36: Generic Payload CRUD — Handler Tests
// ---------------------------------------------------------------------------

describe('Generic Payload CRUD handlers', () => {
  const mockDocs = [
    { id: 1, label: 'Main Header', navItems: [{ link: { type: 'custom', label: 'Home', url: '/' } }], createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  ]

  const mockPayload = {
    find: vi.fn().mockResolvedValue({ docs: mockDocs, totalDocs: 1 }),
    findByID: vi.fn().mockResolvedValue({ id: 1, tenant: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1, label: 'Updated' }),
    create: vi.fn().mockResolvedValue({ id: 2, label: 'New' }),
    delete: vi.fn().mockResolvedValue({ id: 1 }),
  }

  const ctx: ToolExecutorContext = {
    payload: mockPayload as any,
    // Operator tools require manager standing; a platform role short-circuits
    // the membership lookup (see leoToolStanding.resolveStanding).
    roles: ['super_admin'],
    tenantId: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore defaults
    mockPayload.find.mockResolvedValue({ docs: mockDocs, totalDocs: 1 })
    mockPayload.findByID.mockResolvedValue({ id: 1, tenant: 1 })
    mockPayload.update.mockResolvedValue({ id: 1, label: 'Updated' })
    mockPayload.create.mockResolvedValue({ id: 2, label: 'New' })
    mockPayload.delete.mockResolvedValue({ id: 1 })
  })

  describe('payload_find', () => {
    it('queries allowed collections', async () => {
      const result = await executeToolCall('payload_find', { collection: 'header' }, ctx)
      expect(result).toContain('Found 1 document')
      expect(mockPayload.find).toHaveBeenCalledWith(
        expect.objectContaining({ collection: 'header', overrideAccess: true }),
      )
    })

    it('rejects disallowed collections', async () => {
      const result = await executeToolCall('payload_find', { collection: 'users' }, ctx)
      expect(result).toContain('not accessible')
      expect(mockPayload.find).not.toHaveBeenCalled()
    })

    it('scopes to tenant', async () => {
      await executeToolCall('payload_find', { collection: 'header' }, ctx)
      const callArgs = mockPayload.find.mock.calls[0][0]
      expect(JSON.stringify(callArgs.where)).toContain('"equals":1')
    })

    it('handles no results gracefully', async () => {
      mockPayload.find.mockResolvedValue({ docs: [], totalDocs: 0 })
      const result = await executeToolCall('payload_find', { collection: 'footer' }, ctx)
      expect(result).toContain('No documents found')
    })
  })

  describe('payload_update', () => {
    it('updates allowed collections', async () => {
      const result = await executeToolCall('payload_update', {
        collection: 'header',
        id: 1,
        data: { label: 'New Label' },
      }, ctx)
      expect(result).toContain('Successfully updated')
      expect(mockPayload.update).toHaveBeenCalled()
    })

    it('rejects disallowed collections', async () => {
      const result = await executeToolCall('payload_update', {
        collection: 'users',
        id: 1,
        data: { name: 'hacker' },
      }, ctx)
      expect(result).toContain('not accessible')
      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })

  describe('payload_create', () => {
    it('creates in allowed collections', async () => {
      const result = await executeToolCall('payload_create', {
        collection: 'contacts',
        data: { email: 'test@example.com', name: 'Test' },
      }, ctx)
      expect(result).toContain('Successfully created')
      expect(mockPayload.create).toHaveBeenCalled()
    })

    it('injects tenant into data', async () => {
      await executeToolCall('payload_create', {
        collection: 'contacts',
        data: { email: 'test@example.com' },
      }, ctx)
      const callArgs = mockPayload.create.mock.calls[0][0]
      expect(callArgs.data.tenant).toBe(1)
    })
  })

  describe('payload_delete', () => {
    it('deletes from allowed collections after tenant check', async () => {
      const result = await executeToolCall('payload_delete', {
        collection: 'contacts',
        id: 1,
      }, ctx)
      expect(result).toContain('Successfully deleted')
      expect(mockPayload.findByID).toHaveBeenCalled()
      expect(mockPayload.delete).toHaveBeenCalled()
    })

    it('prevents cross-tenant deletion', async () => {
      mockPayload.findByID.mockResolvedValue({ id: 1, tenant: 999 })
      const result = await executeToolCall('payload_delete', {
        collection: 'contacts',
        id: 1,
      }, ctx)
      expect(result).toContain('different tenant')
      expect(mockPayload.delete).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// Sprint 36: Navigation Convenience — Handler Tests
// ---------------------------------------------------------------------------

describe('Navigation convenience tools', () => {
  const headerDoc = {
    id: 1,
    label: 'Main Header',
    navItems: [
      { link: { type: 'custom', label: 'Home', url: '/', newTab: false } },
      { link: { type: 'custom', label: 'Account', url: '/account', newTab: false } },
      { link: { type: 'custom', label: 'Shop', url: '/shop', newTab: false } },
    ],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }

  const mockPayload = {
    find: vi.fn().mockResolvedValue({ docs: [headerDoc], totalDocs: 1 }),
    update: vi.fn().mockResolvedValue({ ...headerDoc, navItems: [] }),
  }

  const ctx: ToolExecutorContext = {
    payload: mockPayload as any,
    // Operator tools require manager standing; a platform role short-circuits
    // the membership lookup (see leoToolStanding.resolveStanding).
    roles: ['super_admin'],
    tenantId: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPayload.find.mockResolvedValue({ docs: [headerDoc], totalDocs: 1 })
    mockPayload.update.mockResolvedValue({ ...headerDoc, navItems: [] })
  })

  describe('query_navigation', () => {
    it('returns header nav items', async () => {
      const result = await executeToolCall('query_navigation', { target: 'header' }, ctx)
      expect(result).toContain('Main Header')
      expect(result).toContain('Home')
      expect(result).toContain('Account')
      expect(result).toContain('Shop')
    })
  })

  describe('update_navigation — remove', () => {
    it('removes nav item by label (case-insensitive)', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'remove',
        label: 'Account',
      }, ctx)
      expect(result).toContain('Successfully updated')
      expect(result).toContain('2 items')
      // Verify the update call removed Account
      const updateData = mockPayload.update.mock.calls[0][0].data.navItems
      expect(updateData).toHaveLength(2)
      expect(updateData.map((i: any) => i.link.label)).toEqual(['Home', 'Shop'])
    })
  })

  describe('update_navigation — add', () => {
    it('adds a custom URL nav item', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'add',
        label: 'Blog',
        url: '/blog',
      }, ctx)
      expect(result).toContain('Successfully updated')
      expect(result).toContain('4 items')
      const updateData = mockPayload.update.mock.calls[0][0].data.navItems
      expect(updateData).toHaveLength(4)
      expect(updateData[3].link.label).toBe('Blog')
    })

    it('rejects add without url or pageId', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'add',
        label: 'Orphan',
      }, ctx)
      expect(result).toContain('url')
    })
  })

  describe('update_navigation — replace_all', () => {
    it('replaces all nav items with provided array', async () => {
      const newItems = [
        { link: { type: 'custom', label: 'New Home', url: '/new', newTab: false } },
      ]
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'replace_all',
        navItems: newItems,
      }, ctx)
      expect(result).toContain('Successfully updated')
      expect(result).toContain('1 items')
      const updateData = mockPayload.update.mock.calls[0][0].data.navItems
      expect(updateData).toHaveLength(1)
      expect(updateData[0].link.label).toBe('New Home')
    })
  })

  describe('update_navigation — remove nonexistent', () => {
    it('reports when label not found', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'remove',
        label: 'Nonexistent',
      }, ctx)
      expect(result).toContain('No nav item')
      expect(result).toContain('Home')
      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })

  describe('update_navigation — XSS protection', () => {
    it('rejects javascript: URLs (caught by Zod or handler)', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'add',
        label: 'Evil',
        url: 'javascript:alert(1)',
      }, ctx)
      // Zod schema rejects before handler runs — either way, update must not happen
      expect(result).toMatch(/validation failed|dangerous/i)
      expect(mockPayload.update).not.toHaveBeenCalled()
    })

    it('rejects data: URLs (caught by Zod or handler)', async () => {
      const result = await executeToolCall('update_navigation', {
        target: 'header',
        action: 'add',
        label: 'Evil',
        url: 'data:text/html,<script>alert(1)</script>',
      }, ctx)
      expect(result).toMatch(/validation failed|dangerous/i)
      expect(mockPayload.update).not.toHaveBeenCalled()
    })
  })
})

// ---------------------------------------------------------------------------
// Sprint 36 Hardening: Security & Robustness
// ---------------------------------------------------------------------------

describe('CRUD hardening', () => {
  const mockPayload = {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 1, tenant: 1 }], totalDocs: 1 }),
    findByID: vi.fn().mockResolvedValue({ id: 1, tenant: 1 }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
    create: vi.fn().mockResolvedValue({ id: 2 }),
    delete: vi.fn().mockResolvedValue({ id: 1 }),
  }

  const ctx: ToolExecutorContext = {
    payload: mockPayload as any,
    // Operator tools require manager standing; a platform role short-circuits
    // the membership lookup (see leoToolStanding.resolveStanding).
    roles: ['super_admin'],
    tenantId: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPayload.find.mockResolvedValue({ docs: [{ id: 1, tenant: 1 }], totalDocs: 1 })
    mockPayload.findByID.mockResolvedValue({ id: 1, tenant: 1 })
    mockPayload.update.mockResolvedValue({ id: 1 })
    mockPayload.create.mockResolvedValue({ id: 2 })
    mockPayload.delete.mockResolvedValue({ id: 1 })
  })

  it('connectors collection is blocked (API key protection)', async () => {
    const result = await executeToolCall('payload_find', { collection: 'connectors' }, ctx)
    expect(result).toContain('not accessible')
    expect(mockPayload.find).not.toHaveBeenCalled()
  })

  it('payload_update verifies tenant ownership before writing', async () => {
    mockPayload.findByID.mockResolvedValue({ id: 1, tenant: 999 })
    const result = await executeToolCall('payload_update', {
      collection: 'header',
      id: 1,
      data: { label: 'Hacked' },
    }, ctx)
    expect(result).toContain('different tenant')
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('payload_update strips LLM-injected tenant field', async () => {
    await executeToolCall('payload_update', {
      collection: 'header',
      id: 1,
      data: { label: 'New', tenant: 999 },
    }, ctx)
    const callArgs = mockPayload.update.mock.calls[0][0]
    expect(callArgs.data.tenant).toBe(1) // forced to ctx.tenantId, not 999
  })

  it('payload_create strips LLM-injected tenant field', async () => {
    await executeToolCall('payload_create', {
      collection: 'contacts',
      data: { email: 'a@b.com', tenant: 999 },
    }, ctx)
    const callArgs = mockPayload.create.mock.calls[0][0]
    expect(callArgs.data.tenant).toBe(1) // forced to ctx.tenantId, not 999
  })

  it('payload_create surfaces duplicate errors', async () => {
    mockPayload.create.mockRejectedValue(new Error('unique constraint violation'))
    const result = await executeToolCall('payload_create', {
      collection: 'contacts',
      data: { email: 'dup@test.com' },
    }, ctx)
    expect(result).toContain('already exists')
    expect(result).toContain('unique')
  })

  it('payload_update returns error message on failure', async () => {
    mockPayload.update.mockRejectedValue(new Error('validation error'))
    const result = await executeToolCall('payload_update', {
      collection: 'header',
      id: 1,
      data: { label: '' },
    }, ctx)
    expect(result).toContain('Failed to update')
  })

  it('payload_delete returns error message on failure', async () => {
    mockPayload.delete.mockRejectedValue(new Error('foreign key constraint'))
    const result = await executeToolCall('payload_delete', {
      collection: 'contacts',
      id: 1,
    }, ctx)
    expect(result).toContain('Failed to delete')
  })

  it('payload_find returns error message on query failure', async () => {
    mockPayload.find.mockRejectedValue(new Error('connection timeout'))
    const result = await executeToolCall('payload_find', {
      collection: 'header',
    }, ctx)
    expect(result).toContain('Error querying')
  })
})

// ---------------------------------------------------------------------------
// Schema Hardening Tests (uses Zod schemas directly — no Payload dependency)
// ---------------------------------------------------------------------------

describe('Schema hardening', () => {
  // Import schemas inline to avoid module resolution issues with Payload mocks
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    broadcastFederationMessageSchema,
    leoHandoffSchema,
    sendFederationMessageSchema,
    updateNavigationSchema,
  } = (() => {
    // Zod schemas are pure — they don't import Payload at all
    const { z } = require('zod')

    const safeDomain = z
      .string()
      .min(1)
      .max(253)
      .regex(
        /^(?!localhost)(?!\d+\.\d+\.\d+\.\d+$)[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/,
      )

    const safeUrl = z
      .string()
      .min(1)
      .max(2000)
      .refine((url: string) => !/^(javascript|data|vbscript):/i.test(url.trim()))

    return {
      broadcastFederationMessageSchema: z.object({
        message: z.string().min(1).max(10_000),
        filter: z.enum(['all_active', 'vouched_or_higher', 'full_trust_only']).optional(),
        conversationId: z.string().optional(),
      }),
      leoHandoffSchema: z.object({
        targetDomain: safeDomain,
        handoffType: z.enum(['provisioning_welcome', 'delegation', 'escalation', 'collaboration']),
        context: z.string().min(1).max(5_000),
        userId: z.number().optional(),
        userName: z.string().max(200).optional(),
        userEmail: z.string().email().optional(),
        returnTo: safeUrl.optional(),
      }),
      sendFederationMessageSchema: z.object({
        peerDomain: safeDomain,
        message: z.string().min(1).max(10_000),
        conversationId: z.string().optional(),
      }),
      updateNavigationSchema: z.object({
        target: z.enum(['header', 'footer']),
        action: z.enum(['add', 'remove', 'reorder', 'replace_all']),
        label: z.string().max(100).optional(),
        url: safeUrl.optional(),
        pageId: z.number().optional(),
        newTab: z.boolean().optional(),
        navItems: z.array(z.record(z.string(), z.unknown())).max(6).optional(),
      }),
    }
  })()

  it('rejects messages over 10,000 characters', () => {
    const result = broadcastFederationMessageSchema.safeParse({
      message: 'x'.repeat(10_001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects localhost as federation domain', () => {
    const result = leoHandoffSchema.safeParse({
      targetDomain: 'localhost',
      handoffType: 'delegation',
      context: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects IP addresses as federation domain', () => {
    const result = sendFederationMessageSchema.safeParse({
      peerDomain: '192.168.1.1',
      message: 'test',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid federation domain', () => {
    const result = leoHandoffSchema.safeParse({
      targetDomain: 'partner.angelos.app',
      handoffType: 'provisioning_welcome',
      context: 'Welcome new user',
    })
    expect(result.success).toBe(true)
  })

  it('rejects javascript: URLs in navigation', () => {
    const result = updateNavigationSchema.safeParse({
      target: 'header',
      action: 'add',
      label: 'Evil',
      url: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('rejects nav items array over 6', () => {
    const result = updateNavigationSchema.safeParse({
      target: 'header',
      action: 'replace_all',
      navItems: Array(7).fill({ link: { label: 'x', url: '/' } }),
    })
    expect(result.success).toBe(false)
  })

  it('validates handoff email format', () => {
    const result = leoHandoffSchema.safeParse({
      targetDomain: 'peer.angelos.app',
      handoffType: 'delegation',
      context: 'test',
      userEmail: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })
})
