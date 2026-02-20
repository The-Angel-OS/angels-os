/**
 * Network Visualization Engine — Sprint 5, Phase 6
 *
 * Pure utility for the federated network map view and filterable directory.
 * Handles geographic clustering, node filtering, connection mapping, and
 * layout calculations for the Angel OS network visualization.
 *
 * Zero Payload imports — fully testable and usable in edge functions.
 *
 * @see src/utilities/federationEngine.ts — federation types
 * @see tests/unit/utilities/networkVisualizationEngine.test.ts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NodeType = 'ministry' | 'holon' | 'guardian' | 'service'
export type NodeStatus = 'active' | 'probation' | 'inactive' | 'suspended'

export interface GeoCoordinate {
  lat: number
  lng: number
}

export interface NetworkNode {
  id: string
  name: string
  type: NodeType
  status: NodeStatus
  location?: GeoCoordinate
  region?: string
  capabilities: string[]
  connectionCount: number
  rating: number
  metadata?: Record<string, string | number | boolean>
}

export interface NetworkEdge {
  sourceId: string
  targetId: string
  type: 'federation' | 'service' | 'supply_chain' | 'referral'
  weight: number
  label?: string
}

export interface GeoCluster {
  id: string
  center: GeoCoordinate
  nodes: NetworkNode[]
  radius: number
  region?: string
}

export interface NetworkStats {
  totalNodes: number
  activeNodes: number
  totalEdges: number
  avgConnectionsPerNode: number
  regions: { region: string; count: number }[]
  typeBreakdown: { type: NodeType; count: number }[]
  densestCluster: string | null
  isolatedNodes: number
}

export interface DirectoryEntry {
  node: NetworkNode
  distance?: number
  matchScore: number
  matchedCapabilities: string[]
}

export interface FilterCriteria {
  types?: NodeType[]
  statuses?: NodeStatus[]
  region?: string
  capability?: string
  minRating?: number
  minConnections?: number
  nearLocation?: GeoCoordinate
  maxDistance?: number // km
}

export interface BoundingBox {
  north: number
  south: number
  east: number
  west: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Earth radius in kilometers. */
export const EARTH_RADIUS_KM = 6371

/** Default cluster radius in km. */
export const DEFAULT_CLUSTER_RADIUS_KM = 50

/** Maximum nodes per cluster before splitting. */
export const MAX_CLUSTER_SIZE = 25

/** Minimum nodes to form a cluster. */
export const MIN_CLUSTER_SIZE = 2

// ---------------------------------------------------------------------------
// Geographic Calculations
// ---------------------------------------------------------------------------

