import { useDashboard } from '@/providers/DashboardContext'
import type { TenantPermission } from '@/constants/permissions'

/** Check if the current user has a specific tenant permission */
export function usePermission(permission: TenantPermission): boolean {
  const { canManage } = useDashboard()
  return canManage(permission)
}

/** Check if the current user has any of the given permissions */
export function useAnyPermission(...permissions: TenantPermission[]): boolean {
  const { canManage } = useDashboard()
  return permissions.some(canManage)
}
