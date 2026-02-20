/**
 * Unit tests for Holon Capabilities — Sprint 3.
 *
 * Tests node type validation, capability validation, location handling,
 * serialization, and registration flow logic for the constitutional
 * manufacturing network.
 *
 * Uses the project pattern of re-implementing pure validation logic
 * to avoid Payload-coupled imports.
 *
 * @see src/collections/HolonCapabilities/index.ts — collection schema
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement validation logic (mirrors HolonCapabilities collection)
// ---------------------------------------------------------------------------

/** Valid Holon node types */
const VALID_NODE_TYPES = [
  'assembly',
  'print',
  'service',
  'product',
  'digital',
  'fulfillment',
] as const
type NodeType = (typeof VALID_NODE_TYPES)[number]

/** Node type display labels */
const NODE_TYPE_LABELS: Record<NodeType, string> = {
  assembly: 'Assembly Node',
  print: 'Print Node',
  service: 'Service Node',
  product: 'Product Node',
  digital: 'Digital Node',
  fulfillment: 'Fulfillment Node',
}

/** Default service radius by node type (miles) */
const DEFAULT_RADIUS: Record<NodeType, number> = {
  assembly: 100,
  print: 100,
  service: 25,
  product: 100,
  digital: 0, // Digital has no radius
  fulfillment: 50,
}

// ─── Capability types ────────────────────────────────────────────

interface HolonCapability {
  skill: string
  equipment?: string
  materials?: string[]
  maxVolume?: string
  turnaroundHours?: number
}

interface HolonLocation {
  lat?: number
  lng?: number
  city?: string
  region?: string
}

interface HolonRegistration {
  tenant?: number | string
  nodeType?: string
  capabilities?: HolonCapability[]
  serviceRadius?: number
  location?: HolonLocation
  constitutionalCompliance?: boolean
}

// ─── Validation functions ────────────────────────────────────────

function validateNodeType(nodeType: string | undefined): string | null {
  if (!nodeType) {
    return 'Error: Node type is required.'
  }
  if (!VALID_NODE_TYPES.includes(nodeType as NodeType)) {
    return `Error: Invalid node type "${nodeType}". Valid types: ${VALID_NODE_TYPES.join(', ')}.`
  }
  return null
}

function validateCapabilities(capabilities: HolonCapability[] | undefined): string | null {
  if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
    return 'Error: At least one capability is required.'
  }

  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i]
    if (!cap.skill || typeof cap.skill !== 'string' || !cap.skill.trim()) {
      return `Error: Capability #${i + 1} requires a skill name.`
    }

    if (cap.turnaroundHours !== undefined) {
      if (typeof cap.turnaroundHours !== 'number' || cap.turnaroundHours <= 0) {
        return `Error: Capability #${i + 1} turnaroundHours must be a positive number.`
      }
    }

    if (cap.materials !== undefined) {
      if (!Array.isArray(cap.materials)) {
        return `Error: Capability #${i + 1} materials must be an array.`
      }
    }
  }

  return null
}

function validateServiceRadius(radius: number | undefined): string | null {
  if (radius === undefined) return null
  if (typeof radius !== 'number' || radius < 0 || !isFinite(radius)) {
    return 'Error: Service radius must be a non-negative number.'
  }
  return null
}

function validateLocation(location: HolonLocation | undefined): string | null {
  if (!location) return null

  if (location.lat !== undefined) {
    if (typeof location.lat !== 'number' || location.lat < -90 || location.lat > 90) {
      return 'Error: Latitude must be between -90 and 90.'
    }
  }

  if (location.lng !== undefined) {
    if (typeof location.lng !== 'number' || location.lng < -180 || location.lng > 180) {
      return 'Error: Longitude must be between -180 and 180.'
    }
  }

  if (!location.city && !location.region) {
    return 'Error: At least city or region is required for location.'
  }

  return null
}

