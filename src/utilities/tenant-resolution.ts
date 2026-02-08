import { getPayload } from 'payload'
import config from '@payload-config'

interface TenantResolutionResult {
  tenant: any | null
  matchedDomain: string
  matchType: 'primary' | 'subdomain' | 'alias' | 'none'
  isActive: boolean
}

/**
 * Resolve tenant from any domain or subdomain (DotNetNuke-style)
 * Supports multiple aliases per tenant for flexible domain management
 */
export async function resolveTenantFromDomain(hostname: string): Promise<TenantResolutionResult> {
  const payload = await getPayload({ config })
  
  console.log(`🔍 Resolving tenant for hostname: ${hostname}`)

  try {
    // First, try exact domain match
    const exactDomainMatch = await payload.find({
      collection: 'tenants',
      where: {
        domain: { equals: hostname }
      },
      limit: 1
    })

    if (exactDomainMatch.docs.length > 0) {
      const tenant = exactDomainMatch.docs[0]
      console.log(`✅ Found tenant by exact domain: ${tenant?.name}`)
      return {
        tenant,
        matchedDomain: hostname,
        matchType: 'primary',
        isActive: tenant?.status === 'active'
      }
    }

    // Try subdomain match (e.g., "hays.kendev.co")
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      const subdomain = parts[0]
      
      const subdomainMatch = await payload.find({
        collection: 'tenants',
        where: {
          subdomain: { equals: subdomain }
        },
        limit: 1
      })

      if (subdomainMatch.docs.length > 0) {
        const tenant = subdomainMatch.docs[0]
        console.log(`✅ Found tenant by subdomain: ${tenant?.name}`)
        return {
          tenant,
          matchedDomain: hostname,
          matchType: 'subdomain',
          isActive: tenant?.status === 'active'
        }
      }
    }

    // Try domain aliases
    const aliasMatch = await payload.find({
      collection: 'tenants',
      where: {
        'domainAliases.domain': { equals: hostname },
        'domainAliases.isActive': { equals: true }
      },
      limit: 1
    })

    if (aliasMatch.docs.length > 0) {
      const tenant = aliasMatch.docs[0]
      console.log(`✅ Found tenant by domain alias: ${tenant?.name}`)
      return {
        tenant,
        matchedDomain: hostname,
        matchType: 'alias',
        isActive: tenant?.status === 'active'
      }
    }

    // No tenant found
    console.log(`❌ No tenant found for hostname: ${hostname}`)
    return {
      tenant: null,
      matchedDomain: hostname,
      matchType: 'none',
      isActive: false
    }

  } catch (error) {
    console.error('Error resolving tenant:', error)
    return {
      tenant: null,
      matchedDomain: hostname,
      matchType: 'none',
      isActive: false
    }
  }
}

/**
 * Middleware function to inject tenant context into requests
 */
export async function withTenantContext(request: Request) {
  const url = new URL(request.url)
  const hostname = url.hostname
  
  const resolution = await resolveTenantFromDomain(hostname)
  
  // Add tenant context to request headers for downstream use
  const headers = new Headers(request.headers)
  if (resolution.tenant) {
    headers.set('x-tenant-id', resolution.tenant.id.toString())
    headers.set('x-tenant-slug', resolution.tenant.slug)
    headers.set('x-tenant-domain-match', resolution.matchType)
  }
  
  return {
    request: new Request(request, { headers }),
    tenant: resolution.tenant,
    resolution
  }
}

/**
 * Generate suggested domain aliases for a tenant
 */
export function generateDomainAliases(tenantSlug: string, businessName: string): Array<{
  domain: string
  type: 'subdomain' | 'development' | 'staging'
  description: string
}> {
  const suggestions = [
    {
      domain: `${tenantSlug}.kendev.co`,
      type: 'subdomain' as const,
      description: 'Primary subdomain'
    },
    {
      domain: `${tenantSlug}.angelos.dev`,
      type: 'subdomain' as const,
      description: 'Angel OS subdomain'
    },
    {
      domain: `dev-${tenantSlug}.kendev.co`,
      type: 'development' as const,
      description: 'Development environment'
    },
    {
      domain: `staging-${tenantSlug}.kendev.co`,
      type: 'staging' as const,
      description: 'Staging environment'
    },
    {
      domain: `test-${tenantSlug}.localhost`,
      type: 'development' as const,
      description: 'Local testing'
    }
  ]

  // Add business name variations
  const businessSlug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  if (businessSlug !== tenantSlug) {
    suggestions.push({
      domain: `${businessSlug}.kendev.co`,
      type: 'subdomain' as const,
      description: 'Business name subdomain'
    })
  }

  return suggestions
}

/**
 * Test domain resolution (for debugging)
 */
export async function testDomainResolution(testDomains: string[]) {
  console.log('🧪 Testing domain resolution...')
  
  for (const domain of testDomains) {
    const result = await resolveTenantFromDomain(domain)
    console.log(`${result.tenant ? '✅' : '❌'} ${domain} → ${result.tenant?.name || 'No tenant'} (${result.matchType})`)
  }
}

/**
 * Example hosts file entries for multi-tenant testing
 */
export const EXAMPLE_HOSTS_ENTRIES = `
# Angel OS Multi-Tenant Testing
# Add these to your Windows hosts file: C:\\Windows\\System32\\drivers\\etc\\hosts

127.0.0.1 kendev.localhost
127.0.0.1 spaces.kendev.localhost  
127.0.0.1 test1.kendev.localhost
127.0.0.1 test2.kendev.localhost
127.0.0.1 demo.kendev.localhost
127.0.0.1 staging.kendev.localhost
127.0.0.1 dev.kendev.localhost

# Custom domain testing
127.0.0.1 hayscactus.localhost
127.0.0.1 example-business.localhost
127.0.0.1 client-site.localhost
`
