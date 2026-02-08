/**
 * Angel OS Tenant Cache Service
 * Implements ASP.NET-style runtime caching for tenant domain mappings
 * Avoids database hits in middleware (Edge Runtime)
 */

interface TenantMapping {
  id: string
  slug: string
  name: string
  domain: string
  aliases: string[]
}

interface CacheEntry {
  data: Map<string, TenantMapping>
  timestamp: number
  ttl: number
}

// In-memory cache (like ASP.NET runtime cache)
let tenantCache: CacheEntry | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_KEY = 'angel-os-tenant-mappings'

/**
 * Load tenant mappings from database and cache them
 * Called once per session or when cache expires
 */
export async function loadTenantMappings(): Promise<Map<string, TenantMapping>> {
  try {
    // Check if cache is still valid
    if (tenantCache && (Date.now() - tenantCache.timestamp) < tenantCache.ttl) {
      console.log('🏢 Using cached tenant mappings')
      return tenantCache.data
    }

    console.log('🔄 Loading tenant mappings from database...')
    
    // Use API call instead of direct DB access (Edge Runtime compatible)
    // FIXED: Use direct database access to avoid infinite loop with middleware
    const { getPayload } = await import('payload')
    const config = await import('../payload.config')
    
    const payload = await getPayload({ config: config.default })
    
    const tenants = await payload.find({
      collection: 'tenants',
      where: {
        status: { equals: 'active' }
      },
      limit: 0, // Get all active tenants
      depth: 0,
      select: {
        id: true,
        slug: true,
        domain: true,
        customDomains: true,
        status: true,
        name: true
      }
    })

    const data = { tenants: tenants.docs }
    const mappings = new Map<string, TenantMapping>()

    // Build domain mapping from tenant data
    for (const tenant of data.tenants) {
      const tenantMapping: TenantMapping = {
        id: tenant.id.toString(),
        slug: tenant.slug || 'unknown',
        name: tenant.name || 'Unknown Tenant',
        domain: tenant.domain || '',
        aliases: []
      }

      // Map primary domain
      if (tenant.domain) {
        mappings.set(tenant.domain, tenantMapping)
        mappings.set(`${tenant.domain}:3000`, tenantMapping) // With port for dev
      }

      // Map custom domains/aliases - use any type to handle flexible field structure
      const customDomains = (tenant as any).customDomains
      if (customDomains && Array.isArray(customDomains)) {
        for (const alias of customDomains) {
          const domain = typeof alias === 'string' ? alias : alias?.domain
          if (domain) {
            tenantMapping.aliases.push(domain)
            mappings.set(domain, tenantMapping)
            mappings.set(`${domain}:3000`, tenantMapping) // With port for dev
          }
        }
      }
    }

    // Update cache
    tenantCache = {
      data: mappings,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    }

    console.log(`🏢 Cached ${data.tenants.length} tenants with ${mappings.size} domain mappings`)
    
    // Debug: Log all cached mappings
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Cached domain mappings:')
      for (const [domain, tenant] of mappings.entries()) {
        console.log(`   ${domain} → ${tenant.name} (${tenant.slug})`)
      }
    }
    
    return mappings

  } catch (error) {
    console.error('❌ Failed to load tenant mappings:', error)
    
    // Return fallback mappings for development
    return getFallbackMappings()
  }
}

/**
 * Fallback tenant mappings for development/emergency use
 */
function getFallbackMappings(): Map<string, TenantMapping> {
  const fallback = new Map<string, TenantMapping>()
  
  const tenants = [
    {
      id: '1',
      slug: 'kendevco',
      name: 'KenDev.Co',
      domain: 'localhost',
      aliases: ['angel-os.kendev.local', 'kendev.localhost']
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
      slug: 'safeschoolmap',
      name: 'SafeSchool|MAP℠',
      domain: 'safeschoolmap.local',
      aliases: ['safeschoolmap.kendev.local', 'www.safeschoolmap.local']
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

  console.log('⚠️ Using fallback tenant mappings')
  return fallback
}

/**
 * Resolve tenant from hostname using cache
 * This is called by middleware for each request
 */
export async function resolveTenantFromCache(hostname: string): Promise<TenantMapping | null> {
  try {
    const mappings = await loadTenantMappings()
    
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
    console.error('❌ Error resolving tenant from cache:', error)
    return null
  }
}

/**
 * Clear cache - useful for testing or when tenants are updated
 */
export function clearTenantCache(): void {
  tenantCache = null
  console.log('🗑️ Tenant cache cleared')
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  if (!tenantCache) {
    return { status: 'empty', age: 0, size: 0 }
  }
  
  const age = Date.now() - tenantCache.timestamp
  const isExpired = age > tenantCache.ttl
  
  return {
    status: isExpired ? 'expired' : 'valid',
    age: Math.round(age / 1000), // seconds
    size: tenantCache.data.size,
    ttl: Math.round(tenantCache.ttl / 1000) // seconds
  }
}

