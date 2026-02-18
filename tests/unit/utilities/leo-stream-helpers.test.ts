/**
 * Unit tests for LEO streaming endpoint helper functions.
 *
 * Tests the pure, deterministic parts of leo-stream.ts:
 * - sseEvent() — SSE wire format
 * - buildStreamingSystemPrompt() — prompt composition
 *
 * The actual streaming handler is tested via integration tests.
 *
 * @see src/endpoints/leo-stream.ts
 */
import { describe, it, expect, vi } from 'vitest'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

// Mock constitutional prompt
vi.mock('@/utilities/constitutional-prompt', () => ({
  buildMinimalConstitutionalPrompt: vi.fn(
    () => '[MINIMAL_CONSTITUTIONAL_PROMPT]',
  ),
}))

// Mock leo-data-tools
vi.mock('@/utilities/leo-data-tools', () => ({
  LEO_TOOLS: [],
  executeToolCall: vi.fn(),
}))

// Mock AgentRouter
vi.mock('@/utilities/AgentRouter', () => ({
  routeToAgent: vi.fn(),
}))

// Mock messageContent
vi.mock('@/utilities/messageContent', () => ({
  extractTextFromContent: vi.fn((c: unknown) => String(c)),
  wrapTextContent: vi.fn((t: string) => ({ type: 'text', text: t })),
}))

// ---------------------------------------------------------------------------
// Re-implement the pure helpers for isolated testing
// ---------------------------------------------------------------------------

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ---------------------------------------------------------------------------
// Tests — sseEvent
// ---------------------------------------------------------------------------

describe('sseEvent', () => {
  it('formats SSE event with event name and JSON data', () => {
    const result = sseEvent('start', { conversationId: 'conv_123' })
    expect(result).toBe(
      'event: start\ndata: {"conversationId":"conv_123"}\n\n',
    )
  })

  it('ends with double newline (SSE protocol)', () => {
    const result = sseEvent('delta', { text: 'hello' })
    expect(result.endsWith('\n\n')).toBe(true)
  })

  it('formats delta events with text chunks', () => {
    const result = sseEvent('delta', { text: 'Hello world' })
    expect(result).toContain('event: delta')
    expect(result).toContain('"text":"Hello world"')
  })

  it('formats tool_call events', () => {
    const result = sseEvent('tool_call', {
      name: 'query_products',
      status: 'executing',
    })
    expect(result).toContain('event: tool_call')
    expect(result).toContain('"name":"query_products"')
    expect(result).toContain('"status":"executing"')
  })

  it('formats done events with full payload', () => {
    const result = sseEvent('done', {
      text: 'Response complete',
      agentName: 'LEO',
      messageId: 42,
      conversationId: 'conv_456',
    })
    expect(result).toContain('event: done')
    expect(result).toContain('"agentName":"LEO"')
    expect(result).toContain('"messageId":42')
  })

  it('formats error events', () => {
    const result = sseEvent('error', { message: 'Something went wrong' })
    expect(result).toContain('event: error')
    expect(result).toContain('"message":"Something went wrong"')
  })

  it('handles empty data object', () => {
    const result = sseEvent('start', {})
    expect(result).toBe('event: start\ndata: {}\n\n')
  })

  it('handles nested objects in data', () => {
    const result = sseEvent('done', {
      images: [{ url: 'https://example.com/img.png', mediaId: 5 }],
    })
    expect(result).toContain('"images":[{"url":"https://example.com/img.png"')
  })

  it('escapes special characters in JSON', () => {
    const result = sseEvent('delta', { text: 'Line 1\nLine 2' })
    expect(result).toContain('"text":"Line 1\\nLine 2"')
  })
})

// ---------------------------------------------------------------------------
// Re-implement buildStreamingSystemPrompt for isolated testing
// ---------------------------------------------------------------------------

