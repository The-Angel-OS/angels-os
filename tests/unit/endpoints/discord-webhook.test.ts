/**
 * Discord Webhook Endpoint — Unit Tests
 *
 * Tests the Discord webhook handler (POST /api/discord/webhook).
 * Covers auth, request parsing, connector/user resolution, conversation IDs,
 * slash commands, LEO processing, AI Bus persistence, multi-tenant isolation,
 * and response shape.
 *
 * NOTE: The handler has an in-memory connector cache (60s TTL). Each test uses
 * a unique connectorId to avoid cache collisions between tests.
 *
 * Sprint 33 — Discord Integration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock modules that trigger Payload CMS initialization ───────
// ensureSystemSpace and logError import @payload-config which connects to Postgres
vi.mock('@/utilities/ensureSystemSpace', () => ({
  ensureDMSpace: vi.fn().mockResolvedValue('space-dm-1'),
  ensureAIBusSpace: vi.fn().mockResolvedValue('space-bus-1'),
  AI_BUS_SPACE_SLUG: 'ai-bus',
  DM_SPACE_SLUG: 'direct-messages',
}))

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn().mockResolvedValue(undefined),
  logCaughtError: vi.fn().mockResolvedValue(undefined),
}))

// ─── Mock leoProcessMessage ─────────────────────────────────────
const mockLeoProcessMessage = vi.fn().mockResolvedValue({
  text: 'I can help with that!',
  conversationId: 'discord-guild1-chan1',
  agentName: 'LEO',
  agentType: 'leo',
})

vi.mock('@/utilities/leoProcessMessage', () => ({
  leoProcessMessage: mockLeoProcessMessage,
}))

// ─── Mock formatForDiscord ──────────────────────────────────────
const mockFormatForDiscord = vi.fn((text: string) => `[discord] ${text}`)

vi.mock('@/utilities/discord-formatter', () => ({
  formatForDiscord: mockFormatForDiscord,
}))

// ─── Import handler after mocks ─────────────────────────────────
const { discordWebhookHandler } = await import('@/endpoints/discord-webhook')

// ─── Unique ID counter (avoids connector cache collisions) ──────
let idCounter = 0
function uid(prefix = 'conn'): string {
  return `${prefix}-${++idCounter}-${Date.now()}`
}

// ─── Factory: build a connector doc ─────────────────────────────

function makeConnector(overrides: Record<string, any> = {}) {
  const id = overrides.id ?? uid()
  return {
    id,
    type: 'discord',
    enabled: true,
    status: 'active',
    tenant: 'tenant-1',
    config: { webhookSecret: 'secret-abc' },
    ...overrides,
  }
}

// ─── Factory: build a request body ──────────────────────────────

function makeBody(overrides: Record<string, any> = {}) {
  return {
    type: 'message',
    content: 'Hello Angel OS',
    connectorId: 'conn-default',
    guildId: 'guild1',
    channelId: 'chan1',
    channelName: 'general',
    userId: 'disc-user-1',
    userName: 'TestUser',
    isDM: false,
    ...overrides,
  }
}

// ─── Factory: build a mock Payload instance ─────────────────────

function makeMockPayload(overrides: Record<string, any> = {}) {
  return {
    findByID: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn().mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'new-1', ...data }),
    ),
    update: vi.fn().mockResolvedValue({ id: 'updated' }),
    ...overrides,
  }
}

// ─── Factory: build a proxied Request with payload attached ─────

function makeReq(
  body: Record<string, any>,
  opts: {
    headers?: Record<string, string>
    payloadOverrides?: Record<string, any>
  } = {},
) {
  const bodyStr = JSON.stringify(body)
  const reqHeaders = new Headers({
    'Content-Type': 'application/json',
    'x-discord-secret': 'secret-abc',
    ...(opts.headers ?? {}),
  })

  const mockPayload = makeMockPayload(opts.payloadOverrides ?? {})

  const baseRequest = new Request('http://localhost:3000/api/discord/webhook', {
    method: 'POST',
    headers: reqHeaders,
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

/** Build a request whose body is not valid JSON */
function makeInvalidJsonReq() {
  const reqHeaders = new Headers({ 'Content-Type': 'text/plain' })
  const mockPayload = makeMockPayload()

  const baseRequest = new Request('http://localhost:3000/api/discord/webhook', {
    method: 'POST',
    headers: reqHeaders,
    body: 'not json at all',
  })

  return new Proxy(baseRequest, {
    get(target, prop) {
      if (prop === 'payload') return mockPayload
      if (prop === 'user') return null
      return (target as any)[prop]
    },
  })
}

