/**
 * Edge-compatible Tenant Cache Service
 * 
 * Lightweight version for Edge Runtime (middleware) that uses API calls
 * instead of direct database access
 */

interface TenantMapping {
  id: string
  slug: string
  name: string
  domain: string
  aliases: string[]
}

// In-memory cache for Edge Runtime
let tenantCache: Map<string, TenantMapping> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Load tenant mappings for Edge Runtime (uses fallback only)
 * 
 * Note: Edge Runtime can't make API calls to same app or access DB directly,
 * so we use static fallback mappings. For dynamic mappings, use server-side cache.
 */
export async function loadTenantMappingsEdge(): Promise<Map<string, TenantMapping>> {
  try {
    // Check if cache is still valid
    if (tenantCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return tenantCache
    }

    // For Edge Runtime, use static fallback mappings
    // TODO: In production, this could be populated from environment variables
    // or a CDN-hosted JSON file for better performance
    const mappings = getFallbackMappingsEdge()

    // Update cache
    tenantCache = mappings
    cacheTimestamp = Date.now()

    return mappings

  } catch (error) {
    console.error('Failed to load tenant mappings in Edge Runtime:', error)
    return getFallbackMappingsEdge()
  }
}

/**
 * Fallback tenant mappings for Edge Runtime
 */
function getFallbackMappingsEdge(): Map<string, TenantMapping> {
  const fallback = new Map<string, TenantMapping>()
  
  const tenants = [
    {
      id: '1',
      slug: 'angel-os',
      name: 'The Angel OS',
      domain: 'angel-os.kendev.local',
      aliases: ['localhost', 'kendev.localhost']
    },
    {
      id: '2',
      slug: 'wdeg',
      name: 'Where Did Everyone Go',
      domain: 'wheredideveryonego.local',
      aliases: ['wdeg.local', 'www.wheredideveryonego.local']
    },
    {
      id: '3',
      slug: 'safeschool',
      name: 'SafeSchool|MAP℠',
      domain: 'safeschoolmap.local',
      aliases: ['safeschool.local', 'www.safeschoolmap.local']
    }
  ]

  for (const tenant of tenants) {
    const mapping: TenantMapping = tenant
    
    // Map primary domain
    fallback.set(tenant.domain, mapping)
    fallback.set(`${tenant.domain}:3000`, mapping)
    
    // Map aliases
    for (const alias of tenant.aliases) {
      fallback.set(alias, mapping)
      fallback.set(`${alias}:3000`, mapping)
    }
  }

  return fallback
}

/**
 * Resolve tenant from hostname using Edge-compatible cache
 */
export async function resolveTenantFromCacheEdge(hostname: string): Promise<TenantMapping | null> {
  try {
    const mappings = await loadTenantMappingsEdge()
    
    // Try exact match first
    let tenant = mappings.get(hostname)
    
    // Try without port
    if (!tenant && hostname.includes(':')) {
      const hostWithoutPort = hostname.split(':')[0]
      if (hostWithoutPort) {
        tenant = mappings.get(hostWithoutPort)
      }
    }
    
    return tenant || null
  } catch (error) {
    console.error('Error resolving tenant from Edge cache:', error)
    return null
  }
}
