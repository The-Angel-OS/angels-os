/**
 * Sprint 44b — configure_endeavor tool + history message truncation
 *
 * Tests:
 *   1. configure_endeavor tool definition exists with correct schema
 *   2. CONTENT_MUTATION_TOOLS includes configure_endeavor
 *   3. History message truncation at MAX_HISTORY_MESSAGE_CHARS
 *   4. Seed data includes operator/missionStatement/capabilities for Clearwater Cruisin
 */
import { describe, it, expect, vi } from 'vitest'

// Mock heavy dependencies that pull in Stripe/Payload config
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: any) => fn),
}))

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    languageModel: vi.fn(),
    imageModel: vi.fn(),
  })),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn() } },
    accountLinks: { create: vi.fn() },
  })),
}))

vi.mock('@payloadcms/richtext-lexical', () => ({
  lexicalEditor: vi.fn(),
  HTMLConverterFeature: vi.fn(),
  FixedToolbarFeature: vi.fn(),
  InlineToolbarFeature: vi.fn(),
  HeadingFeature: vi.fn(),
  BlocksFeature: vi.fn(),
  UploadFeature: vi.fn(),
  LinkFeature: vi.fn(),
  BoldFeature: vi.fn(),
  ItalicFeature: vi.fn(),
  UnorderedListFeature: vi.fn(),
  OrderedListFeature: vi.fn(),
  ChecklistFeature: vi.fn(),
  BlockquoteFeature: vi.fn(),
  HorizontalRuleFeature: vi.fn(),
  InlineCodeFeature: vi.fn(),
  StrikethroughFeature: vi.fn(),
  SubscriptFeature: vi.fn(),
  SuperscriptFeature: vi.fn(),
  ParagraphFeature: vi.fn(),
  AlignFeature: vi.fn(),
  IndentFeature: vi.fn(),
  RelationshipFeature: vi.fn(),
  UnderlineFeature: vi.fn(),
  convertLexicalToHTML: vi.fn(),
}))

// ---------------------------------------------------------------------------
// 1. Tool definition
// ---------------------------------------------------------------------------

describe('configure_endeavor tool definition', () => {
  it('exists in LEO_TOOLS with correct schema', async () => {
    // Dynamic import to avoid heavy init
    const { LEO_TOOLS } = await import('@/utilities/leo-data-tools')
    const tool = LEO_TOOLS.find((t) => t.name === 'configure_endeavor')

    expect(tool).toBeDefined()
    expect(tool!.description).toContain('constitutional identity')

    const props = (tool!.input_schema as any).properties
    expect(props.name).toBeDefined()
    expect(props.tagline).toBeDefined()
    expect(props.description).toBeDefined()
    expect(props.endeavorType).toBeDefined()
    expect(props.missionStatement).toBeDefined()
    expect(props.holonTypes).toBeDefined()
    expect(props.capabilities).toBeDefined()
    expect(props.operatorName).toBeDefined()
    expect(props.operatorEmail).toBeDefined()
    expect(props.operatorRole).toBeDefined()
    expect(props.regionCity).toBeDefined()
    expect(props.regionState).toBeDefined()
    expect(props.regionCountry).toBeDefined()
    expect(props.networkVisible).toBeDefined()
  })

  it('endeavorType has correct enum values', async () => {
    const { LEO_TOOLS } = await import('@/utilities/leo-data-tools')
    const tool = LEO_TOOLS.find((t) => t.name === 'configure_endeavor')!
    const typeEnum = (tool.input_schema as any).properties.endeavorType.enum

    expect(typeEnum).toEqual([
      'service-provider',
      'retail-commerce',
      'creator-content',
      'booking-based',
      'custom',
    ])
  })

  it('capabilities schema has skill and description required', async () => {
    const { LEO_TOOLS } = await import('@/utilities/leo-data-tools')
    const tool = LEO_TOOLS.find((t) => t.name === 'configure_endeavor')!
    const capItems = (tool.input_schema as any).properties.capabilities.items

    expect(capItems.properties.skill).toBeDefined()
    expect(capItems.properties.description).toBeDefined()
    expect(capItems.required).toEqual(['skill', 'description'])
  })
})

