import type { CollectionConfig } from 'payload'

import { channelSlugField } from '@/fields/channelSlugField'

/**
 * Discord-style channel within a Space.
 * Used for organizing messages (welcome, general, support, sales, etc.).
 *
 * Extensible storage fields:
 *   - `data`        — JSON widget state (task lists, timelines, note hierarchies, etc.)
 *   - `widgets`     — JSON UI config (which widgets active, layout, preferences)
 *   - `dataVersion` — Optimistic locking counter (reject stale concurrent writes)
 *
 * Architecture note: `data` stores widget STATE, not business entity data.
 * Products, Orders, etc. stay in their own collections — widgets provide
 * lenses/views into those collections via the data field.
 */
export const Channels: CollectionConfig = {
  slug: 'channels',
  admin: {
    group: 'Spaces',
    useAsTitle: 'name',
    defaultColumns: ['name', 'space', 'type', 'isDefault'],
    listSearchableFields: ['name', 'slug', 'description'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    // Channels inherit the space's visibility, PLUS the user's own DM channels are
    // always theirs (membership-grained, space-independent) — the channel-model
    // fold: DMs live on the AI Bus but are visible only to their members.
    read: async ({ req: { user, payload } }) => {
      const { buildChannelReadFilter } = await import('@/services/PermissionService')
      const f = await buildChannelReadFilter(payload, user)
      // A boolean `false` makes a REST *list* read 403 instead of returning an
      // empty set — which spammed the log and broke the channel image picker.
      // A never-match filter yields an empty 200, the correct list semantics.
      return f === false ? { id: { exists: false } } : f
    },
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    channelSlugField,
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'general',
      index: true,
      options: [
        { label: 'General', value: 'general' },
        { label: 'LEO (AI Assistant)', value: 'leo' },
        { label: 'Announcements', value: 'announcements' },
        { label: 'Support', value: 'support' },
        { label: 'Sales', value: 'sales' },
        { label: 'Inventory', value: 'inventory' },
        { label: 'PDF Processing', value: 'pdf' },
        { label: 'Video', value: 'video' },
        { label: 'Team', value: 'team' },
        { label: 'Social', value: 'social' },
        { label: 'Email', value: 'email' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'SMS', value: 'sms' },
        { label: 'Direct Message', value: 'dm' },
      ],
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        description:
          'Explicit channel members (required for DMs, optional for regular channels)',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'native',
      options: [
        { label: 'Native', value: 'native' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Email', value: 'email' },
        { label: 'Google Chat', value: 'google_chat' },
        { label: 'SMS', value: 'sms' },
        { label: 'Discord', value: 'discord' },
        { label: 'Telegram', value: 'telegram' },
        { label: 'Slack', value: 'slack' },
        { label: 'Federation', value: 'federation' },
      ],
    },
    {
      name: 'workflows',
      type: 'relationship',
      relationTo: 'workflows',
      hasMany: true,
      admin: {
        description: 'Workflows that run on messages in this channel (e.g. inventory_from_image)',
      },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
    },
    // -----------------------------------------------------------------
    // Extensible Storage (P2.8 — widget state, UI config, concurrency)
    // -----------------------------------------------------------------
    {
      name: 'data',
      type: 'json',
      admin: {
        description:
          'Widget state storage (task lists, timeline entries, note hierarchies, etc.). Uses PostgreSQL jsonb with GIN indexing.',
      },
    },
    {
      name: 'widgets',
      type: 'json',
      admin: {
        description:
          'UI configuration: which widgets are active, their layout, and display preferences. Example: [{ type: "trello", position: 0, config: {} }]',
      },
    },
    {
      name: 'dataVersion',
      type: 'number',
      defaultValue: 0,
      admin: {
        description:
          'Optimistic locking counter. Increment on every update to reject stale concurrent writes.',
      },
    },
  ],
}
