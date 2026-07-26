import type { CollectionConfig } from 'payload'

/**
 * Presence — the "who's online right now" layer (MMORPG-hub foundation, Slice 1).
 *
 * One row per user, upserted by a lightweight client ping (~every 30s). "Online"
 * is derived at query time: lastSeenAt within a freshness window. Deliberately
 * NOT multi-tenant-scoped — presence is global (and optionally space-scoped via
 * the `space` relation) so the network can feel alive across Endeavors.
 *
 * Ephemeral by nature; for higher write volume this moves to KV/Redis, but a
 * single upserted row per user is fine to start.
 *
 * @see src/endpoints/presence-ping.ts   — POST /api/presence-ops/ping
 * @see src/endpoints/presence-online.ts — GET  /api/presence-ops/online
 */
export const Presence: CollectionConfig = {
  slug: 'presence',
  admin: {
    group: 'System',
    useAsTitle: 'id',
    defaultColumns: ['user', 'status', 'space', 'lastSeenAt'],
    listSearchableFields: ['path'],
    description: 'Live online-presence heartbeats (one row per user).',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    // Presence is deliberately global (not tenant-scoped), so `Boolean(user)`
    // on update/delete meant anyone could rewrite or clear anyone else's
    // presence. Own row only.
    update: ({ req: { user } }) => (user ? { user: { equals: user.id } } : false),
    delete: ({ req: { user } }) => (user ? { user: { equals: user.id } } : false),
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'The present user (one row per user — upserted).' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'online',
      index: true,
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Away', value: 'away' },
        { label: 'Offline', value: 'offline' },
      ],
    },
    {
      name: 'lastSeenAt',
      type: 'date',
      required: true,
      index: true,
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Last ping — drives the online/offline derivation.' },
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      index: true,
      admin: { description: 'Space the user is currently viewing (for per-space "N online").' },
    },
    {
      name: 'path',
      type: 'text',
      admin: { description: 'Last route the user was on (presence context).' },
    },
  ],
  timestamps: true,
}
