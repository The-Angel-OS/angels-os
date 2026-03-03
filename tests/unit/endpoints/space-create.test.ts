/**
 * Space Create Endpoint — Unit Tests
 *
 * Tests for spaceCreateHandler (POST /api/spaces/create).
 * Covers: auth, tenant resolution, body validation, slug generation,
 * template channels, invitation sending, and success response shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/utilities/apiRateLimiter', () => ({
  applyRateLimit: vi.fn().mockReturnValue(null),
}))

vi.mock('@/utilities/spaceProvisioning', () => ({
  SPACE_TEMPLATES: {
    'service-provider': {
      channels: [
        { name: 'general', type: 'general', description: 'General discussion', isDefault: true },
        { name: 'services', type: 'general', description: 'Service listings' },
      ],
    },
  },
}))

vi.mock('@/utilities/invitationSystem', () => ({
  createInvitation: vi.fn().mockResolvedValue({ inviteUrl: 'https://test.com/invite/abc' }),
  isValidEmail: vi.fn().mockImplementation((email: string) => email.includes('@')),
}))

vi.mock('@/utilities/sendInvitationEmail', () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/middleware/detectTenant', () => ({
  detectTenantFromHostname: vi.fn().mockReturnValue('clearwater'),
}))

// ─── Import handler after mocks ───────────────────────────────────────────────

const { spaceCreateHandler } = await import('@/endpoints/space-create')
const { createInvitation } = await import('@/utilities/invitationSystem')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a mock Payload instance.
 * - find: returns { docs: [{ id: 10 }] } for tenant lookup by default
 * - create: returns the space doc on first call, {} for subsequent calls
 */
function makeMockPayload(overrides: Record<string, unknown> = {}) {
  let createCallCount = 0
  return {
    find: vi.fn().mockResolvedValue({ docs: [{ id: 10 }] }),
    create: vi.fn().mockImplementation(() => {
      createCallCount++
      if (createCallCount === 1) {
        return Promise.resolve({ id: 100, name: 'Test Space', slug: 'test-space' })
      }
      return Promise.resolve({})
    }),
    ...overrides,
  }
}

/**
 * Build a native Request with payload and user attached via Object.assign.
 * @param body   - object to JSON.stringify, or null to produce invalid JSON
 * @param opts   - optional overrides: user, tenantHeader, payloadOverrides
 */
function makeReq(
  body: Record<string, unknown> | null,
  opts: {
    user?: { id: string | number; name?: string } | null
    tenantHeader?: string | null
    payloadOverrides?: Record<string, unknown>
  } = {},
) {
  const { user = { id: 1, name: 'Test User' }, tenantHeader = null, payloadOverrides = {} } = opts

  const rawBody = body === null ? 'NOT VALID JSON {{{{' : JSON.stringify(body)
  const mockPayload = makeMockPayload(payloadOverrides)

  const headersInit: Record<string, string> = { 'Content-Type': 'application/json' }
  if (tenantHeader) {
    headersInit['x-tenant-id'] = tenantHeader
  }

  const baseRequest = new Request('http://localhost:3000/api/spaces/create', {
    method: 'POST',
    headers: headersInit,
    body: rawBody,
  })

  return Object.assign(baseRequest, { payload: mockPayload, user: user ?? null })
}

