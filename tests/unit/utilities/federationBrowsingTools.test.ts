/**
 * Unit tests for Sprint 38 Federation Browsing Tool Handlers
 *
 * Tests the three new LEO tools added in Sprint 38:
 *   - browse_federation_peers  (#102) — reads governance cache, no outbound HTTP
 *   - query_peer_catalog       (#103) — fetches a single peer's catalog
 *   - search_federation_wide   (#104) — fan-out search across all active peers
 *
 * Mocking strategy:
 *   - @/endpoints/federation-governance-sync  → mock getCachedGovernance
 *   - @/utilities/federationClient           → mock fetchCatalog
 *   - @/federation/keyStore                  → mock getOrCreateFederationKeyPair
 *   - Payload API                            → mock payload.findByID (for identity resolution)
 *
 * @see src/utilities/leo-data-tools.ts — handleBrowseFederationPeers,
 *                                        handleQueryPeerCatalog,
 *                                        handleSearchFederationWide
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))

vi.mock('@payloadcms/richtext-lexical', () => ({
  consolidateHTMLConverters: vi.fn(),
  convertLexicalToHTML: vi.fn(),
  defaultEditorConfig: { resolvedFeatureMap: new Map() },
  defaultEditorFeatures: [],
  lexicalEditor: vi.fn(() => ({})),
  FixedToolbarFeature: vi.fn(() => ({})),
  HeadingFeature: vi.fn(() => ({})),
  InlineToolbarFeature: vi.fn(() => ({})),
}))

// Federation infrastructure mocks
const mockGetCachedGovernance = vi.fn()
vi.mock('@/endpoints/federation-governance-sync', () => ({
  getCachedGovernance: (...args: any[]) => mockGetCachedGovernance(...args),
  setCachedGovernance: vi.fn(),
  setCachedGovernanceWithPersist: vi.fn(),
  // Handler used in payload.config.ts — must be included in mock
  federationGovernanceSyncHandler: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
}))

const mockFetchCatalog = vi.fn()
vi.mock('@/utilities/federationClient', () => ({
  fetchCatalog: (...args: any[]) => mockFetchCatalog(...args),
}))

const mockGetOrCreateFederationKeyPair = vi.fn()
vi.mock('@/federation/keyStore', () => ({
  getOrCreateFederationKeyPair: (...args: any[]) => mockGetOrCreateFederationKeyPair(...args),
}))

// ── Import subjects under test ────────────────────────────────────────────────
import { executeToolCall, type ToolExecutorContext } from '@/utilities/leo-data-tools'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sample governance data for testing. */
function buildGovernance(overrides?: Partial<{
  ministries: any[]
  trustScores: Record<string, number>
}>) {
  return {
    ministries: overrides?.ministries ?? [
      {
        id: 'peer-1',
        name: 'Clearwater',
        domain: 'clearwater.spacesangels.com',
        status: 'active',
        capabilities: ['screen_printing', 'embroidery'],
        region: 'US-West',
        lastHeartbeat: new Date(Date.now() - 2 * 60_000).toISOString(), // 2m ago
      },
      {
        id: 'peer-2',
        name: 'Eastbrook',
        domain: 'eastbrook.spacesangels.com',
        status: 'active',
        capabilities: ['web_design'],
        region: 'US-East',
        lastHeartbeat: new Date(Date.now() - 30 * 60_000).toISOString(), // 30m ago
      },
      {
        id: 'peer-3',
        name: 'Pending Node',
        domain: 'pending.spacesangels.com',
        status: 'probation',
        capabilities: ['general'],
        region: 'EU',
        lastHeartbeat: null,
      },
    ],
    trustScores: {
      'peer-1': 0.95,
      'peer-2': 0.72,
    },
    ...(overrides ?? {}),
  }
}

/** Make a mock Payload with findByID set up for a federated tenant. */
function buildFederatedPayload(federationId = 'fed-test-123') {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test Enterprise',
      setup: { federationId },
      domains: [{ domain: 'myapp.spacesangels.com' }],
    }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  }
}

/** Make a mock Payload whose tenant has NO federation ID (not federated). */
function buildUnfederatedPayload() {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue({ id: 1, name: 'Test Enterprise' }), // no setup.federationId
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
  }
}

/** Sample catalog entries for testing. */
const sampleCatalogEntry = (name: string, price: number, rating: number) => ({
  productName: name,
  description: `A high-quality ${name} product.`,
  price,
  rating,
  capabilities: ['screen_printing'],
  fulfillmentMode: 'ship',
})

