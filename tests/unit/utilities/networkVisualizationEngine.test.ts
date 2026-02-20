/**
 * Network Visualization Engine — Tests
 *
 * Test suite for federated network map, directory, clustering, and statistics.
 * Re-implements types and pure functions to avoid Payload imports.
 *
 * @see src/utilities/networkVisualizationEngine.ts
 */

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement types
// ---------------------------------------------------------------------------

type NodeType = 'ministry' | 'holon' | 'guardian' | 'service'
type NodeStatus = 'active' | 'probation' | 'inactive' | 'suspended'

interface GeoCoordinate { lat: number; lng: number }

interface NetworkNode {
  id: string; name: string; type: NodeType; status: NodeStatus
  location?: GeoCoordinate; region?: string; capabilities: string[]
  connectionCount: number; rating: number
  metadata?: Record<string, string | number | boolean>
}

interface NetworkEdge {
  sourceId: string; targetId: string
  type: 'federation' | 'service' | 'supply_chain' | 'referral'
  weight: number; label?: string
}

interface GeoCluster {
  id: string; center: GeoCoordinate; nodes: NetworkNode[]
  radius: number; region?: string
}

interface NetworkStats {
  totalNodes: number; activeNodes: number; totalEdges: number
  avgConnectionsPerNode: number
  regions: { region: string; count: number }[]
  typeBreakdown: { type: NodeType; count: number }[]
  densestCluster: string | null; isolatedNodes: number
}

interface DirectoryEntry {
  node: NetworkNode; distance?: number
  matchScore: number; matchedCapabilities: string[]
}

interface FilterCriteria {
  types?: NodeType[]; statuses?: NodeStatus[]; region?: string
  capability?: string; minRating?: number; minConnections?: number
  nearLocation?: GeoCoordinate; maxDistance?: number
}

interface BoundingBox { north: number; south: number; east: number; west: number }

// ---------------------------------------------------------------------------
// Re-implement constants & functions
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371
const DEFAULT_CLUSTER_RADIUS_KM = 50
const MAX_CLUSTER_SIZE = 25
const MIN_CLUSTER_SIZE = 2

function haversineDistance(a: GeoCoordinate, b: GeoCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

function calculateCenter(coords: GeoCoordinate[]): GeoCoordinate {
  if (coords.length === 0) return { lat: 0, lng: 0 }
  if (coords.length === 1) return { ...coords[0] }
  const sumLat = coords.reduce((sum, c) => sum + c.lat, 0)
  const sumLng = coords.reduce((sum, c) => sum + c.lng, 0)
  return { lat: sumLat / coords.length, lng: sumLng / coords.length }
}

function calculateBoundingBox(coords: GeoCoordinate[]): BoundingBox {
  if (coords.length === 0) return { north: 0, south: 0, east: 0, west: 0 }
  let north = -90, south = 90, east = -180, west = 180
  for (const c of coords) {
    if (c.lat > north) north = c.lat
    if (c.lat < south) south = c.lat
    if (c.lng > east) east = c.lng
    if (c.lng < west) west = c.lng
  }
  return { north, south, east, west }
}

function isWithinBounds(coord: GeoCoordinate, bounds: BoundingBox): boolean {
  return coord.lat >= bounds.south && coord.lat <= bounds.north && coord.lng >= bounds.west && coord.lng <= bounds.east
}

function filterNodes(nodes: NetworkNode[], criteria: FilterCriteria): NetworkNode[] {
  return nodes.filter((node) => {
    if (criteria.types && criteria.types.length > 0 && !criteria.types.includes(node.type)) return false
    if (criteria.statuses && criteria.statuses.length > 0 && !criteria.statuses.includes(node.status)) return false
    if (criteria.region && node.region !== criteria.region) return false
    if (criteria.capability) {
      const cap = criteria.capability.toLowerCase()
      if (!node.capabilities.some((c) => c.toLowerCase().includes(cap))) return false
    }
    if (criteria.minRating !== undefined && node.rating < criteria.minRating) return false
    if (criteria.minConnections !== undefined && node.connectionCount < criteria.minConnections) return false
    if (criteria.nearLocation && criteria.maxDistance !== undefined && node.location) {
      const dist = haversineDistance(criteria.nearLocation, node.location)
      if (dist > criteria.maxDistance) return false
    }
    return true
  })
}

function buildDirectory(nodes: NetworkNode[], searchCapability?: string, fromLocation?: GeoCoordinate): DirectoryEntry[] {
  return nodes.map((node) => {
    const distance = fromLocation && node.location ? haversineDistance(fromLocation, node.location) : undefined
    let matchedCapabilities: string[] = []
    let matchScore = 0
    if (searchCapability) {
      const search = searchCapability.toLowerCase()
      matchedCapabilities = node.capabilities.filter((c) => c.toLowerCase().includes(search))
      matchScore = matchedCapabilities.length > 0 ? (matchedCapabilities.length / node.capabilities.length) * 100 : 0
    } else {
      matchScore = 100
    }
    return { node, distance, matchScore, matchedCapabilities }
  })
}

function sortDirectory(entries: DirectoryEntry[], sortBy: 'relevance' | 'distance' | 'rating' | 'name' = 'relevance'): DirectoryEntry[] {
  const sorted = [...entries]
  switch (sortBy) {
    case 'relevance': sorted.sort((a, b) => b.matchScore - a.matchScore || b.node.rating - a.node.rating); break
    case 'distance': sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)); break
    case 'rating': sorted.sort((a, b) => b.node.rating - a.node.rating); break
    case 'name': sorted.sort((a, b) => a.node.name.localeCompare(b.node.name)); break
  }
  return sorted
}

