import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { authenticated } from '@/access/authenticated'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

export const Quests: CollectionConfig = {
  slug: 'quests',
  admin: {
    group: 'Intelligence',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'questType', 'payout.amount', 'createdAt'],
    listSearchableFields: ['title', 'questType'],
  },
  access: {
    create: authenticated,
    // Tenant-scoped: publicly readable within tenant boundary.
    // Quests with networkListing=true are intentionally cross-tenant
    // (handled by federation catalog, not collection-level access).
    read: publicWithTenantScope,
    update: authenticated,
    delete: adminOnly,
  },
  fields: [
    // ─── Core Identity ────────────────────────────────
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'status',
      type: 'select',
      index: true,
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Posted', value: 'posted' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Completed', value: 'completed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'questType',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Freeform type — tenants define their own (e.g. "mystery-shop", "challenge", "scavenger-hunt", "field-research")',
      },
    },
    // ─── Cover Image ──────────────────────────────────
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
      admin: { position: 'sidebar' },
    },
    // ─── Objectives ───────────────────────────────────
    {
      name: 'objectives',
      type: 'array',
      admin: { description: 'What participants must accomplish' },
      fields: [
        { name: 'description', type: 'text', required: true },
        { name: 'required', type: 'checkbox', defaultValue: true },
        {
          name: 'verificationMethod',
          type: 'select',
          defaultValue: 'manual',
          options: [
            { label: 'Photo Evidence', value: 'photo' },
            { label: 'Video Evidence', value: 'video' },
            { label: 'GPS Check-in', value: 'gps' },
            { label: 'Receipt Upload', value: 'receipt' },
            { label: 'Manual Review', value: 'manual' },
            { label: 'Automatic', value: 'auto' },
          ],
        },
      ],
    },
    // ─── Evidence Requirements ────────────────────────
    {
      name: 'evidenceRequirements',
      type: 'array',
      admin: { description: 'What participants must submit as proof' },
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'Photo', value: 'photo' },
            { label: 'Video', value: 'video' },
            { label: 'Document', value: 'document' },
            { label: 'GPS Check-in', value: 'gps_checkin' },
            { label: 'Text Report', value: 'text_report' },
            { label: 'Receipt', value: 'receipt' },
            { label: 'Link/URL', value: 'link' },
          ],
        },
        {
          name: 'description',
          type: 'text',
          admin: { description: 'What specifically to submit' },
        },
        { name: 'required', type: 'checkbox', defaultValue: true },
      ],
    },
    // ─── Payout ───────────────────────────────────────
    {
      name: 'payout',
      type: 'group',
      admin: { description: 'Compensation for quest completion' },
      fields: [
        {
          name: 'type',
          type: 'select',
          defaultValue: 'fixed',
          options: [
            { label: 'Fixed Amount', value: 'fixed' },
            { label: 'Per Objective', value: 'per_objective' },
            { label: 'Bounty (first to complete)', value: 'bounty' },
            { label: 'Tip-based', value: 'tip' },
          ],
        },
        {
          name: 'amount',
          type: 'number',
          min: 0,
          admin: { description: 'Payout amount (in minor units / cents)' },
        },
        { name: 'currency', type: 'text', defaultValue: 'USD' },
        {
          name: 'paymentMethod',
          type: 'select',
          defaultValue: 'stripe',
          options: [
            { label: 'Stripe', value: 'stripe' },
            { label: 'Angel Token', value: 'angel_token' },
            { label: 'Platform Credit', value: 'platform_credit' },
          ],
        },
      ],
    },
    // ─── Requirements & Constraints ───────────────────
    {
      name: 'requirements',
      type: 'group',
      fields: [
        { name: 'minParticipants', type: 'number', defaultValue: 1, min: 1 },
        {
          name: 'maxParticipants',
          type: 'number',
          admin: { description: 'Leave empty for unlimited' },
        },
        {
          name: 'teamSize',
          type: 'number',
          admin: { description: 'If set, participants form teams of this size' },
        },
        {
          name: 'startsAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'expiresAt',
          type: 'date',
          admin: { date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'timeLimit',
          type: 'number',
          admin: { description: 'Minutes to complete once accepted (0 = no limit)' },
        },
        {
          name: 'prerequisites',
          type: 'json',
          admin: {
            description: 'JSON prerequisites (e.g. completed quests, minimum reputation)',
          },
        },
      ],
    },
    // ─── Location ─────────────────────────────────────
    {
      name: 'location',
      type: 'group',
      admin: { description: 'Physical location requirements (optional)' },
      fields: [
        { name: 'address', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        {
          name: 'radius',
          type: 'number',
          admin: { description: 'Geofence radius in meters' },
        },
        {
          name: 'isRemote',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Can be completed from anywhere' },
        },
      ],
    },
    // ─── Relationships ────────────────────────────────
    {
      name: 'postedBy',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    // ─── Extensible Metadata ──────────────────────────
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Tenant-defined custom metadata (extensible — any JSON)' },
    },
    // ─── Difficulty & Reputation ──────────────────────
    {
      name: 'difficulty',
      type: 'select',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Easy', value: 'easy' },
        { label: 'Medium', value: 'medium' },
        { label: 'Hard', value: 'hard' },
        { label: 'Expert', value: 'expert' },
      ],
    },
    {
      name: 'reputationReward',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Reputation points earned on completion',
      },
    },
    // ─── Network Listing ──────────────────────────────
    {
      name: 'networkListing',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'List on Angel OS network for cross-tenant discovery',
      },
    },
  ],
  timestamps: true,
}