// ─── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe('spaceCreateHandler', () => {
  // 1. Returns 401 when no user
  it('returns 401 when no user', async () => {
    const req = makeReq({ name: 'My Space' }, { user: null })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/authentication/i)
  })

  // 2. Returns 400 when tenant cannot be resolved
  it('returns 400 when tenant cannot be resolved (empty docs)', async () => {
    const req = makeReq(
      { name: 'My Space' },
      {
        payloadOverrides: {
          find: vi.fn().mockResolvedValue({ docs: [] }),
        },
      },
    )
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/tenant/i)
  })

  // 3. Returns 400 for invalid JSON body
  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null) // null triggers invalid JSON string
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/json/i)
  })

  // 4. Returns 400 when name field is missing
  it('returns 400 when name field is missing', async () => {
    const req = makeReq({ description: 'No name here' })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/name/i)
  })

  // 5. Returns 400 when name is an empty string
  it('returns 400 when name is an empty string', async () => {
    const req = makeReq({ name: '' })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/name/i)
  })

  // 6. Returns 400 for invalid visibility value
  it('returns 400 for invalid visibility value ("restricted" is invalid)', async () => {
    const req = makeReq({ name: 'Test Space', visibility: 'restricted' })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/visibility/i)
  })

  // 7. Returns 200 on successful creation with space id, name, slug
  it('returns 200 on successful creation with space id, name, slug in response', async () => {
    const req = makeReq({ name: 'Test Space' })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.space).toBeDefined()
    expect(data.space.id).toBe(100)
    expect(data.space.name).toBe('Test Space')
    expect(data.space.slug).toBe('test-space')
  })

  // 8. Includes channelsCreated count >= 1 in the response
  it('includes channelsCreated count >= 1 in the response', async () => {
    const req = makeReq({ name: 'My Space' })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.channelsCreated).toBeGreaterThanOrEqual(1)
  })

  // 9. Generates correct slug from name
  it('generates correct slug: "My New Space" => "my-new-space"', async () => {
    let createCallCount = 0
    const req = makeReq(
      { name: 'My New Space' },
      {
        payloadOverrides: {
          create: vi.fn().mockImplementation(({ data }: any) => {
            createCallCount++
            if (createCallCount === 1) {
              return Promise.resolve({ id: 200, name: data.name, slug: data.slug })
            }
            return Promise.resolve({})
          }),
        },
      },
    )
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.space.slug).toBe('my-new-space')
  })

  // 10. Uses template channels when template='service-provider' is provided
  it('uses template channels when template="service-provider" is provided', async () => {
    let createCallCount = 0
    const mockCreate = vi.fn().mockImplementation(() => {
      createCallCount++
      if (createCallCount === 1) {
        return Promise.resolve({ id: 100, name: 'Test Space', slug: 'test-space' })
      }
      return Promise.resolve({})
    })

    const req = makeReq(
      { name: 'Test Space', template: 'service-provider' },
      {
        payloadOverrides: { create: mockCreate },
      },
    )
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()

    // The service-provider template has exactly 2 channels (general + services)
    expect(data.channelsCreated).toBe(2)

    // Verify that 'channels' collection was created with template channel names
    const channelCalls = mockCreate.mock.calls.filter(
      (c: any) => c[0]?.collection === 'channels',
    )
    const channelNames = channelCalls.map((c: any) => c[0]?.data?.name)
    expect(channelNames).toContain('general')
    expect(channelNames).toContain('services')
  })

  // 11. Calls createInvitation for each valid email in invites array
  it('calls createInvitation for each valid email in invites array', async () => {
    const req = makeReq({
      name: 'Test Space',
      invites: [
        { email: 'alice@example.com', role: 'member' },
        { email: 'bob@example.com', role: 'moderator' },
      ],
    })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    expect(createInvitation).toHaveBeenCalledTimes(2)
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com' }),
    )
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bob@example.com' }),
    )
  })

  // 12. Skips invalid emails in invites array
  it('skips invalid emails in invites array (email without @)', async () => {
    const req = makeReq({
      name: 'Test Space',
      invites: [
        { email: 'valid@example.com', role: 'member' },
        { email: 'notanemail', role: 'member' }, // no @ — invalid
      ],
    })
    const res = await spaceCreateHandler(req as any)
    expect(res.status).toBe(200)
    // Only the valid email should trigger createInvitation
    expect(createInvitation).toHaveBeenCalledTimes(1)
    expect(createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'valid@example.com' }),
    )
  })
})
