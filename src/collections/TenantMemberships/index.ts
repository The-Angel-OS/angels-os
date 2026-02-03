import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * User–tenant membership with role-based permissions.
 * Source of truth for tenant-level access (tenant_admin, tenant_manager, tenant_member).
 * Platform-level super_admin remains on Users.roles.
 * Visible in admin only to super_admin.
 */
export const TenantMemberships: CollectionConfig = {
  slug: 'tenant-memberships',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
    defaultColumns: ['user', 'tenant', 'role', 'status'],
    hidden: ({ user }) => !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      Boolean(user && checkRole(['super_admin', 'admin'], user)),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: { description: 'User who belongs to this tenant' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { description: 'Tenant this membership applies to' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Tenant Admin', value: 'tenant_admin' },
        { label: 'Tenant Manager', value: 'tenant_manager' },
        { label: 'Tenant Member', value: 'tenant_member' },
      ],
      admin: { description: 'Role within this tenant' },
    },
    {
      name: 'permissions',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Manage users', value: 'manage_users' },
        { label: 'Manage spaces', value: 'manage_spaces' },
        { label: 'Manage content', value: 'manage_content' },
        { label: 'Manage products', value: 'manage_products' },
        { label: 'Manage orders', value: 'manage_orders' },
        { label: 'View analytics', value: 'view_analytics' },
        { label: 'Manage settings', value: 'manage_settings' },
        { label: 'Manage billing', value: 'manage_billing' },
        { label: 'Export data', value: 'export_data' },
      ],
      admin: { description: 'Granular permissions (optional override)' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
      ],
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who sent the invitation' },
    },
    {
      name: 'joinedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'invitationDetails',
      type: 'group',
      admin: { description: 'For pending invitations' },
      fields: [
        {
          name: 'invitationToken',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'invitationExpiresAt',
          type: 'date',
        },
        {
          name: 'invitationMessage',
          type: 'textarea',
        },
      ],
    },
  ],
}
