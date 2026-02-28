/**
 * Board Members — Federation Governance
 *
 * Tracks the governance board of the Angel OS federation.
 * The board exists on every node (homogeneous mesh), but only
 * activates governance features when the node is the flagship
 * or the user holds a board role.
 *
 * Sprint 24: LEO Enterprise Manager — Phase 1
 */

import type { CollectionConfig } from 'payload'

export const BoardMembers: CollectionConfig = {
  slug: 'board-members',
  admin: {
    group: 'Federation',
    useAsTitle: 'title',
    defaultColumns: ['title', 'role', 'status', 'appointedAt'],
    description: 'Federation governance board members',
  },
  access: {
    // Board data is readable by any authenticated user (transparency)
    read: ({ req: { user } }) => Boolean(user),
    // Only super_admins can manage board membership
    create: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin')
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin')
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin')
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: {
        description: 'The user who holds this board seat',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'observer',
      options: [
        { label: 'Founder', value: 'founder' },
        { label: 'Advisor', value: 'advisor' },
        { label: 'Sentinel Representative', value: 'sentinel_representative' },
        { label: 'Observer', value: 'observer' },
      ],
      admin: {
        description: 'Board role — determines governance powers',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Display title (e.g., "Founder & Herald")',
      },
    },
    {
      name: 'appointedAt',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When this board member was appointed',
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'term',
      type: 'select',
      required: true,
      defaultValue: 'permanent',
      options: [
        { label: 'Permanent', value: 'permanent' },
        { label: '1 Year', value: '1yr' },
        { label: '2 Years', value: '2yr' },
      ],
      admin: {
        description: 'Term length — permanent for founders',
      },
    },
    {
      name: 'status',
      type: 'select',
      index: true,
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Emeritus', value: 'emeritus' },
        { label: 'Removed', value: 'removed' },
      ],
    },
    {
      name: 'permissions',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Oversight — view federation-wide health', value: 'oversight' },
        { label: 'Veto — block federation actions', value: 'veto' },
        { label: 'Provision — create new enterprises', value: 'provision' },
        { label: 'Moderate — moderate federation content', value: 'moderate' },
        { label: 'Configure — change federation settings', value: 'configure' },
      ],
      admin: {
        description: 'Specific governance permissions',
      },
    },
  ],
  timestamps: true,
}