function clusterNodes(nodes: NetworkNode[], radiusKm: number = DEFAULT_CLUSTER_RADIUS_KM): GeoCluster[] {
  const geoNodes = nodes.filter((n) => n.location)
  const assigned = new Set<string>()
  const clusters: GeoCluster[] = []
  let clusterId = 0
  for (const node of geoNodes) {
    if (assigned.has(node.id)) continue
    const clusterNodes: NetworkNode[] = [node]
    assigned.add(node.id)
    for (const other of geoNodes) {
      if (assigned.has(other.id)) continue
      if (clusterNodes.length >= MAX_CLUSTER_SIZE) break
      const dist = haversineDistance(node.location!, other.location!)
      if (dist <= radiusKm) { clusterNodes.push(other); assigned.add(other.id) }
    }
    const coords = clusterNodes.map((n) => n.location!)
    const center = calculateCenter(coords)
    clusters.push({ id: `cluster-${clusterId++}`, center, nodes: clusterNodes, radius: radiusKm, region: node.region })
  }
  return clusters
}

function calculateNetworkStats(nodes: NetworkNode[], edges: NetworkEdge[]): NetworkStats {
  const activeNodes = nodes.filter((n) => n.status === 'active').length
  const connectedNodeIds = new Set<string>()
  for (const edge of edges) { connectedNodeIds.add(edge.sourceId); connectedNodeIds.add(edge.targetId) }
  const isolatedNodes = nodes.filter((n) => !connectedNodeIds.has(n.id)).length
  const avgConnections = nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.connectionCount, 0) / nodes.length : 0
  const regionMap = new Map<string, number>()
  for (const node of nodes) { const r = node.region || 'Unknown'; regionMap.set(r, (regionMap.get(r) || 0) + 1) }
  const regions = Array.from(regionMap.entries()).map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count)
  const typeMap = new Map<NodeType, number>()
  for (const node of nodes) { typeMap.set(node.type, (typeMap.get(node.type) || 0) + 1) }
  const typeBreakdown = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
  const clusters = clusterNodes(nodes)
  let densestCluster: string | null = null; let maxDensity = 0
  for (const cluster of clusters) { if (cluster.nodes.length > maxDensity) { maxDensity = cluster.nodes.length; densestCluster = cluster.id } }
  return { totalNodes: nodes.length, activeNodes, totalEdges: edges.length, avgConnectionsPerNode: Math.round(avgConnections * 10) / 10, regions, typeBreakdown, densestCluster, isolatedNodes }
}

