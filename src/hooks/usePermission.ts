import { useDashboard } from '@/providers/DashboardContext'

/** Check if the current user has a specific tenant permission */
export function usePermission(permission: string): boolean {
  const { canManage } = useDashboard()
  return canManage(permission)
}

/** Check if the current user has any of the given permissions */
export function useAnyPermission(...permissions: string[]): boolean {
  const { canManage } = useDashboard()
  return permissions.some(canManage)
}
