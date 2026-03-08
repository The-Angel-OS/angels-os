/**
 * Sprint 42 — User Propagation Layer Tests
 *
 * Tests for ensureTenantMembership: the idempotent, non-fatal utility
 * that auto-creates TenantMemberships when users interact cross-Endeavor.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ensureTenantMembership,
  type PropagationTrigger,
  type EnsureTenantMembershipResult,
} from '@/utilities/ensureTenantMembership'

// ── Mock Payload Factory ────────────────────────────────────────

interface MockPayloadOptions {
  existingMemberships?: unknown[]
  createReturn?: unknown
  findThrows?: boolean
  createThrows?: boolean
}

function makePayload(opts: MockPayloadOptions = {}) {
  const {
    existingMemberships = [],
    createReturn = { id: 'new-membership-123' },
    findThrows = false,
    createThrows = false,
  } = opts

  return {
    find: findThrows
      ? vi.fn().mockRejectedValue(new Error('DB find error'))
      : vi.fn().mockResolvedValue({ docs: existingMemberships }),
    create: createThrows
      ? vi.fn().mockRejectedValue(new Error('DB create error'))
      : vi.fn().mockResolvedValue(createReturn),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as any
}

// ── Tests ───────────────────────────────────────────────────────

describe('ensureTenantMembership', () => {
  // ── Guard Clauses ───────────────────────────────────────────

  describe('guard clauses', () => {
    it('skips when userId is falsy (empty string)', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, '', 'tenant-1', 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.error).toContain('No user ID')
      expect(payload.find).not.toHaveBeenCalled()
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('skips when userId is 0', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, 0 as any, 'tenant-1', 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
    })

    it('skips when userId is null', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, null as any, 'tenant-1', 'booking')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
    })

    it('skips when tenantId is falsy (empty string)', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, 'user-1', '', 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.error).toContain('No tenant ID')
      expect(payload.find).not.toHaveBeenCalled()
    })

    it('skips when tenantId is 0', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, 'user-1', 0 as any, 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
    })

    it('skips when tenantId is undefined', async () => {
      const payload = makePayload()
      const result = await ensureTenantMembership(payload, 'user-1', undefined as any, 'booking')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
    })
  })

  // ── Idempotent Behavior ────────────────────────────────────

  describe('idempotent behavior', () => {
    it('returns skipped when membership already exists', async () => {
      const payload = makePayload({
        existingMemberships: [{ id: 'existing-1', user: 'user-1', tenant: 'tenant-1' }],
      })

      const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
      expect(result.error).toBeUndefined()
      expect(payload.find).toHaveBeenCalledOnce()
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('queries with correct user+tenant filter', async () => {
      const payload = makePayload({ existingMemberships: [{ id: 'x' }] })

      await ensureTenantMembership(payload, 42, 99, 'booking')

      expect(payload.find).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'tenant-memberships',
          where: {
            and: [
              { user: { equals: 42 } },
              { tenant: { equals: 99 } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        }),
      )
    })
  })

  // ── Successful Creation ────────────────────────────────────

  describe('creation', () => {
    it('creates membership with tenant_member role and active status', async () => {
      const payload = makePayload()

      const result = await ensureTenantMembership(payload, 'user-5', 'tenant-3', 'purchase')

      expect(result.created).toBe(true)
      expect(result.skipped).toBe(false)
      expect(result.error).toBeUndefined()

      expect(payload.create).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'tenant-memberships',
          data: expect.objectContaining({
            user: 'user-5',
            tenant: 'tenant-3',
            role: 'tenant_member',
            status: 'active',
            propagationTrigger: 'purchase',
          }),
          depth: 0,
          overrideAccess: true,
        }),
      )
    })

    it('sets joinedAt to a valid ISO date', async () => {
      const payload = makePayload()
      const before = new Date().toISOString()

      await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'booking')

      const after = new Date().toISOString()
      const createdData = payload.create.mock.calls[0][0].data
      expect(createdData.joinedAt).toBeDefined()
      expect(createdData.joinedAt >= before).toBe(true)
      expect(createdData.joinedAt <= after).toBe(true)
    })

    it('passes req when provided', async () => {
      const payload = makePayload()
      const fakeReq = { user: { id: 1 } } as any

      await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'booking', fakeReq)

      expect(payload.create).toHaveBeenCalledWith(
        expect.objectContaining({ req: fakeReq }),
      )
    })

    it('works without req parameter', async () => {
      const payload = makePayload()

      await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      const callArg = payload.create.mock.calls[0][0]
      expect(callArg.req).toBeUndefined()
    })

    it('uses numeric IDs correctly', async () => {
      const payload = makePayload()

      await ensureTenantMembership(payload, 42, 99, 'event_registration')

      const createData = payload.create.mock.calls[0][0].data
      expect(createData.user).toBe(42)
      expect(createData.tenant).toBe(99)
    })
  })

  // ── Trigger Types ──────────────────────────────────────────

  describe('trigger types', () => {
    const triggers: PropagationTrigger[] = [
      'purchase',
      'booking',
      'event_registration',
      'space_join',
      'federation_interaction',
      'manual',
    ]

    for (const trigger of triggers) {
      it(`records trigger "${trigger}" on created membership`, async () => {
        const payload = makePayload()

        const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', trigger)

        expect(result.created).toBe(true)
        const createData = payload.create.mock.calls[0][0].data
        expect(createData.propagationTrigger).toBe(trigger)
      })
    }
  })

  // ── Error Handling ─────────────────────────────────────────

  describe('error handling', () => {
    it('returns error state when find throws', async () => {
      const payload = makePayload({ findThrows: true })

      const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(false)
      expect(result.error).toContain('DB find error')
    })

    it('returns error state when create throws', async () => {
      const payload = makePayload({ createThrows: true })

      const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'booking')

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(false)
      expect(result.error).toContain('DB create error')
    })

    it('NEVER throws — always returns a result', async () => {
      const payload = makePayload({ findThrows: true })

      // This should NOT throw
      const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      expect(result).toBeDefined()
      expect(typeof result.created).toBe('boolean')
      expect(typeof result.skipped).toBe('boolean')
    })

    it('handles non-Error thrown values', async () => {
      const payload = makePayload()
      payload.find = vi.fn().mockRejectedValue('string error')

      const result = await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      expect(result.error).toBe('string error')
      expect(result.created).toBe(false)
    })
  })

  // ── Logging ────────────────────────────────────────────────

  describe('logging', () => {
    it('logs info on successful creation', async () => {
      const payload = makePayload()

      await ensureTenantMembership(payload, 'user-42', 'tenant-7', 'purchase')

      expect(payload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('user-42'),
      )
      expect(payload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('tenant-7'),
      )
      expect(payload.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('purchase'),
      )
    })

    it('logs warn on failure', async () => {
      const payload = makePayload({ createThrows: true })

      await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'booking')

      expect(payload.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
      )
    })

    it('does not log on idempotent skip', async () => {
      const payload = makePayload({ existingMemberships: [{ id: 1 }] })

      await ensureTenantMembership(payload, 'user-1', 'tenant-1', 'purchase')

      expect(payload.logger.info).not.toHaveBeenCalled()
      expect(payload.logger.warn).not.toHaveBeenCalled()
    })

    it('does not log on guard clause skip', async () => {
      const payload = makePayload()

      await ensureTenantMembership(payload, '', 'tenant-1', 'purchase')

      expect(payload.logger.info).not.toHaveBeenCalled()
      expect(payload.logger.warn).not.toHaveBeenCalled()
    })
  })

  // ── Integration-Style ──────────────────────────────────────

  describe('integration-style scenarios', () => {
    it('full flow: user buys from new Endeavor → membership created', async () => {
      const payload = makePayload({
        createReturn: { id: 'membership-new', user: 'user-buyer', tenant: 'tenant-seller' },
      })

      const result = await ensureTenantMembership(
        payload,
        'user-buyer',
        'tenant-seller',
        'purchase',
      )

      expect(result.created).toBe(true)
      expect(payload.find).toHaveBeenCalledOnce() // Checked existing
      expect(payload.create).toHaveBeenCalledOnce() // Created new

      const createData = payload.create.mock.calls[0][0].data
      expect(createData).toMatchObject({
        user: 'user-buyer',
        tenant: 'tenant-seller',
        role: 'tenant_member',
        status: 'active',
        propagationTrigger: 'purchase',
      })
    })

    it('repeat purchase in same Endeavor → idempotent skip', async () => {
      const payload = makePayload({
        existingMemberships: [
          { id: 'membership-existing', user: 'user-buyer', tenant: 'tenant-seller' },
        ],
      })

      const result = await ensureTenantMembership(
        payload,
        'user-buyer',
        'tenant-seller',
        'purchase',
      )

      expect(result.created).toBe(false)
      expect(result.skipped).toBe(true)
      expect(payload.create).not.toHaveBeenCalled()
    })

    it('anonymous checkout → guard clause, no DB call', async () => {
      const payload = makePayload()

      const result = await ensureTenantMembership(payload, '', 'tenant-1', 'purchase')

      expect(result.skipped).toBe(true)
      expect(payload.find).not.toHaveBeenCalled()
      expect(payload.create).not.toHaveBeenCalled()
    })
  })
})