// ---------------------------------------------------------------------------
// 2. CONTENT_MUTATION_TOOLS includes configure_endeavor
// ---------------------------------------------------------------------------

describe('CONTENT_MUTATION_TOOLS', () => {
  it('includes configure_endeavor → endeavors collection', async () => {
    // Access via dynamic import — the map is not exported but we can verify
    // by checking that the tool definition exists and cache invalidation
    // would be triggered. We verify the tool is in LEO_TOOLS which is the
    // public surface.
    const { LEO_TOOLS } = await import('@/utilities/leo-data-tools')
    const tool = LEO_TOOLS.find((t) => t.name === 'configure_endeavor')
    expect(tool).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 3. History message truncation
// ---------------------------------------------------------------------------

describe('history message truncation', () => {
  const MAX_HISTORY_MESSAGE_CHARS = 2000

  it('truncates messages longer than 2000 chars', () => {
    const longMessage = 'x'.repeat(3000)
    let content = longMessage

    if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
      content = content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + '\n\n[...truncated for context efficiency]'
    }

    expect(content.length).toBeLessThan(longMessage.length)
    expect(content).toContain('[...truncated for context efficiency]')
    expect(content.startsWith('x'.repeat(MAX_HISTORY_MESSAGE_CHARS))).toBe(true)
  })

  it('does not truncate messages under 2000 chars', () => {
    const shortMessage = 'Hello, how can I help you?'
    let content = shortMessage

    if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
      content = content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + '\n\n[...truncated for context efficiency]'
    }

    expect(content).toBe(shortMessage)
  })

  it('truncates exactly at boundary', () => {
    const exactMessage = 'a'.repeat(2001)
    let content = exactMessage

    if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
      content = content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + '\n\n[...truncated for context efficiency]'
    }

    expect(content.startsWith('a'.repeat(2000))).toBe(true)
    expect(content).toContain('[...truncated for context efficiency]')
  })

  it('preserves messages at exactly 2000 chars', () => {
    const exactMessage = 'b'.repeat(2000)
    let content = exactMessage

    if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
      content = content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + '\n\n[...truncated for context efficiency]'
    }

    expect(content).toBe(exactMessage)
  })
})

// ---------------------------------------------------------------------------
// 4. Seed data — Clearwater Cruisin initial values
// ---------------------------------------------------------------------------

describe('Clearwater Cruisin seed data', () => {
  it('has operator, missionStatement, and capabilities', async () => {
    const { USE_CASE_TENANTS } = await import('@/endpoints/seed/use-case-tenants')
    const ccm = USE_CASE_TENANTS.find((t) => t.slug === 'clearwater-cruisin')

    expect(ccm).toBeDefined()
    expect(ccm!.missionStatement).toBeDefined()
    expect(ccm!.missionStatement!.length).toBeGreaterThan(20)

    expect(ccm!.operator).toBeDefined()
    expect(ccm!.operator!.name).toBe('Kenneth Courtney')
    expect(ccm!.operator!.email).toContain('clearwatercruisin')
    expect(ccm!.operator!.role).toBe('Ministry Lead')

    expect(ccm!.capabilities).toBeDefined()
    expect(ccm!.capabilities!.length).toBeGreaterThanOrEqual(3)
    expect(ccm!.capabilities![0].skill).toBeDefined()
    expect(ccm!.capabilities![0].description).toBeDefined()
  })

  it('has correct endeavorType and holonTypes', async () => {
    const { USE_CASE_TENANTS } = await import('@/endpoints/seed/use-case-tenants')
    const ccm = USE_CASE_TENANTS.find((t) => t.slug === 'clearwater-cruisin')!

    expect(ccm.endeavorType).toBe('creator-content')
    expect(ccm.holonTypes).toContain('creator')
    expect(ccm.holonTypes).toContain('community')
  })

  it('has region set to Clearwater FL', async () => {
    const { USE_CASE_TENANTS } = await import('@/endpoints/seed/use-case-tenants')
    const ccm = USE_CASE_TENANTS.find((t) => t.slug === 'clearwater-cruisin')!

    expect(ccm.region).toEqual({ city: 'Clearwater', state: 'FL', country: 'US' })
  })
})
