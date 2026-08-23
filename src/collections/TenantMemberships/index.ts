import type { Access, CollectionConfig, Where } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { adminOrPortalManager, adminOrPortalManagerCreate } from '@/access/portalManager'
import { enforceManagedTenant, enforceManagedTenantOnChange } from '@/hooks/enforceManagedTenant'
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
 *
 * ACCESS IS SECURITY-CRITICAL HERE. This collection IS the authorization graph:
 * a row saying (user X, tenant Y, role tenant_admin) grants X administrative
 * control of Y. It is also NOT registered with the multi-tenant plugin, so
 * nothing ANDs a tenant filter onto it — unlike contacts/orders/etc.
 *
 * It previously had `create` and `update` open to any signed-in user, with no
 * field-level guard on `role`. That let anyone POST themselves a tenant_admin
 * row on ANY tenant on the node, at which point autoJoinSpaces enrolled them in
 * that tenant's spaces. Every legitimate writer — provisioning,
 * ensureTenantMembership, invite acceptance — goes through the Local API with
 * overrideAccess, so none of them are affected by locking this down.
 */
const isPlatformAdmin: Access = ({ req: { user } }) =>
  Boolean(user && checkRole(ADMIN_ROLES, user))

/** Own rows, plus the rosters of tenants you're actually a member of. */
const membershipReadAccess: Access = async ({ req }) => {
  const user = req.user
  if (!user?.id) return false
  if (checkRole(ADMIN_ROLES, user)) return true

  const mine = await req.payload.find({
    collection: 'tenant-memberships',
    where: { user: { equals: user.id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const tenantIds = (mine.docs || [])
    .map((m) => {
      const t = (m as { tenant?: unknown }).tenant
      return typeof t === 'object' && t !== null ? (t as { id?: number | string }).id : t
    })
    .filter((v): v is number | string => v != null)

  if (!tenantIds.length) return { user: { equals: user.id } } as Where
  return { or: [{ user: { equals: user.id } }, { tenant: { in: tenantIds } }] } as Where
}

export const TenantMemberships: CollectionConfig = {
  slug: 'tenant-memberships',
  hooks: {
    beforeValidate: [enforceManagedTenant],
    beforeChange: [enforceManagedTenantOnChange],
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
    // A portal owner manages their OWN people — the roster of a tenant they
    // hold tenant_admin/tenant_manager on, and no other. enforceManagedTenant
    // is what stops a manager writing a membership onto somebody else's tenant,
    // which would otherwise be self-service escalation onto their site.
    // Server flows still use overrideAccess.
    create: adminOrPortalManagerCreate,
    update: adminOrPortalManager,
    delete: adminOrPortalManager,
    // Reads are scoped to what you can legitimately see: your own memberships,
    // plus the roster of any tenant you actually belong to (the dashboard's
    // member list depends on this). Not the whole node's membership graph.
    read: membershipReadAccess,
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
        {
          name: 'invitationName',
          type: 'text',
          admin: {
            description:
              'Display name typed by the inviter (e.g. "Vlad") — shown on rosters while pending, applied to the user account created on first OTP sign-in.',
          },
        },
        {
          name: 'invitationPhone',
          type: 'text',
          index: true,
          admin: {
            description:
              'E.164 mobile of invited user — phone invites: admin copies the link, texts it themselves; invitee signs in with a texted code (account created on first OTP).',
          },
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