/** Extract the mock payload from a proxied request */
function getPayload(req: any): ReturnType<typeof makeMockPayload> {
  return req.payload
}

/**
 * Helper: build a fully-wired request that will pass auth + connector checks.
 * Returns { req, connector, body, payload } for easy assertion access.
 */
function makeValidReq(
  bodyOverrides: Record<string, any> = {},
  connectorOverrides: Record<string, any> = {},
  payloadOverrides: Record<string, any> = {},
  headerOverrides: Record<string, string> = {},
) {
  const connector = makeConnector(connectorOverrides)
  const body = makeBody({
    connectorId: connector.id,
    ...bodyOverrides,
  })
  const secret = connector.config?.webhookSecret ?? 'secret-abc'

  const req = makeReq(body, {
    headers: { 'x-discord-secret': secret, ...headerOverrides },
    payloadOverrides: {
      findByID: vi.fn().mockResolvedValue(connector),
      ...payloadOverrides,
    },
  })

  return { req, connector, body, payload: getPayload(req) }
}

// ─── Reset ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockLeoProcessMessage.mockResolvedValue({
    text: 'I can help with that!',
    conversationId: 'discord-guild1-chan1',
    agentName: 'LEO',
    agentType: 'leo',
  })
  mockFormatForDiscord.mockImplementation((text: string) => `[discord] ${text}`)
})

