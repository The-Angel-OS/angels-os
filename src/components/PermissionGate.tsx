'use client'

import type { ReactNode } from 'react'
import { useDashboard } from '@/providers/DashboardContext'
import type { TenantPermission } from '@/constants/permissions'

interface PermissionGateProps {
  /** Permission key to check (e.g., 'manage_users', 'manage_products') */
  permission: TenantPermission
  /** Optional fallback when permission denied */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Renders children only if the current user has the specified permission.
 * Falls back to null (or custom fallback) if permission denied.
 */
export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const { canManage } = useDashboard()
  return canManage(permission) ? <>{children}</> : <>{fallback}</>
}
