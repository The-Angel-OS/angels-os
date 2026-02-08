import type { Access } from 'payload'
import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { getCurrentTenantId } from './invisible-tenant-system'

/**
 * Creates tenant-aware access control for collections
 * Super admins can switch tenants via the chooser and see filtered content
 * Regular users see content from their assigned tenant only
 */
export function createTenantAwareCollectionAccess() {
  const create: Access = ({ req }) => {
    if (!req.user) return false
    if (req.user?.globalRole === 'super_admin') return true
    if (req.user?.globalRole === 'platform_admin') return true
    return authenticated({ req })
  }

  const delete_: Access = ({ req }) => {
    if (!req.user) return false
    if (req.user?.globalRole === 'super_admin') return true
    if (req.user?.globalRole === 'platform_admin') return true
    return authenticated({ req })
  }

  const read: Access = ({ req }): any => {
    // Super_admin and platform_admin users can see content from selected tenant via chooser
    if (req.user?.globalRole === 'super_admin' || req.user?.globalRole === 'platform_admin') {
      const currentTenantId = getCurrentTenantId(req) // Respects cookie selection for super_admin
      if (currentTenantId) {
        return {
          tenant: {
            equals: currentTenantId,
          },
        }
      }
      // If no tenant selected, show all content for admin users
      return true
    }

    // Regular users: ALWAYS filter by their assigned tenant (no chooser)
    if (req.user?.tenant) {
      const tenantId = typeof req.user.tenant === 'object' ? req.user.tenant.id : req.user.tenant
      return {
        tenant: {
          equals: tenantId,
        },
      }
    }

    // For unauthenticated users, use published content only
    return authenticatedOrPublished({ req })
  }

  const update: Access = ({ req }): any => {
    if (!req.user) return false
    
    // Super_admin and platform_admin users can update content from selected tenant
    if (req.user?.globalRole === 'super_admin' || req.user?.globalRole === 'platform_admin') {
      const currentTenantId = getCurrentTenantId(req) // Respects cookie selection for super_admin
      if (currentTenantId) {
        return {
          tenant: {
            equals: currentTenantId,
          },
        }
      }
      // If no tenant selected, can update all content for admin users
      return true
    }

    // Regular users: ALWAYS filter by their assigned tenant (no chooser)
    if (req.user?.tenant) {
      const tenantId = typeof req.user.tenant === 'object' ? req.user.tenant.id : req.user.tenant
      return {
        tenant: {
          equals: tenantId,
        },
      }
    }

    // No tenant assignment = no access
    return false
  }

  return {
    create,
    delete: delete_,
    read,
    update,
  }
}
