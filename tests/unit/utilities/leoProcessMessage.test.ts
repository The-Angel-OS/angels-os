/**
 * leoProcessMessage — Unit Tests
 *
 * Tests the leoProcessMessage orchestration function that routes messages
 * through ConversationEngine with optional agent lookup.
 *
 * Branches tested:
 *   - No payload provided → engine with empty sessionMemory, default LEO agent
 *   - agentId provided → uses getAgentById to resolve agent
 *   - No agentId → uses routeToAgent for channel-based routing
 *   - BYOAI key resolved from tenant aiConfig
 *   - response.text present → returned directly
 *   - response.text absent → default "received your message" fallback
 *   - federatedContext and pageContext passed into sessionMemory
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockHandleIncomingMessage = vi.fn()
const mockGetCurrentContext = vi.fn()

vi.mock('@/utilities/ConversationEngine', () => ({
  ConversationEngine: vi.fn().mockImplementation(() => ({
    handleIncomingMessage: mockHandleIncomingMessage,
    getCurrentContext: mockGetCurrentContext,
  })),
}))

const mockRouteToAgent = vi.fn()
const mockGetAgentById = vi.fn()

vi.mock('@/utilities/AgentRouter', () => ({
  routeToAgent: (...args: any[]) => mockRouteToAgent(...args),
  getAgentById: (...args: any[]) => mockGetAgentById(...args),
}))

import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { ConversationEngine } from '@/utilities/ConversationEngine'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue({ id: 1, aiConfig: {} }),
    ...overrides,
  } as any
}

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    agentType: 'leo',
    displayName: 'AngelBot',
    name: 'Angel',
    personality: 'helpful',
    capabilities: [],
    responseRules: [],
    ...overrides,
  }
}

function setupEngine(textResponse: string | null, conversationId = 'conv-123', phase = 'active') {
  mockHandleIncomingMessage.mockResolvedValue(
    textResponse !== null ? { text: textResponse } : {},
  )
  mockGetCurrentContext.mockReturnValue({ conversationId, phase })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('leoProcessMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── no-payload path ────────────────────────────────────────────────────────

  it('processes a message without payload using empty sessionMemory', async () => {
    setupEngine('Hello there!')
    const result = await leoProcessMessage({ message: 'Hi' })
    expect(result.text).toBe('Hello there!')
    expect(result.conversationId).toBe('conv-123')
    expect(result.agentName).toBe('LEO')
    expect(result.agentType).toBe('leo')
  })

  it('does NOT call routeToAgent when no payload is provided', async () => {
    setupEngine('Hi')
    await leoProcessMessage({ message: 'test', tenantId: 5 })
    expect(mockRouteToAgent).not.toHaveBeenCalled()
    expect(mockGetAgentById).not.toHaveBeenCalled()
  })

  // ── agentId path ──────────────────────────────────────────────────────────

  it('calls getAgentById when agentId is provided', async () => {
    const agent = makeAgent({ displayName: 'Guardian', agentType: 'guardian' })
    mockGetAgentById.mockResolvedValue(agent)
    setupEngine('Greetings!')
    const payload = makePayload()
    const result = await leoProcessMessage({
      message: 'Hello',
      payload,
      tenantId: 1,
      agentId: 'agent-1',
    })
    expect(mockGetAgentById).toHaveBeenCalledWith(payload, 'agent-1')
    expect(mockRouteToAgent).not.toHaveBeenCalled()
    expect(result.agentName).toBe('Guardian')
    expect(result.agentType).toBe('guardian')
  })

  it('uses routeToAgent when no agentId is given but payload and tenantId are set', async () => {
    const agent = makeAgent({ displayName: 'LEO', agentType: 'leo' })
    mockRouteToAgent.mockResolvedValue(agent)
    setupEngine('How can I help?')
    const payload = makePayload()
    await leoProcessMessage({
      message: 'Need help',
      payload,
      tenantId: 3,
      channelSlug: 'general',
    })
    expect(mockRouteToAgent).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ tenantId: 3, channelSlug: 'general', messageText: 'Need help' }),
    )
  })

  // ── BYOAI key ─────────────────────────────────────────────────────────────

  it('resolves BYOAI anthropicApiKey from tenant aiConfig', async () => {
    setupEngine('Response')
    const payload = makePayload({
      findByID: vi.fn().mockResolvedValue({
        id: 7,
        aiConfig: { anthropicApiKey: 'byoai-key-xyz' },
      }),
    })
    mockRouteToAgent.mockResolvedValue(null)
    await leoProcessMessage({ message: 'hi', payload, tenantId: 7 })
    // ConversationEngine should have been constructed with tenantAnthropicApiKey in sessionMemory
    const ctorArgs = vi.mocked(ConversationEngine).mock.calls[0][0] as any
    expect(ctorArgs.sessionMemory?.tenantAnthropicApiKey).toBe('byoai-key-xyz')
  })

  it('continues without BYOAI key when tenant findByID throws', async () => {
    setupEngine('Still works')
    const payload = makePayload({
      findByID: vi.fn().mockRejectedValue(new Error('DB error')),
    })
    mockRouteToAgent.mockResolvedValue(null)
    const result = await leoProcessMessage({ message: 'hi', payload, tenantId: 7 })
    expect(result.text).toBe('Still works')
    const ctorArgs = vi.mocked(ConversationEngine).mock.calls[0][0] as any
    expect(ctorArgs.sessionMemory?.tenantAnthropicApiKey).toBeUndefined()
  })

  // ── response variants ─────────────────────────────────────────────────────

  it('returns the engine text response when present', async () => {
    setupEngine('The weather is nice today.')
    const result = await leoProcessMessage({ message: 'Weather?' })
    expect(result.text).toBe('The weather is nice today.')
    expect(result.phase).toBe('active')
  })

  it('returns a default fallback when engine response has no text', async () => {
    setupEngine(null)
    const result = await leoProcessMessage({ message: 'Log this' })
    expect(result.text).toContain('received your message')
    expect(result.text).toContain('LEO')
  })

  it('uses agent displayName in fallback text when agent is resolved', async () => {
    const agent = makeAgent({ displayName: 'Clearwater Bot', agentType: 'custom' })
    mockRouteToAgent.mockResolvedValue(agent)
    setupEngine(null)
    const payload = makePayload()
    const result = await leoProcessMessage({ message: 'ping', payload, tenantId: 1 })
    expect(result.text).toContain('Clearwater Bot')
    expect(result.agentName).toBe('Clearwater Bot')
  })

  // ── sessionMemory composition ──────────────────────────────────────────────

  it('includes pageContext in sessionMemory when provided', async () => {
    setupEngine('OK')
    const payload = makePayload()
    mockRouteToAgent.mockResolvedValue(null)
    await leoProcessMessage({
      message: 'hi',
      payload,
      tenantId: 1,
      pageContext: '/shop/product-123',
    })
    const ctorArgs = vi.mocked(ConversationEngine).mock.calls[0][0] as any
    expect(ctorArgs.sessionMemory?.pageContext).toBe('/shop/product-123')
  })

  it('includes federatedContext in sessionMemory when provided', async () => {
    setupEngine('Federation OK')
    const payload = makePayload()
    mockRouteToAgent.mockResolvedValue(null)
    const federatedContext = {
      peerName: 'Clearwater Angels',
      trustLevel: 'vouched',
      federationId: 'fed-abc',
      peerDomain: 'clearwater.example.com',
    }
    await leoProcessMessage({ message: 'hello peer', payload, tenantId: 1, federatedContext })
    const ctorArgs = vi.mocked(ConversationEngine).mock.calls[0][0] as any
    expect(ctorArgs.sessionMemory?.federatedContext).toEqual(federatedContext)
  })

  it('includes spaceId and channelSlug in sessionMemory when provided', async () => {
    setupEngine('OK')
    const payload = makePayload()
    mockRouteToAgent.mockResolvedValue(null)
    await leoProcessMessage({
      message: 'test',
      payload,
      tenantId: 2,
      spaceId: 10,
      channelSlug: 'announcements',
    })
    const ctorArgs = vi.mocked(ConversationEngine).mock.calls[0][0] as any
    expect(ctorArgs.sessionMemory?.spaceId).toBe(10)
    expect(ctorArgs.sessionMemory?.channel).toBe('announcements')
  })

  // ── conversationId passthrough ────────────────────────────────────────────

  it('passes conversationId through to result', async () => {
    mockHandleIncomingMessage.mockResolvedValue({ text: 'reply' })
    mockGetCurrentContext.mockReturnValue({ conversationId: 'my-conv-456', phase: 'greeting' })
    const result = await leoProcessMessage({ message: 'hi', conversationId: 'my-conv-456' })
    expect(result.conversationId).toBe('my-conv-456')
  })
})
