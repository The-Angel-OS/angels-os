import type { Access, CollectionConfig } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

import { runWorkflows } from './hooks/runWorkflows'
import { setAuthor } from './hooks/setAuthor'
import { versionOnEdit } from './hooks/versionOnEdit'
import { setTenantFromSpace } from './hooks/setTenantFromSpace'
import { broadcastToSubscribers } from '@/endpoints/ai-bus-stream'
import { autoAnalyzeMedia } from './hooks/autoAnalyzeMedia'
import { moderateMessage } from './hooks/moderateMessage'

/**
 * Messages Collection — Universal Message Structure (UMS)
 *
 * The foundational "communication fabric" of Angel OS, ensuring every interaction
 * — between humans, AI agents, or federated nodes — is recorded, actionable,
 * and transparent.
 *
 * The UMS is a JSON-based message-driven event system (Article IV, AI Bus Protocol)
 * with these core principles:
 *
 * 1. **Visibility Levels**: private, tenant (default), network — respecting privacy
 *    boundaries while enabling AI collaboration.
 * 2. **Tenant Segmentation**: All messages scoped by Tenant ID for data isolation.
 * 3. **Progressive JSON Content**: Extensible `content` field (JSON) supports plain text,
 *    rich text, payload blocks, widgets, BI metrics, and system actions without
 *    breaking the core schema.
 * 4. **Payload Blocks**: Embed CMS blocks (product displays, booking widgets, forms)
 *    directly within chat messages.
 * 5. **System Messages & Actions**: Track autonomous AI actions, ethical assessments,
 *    and Anti-Daemon Protocol compliance.
 * 6. **Workflow Normalization**: Any form submittal, booking request, or e-commerce
 *    transaction is automatically converted into a System Message — rolling up
 *    disparate activities into a priority-queued messaging hub.
 * 7. **Federation Ready**: Structure aligns with AT Protocol for cross-tenant
 *    AI collaboration and network portability.
 *
 * @see constitutional-prompt.ts — Article IV (AI Bus Protocol)
 * @see ConversationEngine.ts — LEO's conversation management
 * @see workflowRunner.ts — Message-triggered workflow execution
 */

/** Check if user has elevated roles */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAdminOrSystem(user: any): boolean {
  if (!user) return false
  if (user.isSystemUser) return true
  return checkRole(ADMIN_ROLES, user)
}

/**
 * Messages read access: admins/system see all; everyone else sees messages only
 * in spaces visible to them under the ONE shared rule — role-inherits-non-private
 * + explicit-private-grants. Same resolver as Spaces.read + Channels.read, so a
 * member no longer needs a per-space membership row to read their tenant's spaces.
 *
 * @see PermissionService.buildSpaceVisibilityFilter
 */
const readMessages: Access = async ({ req }) => {
  const { user, payload } = req
  // Space-visible messages PLUS the user's own DM threads via the stable channelRef
  // (channel-model fold: DMs live on the AI Bus, gated by channel membership).
  const { buildMessageReadFilter } = await import('@/services/PermissionService')
  const f = await buildMessageReadFilter(payload, user)
  // false → REST list 403 (log spam + broke the channel image picker); a
  // never-match filter returns an empty 200, the correct list semantics.
  return f === false ? { id: { exists: false } } : f
}