// ── Tests: browse_federation_peers ────────────────────────────────────────────

describe('browse_federation_peers', () => {
  const ctx: ToolExecutorContext = {
    payload: {} as any,
    tenantId: 1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns governance-not-populated message when cache is null', async () => {
    mockGetCachedGovernance.mockReturnValue(null)

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('Governance cache not yet populated')
    expect(result).toContain('5 minutes')
  })

  it('returns markdown table with active peers', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('## Federation Peers')
    expect(result).toContain('Clearwater')
    expect(result).toContain('clearwater.spacesangels.com')
    expect(result).toContain('Eastbrook')
    // probation peer should NOT appear (default filter: active)
    expect(result).not.toContain('Pending Node')
  })

  it('includes trust scores in output', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('95%') // 0.95 → 95%
    expect(result).toContain('72%') // 0.72 → 72%
  })

  it('includes capability information', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('screen_printing')
    expect(result).toContain('embroidery')
  })

  it('includes region information', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('US-West')
    expect(result).toContain('US-East')
  })

  it('filters by status=probation shows only probation peers', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { status: 'probation' }, ctx)

    expect(result).toContain('Pending Node')
    expect(result).not.toContain('Clearwater')
    expect(result).not.toContain('Eastbrook')
  })

  it('shows all peers when status=all', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { status: 'all' }, ctx)

    expect(result).toContain('Clearwater')
    expect(result).toContain('Eastbrook')
    expect(result).toContain('Pending Node')
  })

  it('filters by capability substring match', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { capability: 'embroidery' }, ctx)

    expect(result).toContain('Clearwater')
    expect(result).not.toContain('Eastbrook') // web_design, not embroidery
  })

  it('filters by region substring match', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { region: 'US-East' }, ctx)

    expect(result).toContain('Eastbrook')
    expect(result).not.toContain('Clearwater') // US-West
  })

  it('returns no-results message when filters match nothing', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { capability: 'nonexistent_capability_xyz' }, ctx)

    expect(result).toContain('No peers found')
    expect(result).toContain('nonexistent_capability_xyz')
  })

  it('shows total peer counts in summary', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    // 2 active, 3 total in registry
    expect(result).toContain('2 active')
    expect(result).toContain('3 total in registry')
  })

  it('hints about query_peer_catalog and search_federation_wide', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', {}, ctx)

    expect(result).toContain('query_peer_catalog')
    expect(result).toContain('search_federation_wide')
  })

  it('returns "never" heartbeat for peers with null lastHeartbeat when status=all', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const result = await executeToolCall('browse_federation_peers', { status: 'all' }, ctx)

    expect(result).toContain('never') // Pending Node has null lastHeartbeat
  })

  it('respects limit parameter', async () => {
    // Build 10 active peers
    const manyPeers = Array.from({ length: 10 }, (_, i) => ({
      id: `peer-${i}`,
      name: `Peer ${i}`,
      domain: `peer${i}.spacesangels.com`,
      status: 'active',
      capabilities: [],
      region: 'US',
      lastHeartbeat: new Date().toISOString(),
    }))
    mockGetCachedGovernance.mockReturnValue({ ministries: manyPeers, trustScores: {} })

    const result = await executeToolCall('browse_federation_peers', { limit: 3 }, ctx)

    // Should show 3 rows + overflow message
    expect(result).toContain('Showing 3 of 10')
  })

  it('works when tenantId is undefined (no ctx tenant required)', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    const ctxNoTenant: ToolExecutorContext = { payload: {} as any }

    const result = await executeToolCall('browse_federation_peers', {}, ctxNoTenant)

    expect(result).toContain('## Federation Peers')
  })
})

// ── Tests: query_peer_catalog ─────────────────────────────────────────────────

