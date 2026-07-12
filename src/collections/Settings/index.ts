import type { CollectionConfig } from 'payload'

/**
 * Settings — the generic key/value bag (Oqtane `ISettingService` / `Setting`).
 *
 * One mechanism for ALL per-entity configuration: a setting is attached to any
 * entity by `(entityName, entityId, settingName)` and holds a string value.
 * This is the antidote to bespoke config fields and the schema-drift outages they
 * cause — config becomes a ROW, not an ALTER. Keep relational columns only for
 * what you actually query/filter on; everything else lives here.
 *
 * Shape is deliberately Oqtane-verbatim (entityName / entityId / settingName /
 * settingValue / isPrivate) so the eventual Oqtane Marketplace bridge maps 1:1.
 *
 * Access through SettingService (src/services/SettingService.ts), never raw — the
 * service owns uniqueness, coercion, and the isPrivate read-gate.
 *
 * @see docs/architecture/OQTANE_SPINE.md
 */
export const Settings: CollectionConfig = {
  slug: 'settings',
  admin: {
    group: 'System',
    useAsTitle: 'settingName',
    defaultColumns: ['entityName', 'entityId', 'settingName', 'isPrivate'],
    listSearchableFields: ['entityName', 'entityId', 'settingName', 'settingValue'],
    description: 'Generic per-entity key/value settings (Oqtane Setting bag).',
  },
  access: {
    // Reads/writes go through SettingService with overrideAccess; the admin UI is
    // a debug view. Authenticated-only at the collection layer; isPrivate gating
    // is enforced by the service on read.
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
      admin: { description: 'Entity type, e.g. "tenant", "space", "channel", "applet", "user", "page".' },
    },
    {
      name: 'entityId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The entity\'s id (stored as text so string/number ids unify).' },
    },
    {
      name: 'settingName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'settingValue',
      type: 'text',
      admin: { description: 'String value. Non-string values are JSON-encoded by SettingService.' },
    },
    {
      name: 'isPrivate',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Private settings are withheld from non-admin reads (e.g. secrets).' },
    },
  ],
}