export const Messages: CollectionConfig = {
  slug: 'messages',
  // Document locking off (Answer 53) — see Pages/index.ts: the shared
  // payload_locked_documents lock query is the failure point on admin saves on the
  // angels node; locking guards concurrent-editor collisions we don't need here.
  lockDocuments: false,
  admin: {
    group: 'Spaces',
    useAsTitle: 'id',
    defaultColumns: ['messageType', 'space', 'channel', 'visibility', 'author', 'createdAt'],
    listSearchableFields: ['channel', 'federationId'],
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
    // ─── Identity & Routing ───
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      // Not required at API level — setAuthor beforeChange hook auto-populates
      // from req.user. Payload validates required fields before hooks run,
      // so leaving this required would cause 400s on POST.
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
      index: true,
    },
    {
      name: 'channel',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Channel name (e.g. welcome, general, support)' },
    },
    {
      // Phase 2 of the channel re-key (see migration 20260708_000000): the STABLE
      // reference to the canonical channel row. The (space, channel-slug) pair above
      // stays for back-compat reads, but this id survives channel moves/renames —
      // and it's what gates DM privacy (Messages.read: DM messages are visible only
      // to the channel's members via this ref). Set automatically by beforeChange.
      name: 'channelRef',
      type: 'relationship',
      relationTo: 'channels',
      index: true,
      admin: {
        description: 'Canonical channel row (stable across moves/renames). Auto-set on create.',
      },
    },

    // ─── Universal Message Content (JSON) ───
    {
      name: 'content',
      type: 'json',
      required: true,
      admin: {
        description:
          'Universal Message Structure — JSON content supporting text, rich text, payload blocks, widgets, BI metrics, system actions, and any future data format. Backward-compatible: plain string values are auto-wrapped.',
      },
    },

    // ─── Message Classification ───
    {
      name: 'messageType',
      type: 'select',
      defaultValue: 'user',
      index: true,
      options: [
        { label: 'User', value: 'user' },
        { label: 'System', value: 'system' },
        { label: 'Announcement', value: 'announcement' },
        { label: 'AI Agent', value: 'ai_agent' },
        { label: 'Inventory', value: 'inventory' },
        { label: 'PDF', value: 'pdf' },
        { label: 'Video', value: 'video' },
        { label: 'Booking', value: 'booking' },
        { label: 'Form Submission', value: 'form_submission' },
        { label: 'Transaction', value: 'transaction' },
        { label: 'Widget', value: 'widget' },
        { label: 'Ethical Assessment', value: 'ethical_assessment' },
        { label: 'Voice Call', value: 'voice_call' },
        { label: 'Discord Message', value: 'discord_message' },
        { label: 'WhatsApp Message', value: 'whatsapp_message' },
        { label: 'Email Message', value: 'email_message' },
        { label: 'SMS Message', value: 'sms_message' },
        { label: 'Telegram Message', value: 'telegram_message' },
        { label: 'Federation Message', value: 'federation_message' },
      ],
      admin: {
        description: 'Message classification — determines rendering, routing, and workflow triggers',
      },
    },

    // ─── Visibility (Article IV: AI Bus Protocol) ───
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'tenant',
      options: [
        { label: 'Private', value: 'private' },
        { label: 'Tenant', value: 'tenant' },
        { label: 'Network', value: 'network' },
      ],
      admin: {
        description: 'Who can see this message: private (author only), tenant (default), network (federated)',
      },
    },

    // ─── Priority (for workflow normalization queue) ───
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
      admin: {
        description: 'Priority level for the messaging hub queue — affects LEO processing order',
      },
    },

    // ─── Status (for system messages & action tracking) ───
    {
      name: 'status',
      type: 'select',
      index: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Resolved', value: 'resolved' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Message lifecycle status — used for action items, support tickets, and system events',
      },
    },

    // ─── Rich Attachments ───
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
        description: 'Attached media (images, PDFs) — workflows can process these',
      },
    },

    // ─── Progressive Metadata (extensible without schema changes) ───
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description:
          'Progressive metadata: conversation context, intent detection, business goals, ethical assessments, widget configs, BI metrics. Schema-free for forward compatibility.',
      },
    },

    // ─── Thread Support ───
    {
      name: 'parentMessage',
      type: 'relationship',
      relationTo: 'messages',
      admin: {
        description: 'Parent message for threaded replies',
      },
    },

    // Note: 'tenant' field is auto-added by the multi-tenant plugin.
    // Do not define it here to avoid duplicate field errors.

    // ─── Federation: AT Protocol alignment ───
    {
      name: 'federationId',
      type: 'text',
      admin: {
        description: 'AT Protocol DID/URI for cross-tenant federation (future)',
        condition: (_data, siblingData) => siblingData?.visibility === 'network',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      setTenantFromSpace,
      // Make the documented "plain string values are auto-wrapped" promise TRUE.
      // `content` is a required JSON field that REJECTS a bare string on write
      // ("field invalid: Content"), which silently broke every tool that built a
      // string and passed it raw (delegate_task, escalate_issue, send_emergency_alert,
      // send_message, connector relays…). Coerce here once, so no writer has to
      // remember the {text} shape.
      ({ data }) => {
        if (data && typeof (data as { content?: unknown }).content === 'string') {
          ;(data as { content?: unknown }).content = { text: (data as { content: string }).content }
        }
        return data
      },
    ],
    // versionOnEdit AFTER setAuthor: capture prior content into metadata.revisions
    // on every content change (edits + moderator redactions), append-only.
    beforeChange: [
      setAuthor,
      versionOnEdit,
      // Resolve channelRef from the (space, channel-slug) pair on create — the single
      // write-path chokepoint for the stable channel id (phase 2 of the re-key).
      // Fail-soft: a miss (e.g. page-channel slugs with no channel row) leaves it null.
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data || data.channelRef || !data.channel || !data.space) return data
        try {
          const spaceId = typeof data.space === 'object' ? (data.space as { id?: number | string })?.id : data.space
          const found = await req.payload.find({
            collection: 'channels',
            where: { and: [{ slug: { equals: data.channel } }, { space: { equals: spaceId } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          const ch = found.docs?.[0]
          if (ch) data.channelRef = ch.id
        } catch {
          /* non-fatal — back-compat reads still key on (space, slug) */
        }
        return data
      },
    ],
    afterChange: [
      runWorkflows,
      // Broadcast to SSE subscribers for real-time updates
      ({ doc, operation }) => {
        if (operation === 'create') {
          try {
            broadcastToSubscribers(doc)
          } catch {
            // Non-critical: don't fail message save if broadcast fails
          }
        }
        return doc
      },
      // Auto-analyze media attachments (images, PDFs → MediaMeta records)
      autoAnalyzeMedia,
      // Screen every human message (reflex classifier) → annotate metadata.moderation
      // + escalate flagged content to a human moderator. Fail-soft.
      moderateMessage,
    ],
  },
  timestamps: true,
}
