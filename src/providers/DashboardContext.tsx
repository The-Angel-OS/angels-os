'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'

/**
 * Dashboard-wide context — spaces + user roles + permissions.
 *
 * Provides the currently active space and the authenticated user's
 * role/permission data across all dashboard pages. The layout resolves
 * this server-side and passes it here so client components can gate UI
 * without additional fetches.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface DashboardSpace {
  id: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'invite_only' | 'private'
  isSystem?: boolean
}

export interface DashboardUserRole {
  platformRoles: string[]
  tenantRole: string | null // tenant_admin | tenant_manager | tenant_member
  tenantPermissions: string[] // manage_users, manage_spaces, etc.
  membershipId: string | null
}

// ─── Role-implied permission defaults ───────────────────────────
// Permissions granted by tenant role regardless of explicit permissions array.

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  tenant_admin: [
    'manage_users',
    'manage_spaces',
    'manage_content',
    'manage_products',
    'manage_orders',
    'view_analytics',
    'manage_settings',
    'manage_billing',
    'export_data',
  ],
  tenant_manager: [
    'manage_spaces',
    'manage_content',
    'manage_products',
    'manage_orders',
    'view_analytics',
  ],
  tenant_member: ['view_analytics'],
}

// ─── Context Shape ──────────────────────────────────────────────

interface DashboardContextValue {
  // Spaces
  spaces: DashboardSpace[]
  activeSpaceId: string | null
  activeSpace: DashboardSpace | null
  setActiveSpaceId: (id: string) => void

  // User roles + permissions
  userRole: DashboardUserRole | null
  isAdmin: boolean // super_admin || admin || archangel
  isBusinessOwner: boolean // any platform role except customer
  isTenantAdmin: boolean // tenantRole === 'tenant_admin'
  /** Check if current user has a specific tenant permission (or inherits it from role) */
  canManage: (permission: string) => boolean
}

const DashboardCtx = createContext<DashboardContextValue>({
  spaces: [],
  activeSpaceId: null,
  activeSpace: null,
  setActiveSpaceId: () => {},
  userRole: null,
  isAdmin: false,
  isBusinessOwner: false,
  isTenantAdmin: false,
  canManage: () => false,
})

// ─── Provider ───────────────────────────────────────────────────

export function DashboardProvider({
  children,
  initialSpaces,
  defaultSpaceId,
  userRole,
}: {
  children: ReactNode
  initialSpaces: DashboardSpace[]
  defaultSpaceId?: string
  userRole?: DashboardUserRole | null
}) {
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(
    defaultSpaceId || initialSpaces.find((s) => !s.isSystem)?.id || initialSpaces[0]?.id || null,
  )

  const activeSpace = initialSpaces.find((s) => s.id === activeSpaceId) || null

  // Derived booleans
  const isAdmin = Boolean(
    userRole?.platformRoles?.some((r) => r === 'super_admin' || r === 'admin' || r === 'archangel'),
  )
  const isBusinessOwner =
    isAdmin || Boolean(userRole?.platformRoles?.some((r) => r !== 'customer'))
  const isTenantAdmin = userRole?.tenantRole === 'tenant_admin'

  // Permission checker: explicit permissions + role defaults + super_admin bypass
  const canManage = useCallback(
    (permission: string): boolean => {
      if (!userRole) return false
      // Super admins bypass all checks
      if (userRole.platformRoles.includes('super_admin')) return true
      // Platform admin/archangel also bypass
      if (
        userRole.platformRoles.includes('admin') ||
        userRole.platformRoles.includes('archangel')
      )
        return true
      // Explicit permissions on the membership
      if (userRole.tenantPermissions.includes(permission)) return true
      // Role-implied defaults
      const defaults = ROLE_DEFAULT_PERMISSIONS[userRole.tenantRole || ''] || []
      return defaults.includes(permission)
    },
    [userRole],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({
      spaces: initialSpaces,
      activeSpaceId,
      activeSpace,
      setActiveSpaceId,
      userRole: userRole || null,
      isAdmin,
      isBusinessOwner,
      isTenantAdmin,
      canManage,
    }),
    [
      initialSpaces,
      activeSpaceId,
      activeSpace,
      userRole,
      isAdmin,
      isBusinessOwner,
      isTenantAdmin,
      canManage,
    ],
  )

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>
}

export function useDashboard() {
  return useContext(DashboardCtx)
}
