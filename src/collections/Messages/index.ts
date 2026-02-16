import type { Access, CollectionConfig } from 'payload'

import { runWorkflows } from './hooks/runWorkflows'
import { setAuthor } from './hooks/setAuthor'

/**
 * Message within a Space.
 * channel is the channel name (string) for template compatibility;
 * can be upgraded to relationship to Channels when needed.
 *
 * Access Control (P4):
 * - Admins, super_admins, archangels, and system users: full access
 * - Regular users: can read messages only in spaces they belong to
 *   (via SpaceMemberships collection). Can create in any space they
 *   can read. Cannot update/delete others' messages.
 */

/** Check if user has elevated roles */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdminOrSystem(user: any): boolean {
  if (!user) return false
  if (user.isSystemUser) return true
  const roles = user.roles || []
  return roles.includes('super_admin') || roles.includes('admin') || roles.includes('archangel')
}

/**
 * Messages read access: admins see all; regular users see only messages
 * in spaces where they have an active SpaceMemberships entry.
 *
 * Returns true (full access) for admins, or a Where query that
 * restricts reads to the user's spaces.
 */
const readMessages: Access = async ({ req }) => {
  const { user, payload } = req
  if (!user) return false
  if (isAdminOrSystem(user)) return true

  // Fetch user's active space memberships
  try {
    const memberships = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: user.id } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const spaceIds = memberships.docs
      .map((m) => (typeof m.space === 'object' ? m.space?.id : m.space))
      .filter(Boolean)

    if (spaceIds.length === 0) {
      // No memberships — no messages visible
      return false
    }

    // Return a Where clause that restricts to user's spaces
    return {
      space: { in: spaceIds },
    }
  } catch {
    // If membership check fails, deny access (fail closed)
    return false
  }
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
    defaultColumns: ['content', 'space', 'channel', 'messageType', 'author'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: readMessages,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (isAdminOrSystem(user)) return true
      // Regular users can only update their own messages
      return { author: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (isAdminOrSystem(user)) return true
      // Regular users can only delete their own messages
      return { author: { equals: user.id } }
    },
  },
  fields: [
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      // Not required at API level — setAuthor beforeChange hook auto-populates
      // from req.user. Payload validates required fields before hooks run,
      // so leaving this required would cause 400s on POST.
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
    },
    {
      name: 'channel',
      type: 'text',
      required: true,
      admin: { description: 'Channel name (e.g. welcome, general, support)' },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'messageType',
      type: 'select',
      defaultValue: 'user',
      options: [
        { label: 'User', value: 'user' },
        { label: 'System', value: 'system' },
        { label: 'Announcement', value: 'announcement' },
        { label: 'AI Agent', value: 'ai_agent' },
        { label: 'Inventory', value: 'inventory' },
        { label: 'PDF', value: 'pdf' },
        { label: 'Video', value: 'video' },
      ],
      admin: {
        description: 'Message type – workflow runners use inventory/pdf/video for structured processing',
      },
    },
    {
      name: 'attachments',
      type: 'array',
      fields: [
        {
          name: 'media',
          type: 'relationship',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
      admin: {
        description: 'Attached media (images, PDFs) – workflows can process these',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { description: 'Tenant for scoping (derived from space)' },
    },
  ],
  hooks: {
    beforeChange: [setAuthor],
    afterChange: [runWorkflows],
  },
}