describe('query_peer_catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrCreateFederationKeyPair.mockResolvedValue({
      publicKey: 'pub-key-abc',
      privateKey: 'priv-key-abc',
    })
  })

  it('returns error when domain is missing', async () => {
    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', {}, ctx)

    expect(result).toContain('domain is required')
    expect(result).toContain('browse_federation_peers')
  })

  it('returns error when domain is empty string', async () => {
    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', { domain: '  ' }, ctx)

    expect(result).toContain('domain is required')
  })

  it('returns not-federated message when tenant has no federation ID', async () => {
    const ctx: ToolExecutorContext = {
      payload: buildUnfederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', { domain: 'peer.spacesangels.com' }, ctx)

    expect(result).toContain('not yet federated')
    expect(result).toContain('sign_constitution')
  })

  it('returns offline message when fetchCatalog returns null', async () => {
    mockFetchCatalog.mockResolvedValue(null)

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', { domain: 'peer.spacesangels.com' }, ctx)

    expect(result).toContain('Could not reach peer')
    expect(result).toContain('peer.spacesangels.com')
    expect(result).toContain('browse_federation_peers')
  })

  it('returns empty-results message when catalog has no entries', async () => {
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 42, domain: 'peer.spacesangels.com' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', {
      domain: 'peer.spacesangels.com',
      search: 'rare item',
    }, ctx)

    expect(result).toContain('No results found')
    expect(result).toContain('rare item')
    expect(result).toContain('42 total catalog entries')
  })

  it('returns formatted catalog for successful fetch', async () => {
    mockFetchCatalog.mockResolvedValue({
      entries: [
        sampleCatalogEntry('Premium T-Shirt', 2500, 4.8),
        sampleCatalogEntry('Embroidered Cap', 1800, 4.5),
      ],
      total: 2,
      domain: 'clearwater.spacesangels.com',
    })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', {
      domain: 'clearwater.spacesangels.com',
    }, ctx)

    expect(result).toContain('## Catalog from clearwater.spacesangels.com')
    expect(result).toContain('Premium T-Shirt')
    expect(result).toContain('Embroidered Cap')
    expect(result).toContain('$25.00') // 2500 cents → $25.00
    expect(result).toContain('$18.00') // 1800 cents → $18.00
    expect(result).toContain('4.8/5')
  })

  it('includes capabilities in catalog output', async () => {
    mockFetchCatalog.mockResolvedValue({
      entries: [sampleCatalogEntry('Screen Print', 1000, 4.0)],
      total: 1,
      domain: 'peer.spacesangels.com',
    })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', { domain: 'peer.spacesangels.com' }, ctx)

    expect(result).toContain('screen_printing')
  })

  it('passes search, capability, region filters to fetchCatalog', async () => {
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 0, domain: 'peer.spacesangels.com' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    await executeToolCall('query_peer_catalog', {
      domain: 'peer.spacesangels.com',
      search: 'shirts',
      capability: 'screen_printing',
      region: 'US-West',
      limit: 5,
    }, ctx)

    expect(mockFetchCatalog).toHaveBeenCalledWith(
      'peer.spacesangels.com',
      expect.objectContaining({
        q: 'shirts',
        capability: 'screen_printing',
        region: 'US-West',
        limit: 5,
      }),
      expect.objectContaining({ federationId: 'fed-test-123' }),
      expect.objectContaining({ timeout: 10_000 }),
    )
  })

  it('shows total count when results are paginated', async () => {
    mockFetchCatalog.mockResolvedValue({
      entries: [sampleCatalogEntry('Item 1', 1000, 4.0)],
      total: 50,
      domain: 'big-peer.spacesangels.com',
    })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('query_peer_catalog', { domain: 'big-peer.spacesangels.com' }, ctx)

    expect(result).toContain('50')
    expect(result).toContain('showing 1')
  })
})

// ── Tests: search_federation_wide ─────────────────────────────────────────────

