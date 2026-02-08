/**
 * Simple Implicit Tenant Filtering
 * 
 * Clean implementation that works with your existing schema
 */

import type { Access, PayloadRequest } from 'payload'

/**
 * Get current tenant ID from request
 */
function getCurrentTenantId(req: PayloadRequest): string | null {
  try {
    // From middleware headers (domain-based)
    const tenantFromHeaders = req.headers.get('x-tenant-id')
    if (tenantFromHeaders) return tenantFromHeaders
    
    // From cookie (admin UI)
    const cookieHeader = req.headers.get('cookie')
    if (cookieHeader) {
      const match = cookieHeader.match(/payload-tenant=([^;]+)/)
      if (match && match[1]) return match[1]
    }
    
    return null
  } catch (error) {
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
 * Auto-assign tenant hook
 */
export function autoAssignCurrentTenant(req: PayloadRequest, value: any): any {
  if (value) return value // Don't override existing value
  
  // Get current tenant
  const currentTenantId = getCurrentTenantId(req)
  if (currentTenantId) {
    return currentTenantId
  }
  
  // Fall back to user's tenant
  if (req.user && (req.user as any).tenant) {
    const userTenant = (req.user as any).tenant
    return typeof userTenant === 'object' ? userTenant.id : userTenant
  }
  
  return value
}

/**
 * Simple collection enhancer
 */
export function makeCollectionTenantInvisible(collection: any): any {
  // Skip if no tenant field
  const hasTenantField = collection.fields?.some((field: any) => 
    field.name === 'tenant' && field.type === 'relationship' && field.relationTo === 'tenants'
  )

  if (!hasTenantField) {
    return collection
  }

  // Make tenant field invisible
  const enhancedFields = collection.fields?.map((field: any) => {
    if (field.name === 'tenant' && field.type === 'relationship' && field.relationTo === 'tenants') {
      return {
        ...field,
        admin: {
          ...field.admin,
          condition: () => false, // Always hidden
          description: 'Auto-assigned tenant (hidden)',
        },
        hooks: {
          ...field.hooks,
          beforeValidate: [
            ...(field.hooks?.beforeValidate || []),
            ({ req, value }: { req: PayloadRequest; value: any }) => {
              return autoAssignCurrentTenant(req, value)
            },
          ],
        },
      }
    }
    return field
  })

  // Add implicit access control
  const enhancedAccess = {
    create: createInvisibleTenantAccess(),
    read: createInvisibleTenantAccess(),
    update: createInvisibleTenantAccess(),
    delete: createInvisibleTenantAccess(),
  }

  return {
    ...collection,
    fields: enhancedFields,
    access: enhancedAccess,
  }
}