function serializeNetworkStats(stats: NetworkStats): string {
  const lines = [`Network Overview`, `Nodes: ${stats.activeNodes} active / ${stats.totalNodes} total`, `Edges: ${stats.totalEdges}`, `Avg Connections: ${stats.avgConnectionsPerNode}`, `Isolated Nodes: ${stats.isolatedNodes}`]
  if (stats.regions.length > 0) { const top3 = stats.regions.slice(0, 3).map((r) => `${r.region}(${r.count})`).join(', '); lines.push(`Top Regions: ${top3}`) }
  if (stats.typeBreakdown.length > 0) { const types = stats.typeBreakdown.map((t) => `${t.type}(${t.count})`).join(', '); lines.push(`Types: ${types}`) }
  return lines.join('\n')
}

function serializeDirectoryEntry(entry: DirectoryEntry): string {
  const parts = [entry.node.name, `(${entry.node.type})`, `Status: ${entry.node.status}`, `Rating: ${entry.node.rating}`]
  if (entry.distance !== undefined) parts.push(`Distance: ${Math.round(entry.distance)} km`)
  if (entry.matchedCapabilities.length > 0) parts.push(`Matched: ${entry.matchedCapabilities.join(', ')}`)
  if (entry.node.region) parts.push(`Region: ${entry.node.region}`)
  return parts.join(' | ')
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Cities for testing
const CHICAGO: GeoCoordinate = { lat: 41.8781, lng: -87.6298 }
const NEW_YORK: GeoCoordinate = { lat: 40.7128, lng: -74.0060 }
const LOS_ANGELES: GeoCoordinate = { lat: 34.0522, lng: -118.2437 }
const SPRINGFIELD_IL: GeoCoordinate = { lat: 39.7817, lng: -89.6501 }
const NAPERVILLE: GeoCoordinate = { lat: 41.7508, lng: -88.1535 } // ~45 km from Chicago

function makeNode(overrides: Partial<NetworkNode> = {}): NetworkNode {
  return {
    id: 'node-001',
    name: 'Hope Community Church',
    type: 'ministry',
    status: 'active',
    location: CHICAGO,
    region: 'Midwest',
    capabilities: ['food_pantry', 'counseling', 'job_training'],
    connectionCount: 5,
    rating: 4.5,
    ...overrides,
  }
}

function makeEdge(overrides: Partial<NetworkEdge> = {}): NetworkEdge {
  return {
    sourceId: 'node-001',
    targetId: 'node-002',
    type: 'federation',
    weight: 1.0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Network Visualization Engine', () => {

  // ========================================================================
  // Constants
  // ========================================================================

  describe('Constants', () => {
    it('uses standard Earth radius', () => {
      expect(EARTH_RADIUS_KM).toBe(6371)
    })

    it('has 50km default cluster radius', () => {
      expect(DEFAULT_CLUSTER_RADIUS_KM).toBe(50)
    })

    it('limits cluster size to 25', () => {
      expect(MAX_CLUSTER_SIZE).toBe(25)
    })
  })

  // ========================================================================
  // Geographic Calculations
  // ========================================================================

  describe('haversineDistance', () => {
    it('returns 0 for same point', () => {
      expect(haversineDistance(CHICAGO, CHICAGO)).toBe(0)
    })

    it('calculates Chicago to New York (~1145 km)', () => {
      const dist = haversineDistance(CHICAGO, NEW_YORK)
      expect(dist).toBeGreaterThan(1100)
      expect(dist).toBeLessThan(1200)
    })

    it('calculates Chicago to Los Angeles (~2800 km)', () => {
      const dist = haversineDistance(CHICAGO, LOS_ANGELES)
      expect(dist).toBeGreaterThan(2700)
      expect(dist).toBeLessThan(2900)
    })

    it('calculates Chicago to Naperville (~45 km)', () => {
      const dist = haversineDistance(CHICAGO, NAPERVILLE)
      expect(dist).toBeGreaterThan(30)
      expect(dist).toBeLessThan(60)
    })

    it('is symmetric', () => {
      const ab = haversineDistance(CHICAGO, NEW_YORK)
      const ba = haversineDistance(NEW_YORK, CHICAGO)
      expect(Math.abs(ab - ba)).toBeLessThan(0.001)
    })
  })

  describe('calculateCenter', () => {
    it('returns origin for empty array', () => {
      const center = calculateCenter([])
      expect(center.lat).toBe(0)
      expect(center.lng).toBe(0)
    })

    it('returns same point for single coordinate', () => {
      const center = calculateCenter([CHICAGO])
      expect(center.lat).toBe(CHICAGO.lat)
      expect(center.lng).toBe(CHICAGO.lng)
    })

    it('calculates midpoint of two coordinates', () => {
      const center = calculateCenter([
        { lat: 40, lng: -80 },
        { lat: 42, lng: -90 },
      ])
      expect(center.lat).toBe(41)
      expect(center.lng).toBe(-85)
    })
  })

  describe('calculateBoundingBox', () => {
    it('returns zeros for empty array', () => {
      const box = calculateBoundingBox([])
      expect(box.north).toBe(0)
      expect(box.south).toBe(0)
    })

    it('calculates bounding box correctly', () => {
      const box = calculateBoundingBox([CHICAGO, NEW_YORK, LOS_ANGELES])
      expect(box.north).toBeCloseTo(CHICAGO.lat, 2) // Chicago is northernmost
      expect(box.south).toBeCloseTo(LOS_ANGELES.lat, 2) // LA is southernmost
      expect(box.east).toBeCloseTo(NEW_YORK.lng, 2) // NY is easternmost
      expect(box.west).toBeCloseTo(LOS_ANGELES.lng, 2) // LA is westernmost
    })
  })

  describe('isWithinBounds', () => {
    const box: BoundingBox = { north: 42, south: 40, east: -80, west: -90 }

    it('returns true for point inside', () => {
      expect(isWithinBounds({ lat: 41, lng: -85 }, box)).toBe(true)
    })

    it('returns true for point on boundary', () => {
      expect(isWithinBounds({ lat: 42, lng: -80 }, box)).toBe(true)
    })

    it('returns false for point outside', () => {
      expect(isWithinBounds({ lat: 43, lng: -85 }, box)).toBe(false)
    })

    it('returns false for point east of bounds', () => {
      expect(isWithinBounds({ lat: 41, lng: -75 }, box)).toBe(false)
    })
  })

  // ========================================================================
  // Node Filtering
  // ========================================================================

  describe('filterNodes', () => {
    const nodes = [
      makeNode({ id: 'n1', type: 'ministry', status: 'active', region: 'Midwest', capabilities: ['food', 'counseling'], rating: 4.5, connectionCount: 10 }),
      makeNode({ id: 'n2', type: 'holon', status: 'active', region: 'Northeast', capabilities: ['printing', 'design'], rating: 3.8, connectionCount: 3, location: NEW_YORK }),
      makeNode({ id: 'n3', type: 'guardian', status: 'probation', region: 'Midwest', capabilities: ['counseling'], rating: 4.0, connectionCount: 1 }),
      makeNode({ id: 'n4', type: 'service', status: 'inactive', region: 'Southeast', capabilities: ['food'], rating: 2.5, connectionCount: 0 }),
      makeNode({ id: 'n5', type: 'ministry', status: 'active', region: 'Midwest', capabilities: ['food', 'housing'], rating: 4.8, connectionCount: 15, location: NAPERVILLE }),
    ]

    it('returns all nodes with no filters', () => {
      expect(filterNodes(nodes, {})).toHaveLength(5)
    })

    it('filters by type', () => {
      expect(filterNodes(nodes, { types: ['ministry'] })).toHaveLength(2)
    })

    it('filters by multiple types', () => {
      expect(filterNodes(nodes, { types: ['ministry', 'holon'] })).toHaveLength(3)
    })

    it('filters by status', () => {
      expect(filterNodes(nodes, { statuses: ['active'] })).toHaveLength(3)
    })

    it('filters by region', () => {
      expect(filterNodes(nodes, { region: 'Midwest' })).toHaveLength(3)
    })

    it('filters by capability substring', () => {
      expect(filterNodes(nodes, { capability: 'food' })).toHaveLength(3)
    })

    it('capability search is case-insensitive', () => {
      expect(filterNodes(nodes, { capability: 'FOOD' })).toHaveLength(3)
    })

    it('filters by minRating', () => {
      expect(filterNodes(nodes, { minRating: 4.0 })).toHaveLength(3)
    })

    it('filters by minConnections', () => {
      expect(filterNodes(nodes, { minConnections: 5 })).toHaveLength(2)
    })

    it('filters by proximity', () => {
      const results = filterNodes(nodes, { nearLocation: CHICAGO, maxDistance: 50 })
      // Only NAPERVILLE is within 50km of Chicago (and Chicago itself = node n1, n3, n5)
      // n1 is at CHICAGO (0km), n5 at NAPERVILLE (~45km), n3 at CHICAGO (0km)
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('combines multiple filters', () => {
      const results = filterNodes(nodes, {
        types: ['ministry'],
        statuses: ['active'],
        region: 'Midwest',
        minRating: 4.5,
      })
      expect(results).toHaveLength(2) // n1 and n5
    })
  })

  // ========================================================================
  // Directory
  // ========================================================================

  describe('buildDirectory', () => {
    const nodes = [
      makeNode({ id: 'n1', capabilities: ['food_pantry', 'counseling'], location: CHICAGO }),
      makeNode({ id: 'n2', name: 'Print Shop', capabilities: ['printing', 'design'], location: NEW_YORK }),
    ]

    it('returns entries for all nodes', () => {
      const entries = buildDirectory(nodes)
      expect(entries).toHaveLength(2)
    })

    it('gives 100% match score when no search', () => {
      const entries = buildDirectory(nodes)
      expect(entries[0].matchScore).toBe(100)
    })

    it('calculates match score for capability search', () => {
      const entries = buildDirectory(nodes, 'food')
      const foodEntry = entries.find((e) => e.node.id === 'n1')
      expect(foodEntry!.matchScore).toBeGreaterThan(0)
      expect(foodEntry!.matchedCapabilities).toContain('food_pantry')
    })

    it('gives 0 match score when no capabilities match', () => {
      const entries = buildDirectory(nodes, 'food')
      const printEntry = entries.find((e) => e.node.id === 'n2')
      expect(printEntry!.matchScore).toBe(0)
    })

    it('calculates distance when fromLocation provided', () => {
      const entries = buildDirectory(nodes, undefined, CHICAGO)
      const chicagoEntry = entries.find((e) => e.node.id === 'n1')
      const nyEntry = entries.find((e) => e.node.id === 'n2')
      expect(chicagoEntry!.distance).toBe(0)
      expect(nyEntry!.distance).toBeGreaterThan(1000)
    })

    it('distance is undefined when no fromLocation', () => {
      const entries = buildDirectory(nodes)
      expect(entries[0].distance).toBeUndefined()
    })
  })

  describe('sortDirectory', () => {
    const entries: DirectoryEntry[] = [
      { node: makeNode({ id: 'n1', name: 'B Church', rating: 4.0 }), matchScore: 50, matchedCapabilities: ['food'], distance: 100 },
      { node: makeNode({ id: 'n2', name: 'A Church', rating: 4.8 }), matchScore: 80, matchedCapabilities: ['food', 'counseling'], distance: 500 },
      { node: makeNode({ id: 'n3', name: 'C Church', rating: 3.5 }), matchScore: 80, matchedCapabilities: ['food'], distance: 10 },
    ]

    it('sorts by relevance (match score) by default', () => {
      const sorted = sortDirectory(entries)
      expect(sorted[0].node.id).toBe('n2') // 80 score, higher rating
      expect(sorted[1].node.id).toBe('n3') // 80 score, lower rating
      expect(sorted[2].node.id).toBe('n1') // 50 score
    })

    it('sorts by distance', () => {
      const sorted = sortDirectory(entries, 'distance')
      expect(sorted[0].distance).toBe(10)
      expect(sorted[2].distance).toBe(500)
    })

    it('sorts by rating', () => {
      const sorted = sortDirectory(entries, 'rating')
      expect(sorted[0].node.rating).toBe(4.8)
    })

    it('sorts by name', () => {
      const sorted = sortDirectory(entries, 'name')
      expect(sorted[0].node.name).toBe('A Church')
      expect(sorted[1].node.name).toBe('B Church')
      expect(sorted[2].node.name).toBe('C Church')
    })

    it('does not mutate original', () => {
      const first = entries[0].node.id
      sortDirectory(entries, 'rating')
      expect(entries[0].node.id).toBe(first)
    })
  })

  // ========================================================================
  // Clustering
  // ========================================================================

  describe('clusterNodes', () => {
    it('clusters nearby nodes together', () => {
      const nodes = [
        makeNode({ id: 'n1', location: CHICAGO }),
        makeNode({ id: 'n2', location: NAPERVILLE }), // ~45km from Chicago
        makeNode({ id: 'n3', location: NEW_YORK }),
      ]
      const clusters = clusterNodes(nodes, 50)
      // Chicago + Naperville should cluster, NY separate
      expect(clusters.length).toBe(2)
    })

    it('puts distant nodes in separate clusters', () => {
      const nodes = [
        makeNode({ id: 'n1', location: CHICAGO }),
        makeNode({ id: 'n2', location: LOS_ANGELES }),
      ]
      const clusters = clusterNodes(nodes, 50)
      expect(clusters.length).toBe(2)
    })

    it('ignores nodes without location', () => {
      const nodes = [
        makeNode({ id: 'n1', location: CHICAGO }),
        makeNode({ id: 'n2', location: undefined }),
      ]
      const clusters = clusterNodes(nodes)
      const allClustered = clusters.flatMap((c) => c.nodes)
      expect(allClustered).toHaveLength(1)
    })

    it('assigns cluster IDs', () => {
      const nodes = [
        makeNode({ id: 'n1', location: CHICAGO }),
        makeNode({ id: 'n2', location: NEW_YORK }),
      ]
      const clusters = clusterNodes(nodes)
      expect(clusters[0].id).toBe('cluster-0')
      expect(clusters[1].id).toBe('cluster-1')
    })

    it('calculates cluster center', () => {
      const nodes = [
        makeNode({ id: 'n1', location: { lat: 40, lng: -88 } }),
        makeNode({ id: 'n2', location: { lat: 42, lng: -88 } }),
      ]
      const clusters = clusterNodes(nodes, 500) // Large radius to force single cluster
      expect(clusters[0].center.lat).toBeCloseTo(41, 0)
    })

    it('returns empty for empty input', () => {
      expect(clusterNodes([])).toHaveLength(0)
    })

    it('respects MAX_CLUSTER_SIZE', () => {
      // Create 30 nodes all at same location
      const nodes = Array.from({ length: 30 }, (_, i) =>
        makeNode({ id: `n${i}`, location: CHICAGO }),
      )
      const clusters = clusterNodes(nodes, 100)
      // First cluster gets MAX_CLUSTER_SIZE, rest go to second
      expect(clusters[0].nodes.length).toBeLessThanOrEqual(MAX_CLUSTER_SIZE)
    })
  })

  // ========================================================================
  // Network Statistics
  // ========================================================================

  describe('calculateNetworkStats', () => {
    it('counts total and active nodes', () => {
      const nodes = [
        makeNode({ id: 'n1', status: 'active' }),
        makeNode({ id: 'n2', status: 'probation' }),
        makeNode({ id: 'n3', status: 'active' }),
      ]
      const stats = calculateNetworkStats(nodes, [])
      expect(stats.totalNodes).toBe(3)
      expect(stats.activeNodes).toBe(2)
    })

    it('counts edges', () => {
      const edges = [makeEdge(), makeEdge({ sourceId: 'n2', targetId: 'n3' })]
      const stats = calculateNetworkStats([makeNode()], edges)
      expect(stats.totalEdges).toBe(2)
    })

    it('calculates average connections', () => {
      const nodes = [
        makeNode({ id: 'n1', connectionCount: 10 }),
        makeNode({ id: 'n2', connectionCount: 6 }),
      ]
      const stats = calculateNetworkStats(nodes, [])
      expect(stats.avgConnectionsPerNode).toBe(8)
    })

    it('identifies isolated nodes', () => {
      const nodes = [
        makeNode({ id: 'n1' }),
        makeNode({ id: 'n2' }),
        makeNode({ id: 'n3' }),
      ]
      const edges = [makeEdge({ sourceId: 'n1', targetId: 'n2' })]
      const stats = calculateNetworkStats(nodes, edges)
      expect(stats.isolatedNodes).toBe(1) // n3 not in any edge
    })

    it('produces region breakdown', () => {
      const nodes = [
        makeNode({ id: 'n1', region: 'Midwest' }),
        makeNode({ id: 'n2', region: 'Midwest' }),
        makeNode({ id: 'n3', region: 'Northeast' }),
      ]
      const stats = calculateNetworkStats(nodes, [])
      expect(stats.regions[0].region).toBe('Midwest')
      expect(stats.regions[0].count).toBe(2)
    })

    it('produces type breakdown', () => {
      const nodes = [
        makeNode({ id: 'n1', type: 'ministry' }),
        makeNode({ id: 'n2', type: 'ministry' }),
        makeNode({ id: 'n3', type: 'holon' }),
      ]
      const stats = calculateNetworkStats(nodes, [])
      expect(stats.typeBreakdown[0].type).toBe('ministry')
      expect(stats.typeBreakdown[0].count).toBe(2)
    })

    it('handles empty inputs', () => {
      const stats = calculateNetworkStats([], [])
      expect(stats.totalNodes).toBe(0)
      expect(stats.avgConnectionsPerNode).toBe(0)
      expect(stats.densestCluster).toBeNull()
    })

    it('identifies densest cluster', () => {
      const nodes = [
        makeNode({ id: 'n1', location: CHICAGO }),
        makeNode({ id: 'n2', location: NAPERVILLE }),
        makeNode({ id: 'n3', location: NEW_YORK }),
      ]
      const stats = calculateNetworkStats(nodes, [])
      expect(stats.densestCluster).toBe('cluster-0') // Chicago cluster has 2 nodes
    })
  })

  // ========================================================================
  // Serialization
  // ========================================================================

  describe('serializeNetworkStats', () => {
    it('includes header', () => {
      const stats = calculateNetworkStats([], [])
      const result = serializeNetworkStats(stats)
      expect(result).toContain('Network Overview')
    })

    it('shows node counts', () => {
      const nodes = [makeNode({ status: 'active' }), makeNode({ id: 'n2', status: 'probation' })]
      const stats = calculateNetworkStats(nodes, [])
      const result = serializeNetworkStats(stats)
      expect(result).toContain('1 active / 2 total')
    })

    it('shows regions', () => {
      const nodes = [makeNode({ region: 'Midwest' })]
      const stats = calculateNetworkStats(nodes, [])
      const result = serializeNetworkStats(stats)
      expect(result).toContain('Top Regions:')
      expect(result).toContain('Midwest(1)')
    })
  })

  describe('serializeDirectoryEntry', () => {
    it('includes node name and type', () => {
      const entry: DirectoryEntry = { node: makeNode(), matchScore: 100, matchedCapabilities: [], distance: undefined }
      const result = serializeDirectoryEntry(entry)
      expect(result).toContain('Hope Community Church')
      expect(result).toContain('(ministry)')
    })

    it('shows distance when available', () => {
      const entry: DirectoryEntry = { node: makeNode(), matchScore: 100, matchedCapabilities: [], distance: 42.7 }
      const result = serializeDirectoryEntry(entry)
      expect(result).toContain('Distance: 43 km')
    })

    it('omits distance when undefined', () => {
      const entry: DirectoryEntry = { node: makeNode(), matchScore: 100, matchedCapabilities: [] }
      const result = serializeDirectoryEntry(entry)
      expect(result).not.toContain('Distance')
    })

    it('shows matched capabilities', () => {
      const entry: DirectoryEntry = { node: makeNode(), matchScore: 50, matchedCapabilities: ['food_pantry', 'counseling'] }
      const result = serializeDirectoryEntry(entry)
      expect(result).toContain('Matched: food_pantry, counseling')
    })

    it('shows region', () => {
      const entry: DirectoryEntry = { node: makeNode({ region: 'Midwest' }), matchScore: 100, matchedCapabilities: [] }
      const result = serializeDirectoryEntry(entry)
      expect(result).toContain('Region: Midwest')
    })
  })
})