describe('search_federation_wide', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrCreateFederationKeyPair.mockResolvedValue({
      publicKey: 'pub-key-abc',
      privateKey: 'priv-key-abc',
    })
  })

  it('returns governance-not-populated message when cache is null', async () => {
    mockGetCachedGovernance.mockReturnValue(null)

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('Governance cache not yet populated')
  })

  it('returns no-active-peers message when no active ministries', async () => {
    mockGetCachedGovernance.mockReturnValue({ ministries: [], trustScores: {} })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('No active federation peers')
  })

  it('returns not-federated message when tenant lacks federation identity', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())

    const ctx: ToolExecutorContext = {
      payload: buildUnfederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('not yet federated')
    expect(result).toContain('sign_constitution')
  })

  it('fans out to all active peers and aggregates results', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    // peer-1 returns 2 results, peer-2 returns 1
    mockFetchCatalog
      .mockResolvedValueOnce({
        entries: [
          sampleCatalogEntry('Screen Print Tee', 2000, 4.5),
          sampleCatalogEntry('Embroidered Hoodie', 4500, 4.8),
        ],
        total: 2,
        domain: 'clearwater.spacesangels.com',
      })
      .mockResolvedValueOnce({
        entries: [sampleCatalogEntry('Web Design Package', 50000, 4.2)],
        total: 1,
        domain: 'eastbrook.spacesangels.com',
      })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('## Federation-Wide Search Results')
    expect(result).toContain('Screen Print Tee')
    expect(result).toContain('Embroidered Hoodie')
    expect(result).toContain('Web Design Package')
    expect(result).toContain('clearwater.spacesangels.com')
    expect(result).toContain('eastbrook.spacesangels.com')
  })

  it('reports peer count in summary (searched X, responded Y)', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    mockFetchCatalog
      .mockResolvedValueOnce({ entries: [sampleCatalogEntry('Item A', 1000, 4.0)], total: 1, domain: 'clearwater.spacesangels.com' })
      .mockResolvedValueOnce({ entries: [sampleCatalogEntry('Item B', 1500, 3.8)], total: 1, domain: 'eastbrook.spacesangels.com' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toMatch(/Searched \*\*\d+\*\* peer/)
    expect(result).toMatch(/\*\*\d+\*\* responded/)
  })

  it('handles a peer being unreachable (null response) gracefully', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    // peer-1 succeeds, peer-2 is unreachable
    mockFetchCatalog
      .mockResolvedValueOnce({ entries: [sampleCatalogEntry('Good Item', 1000, 4.0)], total: 1, domain: 'clearwater.spacesangels.com' })
      .mockResolvedValueOnce(null) // unreachable

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    // Good results should still appear
    expect(result).toContain('Good Item')
    // Should list the failed peer
    expect(result).toContain('eastbrook.spacesangels.com')
  })

  it('handles a peer throwing an error gracefully', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    mockFetchCatalog
      .mockResolvedValueOnce({ entries: [sampleCatalogEntry('Item', 1000, 4.0)], total: 1, domain: 'clearwater.spacesangels.com' })
      .mockRejectedValueOnce(new Error('Network timeout'))

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('Item') // successful results still shown
    // Timed-out peer listed as failed
    expect(result).toContain('eastbrook.spacesangels.com')
  })

  it('returns no-results message when all peers respond with empty catalogs', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 0, domain: 'any.com' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', { search: 'rare item' }, ctx)

    expect(result).toContain('No results found')
  })

  it('passes search and capability filters to all peers', async () => {
    mockGetCachedGovernance.mockReturnValue({
      ministries: [
        { id: 'p1', name: 'Peer 1', domain: 'peer1.com', status: 'active', capabilities: ['screen_printing'], region: 'US' },
      ],
      trustScores: {},
    })
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 0, domain: 'peer1.com' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    await executeToolCall('search_federation_wide', {
      search: 'organic tee',
      capability: 'screen_printing',
      region: 'US',
    }, ctx)

    expect(mockFetchCatalog).toHaveBeenCalledWith(
      'peer1.com',
      expect.objectContaining({
        q: 'organic tee',
        capability: 'screen_printing',
      }),
      expect.any(Object),
      expect.objectContaining({ timeout: 8_000 }),
    )
  })

  it('respects max_peers limit', async () => {
    // Build 5 active peers, set max_peers to 2
    const manyPeers = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      name: `Peer ${i}`,
      domain: `peer${i}.spacesangels.com`,
      status: 'active',
      capabilities: [],
      region: 'US',
      lastHeartbeat: new Date().toISOString(),
    }))
    mockGetCachedGovernance.mockReturnValue({ ministries: manyPeers, trustScores: {} })
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 0, domain: 'any' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    await executeToolCall('search_federation_wide', { max_peers: 2 }, ctx)

    // Only 2 peers should have been queried
    expect(mockFetchCatalog).toHaveBeenCalledTimes(2)
  })

  it('filters peers by region before fanning out', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    mockFetchCatalog.mockResolvedValue({ entries: [], total: 0, domain: 'any' })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    await executeToolCall('search_federation_wide', { region: 'US-East' }, ctx)

    // Only Eastbrook is in US-East
    expect(mockFetchCatalog).toHaveBeenCalledTimes(1)
    expect(mockFetchCatalog).toHaveBeenCalledWith(
      'eastbrook.spacesangels.com',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('hints about query_peer_catalog for deeper browsing', async () => {
    mockGetCachedGovernance.mockReturnValue(buildGovernance())
    mockFetchCatalog.mockResolvedValue({
      entries: [sampleCatalogEntry('Item', 1000, 4.0)],
      total: 1,
      domain: 'peer.com',
    })

    const ctx: ToolExecutorContext = {
      payload: buildFederatedPayload() as any,
      tenantId: 1,
    }

    const result = await executeToolCall('search_federation_wide', {}, ctx)

    expect(result).toContain('query_peer_catalog')
    expect(result).toContain('browse_federation_peers')
  })
})