// ═══════════════════════════════════════════════════════════════
// Auth (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('Auth', () => {
  it('passes with valid webhook secret', async () => {
    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('rejects with invalid webhook secret → 401', async () => {
    const { req } = makeValidReq({}, {}, {}, { 'x-discord-secret': 'wrong-secret' })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('rejects with missing secret when connector requires one → 401', async () => {
    const connector = makeConnector()
    const body = makeBody({ connectorId: connector.id })

    // Build request WITHOUT x-discord-secret header
    const reqHeaders = new Headers({ 'Content-Type': 'application/json' })
    const mockPayload = makeMockPayload({
      findByID: vi.fn().mockResolvedValue(connector),
    })
    const baseRequest = new Request('http://localhost:3000/api/discord/webhook', {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(body),
    })
    const proxyReq = new Proxy(baseRequest, {
      get(target, prop) {
        if (prop === 'payload') return mockPayload
        if (prop === 'user') return null
        return (target as any)[prop]
      },
    })

    const res = await discordWebhookHandler(proxyReq as any)
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown connectorId', async () => {
    const unknownId = uid('unknown')
    const body = makeBody({ connectorId: unknownId })
    const req = makeReq(body, {
      payloadOverrides: {
        findByID: vi.fn().mockResolvedValue(null),
      },
    })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe('Unknown connector')
  })
})

// ═══════════════════════════════════════════════════════════════
// Request Parsing (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('Request parsing', () => {
  it('accepts a valid message body', async () => {
    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('accepts a valid slash command body', async () => {
    const { req } = makeValidReq({
      type: 'slash_command',
      commandName: 'pulse',
      content: '',
    })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)
  })

  it('rejects missing content for message type → 400', async () => {
    // connectorId validation happens AFTER content validation,
    // so we still need a connectorId but content is empty
    const { req } = makeValidReq({ content: '' })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Missing')
  })

  it('rejects missing connectorId → 400', async () => {
    const connector = makeConnector()
    const body = makeBody({ connectorId: '', content: 'Hello' })
    const req = makeReq(body, {
      payloadOverrides: {
        findByID: vi.fn().mockResolvedValue(connector),
      },
    })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('connectorId')
  })
})

// ═══════════════════════════════════════════════════════════════
// Connector Resolution (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('Connector resolution', () => {
  it('resolves a valid connector via findByID', async () => {
    const { req, connector, payload } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)
    expect(payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'connectors',
        id: connector.id,
      }),
    )
  })

  it('rejects disabled connector → 403', async () => {
    const { req } = makeValidReq({}, { enabled: false })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('disabled')
  })

  it('rejects wrong connector type → 400', async () => {
    const { req } = makeValidReq({}, { type: 'slack' })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('discord')
  })

  it('resolves tenant from connector', async () => {
    const { req } = makeValidReq({}, { tenant: 'tenant-resolved' })
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-resolved',
      }),
    )
  })

  it('updates lastActivity after success', async () => {
    const { req, connector, payload } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'connectors',
        id: connector.id,
        data: expect.objectContaining({
          lastActivity: expect.any(String),
          status: 'active',
        }),
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// User Resolution (5 tests)
// ═══════════════════════════════════════════════════════════════

describe('User resolution', () => {
  it('finds existing guest user by synthetic email', async () => {
    // findOrCreateGuestUser resolves users via synthetic email: discord-{userId}@guests.angel-os.local
    const userId = 'disc-user-1' // default from makeBody
    const syntheticEmail = `discord-${userId}@guests.angel-os.local`
    const existingUser = { id: 'user-55', name: 'ExistingUser', email: syntheticEmail }

    const { req } = makeValidReq({}, {}, {
      find: vi.fn().mockImplementation(({ where }: any) => {
        if (where?.email?.equals === syntheticEmail) {
          return Promise.resolve({ docs: [existingUser] })
        }
        return Promise.resolve({ docs: [] })
      }),
    })

    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: expect.objectContaining({
          id: 'user-55',
          email: syntheticEmail,
        }),
      }),
    )
  })

  it('creates a guest user with synthetic email when no linked user', async () => {
    const userId = uid('discuser')
    const { req, payload } = makeValidReq({ userId })

    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          email: `discord-${userId}@guests.angel-os.local`,
          name: 'TestUser',
          roles: ['customer'],
        }),
      }),
    )
  })

  it('reuses existing guest user on subsequent messages', async () => {
    const userId = uid('discuser')
    const syntheticEmail = `discord-${userId}@guests.angel-os.local`
    const existingGuest = { id: 'guest-77', name: 'TestUser', email: syntheticEmail }

    const { req, payload } = makeValidReq({ userId }, {}, {
      find: vi.fn().mockImplementation(({ where }: any) => {
        if (where?.['socialProviders.providerId']) {
          return Promise.resolve({ docs: [] })
        }
        if (where?.email?.equals === syntheticEmail) {
          return Promise.resolve({ docs: [existingGuest] })
        }
        return Promise.resolve({ docs: [] })
      }),
    })

    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    // Should NOT create a new user since guest already exists
    expect(payload.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users' }),
    )

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: expect.objectContaining({
          id: 'guest-77',
        }),
      }),
    )
  })

  it('guest email format is discord-{id}@guests.angel-os.local', async () => {
    const userId = uid('abc123xyz')
    const { req, payload } = makeValidReq({ userId })

    await discordWebhookHandler(req as any)

    // The second find call should look up the guest by synthetic email
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: `discord-${userId}@guests.angel-os.local` },
        }),
      }),
    )
  })

  it('passes display name through to user creation', async () => {
    const { req, payload } = makeValidReq({ userName: 'CoolDiscordNick' })

    await discordWebhookHandler(req as any)

    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({
          name: 'CoolDiscordNick',
          socialProviders: expect.arrayContaining([
            expect.objectContaining({
              displayName: 'CoolDiscordNick',
            }),
          ]),
        }),
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// ConversationId (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('ConversationId', () => {
  it('channel format: discord-{guildId}-{channelId}', async () => {
    const { req } = makeValidReq({
      guildId: 'g100',
      channelId: 'c200',
      isDM: false,
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'discord-g100-c200',
      }),
    )
  })

  it('DM format: discord-dm-{userId}', async () => {
    const { req } = makeValidReq({
      isDM: true,
      userId: 'u999',
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'discord-dm-u999',
      }),
    )
  })

  it('thread format: discord-{guildId}-{threadId}', async () => {
    const { req } = makeValidReq({
      guildId: 'g100',
      threadId: 'thread-42',
      isDM: false,
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'discord-g100-thread-42',
      }),
    )
  })

  it('deterministic — same input produces same conversationId', async () => {
    // Both requests use the same guild+channel but unique connectors
    const { req: req1 } = makeValidReq({ guildId: 'gD', channelId: 'cD' })
    await discordWebhookHandler(req1 as any)
    const call1 = mockLeoProcessMessage.mock.calls[0][0].conversationId

    mockLeoProcessMessage.mockClear()

    const { req: req2 } = makeValidReq({ guildId: 'gD', channelId: 'cD' })
    await discordWebhookHandler(req2 as any)
    const call2 = mockLeoProcessMessage.mock.calls[0][0].conversationId

    expect(call1).toBe(call2)
    expect(call1).toBe('discord-gD-cD')
  })
})

