import type { CollectionConfig } from 'payload'

/**
 * Permissions — the generic access-grant table (Oqtane `Permission` / IPermissionService).
 *
 * ONE mechanism for all access control. A grant attaches a permission
 * (`permissionName`, e.g. "View"/"Edit"/"Manage") on an entity
 * (`entityName`+`entityId`) to either a ROLE (`roleName`) or a specific USER, with
 * `isAuthorized` true (grant) or false (deny — deny wins). This collapses the
 * scattered checkRole / ADMIN_ROLES / membership-permission / space-role dialects
 * into rows a single resolver reads.
 *
 * Shape is Oqtane-verbatim (entityName / entityId / permissionName / roleName /
 * user / isAuthorized) so the eventual Oqtane Marketplace bridge maps 1:1.
 *
 * Access through PermissionService.can(), never raw. Note: the resolver works even
 * with ZERO rows — it derives grants from platform roles + memberships — so this
 * table is an ADDITIVE override/refinement layer, and adopting it is non-breaking.
 *
 * @see docs/architecture/OQTANE_SPINE.md  (Spine 2 — Permissions)
 */
export const Permissions: CollectionConfig = {
  slug: 'permissions',
  admin: {
    group: 'System',
    useAsTitle: 'permissionName',
    defaultColumns: ['entityName', 'entityId', 'permissionName', 'roleName', 'isAuthorized'],
    listSearchableFields: ['entityName', 'entityId', 'permissionName', 'roleName'],
    description: 'Generic per-entity access grants (Oqtane Permission rows).',
  },
  access: {
    // Reads/writes go through PermissionService with overrideAccess; admin UI is a
    // debug view. Only platform/tenant admins should mutate grants in the UI.
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'entityName',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Entity type, e.g. "space", "channel", "page", "booking", "endeavor", "tenant".' },
    },
    {
      name: 'entityId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The entity\'s id (text so string/number ids unify).' },
    },
    {
      name: 'permissionName',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'e.g. "View", "Edit", "Manage" + applet-defined.' },
    },
    {
      name: 'roleName',
      type: 'text',
      index: true,
      admin: {
        description:
          'Grant to a role: platform (super_admin/admin), tenant (tenant_admin/...), space (space_admin/...), or special ("All Users", "Registered Users"). Mutually exclusive with user.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Grant to a specific user. Mutually exclusive with roleName.' },
    },
    {
      name: 'isAuthorized',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'true = grant, false = explicit deny (deny wins over any grant).' },
    },
  ],
}
