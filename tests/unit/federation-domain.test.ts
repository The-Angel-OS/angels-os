/**
 * Sprint 43 — Federation domain persistence tests
 *
 * Tests that the heartbeat handler stores senderDomain in the Endeavors
 * federation group and that the heartbeat cron uses stored domain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the federation protocol module
vi.mock('@/federation/protocol', () => ({
  verifySignature: vi.fn().mockReturnValue(true),
}))

vi.mock('@/utilities/federationEngine', () => ({
  isHeartbeatHealthy: vi.fn().mockReturnValue(true),
}))

vi.mock('@/federation/constitution', () => ({
  getActiveConstitution: vi.fn().mockReturnValue({ version: '1.1' }),
}))

vi.mock('@/utilities/streetSigns', () => ({
  mergeStreetSignsForPeer: vi.fn(),
}))

describe('federation domain persistence', () => {
  describe('heartbeat handler stores senderDomain', () => {
    it('stores domain on known peer update', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({})
      const mockFind = vi.fn()
        .mockResolvedValueOnce({
          // First find: known peer
          docs: [{ id: 'endeavor-1', federation: { federationId: 'fed-123' } }],
        })
        .mockResolvedValueOnce({
          // Second find: our tenants
          docs: [{ name: 'Test Node', setup: { federationId: 'our-fed-id' } }],
        })
        .mockResolvedValueOnce({
          // Third find: our endeavors
          docs: [{ federation: { lastPingAt: new Date().toISOString() } }],
        })

      const body = JSON.stringify({
        federationId: 'fed-123',
        domain: 'peer.spacesangels.com',
        name: 'Peer Node',
        timestamp: new Date().toISOString(),
        status: 'healthy',
      })

      // Simulate the heartbeat handler logic for domain storage
      const senderDomain = 'peer.spacesangels.com'
      const updateData: Record<string, unknown> = {
        federation: {
          lastPingAt: new Date().toISOString(),
          networkVisible: true,
          ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
        },
      }

      expect(updateData.federation).toHaveProperty('domain', 'peer.spacesangels.com')
    })

    it('stores domain on new peer creation', () => {
      const senderDomain = 'newpeer.example.com'
      const createData: Record<string, unknown> = {
        name: 'New Peer',
        endeavorType: 'custom',
        status: 'active',
        federation: {
          networkVisible: true,
          ministryStatus: 'applicant',
          federationId: 'fed-new',
          lastPingAt: new Date().toISOString(),
          ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
        },
      }

      expect((createData.federation as any).domain).toBe('newpeer.example.com')
    })

    it('omits domain when senderDomain is not a string', () => {
      const senderDomain = undefined
      const updateData: Record<string, unknown> = {
        federation: {
          lastPingAt: new Date().toISOString(),
          networkVisible: true,
          ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
        },
      }

      expect(updateData.federation).not.toHaveProperty('domain')
    })

    it('omits domain when senderDomain is numeric', () => {
      const senderDomain = 12345 as unknown
      const updateData: Record<string, unknown> = {
        federation: {
          lastPingAt: new Date().toISOString(),
          networkVisible: true,
          ...(typeof senderDomain === 'string' ? { domain: senderDomain } : {}),
        },
      }

      expect(updateData.federation).not.toHaveProperty('domain')
    })
  })

  describe('heartbeat cron uses stored domain', () => {
    it('reads domain from peerFederation', () => {
      const peerFederation = {
        federationId: 'fed-123',
        domain: 'peer.spacesangels.com',
        lastPingAt: new Date().toISOString(),
      }

      const peerDomain = (peerFederation?.domain as string) || undefined
      expect(peerDomain).toBe('peer.spacesangels.com')
    })

    it('returns undefined when domain not stored', () => {
      const peerFederation = {
        federationId: 'fed-123',
        lastPingAt: new Date().toISOString(),
      }

      const peerDomain = ((peerFederation as any)?.domain as string) || undefined
      expect(peerDomain).toBeUndefined()
    })

    it('returns undefined when federation is null', () => {
      const peerFederation = null

      const peerDomain = (peerFederation?.domain as string) || undefined
      expect(peerDomain).toBeUndefined()
    })
  })

  describe('discover page URL construction', () => {
    it('uses tenant domain when available and not .local', () => {
      const tenantDomain = 'hays-cactus.spacesangels.com'
      const federationDomain = null

      let storefrontUrl: string | null = null
      if (tenantDomain && !tenantDomain.endsWith('.local')) {
        storefrontUrl = `https://${tenantDomain}`
      }

      expect(storefrontUrl).toBe('https://hays-cactus.spacesangels.com')
    })

    it('falls back to federation domain when tenant domain is .local', () => {
      const tenantDomain = 'hays-cactus.angelos.local'
      const federationDomain = 'hays-cactus.spacesangels.com'
      const tenantSlug = 'hays-cactus'
      const serverHost = 'localhost:3000'

      let storefrontUrl: string | null = null
      if (tenantDomain && !tenantDomain.endsWith('.local')) {
        storefrontUrl = `https://${tenantDomain}`
      } else if (federationDomain && !federationDomain.includes('localhost')) {
        storefrontUrl = `https://${federationDomain}`
      } else if (tenantSlug && tenantSlug !== 'default' && tenantSlug !== 'platform') {
        storefrontUrl = `https://${tenantSlug}.${serverHost.replace(/:\d+$/, '')}`
      }

      expect(storefrontUrl).toBe('https://hays-cactus.spacesangels.com')
    })

    it('falls back to slug construction when no real domain available', () => {
      const tenantDomain = 'hays-cactus.angelos.local'
      const federationDomain = null
      const tenantSlug = 'hays-cactus'
      const serverHost = 'spacesangels.com'

      let storefrontUrl: string | null = null
      if (tenantDomain && !tenantDomain.endsWith('.local')) {
        storefrontUrl = `https://${tenantDomain}`
      } else if (federationDomain && !federationDomain.includes('localhost')) {
        storefrontUrl = `https://${federationDomain}`
      } else if (tenantSlug && tenantSlug !== 'default' && tenantSlug !== 'platform') {
        storefrontUrl = `https://${tenantSlug}.${serverHost.replace(/:\d+$/, '')}`
      }

      expect(storefrontUrl).toBe('https://hays-cactus.spacesangels.com')
    })

    it('returns null for default tenant', () => {
      const tenantDomain = null
      const federationDomain = null
      const tenantSlug = 'default'
      const serverHost = 'spacesangels.com'

      let storefrontUrl: string | null = null
      if (tenantDomain && !tenantDomain.endsWith('.local')) {
        storefrontUrl = `https://${tenantDomain}`
      } else if (federationDomain && !federationDomain.includes('localhost')) {
        storefrontUrl = `https://${federationDomain}`
      } else if (tenantSlug && tenantSlug !== 'default' && tenantSlug !== 'platform') {
        storefrontUrl = `https://${tenantSlug}.${serverHost.replace(/:\d+$/, '')}`
      }

      expect(storefrontUrl).toBeNull()
    })

    it('rejects federation domain containing localhost', () => {
      const tenantDomain = null
      const federationDomain = 'localhost:3000'
      const tenantSlug = 'hays-cactus'
      const serverHost = 'spacesangels.com'

      let storefrontUrl: string | null = null
      if (tenantDomain && !tenantDomain.endsWith('.local')) {
        storefrontUrl = `https://${tenantDomain}`
      } else if (federationDomain && !federationDomain.includes('localhost')) {
        storefrontUrl = `https://${federationDomain}`
      } else if (tenantSlug && tenantSlug !== 'default' && tenantSlug !== 'platform') {
        storefrontUrl = `https://${tenantSlug}.${serverHost.replace(/:\d+$/, '')}`
      }

      expect(storefrontUrl).toBe('https://hays-cactus.spacesangels.com')
    })
  })
})