function validateRegistration(input: HolonRegistration): string | null {
  if (!input.tenant) {
    return 'Error: Tenant is required.'
  }

  const nodeTypeErr = validateNodeType(input.nodeType)
  if (nodeTypeErr) return nodeTypeErr

  if (input.constitutionalCompliance === false) {
    return 'Error: Constitutional compliance is required to register as a Holon node.'
  }

  const capErr = validateCapabilities(input.capabilities)
  if (capErr) return capErr

  const radiusErr = validateServiceRadius(input.serviceRadius)
  if (radiusErr) return radiusErr

  const locErr = validateLocation(input.location)
  if (locErr) return locErr

  return null
}

// ─── Distance calculation ────────────────────────────────────────

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in miles.
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}

// ─── Serialization ───────────────────────────────────────────────

interface SerializedHolon {
  nodeType: string
  nodeTypeLabel: string
  capabilities: string[]
  serviceRadius: string
  location?: string
  constitutionalCompliance: boolean
}

function serializeHolon(
  registration: HolonRegistration & { nodeType: NodeType },
): SerializedHolon {
  const caps = (registration.capabilities || []).map((c) => {
    let label = c.skill
    if (c.equipment) label += ` (${c.equipment})`
    return label
  })

  const radius = registration.serviceRadius ?? DEFAULT_RADIUS[registration.nodeType]
  const radiusStr = radius === 0 ? 'No limit (digital)' : `${radius} miles`

  let locationStr: string | undefined
  if (registration.location) {
    const parts = [registration.location.city, registration.location.region].filter(Boolean)
    locationStr = parts.join(', ') || undefined
  }

  return {
    nodeType: registration.nodeType,
    nodeTypeLabel: NODE_TYPE_LABELS[registration.nodeType],
    capabilities: caps,
    serviceRadius: radiusStr,
    location: locationStr,
    constitutionalCompliance: registration.constitutionalCompliance !== false,
  }
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Holon Capabilities', () => {
  // ─── Node Type Validation ──────────────────────────────────────

  describe('Node type validation', () => {
    it('validates all 6 node types', () => {
      for (const type of VALID_NODE_TYPES) {
        expect(validateNodeType(type)).toBeNull()
      }
    })

    it('rejects invalid node type', () => {
      const result = validateNodeType('manufacturing')
      expect(result).toContain('Invalid node type')
    })

    it('requires node type', () => {
      const result = validateNodeType(undefined)
      expect(result).toContain('required')
    })

    it('rejects empty string', () => {
      const result = validateNodeType('')
      expect(result).toContain('required')
    })

    it('has correct node type count', () => {
      expect(VALID_NODE_TYPES).toHaveLength(6)
    })

    it('has labels for all node types', () => {
      for (const type of VALID_NODE_TYPES) {
        expect(NODE_TYPE_LABELS[type]).toBeTruthy()
      }
    })
  })

  // ─── Capability Validation ─────────────────────────────────────

  describe('Capability validation', () => {
    it('requires at least one capability', () => {
      const result = validateCapabilities([])
      expect(result).toContain('At least one capability')
    })

    it('requires skill name per capability', () => {
      const result = validateCapabilities([{ skill: '' }])
      expect(result).toContain('requires a skill name')
    })

    it('validates turnaround hours (positive number)', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', turnaroundHours: -1 },
      ])
      expect(result).toContain('positive number')
    })

    it('validates zero turnaround hours', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', turnaroundHours: 0 },
      ])
      expect(result).toContain('positive number')
    })

    it('validates materials as array', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', materials: 'PLA' as unknown as string[] },
      ])
      expect(result).toContain('must be an array')
    })

    it('allows optional equipment', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', equipment: 'Bambu Lab X1C' },
      ])
      expect(result).toBeNull()
    })

    it('allows optional maxVolume', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', maxVolume: '250x250x250mm' },
      ])
      expect(result).toBeNull()
    })

    it('accepts valid capability', () => {
      const result = validateCapabilities([
        {
          skill: '3d-printing',
          equipment: 'Bambu Lab X1C',
          materials: ['PLA', 'PETG', 'TPU'],
          maxVolume: '250x250x250mm',
          turnaroundHours: 24,
        },
      ])
      expect(result).toBeNull()
    })

    it('accepts multiple capabilities', () => {
      const result = validateCapabilities([
        { skill: '3d-printing', turnaroundHours: 24 },
        { skill: 'laser-cutting', turnaroundHours: 48 },
      ])
      expect(result).toBeNull()
    })

    it('handles undefined capabilities', () => {
      const result = validateCapabilities(undefined)
      expect(result).toContain('At least one capability')
    })
  })

  // ─── Location Validation ───────────────────────────────────────

  describe('Location validation', () => {
    it('validates latitude range', () => {
      expect(validateLocation({ lat: 91, city: 'Test' })).toContain('Latitude')
      expect(validateLocation({ lat: -91, city: 'Test' })).toContain('Latitude')
    })

    it('validates longitude range', () => {
      expect(validateLocation({ lng: 181, city: 'Test' })).toContain('Longitude')
      expect(validateLocation({ lng: -181, city: 'Test' })).toContain('Longitude')
    })

    it('requires city or region', () => {
      const result = validateLocation({ lat: 27.96, lng: -82.79 })
      expect(result).toContain('city or region')
    })

    it('accepts city without coordinates', () => {
      const result = validateLocation({ city: 'Clearwater' })
      expect(result).toBeNull()
    })

    it('accepts region without city', () => {
      const result = validateLocation({ region: 'Florida' })
      expect(result).toBeNull()
    })

    it('accepts full location', () => {
      const result = validateLocation({
        lat: 27.96,
        lng: -82.79,
        city: 'Clearwater',
        region: 'Florida',
      })
      expect(result).toBeNull()
    })

    it('handles null location gracefully', () => {
      const result = validateLocation(undefined)
      expect(result).toBeNull()
    })

    it('accepts valid boundary latitude', () => {
      expect(validateLocation({ lat: 90, city: 'North Pole' })).toBeNull()
      expect(validateLocation({ lat: -90, city: 'South Pole' })).toBeNull()
    })

    it('accepts valid boundary longitude', () => {
      expect(validateLocation({ lng: 180, city: 'Dateline' })).toBeNull()
      expect(validateLocation({ lng: -180, city: 'Dateline' })).toBeNull()
    })
  })

  // ─── Distance Calculation ──────────────────────────────────────

  describe('Distance calculation', () => {
    it('calculates distance between two coordinates', () => {
      // Clearwater, FL to Tampa, FL (~22 miles)
      const distance = calculateDistance(27.9659, -82.8001, 27.9506, -82.4572)
      expect(distance).toBeGreaterThan(15)
      expect(distance).toBeLessThan(30)
    })

    it('returns 0 for same coordinates', () => {
      const distance = calculateDistance(27.96, -82.80, 27.96, -82.80)
      expect(distance).toBeCloseTo(0, 1)
    })

    it('handles cross-hemisphere distances', () => {
      // New York to London (~3459 miles)
      const distance = calculateDistance(40.7128, -74.006, 51.5074, -0.1278)
      expect(distance).toBeGreaterThan(3000)
      expect(distance).toBeLessThan(4000)
    })

    it('is within 100-mile Holon radius for nearby cities', () => {
      // Clearwater to St. Petersburg (~24 miles)
      const distance = calculateDistance(27.9659, -82.8001, 27.7676, -82.6413)
      expect(distance).toBeLessThan(100) // Within Holon economic radius
    })
  })

  // ─── Service Radius ────────────────────────────────────────────

  describe('Service radius', () => {
    it('validates positive radius', () => {
      expect(validateServiceRadius(50)).toBeNull()
    })

    it('allows zero radius (digital nodes)', () => {
      expect(validateServiceRadius(0)).toBeNull()
    })

    it('rejects negative radius', () => {
      const result = validateServiceRadius(-10)
      expect(result).toContain('non-negative')
    })

    it('rejects infinite radius', () => {
      const result = validateServiceRadius(Infinity)
      expect(result).toContain('non-negative')
    })

    it('allows undefined radius (uses default)', () => {
      expect(validateServiceRadius(undefined)).toBeNull()
    })

    it('has correct default radius per node type', () => {
      expect(DEFAULT_RADIUS.assembly).toBe(100)
      expect(DEFAULT_RADIUS.service).toBe(25)
      expect(DEFAULT_RADIUS.digital).toBe(0)
      expect(DEFAULT_RADIUS.fulfillment).toBe(50)
    })
  })

  // ─── Registration Validation ───────────────────────────────────

  describe('Registration flow', () => {
    const validRegistration: HolonRegistration = {
      tenant: 1,
      nodeType: 'assembly',
      capabilities: [
        {
          skill: '3d-printing',
          equipment: 'Bambu Lab X1C',
          materials: ['PLA', 'PETG'],
          turnaroundHours: 24,
        },
      ],
      serviceRadius: 100,
      location: { lat: 27.96, lng: -82.80, city: 'Clearwater', region: 'FL' },
      constitutionalCompliance: true,
    }

    it('accepts valid registration', () => {
      expect(validateRegistration(validRegistration)).toBeNull()
    })

    it('requires tenant', () => {
      const noTenant = { ...validRegistration, tenant: undefined }
      expect(validateRegistration(noTenant)).toContain('Tenant is required')
    })

    it('requires constitutional compliance', () => {
      const noncompliant = { ...validRegistration, constitutionalCompliance: false }
      expect(validateRegistration(noncompliant)).toContain('Constitutional compliance')
    })

    it('defaults constitutional compliance to true', () => {
      const noCompliance = { ...validRegistration, constitutionalCompliance: undefined }
      // When undefined, it should pass (defaults to true)
      expect(validateRegistration(noCompliance)).toBeNull()
    })

    it('validates node type in registration', () => {
      const badType = { ...validRegistration, nodeType: 'invalid' }
      expect(validateRegistration(badType)).toContain('Invalid node type')
    })

    it('validates capabilities in registration', () => {
      const noCaps = { ...validRegistration, capabilities: [] }
      expect(validateRegistration(noCaps)).toContain('At least one capability')
    })
  })

  // ─── Holon Serialization ───────────────────────────────────────

  describe('Holon serialization', () => {
    const sampleHolon: HolonRegistration & { nodeType: NodeType } = {
      tenant: 1,
      nodeType: 'assembly',
      capabilities: [
        { skill: '3d-printing', equipment: 'Bambu Lab X1C' },
        { skill: 'laser-cutting' },
      ],
      serviceRadius: 100,
      location: { city: 'Clearwater', region: 'FL' },
      constitutionalCompliance: true,
    }

    it('serializes for dashboard display', () => {
      const serialized = serializeHolon(sampleHolon)
      expect(serialized.nodeType).toBe('assembly')
    })

    it('includes node type label', () => {
      const serialized = serializeHolon(sampleHolon)
      expect(serialized.nodeTypeLabel).toBe('Assembly Node')
    })

    it('formats capability list', () => {
      const serialized = serializeHolon(sampleHolon)
      expect(serialized.capabilities).toContain('3d-printing (Bambu Lab X1C)')
      expect(serialized.capabilities).toContain('laser-cutting')
    })

    it('formats service radius with unit', () => {
      const serialized = serializeHolon(sampleHolon)
      expect(serialized.serviceRadius).toBe('100 miles')
    })

    it('formats digital node radius as no limit', () => {
      const digitalHolon: HolonRegistration & { nodeType: NodeType } = {
        ...sampleHolon,
        nodeType: 'digital',
        serviceRadius: 0,
      }
      const serialized = serializeHolon(digitalHolon)
      expect(serialized.serviceRadius).toBe('No limit (digital)')
    })

    it('formats location string', () => {
      const serialized = serializeHolon(sampleHolon)
      expect(serialized.location).toBe('Clearwater, FL')
    })

    it('handles missing optional fields', () => {
      const minimal: HolonRegistration & { nodeType: NodeType } = {
        tenant: 1,
        nodeType: 'digital',
        capabilities: [{ skill: 'web-development' }],
        constitutionalCompliance: true,
      }
      const serialized = serializeHolon(minimal)
      expect(serialized.location).toBeUndefined()
      expect(serialized.constitutionalCompliance).toBe(true)
    })

    it('uses default radius when not specified', () => {
      const noRadius: HolonRegistration & { nodeType: NodeType } = {
        ...sampleHolon,
        serviceRadius: undefined,
      }
      const serialized = serializeHolon(noRadius)
      expect(serialized.serviceRadius).toBe('100 miles') // Default for assembly
    })
  })
})