/** Calculate Haversine distance between two coordinates in km. */
export function haversineDistance(a: GeoCoordinate, b: GeoCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** Calculate center point of a set of coordinates. */
export function calculateCenter(coords: GeoCoordinate[]): GeoCoordinate {
  if (coords.length === 0) return { lat: 0, lng: 0 }
  if (coords.length === 1) return { ...coords[0] }

  const sumLat = coords.reduce((sum, c) => sum + c.lat, 0)
  const sumLng = coords.reduce((sum, c) => sum + c.lng, 0)
  return {
    lat: sumLat / coords.length,
    lng: sumLng / coords.length,
  }
}

/** Calculate bounding box for a set of coordinates. */
export function calculateBoundingBox(coords: GeoCoordinate[]): BoundingBox {
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

/** Check if a coordinate is within a bounding box. */
export function isWithinBounds(coord: GeoCoordinate, bounds: BoundingBox): boolean {
  return (
    coord.lat >= bounds.south &&
    coord.lat <= bounds.north &&
    coord.lng >= bounds.west &&
    coord.lng <= bounds.east
  )
}

// ---------------------------------------------------------------------------
// Node Filtering & Directory
// ---------------------------------------------------------------------------

/** Filter nodes by criteria. */
export function filterNodes(nodes: NetworkNode[], criteria: FilterCriteria): NetworkNode[] {
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

/** Build directory entries with distance and capability matching. */
export function buildDirectory(
  nodes: NetworkNode[],
  searchCapability?: string,
  fromLocation?: GeoCoordinate,
): DirectoryEntry[] {
  return nodes.map((node) => {
    const distance = fromLocation && node.location
      ? haversineDistance(fromLocation, node.location)
      : undefined

    let matchedCapabilities: string[] = []
    let matchScore = 0

    if (searchCapability) {
      const search = searchCapability.toLowerCase()
      matchedCapabilities = node.capabilities.filter((c) =>
        c.toLowerCase().includes(search),
      )
      matchScore = matchedCapabilities.length > 0
        ? (matchedCapabilities.length / node.capabilities.length) * 100
        : 0
    } else {
      matchScore = 100 // No search = full match
    }

    return { node, distance, matchScore, matchedCapabilities }
  })
}

/** Sort directory entries by relevance. */
export function sortDirectory(
  entries: DirectoryEntry[],
  sortBy: 'relevance' | 'distance' | 'rating' | 'name' = 'relevance',
): DirectoryEntry[] {
  const sorted = [...entries]
  switch (sortBy) {
    case 'relevance':
      sorted.sort((a, b) => b.matchScore - a.matchScore || b.node.rating - a.node.rating)
      break
    case 'distance':
      sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
      break
    case 'rating':
      sorted.sort((a, b) => b.node.rating - a.node.rating)
      break
    case 'name':
      sorted.sort((a, b) => a.node.name.localeCompare(b.node.name))
      break
  }
  return sorted
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

/** Create geographic clusters from nodes. */
export function clusterNodes(
  nodes: NetworkNode[],
  radiusKm: number = DEFAULT_CLUSTER_RADIUS_KM,
): GeoCluster[] {
  const geoNodes = nodes.filter((n) => n.location)
  const assigned = new Set<string>()
  const clusters: GeoCluster[] = []
  let clusterId = 0

  for (const node of geoNodes) {
    if (assigned.has(node.id)) continue

    // Start a new cluster
    const clusterNodes: NetworkNode[] = [node]
    assigned.add(node.id)

    // Find nearby unassigned nodes
    for (const other of geoNodes) {
      if (assigned.has(other.id)) continue
      if (clusterNodes.length >= MAX_CLUSTER_SIZE) break

      const dist = haversineDistance(node.location!, other.location!)
      if (dist <= radiusKm) {
        clusterNodes.push(other)
        assigned.add(other.id)
      }
    }

    const coords = clusterNodes.map((n) => n.location!)
    const center = calculateCenter(coords)

    clusters.push({
      id: `cluster-${clusterId++}`,
      center,
      nodes: clusterNodes,
      radius: radiusKm,
      region: node.region,
    })
  }

  return clusters
}

// ---------------------------------------------------------------------------
// Network Statistics
// ---------------------------------------------------------------------------

/** Calculate network statistics. */
export function calculateNetworkStats(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
): NetworkStats {
  const activeNodes = nodes.filter((n) => n.status === 'active').length

  const connectedNodeIds = new Set<string>()
  for (const edge of edges) {
    connectedNodeIds.add(edge.sourceId)
    connectedNodeIds.add(edge.targetId)
  }
  const isolatedNodes = nodes.filter((n) => !connectedNodeIds.has(n.id)).length

  const avgConnections = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + n.connectionCount, 0) / nodes.length
    : 0

  // Region breakdown
  const regionMap = new Map<string, number>()
  for (const node of nodes) {
    const region = node.region || 'Unknown'
    regionMap.set(region, (regionMap.get(region) || 0) + 1)
  }
  const regions = Array.from(regionMap.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count)

  // Type breakdown
  const typeMap = new Map<NodeType, number>()
  for (const node of nodes) {
    typeMap.set(node.type, (typeMap.get(node.type) || 0) + 1)
  }
  const typeBreakdown = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Densest cluster (most connections)
  const clusters = clusterNodes(nodes)
  let densestCluster: string | null = null
  let maxDensity = 0
  for (const cluster of clusters) {
    if (cluster.nodes.length > maxDensity) {
      maxDensity = cluster.nodes.length
      densestCluster = cluster.id
    }
  }

  return {
    totalNodes: nodes.length,
    activeNodes,
    totalEdges: edges.length,
    avgConnectionsPerNode: Math.round(avgConnections * 10) / 10,
    regions,
    typeBreakdown,
    densestCluster,
    isolatedNodes,
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Format network stats for display. */
export function serializeNetworkStats(stats: NetworkStats): string {
  const lines = [
    `Network Overview`,
    `Nodes: ${stats.activeNodes} active / ${stats.totalNodes} total`,
    `Edges: ${stats.totalEdges}`,
    `Avg Connections: ${stats.avgConnectionsPerNode}`,
    `Isolated Nodes: ${stats.isolatedNodes}`,
  ]

  if (stats.regions.length > 0) {
    const top3 = stats.regions.slice(0, 3).map((r) => `${r.region}(${r.count})`).join(', ')
    lines.push(`Top Regions: ${top3}`)
  }

  if (stats.typeBreakdown.length > 0) {
    const types = stats.typeBreakdown.map((t) => `${t.type}(${t.count})`).join(', ')
    lines.push(`Types: ${types}`)
  }

  return lines.join('\n')
}

/** Format a directory entry for display. */
export function serializeDirectoryEntry(entry: DirectoryEntry): string {
  const parts = [
    entry.node.name,
    `(${entry.node.type})`,
    `Status: ${entry.node.status}`,
    `Rating: ${entry.node.rating}`,
  ]

  if (entry.distance !== undefined) {
    parts.push(`Distance: ${Math.round(entry.distance)} km`)
  }

  if (entry.matchedCapabilities.length > 0) {
    parts.push(`Matched: ${entry.matchedCapabilities.join(', ')}`)
  }

  if (entry.node.region) {
    parts.push(`Region: ${entry.node.region}`)
  }

  return parts.join(' | ')
}
