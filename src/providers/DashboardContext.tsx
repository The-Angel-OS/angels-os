'use client'

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import { ROLE_DEFAULT_PERMISSIONS } from '@/constants/permissions'
import type { TenantPermission, TenantRole } from '@/constants/permissions'

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
  tenantRole: TenantRole | null
  tenantPermissions: TenantPermission[]
  membershipId: string | null
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
  canManage: (permission: TenantPermission) => boolean
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
  // SSR-safe initial: the server-resolved default (so no hydration mismatch).
  const [activeSpaceId, setActiveSpaceIdState] = useState<string | null>(
    defaultSpaceId || initialSpaces.find((s) => !s.isSystem)?.id || initialSpaces[0]?.id || null,
  )

  // Sticky active space: persist the user's choice and restore it on mount, so
  // navigating away and back doesn't bounce you to a different space's `general`
  // (the "my messages disappeared" bug when a tenant has >1 community space).
  // Validated against THIS tenant's spaces → a stored id from another tenant is
  // ignored (cross-tenant-safe).
  const STORAGE_KEY = 'angelos.activeSpaceId'
  const setActiveSpaceId = useCallback((id: string) => {
    setActiveSpaceIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* private mode / unavailable — non-fatal */
    }
  }, [])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored && stored !== activeSpaceId && initialSpaces.some((s) => s.id === stored)) {
        setActiveSpaceIdState(stored)
      }
    } catch {
      /* non-fatal */
    }
    // Restore once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    (permission: TenantPermission): boolean => {
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
      if (userRole.tenantRole) {
        const defaults = ROLE_DEFAULT_PERMISSIONS[userRole.tenantRole] || []
        return defaults.includes(permission)
      }
      return false
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
