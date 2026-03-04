/**
 * Federation Audit Log — Unit Tests
 *
 * Tests logFederationAction, logFromVerification, and logOutboundAction.
 * Payload is passed as a parameter — no module-level mocking needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  logFederationAction,
  logFromVerification,
  logOutboundAction,
  type AuditEntry,
} from '@/federation/auditLog'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(createReturn: unknown = {}) {
  return {
    create: vi.fn().mockResolvedValue(createReturn),
  } as any
}

const BASE_ENTRY: AuditEntry = {
  action: 'skill_list',
  direction: 'inbound',
  sourceFederationId: 'fed-abc123',
  allowed: true,
}

// ── logFederationAction ───────────────────────────────────────────────────────

describe('logFederationAction', () => {
  it('creates a record in federation-audit-log', async () => {
    const payload = makePayload()
    await logFederationAction(payload, BASE_ENTRY)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'federation-audit-log' }),
    )
  })

  it('includes action, direction, sourceFederationId, allowed in data', async () => {
    const payload = makePayload()
    await logFederationAction(payload, BASE_ENTRY)
    const data = payload.create.mock.calls[0][0].data
    expect(data.action).toBe('skill_list')
    expect(data.direction).toBe('inbound')
    expect(data.sourceFederationId).toBe('fed-abc123')
    expect(data.allowed).toBe(true)
  })

  it('includes optional fields when provided', async () => {
    const payload = makePayload()
    await logFederationAction(payload, {
      ...BASE_ENTRY,
      sourceDomain: 'peer.example.com',
      sourceName: 'Peer Corp',
      targetAction: 'search_catalog',
      trustLevel: 'vouched',
      deniedReason: undefined,
      responseTimeMs: 150,
      metadata: { key: 'value' },
    })
    const data = payload.create.mock.calls[0][0].data
    expect(data.sourceDomain).toBe('peer.example.com')
    expect(data.sourceName).toBe('Peer Corp')
    expect(data.targetAction).toBe('search_catalog')
    expect(data.trustLevel).toBe('vouched')
    expect(data.responseTimeMs).toBe(150)
    expect(data.metadata).toEqual({ key: 'value' })
  })

  it('does not throw when payload.create fails (fire-and-forget)', async () => {
    const payload = {
      create: vi.fn().mockRejectedValue(new Error('DB down')),
    } as any
    await expect(logFederationAction(payload, BASE_ENTRY)).resolves.not.toThrow()
  })

  it('does not throw when payload.create throws synchronously', async () => {
    const payload = {
      create: vi.fn().mockImplementation(() => { throw new Error('sync error') }),
    } as any
    await expect(logFederationAction(payload, BASE_ENTRY)).resolves.not.toThrow()
  })

  it('stores denied reason when provided', async () => {
    const payload = makePayload()
    await logFederationAction(payload, {
      ...BASE_ENTRY,
      allowed: false,
      deniedReason: 'rate limit exceeded',
    })
    const data = payload.create.mock.calls[0][0].data
    expect(data.allowed).toBe(false)
    expect(data.deniedReason).toBe('rate limit exceeded')
  })
})

// ── logFromVerification ───────────────────────────────────────────────────────

describe('logFromVerification', () => {
  it('maps verification fields to audit entry', async () => {
    const payload = makePayload()
    await logFromVerification(
      payload,
      {
        verified: true,
        federationId: 'fed-xyz',
        trustLevel: 'active',
        reason: undefined,
        ministry: null,
      } as any,
      'skill_list' as any,
    )
    const data = payload.create.mock.calls[0][0].data
    expect(data.sourceFederationId).toBe('fed-xyz')
    expect(data.trustLevel).toBe('active')
    expect(data.allowed).toBe(true)
  })

  it('defaults direction to "inbound"', async () => {
    const payload = makePayload()
    await logFromVerification(
      payload,
      { verified: true, federationId: 'fed-1', trustLevel: 'probationary', reason: undefined, ministry: null } as any,
      'catalog_browse',
    )
    expect(payload.create.mock.calls[0][0].data.direction).toBe('inbound')
  })

  it('accepts explicit direction override', async () => {
    const payload = makePayload()
    await logFromVerification(
      payload,
      { verified: true, federationId: 'fed-1', trustLevel: 'probationary', reason: undefined, ministry: null } as any,
      'catalog_browse',
      { direction: 'outbound' },
    )
    expect(payload.create.mock.calls[0][0].data.direction).toBe('outbound')
  })

  it('sets deniedReason when verification failed', async () => {
    const payload = makePayload()
    await logFromVerification(
      payload,
      { verified: false, federationId: 'fed-bad', trustLevel: 'none', reason: 'unknown federation id', ministry: null } as any,
      'skill_list' as any,
    )
    const data = payload.create.mock.calls[0][0].data
    expect(data.allowed).toBe(false)
    expect(data.deniedReason).toBe('unknown federation id')
  })

  it('passes responseTimeMs and metadata through', async () => {
    const payload = makePayload()
    await logFromVerification(
      payload,
      { verified: true, federationId: 'fed-1', trustLevel: 'active', reason: undefined, ministry: null } as any,
      'skill_list' as any,
      { responseTimeMs: 42, metadata: { requestId: 'r1' } },
    )
    const data = payload.create.mock.calls[0][0].data
    expect(data.responseTimeMs).toBe(42)
    expect(data.metadata).toEqual({ requestId: 'r1' })
  })
})

// ── logOutboundAction ─────────────────────────────────────────────────────────

describe('logOutboundAction', () => {
  it('direction is always "outbound"', async () => {
    const payload = makePayload()
    await logOutboundAction(payload, {
      action: 'catalog_browse',
      targetFederationId: 'fed-target',
      targetDomain: 'target.example.com',
      success: true,
    })
    expect(payload.create.mock.calls[0][0].data.direction).toBe('outbound')
  })

  it('stores target federation id in sourceFederationId field', async () => {
    const payload = makePayload()
    await logOutboundAction(payload, {
      action: 'catalog_browse',
      targetFederationId: 'fed-remote',
      targetDomain: 'remote.example.com',
      success: true,
    })
    const data = payload.create.mock.calls[0][0].data
    expect(data.sourceFederationId).toBe('fed-remote')
    expect(data.sourceDomain).toBe('remote.example.com')
  })

  it('maps success=false to allowed=false', async () => {
    const payload = makePayload()
    await logOutboundAction(payload, {
      action: 'skill_invoke',
      targetFederationId: 'fed-down',
      targetDomain: 'down.example.com',
      success: false,
      error: 'connection refused',
    })
    const data = payload.create.mock.calls[0][0].data
    expect(data.allowed).toBe(false)
    expect(data.deniedReason).toBe('connection refused')
  })

  it('includes direction_note in metadata', async () => {
    const payload = makePayload()
    await logOutboundAction(payload, {
      action: 'catalog_browse',
      targetFederationId: 'fed-t',
      targetDomain: 't.example.com',
      success: true,
    })
    const { metadata } = payload.create.mock.calls[0][0].data
    expect(metadata.direction_note).toContain('TARGET')
  })

  it('merges caller metadata with direction_note', async () => {
    const payload = makePayload()
    await logOutboundAction(payload, {
      action: 'catalog_browse',
      targetFederationId: 'fed-t',
      targetDomain: 't.example.com',
      success: true,
      metadata: { requestId: 'abc' },
    })
    const { metadata } = payload.create.mock.calls[0][0].data
    expect(metadata.requestId).toBe('abc')
    expect(metadata.direction_note).toBeDefined()
  })
})
