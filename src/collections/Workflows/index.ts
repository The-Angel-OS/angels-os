import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'

/**
 * Channel workflows – define automations that run when messages match criteria.
 * E.g. inventory_from_image, pdf_extraction, video_analysis.
 */
export const Workflows: CollectionConfig = {
  slug: 'workflows',
  admin: {
    group: 'Configuration',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'triggerType', 'channelTypes', 'isActive'],
    listSearchableFields: ['name', 'slug', 'description'],
  },
  access: {
    // Tenant automation config, NOT user-owned data — no customer has business
    // reading the triggers and actions wired up for a portal, let alone editing
    // them. workflowRunner reads via the Local API, which defaults to
    // overrideAccess, so execution is unaffected.
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Display name (e.g., "Inventory from Photos")' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Unique identifier (e.g., inventory_from_image)' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'What this workflow does' },
    },
    {
      name: 'triggerType',
      type: 'select',
      required: true,
      options: [
        { label: 'Message with attachments', value: 'message_attachments' },
        { label: 'Message content pattern', value: 'message_pattern' },
        { label: 'Channel type', value: 'channel_type' },
        { label: 'Manual', value: 'manual' },
      ],
      defaultValue: 'message_attachments',
      admin: { description: 'When this workflow runs' },
    },
    {
      name: 'channelTypes',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'General', value: 'general' },
        { label: 'Support', value: 'support' },
        { label: 'Sales', value: 'sales' },
        { label: 'Inventory', value: 'inventory' },
        { label: 'PDF Processing', value: 'pdf' },
        { label: 'Video', value: 'video' },
      ],
      admin: { description: 'Channel types this workflow applies to' },
    },
    {
      name: 'attachmentTypes',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Image', value: 'image' },
        { label: 'PDF', value: 'pdf' },
        { label: 'Video URL', value: 'video_url' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.triggerType === 'message_attachments',
        description: 'Attachment types that trigger this workflow',
      },
    },
    {
      name: 'outputSchema',
      type: 'json',
      admin: {
        description: 'Expected JSON output schema for the workflow (for structured outputs)',
      },
    },
    {
      name: 'handlerConfig',
      type: 'json',
      admin: {
        description: 'Configuration for the workflow handler (model prompt, options, etc.)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Whether this workflow is active' },
    },
  ],
  timestamps: true,
}