// ═══════════════════════════════════════════════════════════════
// Slash Commands (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('Slash commands', () => {
  it('/pulse → "Show me the federation pulse"', async () => {
    const { req } = makeValidReq({
      type: 'slash_command',
      commandName: 'pulse',
      content: '',
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Show me the federation pulse',
      }),
    )
  })

  it('/weather → "Give me the federation weather report"', async () => {
    const { req } = makeValidReq({
      type: 'slash_command',
      commandName: 'weather',
      content: '',
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Give me the federation weather report',
      }),
    )
  })

  it('/ask → uses content directly', async () => {
    const { req } = makeValidReq({
      type: 'slash_command',
      commandName: 'ask',
      content: 'What is the meaning of life?',
    })
    await discordWebhookHandler(req as any)

    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'What is the meaning of life?',
      }),
    )
  })

  it('unknown command → falls back to content or /commandName', async () => {
    const { req } = makeValidReq({
      type: 'slash_command',
      commandName: 'foobar',
      content: '',
    })
    await discordWebhookHandler(req as any)

    // When content is empty, should use /commandName
    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '/foobar',
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// LEO Processing (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('LEO processing', () => {
  it('success returns formatted text', async () => {
    mockLeoProcessMessage.mockResolvedValueOnce({
      text: 'Federation is healthy',
      conversationId: 'discord-guild1-chan1',
      agentName: 'LEO',
    })

    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.text).toBe('[discord] Federation is healthy')
  })

  it('LEO error returns 500 with fallback message', async () => {
    mockLeoProcessMessage.mockRejectedValueOnce(new Error('Model timeout'))

    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(500)

    const data = await res.json()
    expect(data.text).toBeDefined()
    expect(data.error).toBeDefined()
  })

  it('formats response via formatForDiscord', async () => {
    mockLeoProcessMessage.mockResolvedValueOnce({
      text: '# Big Heading\nSome **bold** text',
      conversationId: 'discord-guild1-chan1',
      agentName: 'LEO',
    })

    const { req } = makeValidReq()
    await discordWebhookHandler(req as any)

    expect(mockFormatForDiscord).toHaveBeenCalledWith('# Big Heading\nSome **bold** text')
  })

  it('passes tenant and channel context to LEO', async () => {
    const { req } = makeValidReq(
      { channelId: 'chan-support', channelName: 'support-tickets' },
      { tenant: 'tenant-ctx' },
    )
    await discordWebhookHandler(req as any)

    // channelSlug is derived from channelId: `discord-${channelId}`
    expect(mockLeoProcessMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-ctx',
        channelSlug: 'discord-chan-support',
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// AI Bus Persistence (4 tests)
// ═══════════════════════════════════════════════════════════════

describe('AI Bus persistence', () => {
  it('saves user message with discord_message type', async () => {
    const { req, payload } = makeValidReq()

    await discordWebhookHandler(req as any)

    const createCalls = payload.create.mock.calls
    const messageCalls = createCalls.filter((c: any) => c[0]?.collection === 'messages')

    expect(messageCalls.length).toBeGreaterThanOrEqual(1)
    const userMsg = messageCalls.find(
      (c: any) => c[0]?.data?.messageType === 'discord_message',
    )
    expect(userMsg).toBeDefined()
    expect(userMsg![0].data.content.text).toBe('Hello Angel OS')
  })

  it('saves LEO response with ai_agent type', async () => {
    const { req, payload } = makeValidReq()

    await discordWebhookHandler(req as any)

    const createCalls = payload.create.mock.calls
    const messageCalls = createCalls.filter((c: any) => c[0]?.collection === 'messages')

    const agentMsg = messageCalls.find(
      (c: any) => c[0]?.data?.messageType === 'ai_agent',
    )
    expect(agentMsg).toBeDefined()
    expect(agentMsg![0].data.metadata.agentName).toBe('LEO')
  })

  it('metadata includes connectorId', async () => {
    const { req, connector, payload } = makeValidReq()

    await discordWebhookHandler(req as any)

    const createCalls = payload.create.mock.calls
    const messageCalls = createCalls.filter((c: any) => c[0]?.collection === 'messages')

    expect(messageCalls.length).toBeGreaterThanOrEqual(1)
    for (const call of messageCalls) {
      expect(call[0].data.metadata.connectorId).toBe(connector.id)
    }
  })

  it('persistence failure is non-fatal — response still returns 200', async () => {
    const { req } = makeValidReq({}, {}, {
      create: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'messages') {
          return Promise.reject(new Error('DB write failed'))
        }
        // User creation still works
        return Promise.resolve({ id: 'new-1', email: 'test@test.com', name: 'Test' })
      }),
    })

    const res = await discordWebhookHandler(req as any)

    // Should still return 200 since AI Bus persistence is non-fatal
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.text).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════
// Multi-tenant (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Multi-tenant', () => {
  it('different connectors resolve to different tenants', async () => {
    const { req: req1 } = makeValidReq({}, { tenant: 'tenant-alpha' })
    await discordWebhookHandler(req1 as any)
    const call1TenantId = mockLeoProcessMessage.mock.calls[0][0].tenantId

    mockLeoProcessMessage.mockClear()

    const { req: req2 } = makeValidReq({}, { tenant: 'tenant-beta' })
    await discordWebhookHandler(req2 as any)
    const call2TenantId = mockLeoProcessMessage.mock.calls[0][0].tenantId

    expect(call1TenantId).toBe('tenant-alpha')
    expect(call2TenantId).toBe('tenant-beta')
    expect(call1TenantId).not.toBe(call2TenantId)
  })

  it('guest user is scoped to tenant', async () => {
    const { req, payload } = makeValidReq({}, { tenant: 'tenant-42' })

    await discordWebhookHandler(req as any)

    const userCreateCall = payload.create.mock.calls.find(
      (c: any) => c[0]?.collection === 'users',
    )
    expect(userCreateCall).toBeDefined()
    expect(userCreateCall![0].data.tenant).toBe('tenant-42')
  })

  it('connector webhook secret is per-tenant (different secrets)', async () => {
    // Tenant A: secret 'aaa', request sends 'aaa' → 200
    const { req: reqA } = makeValidReq(
      {},
      { config: { webhookSecret: 'aaa' } },
      {},
      { 'x-discord-secret': 'aaa' },
    )
    const resA = await discordWebhookHandler(reqA as any)
    expect(resA.status).toBe(200)

    // Tenant B: secret 'bbb', but request sends 'aaa' → 401
    const { req: reqB } = makeValidReq(
      {},
      { config: { webhookSecret: 'bbb' } },
      {},
      { 'x-discord-secret': 'aaa' },
    )
    const resB = await discordWebhookHandler(reqB as any)
    expect(resB.status).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════
// Response Shape (3 tests)
// ═══════════════════════════════════════════════════════════════

describe('Response shape', () => {
  it('returns text, conversationId, and agentName', async () => {
    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveProperty('text')
    expect(data).toHaveProperty('conversationId')
    expect(data).toHaveProperty('agentName')
    expect(typeof data.text).toBe('string')
    expect(typeof data.conversationId).toBe('string')
    expect(typeof data.agentName).toBe('string')
  })

  it('agentName defaults to LEO', async () => {
    mockLeoProcessMessage.mockResolvedValueOnce({
      text: 'Hello!',
      conversationId: 'conv-1',
      agentName: undefined,
    })

    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    const data = await res.json()

    expect(data.agentName).toBe('LEO')
  })

  it('text is Discord-formatted via formatForDiscord', async () => {
    mockLeoProcessMessage.mockResolvedValueOnce({
      text: 'Raw markdown response',
      conversationId: 'conv-1',
      agentName: 'LEO',
    })

    const { req } = makeValidReq()
    const res = await discordWebhookHandler(req as any)
    const data = await res.json()

    // Our mock prefixes with [discord]
    expect(data.text).toBe('[discord] Raw markdown response')
    expect(mockFormatForDiscord).toHaveBeenCalledWith('Raw markdown response')
  })
})
