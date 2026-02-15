import type { Access } from 'payload'
import { isSuperAdmin } from '@/access/isSuperAdmin'
import { authenticated } from '../access/authenticated'
import { authenticatedOrPublished } from '../access/authenticatedOrPublished'
import { getCurrentTenantId } from './invisible-tenant-system'

function isPlatformAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object' || !('roles' in user)) return false
  const roles = (user as { roles?: string[] }).roles
  return Array.isArray(roles) && (roles.includes('super_admin') || roles.includes('archangel') || roles.includes('admin'))
}

/**
 * Creates tenant-aware access control for collections
 * Super admins can switch tenants via the chooser and see filtered content
 * Regular users see content from their assigned tenant only
 */
export function createTenantAwareCollectionAccess() {
  const create: Access = ({ req }) => {
    if (!req.user) return false
    if (isSuperAdmin(req.user as import('@/payload-types').User)) return true
    if (isPlatformAdmin(req.user)) return true
    return authenticated({ req })
  }

  const delete_: Access = ({ req }) => {
    if (!req.user) return false
    if (isSuperAdmin(req.user as import('@/payload-types').User)) return true
    if (isPlatformAdmin(req.user)) return true
    return authenticated({ req })
  }

  const read: Access = ({ req }): any => {
    // Super_admin and platform_admin users can see content from selected tenant via chooser
    if (isSuperAdmin(req.user as import('@/payload-types').User) || isPlatformAdmin(req.user)) {
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

    // Regular users: filter by tenant from membership / context
    const userTenantId = getCurrentTenantId(req)
    if (userTenantId) {
      return {
        tenant: {
          equals: userTenantId,
        },
      }
    }

    // For unauthenticated users, use published content only
    return authenticatedOrPublished({ req })
  }

  const update: Access = ({ req }): any => {
    if (!req.user) return false

    // Super_admin and platform_admin users can update content from selected tenant
    if (isSuperAdmin(req.user as import('@/payload-types').User) || isPlatformAdmin(req.user)) {
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

    // Regular users: filter by tenant from membership / context
    const updateTenantId = getCurrentTenantId(req)
    if (updateTenantId) {
      return {
        tenant: {
          equals: updateTenantId,
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