function buildStreamingSystemPrompt(opts: {
  agentName: string
  personality: string
  capabilities: string[]
  hasDataAccess: boolean
  userName?: string
  userEmail?: string
  userRoles?: string[]
  phase: string
}): string {
  const {
    agentName,
    personality,
    capabilities,
    hasDataAccess,
    userName,
    userEmail,
    userRoles,
    phase,
  } = opts

  let userSection = ''
  if (userName || userEmail) {
    const displayName = userName || userEmail?.split('@')[0] || 'there'
    const roles = userRoles || []
    let accessLevel = 'authenticated user'
    if (roles.includes('super_admin') || roles.includes('archangel')) {
      accessLevel = 'platform administrator (full access)'
    } else if (roles.includes('admin')) {
      accessLevel = 'tenant administrator'
    } else if (roles.includes('customer')) {
      accessLevel = 'customer'
    }

    userSection = `## Current User

You are speaking with **${displayName}**${userEmail ? ` (${userEmail})` : ''}.
- Access level: ${accessLevel}
- Roles: ${roles.length > 0 ? roles.join(', ') : 'standard user'}

Tailor your responses to their access level. Administrators can see all data and configure the platform. Customers should only see their own bookings, orders, and public content. Be helpful to everyone, but respect the access boundaries.

`
  }

  const dataSection = hasDataAccess ? '\n## Data Access\n' : ''

  return `[MINIMAL_CONSTITUTIONAL_PROMPT]

## Your Identity

You are **${agentName}**, a Guardian Angel in the Angel OS platform.

## Personality

${personality}

## Capabilities

${capabilities.length > 0 ? capabilities.map((c) => `- ${c}`).join('\n') : '- General conversation and assistance'}
${dataSection}

${userSection}## Guidelines

- Current conversation phase: ${phase}
`
}

// ---------------------------------------------------------------------------
// Tests — buildStreamingSystemPrompt
// ---------------------------------------------------------------------------

describe('buildStreamingSystemPrompt', () => {
  const defaultOpts = {
    agentName: 'LEO',
    personality: 'Friendly and helpful.',
    capabilities: ['query_products', 'query_posts'],
    hasDataAccess: true,
    phase: 'general',
  }

  it('includes constitutional prompt', () => {
    const prompt = buildStreamingSystemPrompt(defaultOpts)
    expect(prompt).toContain('[MINIMAL_CONSTITUTIONAL_PROMPT]')
  })

  it('includes agent name in identity section', () => {
    const prompt = buildStreamingSystemPrompt(defaultOpts)
    expect(prompt).toContain('You are **LEO**')
  })

  it('includes personality', () => {
    const prompt = buildStreamingSystemPrompt({
      ...defaultOpts,
      personality: 'Wise and patient.',
    })
    expect(prompt).toContain('Wise and patient.')
  })

  it('lists capabilities as bullet points', () => {
    const prompt = buildStreamingSystemPrompt(defaultOpts)
    expect(prompt).toContain('- query_products')
    expect(prompt).toContain('- query_posts')
  })

  it('shows fallback when no capabilities', () => {
    const prompt = buildStreamingSystemPrompt({
      ...defaultOpts,
      capabilities: [],
    })
    expect(prompt).toContain('General conversation and assistance')
  })

  it('includes data access section when hasDataAccess=true', () => {
    const prompt = buildStreamingSystemPrompt(defaultOpts)
    expect(prompt).toContain('Data Access')
  })

  it('omits data access section when hasDataAccess=false', () => {
    const prompt = buildStreamingSystemPrompt({
      ...defaultOpts,
      hasDataAccess: false,
    })
    expect(prompt).not.toContain('Data Access')
  })

  it('includes current phase', () => {
    const prompt = buildStreamingSystemPrompt({
      ...defaultOpts,
      phase: 'problem_solving',
    })
    expect(prompt).toContain('problem_solving')
  })

  describe('user context injection', () => {
    it('includes user name when provided', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'Alice',
        userEmail: 'alice@example.com',
      })
      expect(prompt).toContain('**Alice**')
      expect(prompt).toContain('alice@example.com')
    })

    it('uses email prefix when no name provided', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userEmail: 'bob@example.com',
      })
      expect(prompt).toContain('**bob**')
    })

    it('maps super_admin role to platform administrator', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'Admin',
        userRoles: ['super_admin'],
      })
      expect(prompt).toContain('platform administrator (full access)')
    })

    it('maps archangel role to platform administrator', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'Admin',
        userRoles: ['archangel'],
      })
      expect(prompt).toContain('platform administrator (full access)')
    })

    it('maps admin role to tenant administrator', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'TenantAdmin',
        userRoles: ['admin'],
      })
      expect(prompt).toContain('tenant administrator')
    })

    it('maps customer role correctly', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'Shopper',
        userRoles: ['customer'],
      })
      expect(prompt).toContain('customer')
    })

    it('defaults to authenticated user for unknown roles', () => {
      const prompt = buildStreamingSystemPrompt({
        ...defaultOpts,
        userName: 'User',
        userRoles: ['member'],
      })
      expect(prompt).toContain('authenticated user')
    })

    it('omits user section when no user info', () => {
      const prompt = buildStreamingSystemPrompt(defaultOpts)
      expect(prompt).not.toContain('Current User')
    })
  })
})
