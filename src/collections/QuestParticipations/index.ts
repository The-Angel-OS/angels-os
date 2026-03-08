import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { authenticated } from '@/access/authenticated'

export const QuestParticipations: CollectionConfig = {
  slug: 'quest-participations',
  admin: {
    group: 'Intelligence',
    defaultColumns: ['quest', 'participant', 'status', 'createdAt'],
    description: 'Quest participation records — tracks evidence, objectives, review, and payout for each participant.',
  },
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: adminOnly,
  },
  fields: [
    // ─── Core Relationships ───────────────────────────
    {
      name: 'quest',
      type: 'relationship',
      relationTo: 'quests',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'participant',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    // ─── State Machine ────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'accepted',
      options: [
        { label: 'Accepted', value: 'accepted' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Under Review', value: 'under_review' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Paid', value: 'paid' },
        { label: 'Abandoned', value: 'abandoned' },
      ],
      admin: { position: 'sidebar' },
    },
    // ─── Evidence Submissions ─────────────────────────
    {
      name: 'evidence',
      type: 'array',
      admin: { description: 'Proof of quest completion' },
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
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          admin: {
            condition: (_, siblingData) =>
              ['photo', 'video', 'document', 'receipt'].includes(siblingData?.type),
          },
        },
        {
          name: 'text',
          type: 'textarea',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'text_report',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'link',
          },
        },
        {
          name: 'latitude',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'gps_checkin',
          },
        },
        {
          name: 'longitude',
          type: 'number',
          admin: {
            condition: (_, siblingData) => siblingData?.type === 'gps_checkin',
          },
        },
        {
          name: 'submittedAt',
          type: 'date',
          admin: { readOnly: true },
        },
        {
          name: 'notes',
          type: 'text',
          admin: { description: 'Participant notes about this evidence' },
        },
      ],
    },
    // ─── Objective Tracking ───────────────────────────
    {
      name: 'objectivesCompleted',
      type: 'json',
      admin: {
        description:
          'Map of objective index → completion status { "0": true, "1": false, "2": true }',
      },
    },
    // ─── Review ───────────────────────────────────────
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        condition: (_, siblingData) =>
          ['approved', 'rejected'].includes(siblingData?.status),
      },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: {
        condition: (_, siblingData) =>
          ['under_review', 'approved', 'rejected'].includes(siblingData?.status),
      },
    },
    {
      name: 'rating',
      type: 'number',
      min: 1,
      max: 5,
      admin: { description: 'Quest poster rates the participant (1-5)' },
    },
    // ─── Payout Tracking ──────────────────────────────
    {
      name: 'payoutStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        position: 'sidebar',
        condition: (_, siblingData) =>
          siblingData?.status === 'approved' || siblingData?.status === 'paid',
      },
    },
    {
      name: 'payoutAmount',
      type: 'number',
      admin: { description: 'Actual payout amount in minor units / cents' },
    },
    // ─── Timestamps ───────────────────────────────────
    {
      name: 'acceptedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'submittedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'reviewedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    // ─── Team Info ────────────────────────────────────
    {
      name: 'teamId',
      type: 'text',
      admin: { description: 'Team identifier for group quests' },
    },
    {
      name: 'teamMembers',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: { description: 'Other team members (for group quests)' },
    },
  ],
  timestamps: true,
}
