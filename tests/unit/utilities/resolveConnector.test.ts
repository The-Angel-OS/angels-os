/**
 * resolveConnector — Unit Tests
 *
 * Tests the two exported functions:
 *   resolveConnector — priority-ordered connector lookup for a tenant
 *   findAllConnectors — multi-tenant connector listing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { resolveConnector, findAllConnectors } from '@/utilities/resolveConnector'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeConnectorDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    type: 'email_outbound',
    tenant: 1,
    enabled: true,
    status: 'active',
    priority: 10,
    config: { apiKey: 'test-key' },
    routingChannel: null,
    systemUser: null,
    ...overrides,
  }
}

function makePayload(findDocs: unknown[][] = [[], []]) {
  let callIndex = 0
  return {
    find: vi.fn(async () => {
      const docs = findDocs[callIndex] ?? []
      callIndex++
      return { docs }
    }),
  } as any
}

// ── resolveConnector ────────────────────────────────────────────────────────────

describe('resolveConnector', () => {
  describe('with spaceId provided', () => {
    it('returns space-level connector when found', async () => {
      const doc = makeConnectorDoc({ id: 'space-conn', routingChannel: 'ch-1', systemUser: 'sys-1' })
      const payload = makePayload([[doc], []])

      const result = await resolveConnector(payload, {
        type: 'email_outbound',
        tenantId: 1,
        spaceId: 99,
      })

      expect(result).not.toBeNull()
      expect(result!.id).toBe('space-conn')
      expect(result!.routingChannel).toBe('ch-1')
      expect(result!.systemUser).toBe('sys-1')
    })

    it('falls back to endeavor-level connector when space-level not found', async () => {
      const endeavorDoc = makeConnectorDoc({ id: 'endeavor-conn' })
      const payload = makePayload([[], [endeavorDoc]])

      const result = await resolveConnector(payload, {
        type: 'email_outbound',
        tenantId: 1,
        spaceId: 99,
      })

      expect(result!.id).toBe('endeavor-conn')
    })

    it('makes two find calls when spaceId is provided and space-level misses', async () => {
      const payload = makePayload([[], []])
      await resolveConnector(payload, { type: 'email_outbound', tenantId: 1, spaceId: 99 })
      expect(payload.find).toHaveBeenCalledTimes(2)
    })
  })

  describe('without spaceId', () => {
    it('skips space-level lookup and returns endeavor-level connector', async () => {
      const doc = makeConnectorDoc({ id: 'endeavor-only' })
      const payload = makePayload([[doc]])

      const result = await resolveConnector(payload, {
        type: 'email_outbound',
        tenantId: 1,
      })

      expect(payload.find).toHaveBeenCalledTimes(1)
      expect(result!.id).toBe('endeavor-only')
    })

    it('returns null when no connectors found at endeavor level', async () => {
      const payload = makePayload([[]])

      const result = await resolveConnector(payload, {
        type: 'whatsapp',
        tenantId: 2,
      })

      expect(result).toBeNull()
    })
  })

  it('maps connector fields to result shape correctly', async () => {
    const doc = makeConnectorDoc({
      id: 42,
      config: { key: 'val' },
      routingChannel: 'chan-123',
      systemUser: 'user-456',
    })
    const payload = makePayload([[doc]])

    const result = await resolveConnector(payload, { type: 'email_outbound', tenantId: 1 })

    expect(result).toEqual({
      id: '42',
      config: { key: 'val' },
      routingChannel: 'chan-123',
      systemUser: 'user-456',
    })
  })

  it('omits routingChannel and systemUser when they are null', async () => {
    const doc = makeConnectorDoc({ routingChannel: null, systemUser: null })
    const payload = makePayload([[doc]])

    const result = await resolveConnector(payload, { type: 'email_outbound', tenantId: 1 })

    expect(result!.routingChannel).toBeUndefined()
    expect(result!.systemUser).toBeUndefined()
  })

  it('returns empty config object when doc.config is missing', async () => {
    const doc = makeConnectorDoc({ config: undefined })
    const payload = makePayload([[doc]])

    const result = await resolveConnector(payload, { type: 'email_outbound', tenantId: 1 })

    expect(result!.config).toEqual({})
  })
})

// ── findAllConnectors ──────────────────────────────────────────────────────────

describe('findAllConnectors', () => {
  it('returns empty array when no connectors found', async () => {
    const payload = { find: vi.fn().mockResolvedValue({ docs: [] }) } as any
    const result = await findAllConnectors(payload, 'whatsapp')
    expect(result).toEqual([])
  })

  it('maps multiple connector docs to result shape', async () => {
    const docs = [
      makeConnectorDoc({ id: 'c1', tenant: 1, config: { a: 1 }, routingChannel: 'ch-1', systemUser: null }),
      makeConnectorDoc({ id: 'c2', tenant: 2, config: { b: 2 }, routingChannel: null, systemUser: 'su-2' }),
    ]
    const payload = { find: vi.fn().mockResolvedValue({ docs }) } as any

    const result = await findAllConnectors(payload, 'email_outbound')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'c1', tenantId: '1', config: { a: 1 }, routingChannel: 'ch-1' })
    expect(result[1]).toEqual({ id: 'c2', tenantId: '2', config: { b: 2 }, systemUser: 'su-2' })
  })

  it('makes one find call with the given type', async () => {
    const payload = { find: vi.fn().mockResolvedValue({ docs: [] }) } as any
    await findAllConnectors(payload, 'discord')
    expect(payload.find).toHaveBeenCalledOnce()
    const callArgs = payload.find.mock.calls[0][0]
    expect(callArgs.where.and).toEqual(
      expect.arrayContaining([{ type: { equals: 'discord' } }]),
    )
  })

  it('handles missing docs field gracefully', async () => {
    const payload = { find: vi.fn().mockResolvedValue({}) } as any
    const result = await findAllConnectors(payload, 'sms')
    expect(result).toEqual([])
  })
})
