/**
 * Sprint 19 — Vapi Voice AI Webhook Tests
 *
 * Tests the Vapi webhook endpoint handling for phone-based Leo access.
 * Covers:
 * - Single-number platform routing (tenant resolution from conversation)
 * - Dedicated number routing (tenant-specific phone number)
 * - Tenant name fuzzy matching from caller speech
 * - AI Bus persistence (voice messages → Messages collection)
 * - All Vapi event types
 *
 * Uses proxy-based mocking since Request.headers is a non-writable getter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock leoProcessMessage ─────────────────────────────────────
vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: vi.fn().mockResolvedValue({
    text: 'I can help with that!',
    conversationId: 'conv-123',
    agentName: 'LEO',
    agentType: 'leo',
  }),
}))

// ─── Import after mock ──────────────────────────────────────────
const { vapiWebhookHandler, matchTenantByName, resolveTenantFromConversation } = await import(
  '@/endpoints/vapi-webhook'
)

// ─── Mock Tenant Data ───────────────────────────────────────────

const MOCK_TENANTS = [
  {
    id: 1,
    slug: 'angel-os',
    name: 'Angel OS',
    type: 'platform',
    status: 'active',
    branding: { siteName: 'Angel OS' },
    vapi: { enabled: false },
  },
  {
    id: 42,
    slug: 'hays-cactus',
    name: 'Hays Cactus',
    type: 'tenant',
    status: 'active',
    branding: { siteName: 'Hays Cactus Co' },
    vapi: { enabled: true, phoneNumber: '+17274408797', greeting: 'Howdy from Hays Cactus!' },
  },
  {
    id: 43,
    slug: 'sunny-bakery',
    name: 'Sunny Side Bakery',
    type: 'tenant',
    status: 'active',
    branding: { siteName: 'Sunny Side Bakery' },
    vapi: { enabled: false },
  },
  {
    id: 44,
    slug: 'grace-church',
    name: 'Grace Community Church',
    type: 'ministry',
    status: 'active',
    branding: { siteName: 'Grace Community' },
    vapi: { enabled: false },
  },
]

// ─── Helpers ────────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>) {
  const bodyStr = JSON.stringify(body)
  const headers = new Headers({ 'Content-Type': 'application/json' })

  const mockCreate = vi.fn().mockResolvedValue({ id: 1 })
  const mockPayload = {
    find: vi.fn().mockImplementation(({ where }: any) => {
      // Return all active tenants
      if (where?.status?.equals === 'active' && !where?.slug && !where?.tenant) {
        return Promise.resolve({ docs: MOCK_TENANTS })
      }
      // Space lookup
      if (where?.tenant) {
        return Promise.resolve({ docs: [{ id: 10 }] })
      }
      // Default tenant fallback
      return Promise.resolve({ docs: [MOCK_TENANTS[0]] })
    }),
    create: mockCreate,
  }

  const baseRequest = new Request('http://localhost:3000/api/vapi/webhook', {
    method: 'POST',
    headers,
    body: bodyStr,
  })

  return new Proxy(baseRequest, {
    get(target, prop) {
      if (prop === 'payload') return mockPayload
      if (prop === 'user') return null
      return (target as any)[prop]
    },
  })
}

function makeInvalidReq() {
  const headers = new Headers({ 'Content-Type': 'text/plain' })

  const baseRequest = new Request('http://localhost:3000/api/vapi/webhook', {
    method: 'POST',
    headers,
    body: 'not json',
  })

  return new Proxy(baseRequest, {
    get(target, prop) {
      if (prop === 'payload') return { find: vi.fn(), create: vi.fn() }
      if (prop === 'user') return null
      return (target as any)[prop]
    },
  })
}

// ─── Core Event Handling Tests ──────────────────────────────────

describe('Vapi Webhook Handler', () => {
  it('rejects requests with invalid JSON', async () => {
    const req = makeInvalidReq()
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects requests without message.type', async () => {
    const req = makeReq({ message: {} })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(400)
  })

  it('returns platform assistant config for assistant-request (no dedicated number)', async () => {
    const req = makeReq({ message: { type: 'assistant-request' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.assistant).toBeDefined()
    expect(data.assistant.name).toBe('LEO')
    expect(data.assistant.model.provider).toBe('anthropic')
    // Platform mode: asks which business
    expect(data.assistant.firstMessage).toContain('Which business')
    expect(data.assistant.model.systemPrompt).toContain('shared phone line')
  })

  it('acknowledges status-update events', async () => {
    const req = makeReq({ message: { type: 'status-update', status: 'in-progress' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('acknowledges transcript events', async () => {
    const req = makeReq({ message: { type: 'transcript' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('acknowledges speech-update events', async () => {
    const req = makeReq({ message: { type: 'speech-update' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('acknowledges hang events', async () => {
    const req = makeReq({ message: { type: 'hang' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('handles end-of-call-report', async () => {
    const req = makeReq({
      message: {
        type: 'end-of-call-report',
        endedReason: 'customer-ended-call',
        summary: 'Customer asked about order status.',
      },
    })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('handles unknown event types gracefully', async () => {
    const req = makeReq({ message: { type: 'some-new-event-type' } })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('handles function-call with check_order_status', async () => {
    const req = makeReq({
      message: {
        type: 'function-call',
        functionCall: {
          name: 'check_order_status',
          parameters: { orderId: 42 },
        },
      },
    })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.result).toBeDefined()
  })

  it('handles function-call without functionCall object', async () => {
    const req = makeReq({
      message: {
        type: 'function-call',
      },
    })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.result).toContain('No function call')
  })
})

// ─── Dedicated Number Routing Tests ─────────────────────────────

describe('Dedicated Number Routing', () => {
  it('returns tenant-specific config when dedicated number matches', async () => {
    const req = makeReq({
      message: {
        type: 'assistant-request',
        call: {
          phoneNumber: { number: '+17274408797' },
        },
      },
    })
    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.assistant).toBeDefined()
    // Should use Hays Cactus custom greeting
    expect(data.assistant.firstMessage).toBe('Howdy from Hays Cactus!')
    // Should include tenant name in end call message
    expect(data.assistant.endCallMessage).toContain('Hays Cactus')
    // Should use tenant-specific voice prompt
    expect(data.assistant.model.systemPrompt).toContain('Hays Cactus')
    // Should NOT contain routing instructions
    expect(data.assistant.model.systemPrompt).not.toContain('shared phone line')
  })

  it('falls back to platform mode for unknown numbers', async () => {
    const req = makeReq({
      message: {
        type: 'assistant-request',
        call: {
          phoneNumber: { number: '+19995551234' },
        },
      },
    })
    const res = await vapiWebhookHandler(req as any)
    const data = await res.json()

    // Platform mode: routing prompt
    expect(data.assistant.firstMessage).toContain('Which business')
  })
})

// ─── Tenant Name Matching Tests ─────────────────────────────────

describe('matchTenantByName', () => {
  it('matches exact siteName', () => {
    const result = matchTenantByName('I need to reach Hays Cactus Co', MOCK_TENANTS)
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('hays-cactus')
  })

  it('matches exact tenant name', () => {
    const result = matchTenantByName("I'm calling for Sunny Side Bakery", MOCK_TENANTS)
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('sunny-bakery')
  })

  it('matches slug with hyphens converted to spaces', () => {
    const result = matchTenantByName('hays cactus please', MOCK_TENANTS)
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('hays-cactus')
  })

  it('matches partial words of tenant name', () => {
    const result = matchTenantByName("I'm looking for grace community", MOCK_TENANTS)
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('grace-church')
  })

  it('is case-insensitive', () => {
    const result = matchTenantByName('SUNNY SIDE BAKERY', MOCK_TENANTS)
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('sunny-bakery')
  })

  it('skips platform tenant', () => {
    const result = matchTenantByName('Angel OS', MOCK_TENANTS)
    expect(result).toBeNull()
  })

  it('returns null for no match', () => {
    const result = matchTenantByName('some random business that does not exist', MOCK_TENANTS)
    expect(result).toBeNull()
  })

  it('returns null for empty speech', () => {
    const result = matchTenantByName('', MOCK_TENANTS)
    expect(result).toBeNull()
  })

  it('prefers exact siteName over partial match', () => {
    const tenants = [
      {
        id: 10,
        slug: 'grace-a',
        name: 'Grace',
        type: 'tenant',
        branding: { siteName: 'Grace' },
      },
      {
        id: 11,
        slug: 'grace-b',
        name: 'Amazing Grace Ministries',
        type: 'tenant',
        branding: { siteName: 'Amazing Grace' },
      },
    ]
    // "Amazing Grace" exact siteName should win over partial "Grace"
    const result = matchTenantByName('I need Amazing Grace', tenants)
    expect(result?.slug).toBe('grace-b')
  })
})

// ─── AI Bus Persistence Tests ────────────────────────────────────

describe('AI Bus Voice Persistence', () => {
  it('persists end-of-call report to AI Bus', async () => {
    const req = makeReq({
      message: {
        type: 'end-of-call-report',
        endedReason: 'customer-ended-call',
        summary: 'Customer asked about cactus care.',
        call: {
          id: 'call-abc-123',
          phoneNumber: { number: '+17274408797' },
        },
      },
    })

    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    // Verify payload.create was called to persist the message
    const mockPayload = (req as any).payload
    expect(mockPayload.create).toHaveBeenCalled()

    const createCall = mockPayload.create.mock.calls[0][0]
    expect(createCall.collection).toBe('messages')
    expect(createCall.data.channel).toBe('voice')
    expect(createCall.data.messageType).toBe('system')
    expect(createCall.data.visibility).toBe('tenant')
  })

  it('persists conversation updates to AI Bus when tenant is resolved', async () => {
    const req = makeReq({
      message: {
        type: 'conversation-update',
        conversation: [
          { role: 'assistant', content: 'Which business are you calling for?' },
          { role: 'user', content: "I'm calling for Sunny Side Bakery" },
          { role: 'assistant', content: 'Connecting you with Sunny Side Bakery!' },
          { role: 'user', content: 'What are your hours today?' },
        ],
        call: { id: 'call-xyz' },
      },
    })

    const res = await vapiWebhookHandler(req as any)
    expect(res.status).toBe(200)

    // Should have persisted caller + assistant messages
    const mockPayload = (req as any).payload
    expect(mockPayload.create).toHaveBeenCalledTimes(2) // caller + assistant
  })
})

// ─── Voice Call Content Helper Tests ─────────────────────────────

describe('Voice Call UMS Content', () => {
  it('creates voice_call content with caller role', async () => {
    const { createVoiceCallContent } = await import('@/utilities/messageContent')

    const content = createVoiceCallContent('Hello, I need help with my order', {
      role: 'caller',
      callId: 'call-123',
      callerPhone: '+15551234567',
    })

    expect(content.type).toBe('voice_call')
    expect(content.text).toBe('Hello, I need help with my order')
    expect(content.data).toBeDefined()
    expect((content.data as any).role).toBe('caller')
    expect((content.data as any).callId).toBe('call-123')
    expect((content.data as any).timestamp).toBeDefined()
  })

  it('creates voice_call content with assistant role', async () => {
    const { createVoiceCallContent } = await import('@/utilities/messageContent')

    const content = createVoiceCallContent('I can check that for you!', {
      role: 'assistant',
      callId: 'call-123',
    })

    expect(content.type).toBe('voice_call')
    expect((content.data as any).role).toBe('assistant')
  })

  it('creates voice_call content with system role for end-of-call', async () => {
    const { createVoiceCallContent } = await import('@/utilities/messageContent')

    const content = createVoiceCallContent('Call ended — customer satisfied', {
      role: 'system',
      callId: 'call-123',
      recordingUrl: 'https://recordings.vapi.ai/call-123.wav',
      endedReason: 'customer-ended-call',
      duration: 120,
    })

    expect(content.type).toBe('voice_call')
    expect((content.data as any).role).toBe('system')
    expect((content.data as any).recordingUrl).toContain('vapi.ai')
    expect((content.data as any).endedReason).toBe('customer-ended-call')
    expect((content.data as any).duration).toBe(120)
  })
})
