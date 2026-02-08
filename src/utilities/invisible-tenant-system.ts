/**
 * Invisible Tenant System
 * 
 * Makes tenant fields completely invisible and adds automatic filtering
 * without breaking your existing carefully designed collections
 */

import type { Access, Field, PayloadRequest } from 'payload'

/**
 * Get current tenant ID from request context
 */
export function getCurrentTenantId(req: PayloadRequest): string | null {
  try {
    const isSuper = (req.user as any)?.globalRole === 'super_admin'
    const isPlatformAdmin = (req.user as any)?.globalRole === 'platform_admin'
    
    // For super_admin and platform_admin users, prioritize cookie (explicit selection) over domain
    if (isSuper || isPlatformAdmin) {
      // Check cookie first for admin users (tenant chooser selection)
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        const match = cookieHeader.match(/payload-tenant=([^;]+)/)
        if (match && match[1]) return match[1]
      }
      
      // Fallback to domain-based for admin users
      const tenantFromHeaders = req.headers.get('x-tenant-id')
      if (tenantFromHeaders) return tenantFromHeaders
    } else {
      // For regular users, ONLY use domain-based tenant resolution (strict isolation)
      const tenantFromHeaders = req.headers.get('x-tenant-id')
      if (tenantFromHeaders) {
        // Verify the user actually belongs to this tenant
        if (req.user && (req.user as any).tenant) {
          const userTenant = (req.user as any).tenant
          const userTenantId = typeof userTenant === 'object' ? String(userTenant.id) : String(userTenant)
          
          // Only return the domain tenant if it matches the user's tenant
          if (tenantFromHeaders === userTenantId) {
            return tenantFromHeaders
          }
          
          // If domain doesn't match user's tenant, return user's tenant (security)
          return userTenantId
        }
        
        // For unauthenticated users, use domain tenant
        return tenantFromHeaders
      }
    }
    
    // Fallback to user's tenant
    if (req.user && (req.user as any).tenant) {
      const userTenant = (req.user as any).tenant
      return typeof userTenant === 'object' ? String(userTenant.id) : String(userTenant)
    }
    
    return null
  } catch (error) {
    console.error('Error getting current tenant:', error)
    return null
  }
}

/**
 * Create invisible tenant access control
 */
export function createInvisibleTenantAccess(): Access {
  return ({ req }) => {
    // Super admins see everything
    if ((req.user as any)?.globalRole === 'super_admin') {
      return true
    }

    // Get current tenant
    const currentTenantId = getCurrentTenantId(req)
    if (currentTenantId) {
      return {
        tenant: {
          equals: currentTenantId,
        },
      }
    }

    // No tenant context = no access
    return false
  }
}

/**
 * Create the invisible tenant field
 */
export function createInvisibleTenantField(): Field {
  return {
    name: 'tenant',
    type: 'relationship',
    relationTo: 'tenants',
    required: true,
    admin: {
      condition: () => false, // Always hidden
      description: 'Auto-assigned tenant (hidden from UI)',
    },
    hooks: {
      beforeValidate: [
        ({ req, value }) => {
          // Auto-assign current tenant if not set
          if (!value) {
            const currentTenantId = getCurrentTenantId(req)
            if (currentTenantId) {
              return currentTenantId
            }
          }
          return value
        },
      ],
    },
  }
}

/**
 * Make existing tenant field invisible
 */
export function makeExistingTenantFieldInvisible(field: any): any {
  if (field.name === 'tenant' && field.type === 'relationship' && field.relationTo === 'tenants') {
    return {
      ...field,
      admin: {
        ...field.admin,
        condition: () => false, // Always hidden
        description: 'Auto-assigned tenant (hidden from UI)',
      },
      hooks: {
        ...field.hooks,
        beforeValidate: [
          ...(field.hooks?.beforeValidate || []),
          ({ req, value }: { req: PayloadRequest; value: any }) => {
            if (!value) {
              const currentTenantId = getCurrentTenantId(req)
              if (currentTenantId) {
                return currentTenantId
              }
            }
            return value
          },
        ],
      },
    }
  }
  return field
}

/**
 * Collections that should NOT have tenant filtering (platform-wide)
 */
const GLOBAL_COLLECTIONS = [
  'tenants',
  'tenant-management', 
  'tenant-memberships',
  'space-memberships',
  'users',
  'angel-tokens',
  'token-balances',
  'angel-os-nodes',
  'tenant-distribution',
  'humanitarian-agents',
  'ai-generation-queue',
  'job-queue',
  'organizations', // Organizations span multiple tenants
  'roadmap-features', // Platform roadmap is global
  'security-logs' // Platform security is global
]

/**
 * Collections that need tenant fields added (ONLY if they don't break existing DB schema)
 * For now, we'll be conservative and only work with existing tenant fields
 */
const NEEDS_TENANT_FIELD: string[] = [
  // Temporarily empty - will add tenant fields via database migration scripts instead
  // 'quote-requests', // Missing tenant field
  // 'schools', // SafeSchool data should be tenant-specific  
]

/**
 * Check if collection should have tenant filtering
 */
export function shouldHaveTenantFiltering(collectionSlug: string): boolean {
  return !GLOBAL_COLLECTIONS.includes(collectionSlug)
}

/**
 * Enhance collection with invisible tenant filtering
 */
export function enhanceCollectionWithInvisibleTenantFiltering(collection: any): any {
  const collectionSlug = collection.slug

  // Skip global collections
  if (!shouldHaveTenantFiltering(collectionSlug)) {
    return collection
  }

  // Check if collection has tenant field
  const hasTenantField = collection.fields?.some((field: any) => 
    field.name === 'tenant' && field.type === 'relationship' && field.relationTo === 'tenants'
  )

  let enhancedFields = collection.fields

  if (hasTenantField) {
    // Make existing tenant field invisible
    enhancedFields = collection.fields?.map(makeExistingTenantFieldInvisible)
  } else if (NEEDS_TENANT_FIELD.includes(collectionSlug)) {
    // Add invisible tenant field (only for explicitly listed collections)
    enhancedFields = [...(collection.fields || []), createInvisibleTenantField()]
  } else {
    // Collection doesn't have tenant field - skip tenant filtering for now
    console.log(`⚠️ Collection '${collectionSlug}' has no tenant field - skipping tenant filtering`)
    return collection
  }

  // Don't override existing access control, just enhance it
  const originalAccess = collection.access || {}
  
  // Create enhanced access that preserves existing logic
  const enhancedAccess = {
    create: originalAccess.create || createInvisibleTenantAccess(),
    read: originalAccess.read || createInvisibleTenantAccess(),
    update: originalAccess.update || createInvisibleTenantAccess(), 
    delete: originalAccess.delete || createInvisibleTenantAccess(),
  }

  return {
    ...collection,
    fields: enhancedFields,
    access: enhancedAccess,
    admin: {
      ...collection.admin,
      description: `${collection.admin?.description || ''} (Auto tenant-filtered)`.trim(),
    },
  }
}

/**
 * Batch enhance all collections
 */
export function applyInvisibleTenantFiltering(collections: any[]): any[] {
  const enhanced = collections.map(enhanceCollectionWithInvisibleTenantFiltering)
  
  // Log what was enhanced
  const enhancedCollections = enhanced.filter((collection, index) => {
    const wasEnhanced = collection !== collections[index]
    if (wasEnhanced) {
      console.log(`🔧 Enhanced '${collection.slug}' with invisible tenant filtering`)
    }
    return wasEnhanced
  })
  
  console.log(`✅ Applied invisible tenant filtering to ${enhancedCollections.length} collections`)
  
  return enhanced
}
