/**
 * Canonical tenant permission definitions.
 *
 * Single source of truth — imported by DashboardContext, TeamManager,
 * server actions, and anywhere else that references permission keys.
 */

/** All valid tenant-level permission keys. */
export type TenantPermission =
  | 'manage_users'
  | 'manage_spaces'
  | 'manage_content'
  | 'manage_products'
  | 'manage_orders'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_billing'
  | 'export_data'

/** Valid tenant roles. */
export type TenantRole = 'tenant_admin' | 'tenant_manager' | 'tenant_member'

/** Permission metadata for UI display. */
export interface PermissionInfo {
  key: TenantPermission
  label: string
}

/** All 9 tenant permissions with labels. */
export const ALL_PERMISSIONS: PermissionInfo[] = [
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_spaces', label: 'Manage Spaces' },
  { key: 'manage_content', label: 'Manage Content' },
  { key: 'manage_products', label: 'Manage Products' },
  { key: 'manage_orders', label: 'Manage Orders' },
  { key: 'view_analytics', label: 'View Analytics' },
  { key: 'manage_settings', label: 'Manage Settings' },
  { key: 'manage_billing', label: 'Manage Billing' },
  { key: 'export_data', label: 'Export Data' },
]

/** Flat list of all permission keys. */
export const ALL_PERMISSION_KEYS: TenantPermission[] = ALL_PERMISSIONS.map((p) => p.key)

/** Default permissions granted by role (before explicit overrides). */
export const ROLE_DEFAULT_PERMISSIONS: Record<TenantRole, TenantPermission[]> = {
  tenant_admin: [...ALL_PERMISSION_KEYS],
  tenant_manager: [
    'manage_spaces',
    'manage_content',
    'manage_products',
    'manage_orders',
    'view_analytics',
  ],
  tenant_member: ['view_analytics'],
}

/** Human-readable role labels. */
export const ROLE_LABELS: Record<TenantRole, string> = {
  tenant_admin: 'Admin',
  tenant_manager: 'Manager',
  tenant_member: 'Member',
}
