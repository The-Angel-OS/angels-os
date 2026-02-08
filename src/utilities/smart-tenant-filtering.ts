/**
 * Smart Tenant Filtering System
 * 
 * Handles different tenant relationship patterns across collections
 * without breaking existing schemas
 */

import type { Access, PayloadRequest } from 'payload'

/**
 * Get current tenant ID from request context
 */
function getCurrentTenantId(req: PayloadRequest): string | null {
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
    return null
  }
}

/**
 * Collection-specific tenant filtering patterns
 */
const TENANT_FILTERING_PATTERNS: Record<string, {
  field: string
  type: 'direct' | 'relationship' | 'nested'
  path?: string
}> = {
  // Direct tenant relationship
  'products': { field: 'tenant', type: 'direct' },
  'orders': { field: 'tenant', type: 'direct' },
  'contacts': { field: 'tenant', type: 'direct' },
  'spaces': { field: 'tenant', type: 'direct' },
  'appointments': { field: 'tenant', type: 'direct' },
  'leads': { field: 'tenant', type: 'direct' },
  'opportunities': { field: 'tenant', type: 'direct' },
  'projects': { field: 'tenant', type: 'direct' },
  'tasks': { field: 'tenant', type: 'direct' },
  'campaigns': { field: 'tenant', type: 'direct' },
  'workflows': { field: 'tenant', type: 'direct' },
  'business-agents': { field: 'tenant', type: 'direct' },
  'social-media-bots': { field: 'tenant', type: 'direct' },
  'linked-accounts': { field: 'tenant', type: 'direct' },
  'web-chat-sessions': { field: 'tenant', type: 'direct' },
  'invoices': { field: 'tenant', type: 'direct' },
  'donations': { field: 'tenant', type: 'direct' },
  'documents': { field: 'tenant', type: 'direct' },
  'feedback': { field: 'tenant', type: 'direct' },
  'events': { field: 'tenant', type: 'direct' },
  
  // Tenant through space relationship
  'messages': { field: 'space.tenant', type: 'nested', path: 'space' },
  
  // Text-based tenant ID (legacy)
  'channels': { field: 'tenantId', type: 'direct' },
  'photo-analysis': { field: 'tenantId', type: 'direct' },
  'mileage-logs': { field: 'tenantId', type: 'direct' },
  
  // No tenant filtering (global collections)
  'users': { field: '', type: 'direct' }, // Skip
  'media': { field: '', type: 'direct' }, // Skip for now
  'categories': { field: '', type: 'direct' }, // Skip for now
  'pages': { field: '', type: 'direct' }, // Skip for now
  'posts': { field: '', type: 'direct' }, // Skip for now
}

/**
 * Create smart tenant access control based on collection pattern
 */
export function createSmartTenantAccess(collectionSlug: string): Access {
  return ({ req }) => {
    // Super admins see everything
    if ((req.user as any)?.globalRole === 'super_admin') {
      return true
    }

    // Get filtering pattern for this collection
    const pattern = TENANT_FILTERING_PATTERNS[collectionSlug]
    if (!pattern || !pattern.field) {
      // No tenant filtering for this collection
      return true
    }

    // Get current tenant
    const currentTenantId = getCurrentTenantId(req)
    if (!currentTenantId) {
      return false // No tenant context = no access
    }

    // Apply filtering based on pattern type
    switch (pattern.type) {
      case 'direct':
        return {
          [pattern.field]: {
            equals: currentTenantId,
          },
        }
      
      case 'nested':
        // For nested relationships like messages -> space -> tenant
        // Payload doesn't support nested where clauses easily, so we'll handle this at API level
        return true
      
      default:
        return true
    }
  }
}

/**
 * Auto-assign tenant based on collection pattern
 */
export function createSmartTenantAssignment(collectionSlug: string) {
  return ({ req, value }: { req: PayloadRequest; value: any }) => {
    const pattern = TENANT_FILTERING_PATTERNS[collectionSlug]
    if (!pattern || !pattern.field || pattern.type === 'nested') {
      return value // Don't auto-assign for nested or missing patterns
    }

    // Auto-assign current tenant if not set
    if (!value) {
      const currentTenantId = getCurrentTenantId(req)
      if (currentTenantId) {
        return currentTenantId
      }
      
      // Fall back to user's tenant
      if (req.user && (req.user as any).tenant) {
        const userTenant = (req.user as any).tenant
        return typeof userTenant === 'object' ? String(userTenant.id) : String(userTenant)
      }
    }
    
    return value
  }
}

/**
 * Make tenant field invisible if it exists
 */
export function makeSmartTenantFieldInvisible(field: any, collectionSlug: string): any {
  const pattern = TENANT_FILTERING_PATTERNS[collectionSlug]
  if (!pattern) return field

  // Check if this is the tenant field for this collection
  const isTenantField = (
    (field.name === 'tenant' && pattern.field === 'tenant') ||
    (field.name === 'tenantId' && pattern.field === 'tenantId')
  )

  if (isTenantField && field.type === 'relationship' && field.relationTo === 'tenants') {
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
          createSmartTenantAssignment(collectionSlug),
        ],
      },
    }
  }

  return field
}

/**
 * Apply smart tenant filtering to a collection
 */
export function applySmartTenantFiltering(collection: any): any {
  const collectionSlug = collection.slug
  const pattern = TENANT_FILTERING_PATTERNS[collectionSlug]

  if (!pattern || !pattern.field) {
    // No tenant filtering for this collection
    console.log(`⚪ Collection '${collectionSlug}' - no tenant filtering`)
    return collection
  }

  // Make tenant fields invisible
  const enhancedFields = collection.fields?.map((field: any) => 
    makeSmartTenantFieldInvisible(field, collectionSlug)
  )

  // Add smart access control (preserve existing access if it exists)
  const smartAccess = createSmartTenantAccess(collectionSlug)
  const enhancedAccess = {
    create: collection.access?.create || smartAccess,
    read: collection.access?.read || smartAccess,
    update: collection.access?.update || smartAccess,
    delete: collection.access?.delete || smartAccess,
  }

  console.log(`🔧 Collection '${collectionSlug}' - applied smart tenant filtering (${pattern.type}: ${pattern.field})`)

  return {
    ...collection,
    fields: enhancedFields,
    access: enhancedAccess,
  }
}

/**
 * Apply to all collections
 */
export function applySmartTenantFilteringToAll(collections: any[]): any[] {
  return collections.map(applySmartTenantFiltering)
}
