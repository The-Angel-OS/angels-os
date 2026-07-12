import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'
import { syncUserTenants } from './hooks/syncUserTenants'
import { autoJoinSpaces } from './hooks/autoJoinSpaces'

/**
 * User–tenant membership with role-based permissions.
 * Source of truth for tenant-level access (tenant_admin, tenant_manager, tenant_member).
 * Platform-level super_admin remains on Users.roles.
 * Visible in admin only to super_admin.
 *
 * The syncUserTenants afterChange hook syncs active memberships to the User's
 * `tenants` array so the multi-tenant admin plugin shows the correct tenant data.
 */
export const TenantMemberships: CollectionConfig = {
  slug: 'tenant-memberships',
  hooks: {
    afterChange: [syncUserTenants, autoJoinSpaces],
  },
  admin: {
    group: 'Core',
    useAsTitle: 'id',
    defaultColumns: ['user', 'tenant', 'role', 'status'],
    listSearchableFields: ['invitationDetails.invitationEmail', 'invitationDetails.invitationToken'],
    description: 'User–tenant membership with role-based permissions (tenant_admin, tenant_manager, tenant_member).',
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
      // NOT required: a PENDING email invitation has no user account yet — the
      // user is linked on accept (tenant-invite-accept). Requiring it made every
      // email invite 500 with a ValidationError. The prod column was migrated to
      // nullable accordingly (see migrations/20260605_membership_user_nullable).
      index: true,
      admin: { description: 'User who belongs to this tenant (empty for pending email invitations)' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
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
      index: true,
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
        {
          name: 'invitationEmail',
          type: 'email',
          admin: { description: 'Email of invited user (may not have an account yet)' },
        },
      ],
    },
    // ── Propagation Layer (Sprint 42) ─────────────────────────────
    {
      name: 'propagationTrigger',
      type: 'select',
      admin: {
        description:
          'What caused this membership to be created automatically. Null for manually-created memberships (invitations, admin, seed).',
        readOnly: true,
      },
      options: [
        { label: 'Purchase', value: 'purchase' },
        { label: 'Booking', value: 'booking' },
        { label: 'Event Registration', value: 'event_registration' },
        { label: 'Space Join', value: 'space_join' },
        { label: 'Federation Interaction', value: 'federation_interaction' },
        { label: 'Manual', value: 'manual' },
      ],
    },
  ],
}
