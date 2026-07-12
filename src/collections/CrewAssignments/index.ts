/**
 * CrewAssignments Collection — Sprint 40
 *
 * Naval architecture overlay for Endeavor crews. Each assignment maps a
 * TenantMembership holder to a department, station, rank, and watch section
 * within an Endeavor.
 *
 * One member can hold multiple assignments (dual-hatting, cross-training).
 * The Crew Routing Engine uses these assignments to dispatch intra-Enterprise
 * work to the right person once the Workload Engine routes a WorkUnit to the
 * node (Endeavor).
 *
 * Metaphor: The Endeavor is the ship. CrewAssignments are the duty roster.
 * Departments are functional divisions. Stations are specific positions.
 * Watches are shift rotations.
 *
 * @see src/utilities/crew-routing-engine.ts — person-level work dispatch
 * @see src/utilities/workload-engine.ts — node-level work dispatch
 */

import type { CollectionConfig } from 'payload'

export const DEPARTMENTS = [
  { label: 'Bridge (Command)', value: 'bridge' },
  { label: 'Engineering', value: 'engineering' },
  { label: 'Operations', value: 'operations' },
  { label: 'Science', value: 'science' },
  { label: 'Communications', value: 'communications' },
  { label: 'Medical', value: 'medical' },
  { label: 'Security', value: 'security' },
  { label: 'Logistics', value: 'logistics' },
] as const

export const RANKS = [
  { label: 'Captain', value: 'captain' },
  { label: 'Commander', value: 'commander' },
  { label: 'Lt. Commander', value: 'lt_commander' },
  { label: 'Lieutenant', value: 'lieutenant' },
  { label: 'Ensign', value: 'ensign' },
  { label: 'Specialist', value: 'specialist' },
  { label: 'Cadet', value: 'cadet' },
] as const

export const DUTY_STATUSES = [
  { label: 'Active Duty', value: 'active_duty' },
  { label: 'Shore Leave', value: 'shore_leave' },
  { label: 'Detached Service', value: 'detached' },
  { label: 'Reserve', value: 'reserve' },
] as const

export const WATCH_SECTIONS = [
  { label: 'Alpha Watch', value: 'alpha' },
  { label: 'Beta Watch', value: 'beta' },
  { label: 'Gamma Watch', value: 'gamma' },
  { label: 'Delta Watch', value: 'delta' },
] as const

export type Department = (typeof DEPARTMENTS)[number]['value']
export type Rank = (typeof RANKS)[number]['value']
export type DutyStatus = (typeof DUTY_STATUSES)[number]['value']
export type WatchSection = (typeof WATCH_SECTIONS)[number]['value']

export const CrewAssignments: CollectionConfig = {
  slug: 'crew-assignments',
  admin: {
    group: 'Core',
    useAsTitle: 'station',
    defaultColumns: ['station', 'department', 'rank', 'dutyStatus', 'watchSection'],
    listSearchableFields: ['station', 'notes'],
    description:
      'Naval crew assignments — maps members to departments, stations, and watches within an Endeavor.',
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
  },

  fields: [
    // ── Relationships ──────────────────────────────────────────────
    {
      name: 'membership',
      type: 'relationship',
      relationTo: 'tenant-memberships' as any,
      required: true,
      admin: {
        description: 'The tenant membership this crew assignment belongs to',
      },
    },
    {
      name: 'endeavor',
      type: 'relationship',
      relationTo: 'endeavors' as any,
      required: true,
      index: true,
      admin: {
        description: 'The Endeavor (ship) this crew member serves on',
      },
    },

    // ── Naval Role ─────────────────────────────────────────────────
    {
      name: 'department',
      type: 'select',
      required: true,
      options: [...DEPARTMENTS],
      admin: {
        description:
          'Functional division: Bridge (command), Engineering (tech/product), ' +
          'Operations (logistics/fulfillment), Science (analytics/research), ' +
          'Communications (marketing/content), Medical (support/wellness), ' +
          'Security (compliance/trust), Logistics (supply chain/fleet)',
      },
    },
    {
      name: 'station',
      type: 'text',
      required: true,
      admin: {
        description: 'Specific position within the department',
        placeholder: 'e.g., "Captain", "Chief Engineer", "Ops Chief", "Content Specialist"',
      },
    },
    {
      name: 'rank',
      type: 'select',
      required: true,
      defaultValue: 'ensign',
      options: [...RANKS],
      admin: {
        description: 'Crew rank — determines chain of command priority',
      },
    },

    // ── Duty & Watch ───────────────────────────────────────────────
    {
      name: 'dutyStatus',
      type: 'select',
      required: true,
      defaultValue: 'active_duty',
      options: [...DUTY_STATUSES],
      admin: {
        description: 'Current duty status — affects work routing eligibility',
      },
    },
    {
      name: 'watchSection',
      type: 'select',
      options: [...WATCH_SECTIONS],
      admin: {
        description: 'Watch/shift rotation assignment (Alpha through Delta)',
      },
    },

    // ── Individual Capabilities ────────────────────────────────────
    {
      name: 'capabilities',
      type: 'array',
      admin: {
        description: 'Individual skills and proficiency levels — used by the Crew Routing Engine',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'skill',
          type: 'text',
          required: true,
          admin: { placeholder: 'e.g., "Graphic Design", "Node.js", "Customer Support"' },
        },
        {
          name: 'proficiency',
          type: 'select',
          defaultValue: 'proficient',
          options: [
            { label: 'Expert', value: 'expert' },
            { label: 'Proficient', value: 'proficient' },
            { label: 'Learning', value: 'learning' },
          ],
        },
      ],
    },

    // ── Metadata ───────────────────────────────────────────────────
    {
      name: 'assignedAt',
      type: 'date',
      defaultValue: () => new Date().toISOString(),
      admin: { readOnly: true },
    },
    {
      name: 'assignedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes about this assignment',
        rows: 2,
      },
    },
  ],
}
