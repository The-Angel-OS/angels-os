import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
import { publicAccess } from '@/access/publicAccess'
import { adminOrSelf } from '@/access/adminOrSelf'
import { adminOrSelfFieldAccess } from '@/access/adminOrSelfFieldAccess'
import { signedInDirectoryRead } from '@/access/signedInDirectoryRead'
import { checkRole } from '@/access/utilities'
import { managedTenantIds } from '@/access/portalManager'

import { computeFederatedIdentityId } from '@/utilities/federatedIdentity'
import { ensureFirstUserIsAdmin } from './hooks/ensureFirstUserIsAdmin'
import { autoJoinTenantSpaces } from './hooks/autoJoinTenantSpaces'
import { baselineMemberships } from './hooks/baselineMemberships'
import { claimVisitorConversation } from './hooks/claimVisitorConversation'
import { notifyUserRegistered } from './hooks/notifyUserRegistered'

export const Users: CollectionConfig = {
  slug: 'users',
  hooks: {
    // Order matters: baselineMemberships creates the tenant memberships that
    // autoJoinTenantSpaces then reads to find spaces.
    afterChange: [baselineMemberships, autoJoinTenantSpaces, claimVisitorConversation, notifyUserRegistered],
  },
  access: {
    // super_admin: full platform access
    // admin: tenant admin, can access Payload panel and manage tenant data
    // archangel: elevated user role, can access Payload panel
    // Platform roles, OR anyone who manages a portal. A tenant_admin holds no
    // platform role at all, so this refused the owner of a site entry to the
    // panel that every dashboard "Edit" link points at — the error Tyler hit on
    // her own portal. What they can SEE inside is unchanged and still decided
    // per collection; this is only the door.
    admin: async ({ req }) => {
      if (checkRole(['super_admin', 'admin', 'archangel'], req.user)) return true
      return (await managedTenantIds(req)).length > 0
    },
    create: publicAccess,
    delete: adminOnly,
    // Widened 260824 so chat can show WHO SAID SOMETHING — see
    // signedInDirectoryRead. Only name + avatar survive the field gates;
    // usersFieldExposure.test.ts is what keeps it that way.
    read: signedInDirectoryRead,
    update: adminOrSelf,
  },
  admin: {
    group: 'Core',
    defaultColumns: ['name', 'email', 'roles'],
    listSearchableFields: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: {
    tokenExpiration: 1209600,
    cookies: {
      // Allow auth cookie to be shared across all tenant subdomains
      // e.g. .angelos.local (dev) or .angelos.app (prod)
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      sameSite: 'Lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      // The auth email field, re-declared ONLY to hang a read gate on it —
      // Payload merges this with the one `auth: true` adds. Login, invitations
      // and every server-side lookup run with overrideAccess, so they are
      // unaffected; this is about what a peer sees when chat populates an
      // author. Without it, widening users.read hands every signed-in person
      // the whole portal's mailing list.
      name: 'email',
      type: 'email',
      access: { read: adminOrSelfFieldAccess },
    },
    {
      // Uploadable override avatar. `avatarUrl` below falls back to the linked
      // social account, then to Gravatar, so a user who never uploads anything
      // still gets a face — config-free.
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Profile picture. Leave empty to use your Gravatar.' },
    },
    {
      // Gravatar's md5-of-email, maintained on save. It exists as a COLUMN
      // rather than being computed at read time because `email` is redacted for
      // peers by the field gate above — and a fallback avatar that only the
      // account's owner can see is not a fallback. Public by design: a Gravatar
      // hash is what every Gravatar-using site puts in an <img src>.
      name: 'gravatarHash',
      type: 'text',
      admin: { readOnly: true, hidden: true },
      hooks: {
        beforeChange: [
          async ({ data }) => {
            const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : ''
            if (!email) return null
            const { createHash } = await import('crypto')
            // ponytail: Gravatar's documented scheme — md5 here is an address, not a security hash.
            return createHash('md5').update(email).digest('hex')
          },
        ],
      },
    },
    {
      // Virtual: resolved on read, no column. This is the ONE field a chat
      // surface should read — uploaded picture first, Gravatar otherwise.
      // The uploaded branch needs depth >= 1; at depth 0 you get the Gravatar,
      // which is the right thing to show while you wait.
      name: 'avatarUrl',
      type: 'text',
      virtual: true,
      admin: { readOnly: true, hidden: true },
      hooks: {
        afterRead: [
          ({ data }) => {
            const d = (data || {}) as Record<string, unknown>
            const up = d.avatar as { url?: string } | null | undefined
            if (up && typeof up === 'object' && typeof up.url === 'string' && up.url) return up.url
            const hash = typeof d.gravatarHash === 'string' ? d.gravatarHash : ''
            return hash ? `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200` : null
          },
        ],
      },
    },
    {
      // Mobile number (E.164) — the identity anchor for SMS sign-in (Twilio
      // Verify texts a code; verifyOtpSms matches the approved phone to this
      // field). Phone + email are co-equal anchors in the identity graph.
      name: 'phone',
      access: { read: adminOrSelfFieldAccess },
      type: 'text',
      index: true,
      admin: { description: 'Mobile number — any format; normalized to E.164 on save. Enables sign-in by text.' },
      hooks: {
        beforeValidate: [
          // Login normalizes the typed number to E.164 before matching, so the
          // STORED value must be E.164 too — "727-256-4413" saved raw would
          // never match "+17272564413" at sign-in. Same normalizer both sides.
          async ({ value }) => {
            if (typeof value !== 'string' || !value.trim()) return value
            const { normalizePhone } = await import('@/utilities/otpLogin')
            return normalizePhone(value)
          },
        ],
      },
    },
    {
      // Deterministic GLOBAL identity, derived from email — the same person across
      // every federation node. Virtual: computed on read, never stored, so it adds
      // no column and cannot drift across the two databases. See federatedIdentity.ts.
      name: 'federatedIdentityId',
      access: { read: adminOrSelfFieldAccess },
      type: 'text',
      virtual: true,
      admin: {
        readOnly: true,
        description: 'Stable global identity (derived from email). Same value on every Angel OS node.',
      },
      hooks: {
        afterRead: [({ data }) => computeFederatedIdentityId((data?.email as string) || '')],
      },
    },
    {
      name: 'isSystemUser',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description: 'LEO/AI avatar users. Do not log in; author Messages as ai_agent.',
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
      },
    },
    {
      name: 'servesTenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: {
        description: 'Tenant this agent serves (system users only)',
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
      },
    },
    {
      name: 'agentConfig',
      access: { read: adminOrSelfFieldAccess },
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.isSystemUser === true,
        description: 'Configuration for AI/system agent behavior',
      },
      fields: [
        {
          name: 'agentType',
          type: 'select',
          options: [
            { label: 'LEO (General Assistant)', value: 'leo' },
            { label: 'Support Agent', value: 'support' },
            { label: 'Sales Agent', value: 'sales' },
            { label: 'Onboarding Guide', value: 'onboarding' },
            { label: 'Integration Agent', value: 'integration' },
            { label: 'AngelClaw (External)', value: 'angelclaw' },
            { label: 'Custom', value: 'custom' },
          ],
          defaultValue: 'leo',
          admin: {
            description: 'Type of agent - determines default behavior and routing',
          },
        },
        {
          name: 'angelName',
          type: 'text',
          defaultValue: 'LEO',
          admin: {
            description: 'Custom name for this Angel (e.g., "LEO", "Gabriel", "Seraph")',
          },
        },
        {
          name: 'displayName',
          type: 'text',
          admin: {
            description: 'Name shown in chat (e.g., "LEO", "Alex from Support")',
          },
        },
        {
          name: 'personality',
          type: 'textarea',
          admin: {
            description: 'System prompt / personality guidelines for this agent',
          },
        },
        {
          name: 'capabilities',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Query Posts', value: 'query_posts' },
            { label: 'Create Posts', value: 'create_posts' },
            { label: 'Update Posts', value: 'update_posts' },
            { label: 'Query Products', value: 'query_products' },
            { label: 'Create Products', value: 'create_products' },
            { label: 'Update Products', value: 'update_products' },
            { label: 'Query Pages', value: 'query_pages' },
            { label: 'Create Pages', value: 'create_pages' },
            { label: 'Update Pages', value: 'update_pages' },
            { label: 'Manage Categories', value: 'manage_categories' },
            { label: 'Manage Media', value: 'manage_media' },
            { label: 'Manage Navigation', value: 'manage_navigation' },
            { label: 'Create Orders', value: 'create_orders' },
            { label: 'Manage Spaces', value: 'manage_spaces' },
            { label: 'Send Emails', value: 'send_emails' },
            { label: 'Schedule Events', value: 'schedule_events' },
            { label: 'External API Calls', value: 'external_api' },
          ],
          admin: {
            description: 'What actions this agent can perform',
          },
        },
        {
          name: 'responseRules',
          type: 'json',
          admin: {
            description: 'Custom rules/conditions for response generation (JSON). Include "modelStrategy" key to override escalation rhythm.',
          },
        },
        {
          name: 'modelStrategy',
          type: 'group',
          admin: {
            description: 'Model escalation rhythm — controls how often this agent uses a more powerful "deep think" model. Leave defaults for the standard 4:1 rhythm.',
            condition: (_data, siblingData) => Boolean(siblingData?.agentType),
          },
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: true,
              admin: {
                description: 'Enable the escalation rhythm (alternate between fast and deep-think models)',
              },
            },
            {
              name: 'standardRounds',
              type: 'number',
              defaultValue: 4,
              min: 1,
              max: 20,
              admin: {
                description: 'Number of fast rounds between each deep-think round (default: 4)',
              },
            },
            {
              name: 'standardTier',
              type: 'select',
              defaultValue: 'medium',
              options: [
                { label: 'Low (Budget — Gemini Flash)', value: 'low' },
                { label: 'Medium (Standard — Gemini Flash w/ Pro fallback)', value: 'medium' },
                { label: 'High (Premium — Gemini Pro)', value: 'high' },
                { label: 'Critical (Top — Sonnet 4.6)', value: 'critical' },
              ],
              admin: {
                description: 'Model tier for standard (non-escalated) rounds',
              },
            },
            {
              name: 'escalationTier',
              type: 'select',
              defaultValue: 'critical',
              options: [
                { label: 'Low (Budget — Gemini Flash)', value: 'low' },
                { label: 'Medium (Standard — Gemini Flash w/ Pro fallback)', value: 'medium' },
                { label: 'High (Premium — Gemini Pro)', value: 'high' },
                { label: 'Critical (Top — Sonnet 4.6)', value: 'critical' },
              ],
              admin: {
                description: 'Model tier for deep-think (escalated) rounds',
              },
            },
          ],
        },
        {
          name: 'handoffTo',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'Escalate to this user/agent when unable to help',
          },
        },
        {
          name: 'appearance',
          type: 'group',
          admin: {
            description: 'Angel visual appearance and branding',
          },
          fields: [
            {
              name: 'avatar',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Angel avatar image',
              },
            },
            {
              name: 'color',
              type: 'text',
              admin: {
                description: 'Angel theme color (hex, e.g., #10B981)',
                placeholder: '#10B981',
              },
            },
            {
              name: 'emoji',
              type: 'text',
              admin: {
                description: 'Angel signature emoji',
                placeholder: '🦅',
              },
            },
          ],
        },
        {
          name: 'routingRules',
          type: 'group',
          admin: {
            description: 'Rules for when this agent should handle messages',
          },
          fields: [
            {
              name: 'channels',
              type: 'array',
              admin: {
                description: 'Channel slugs this agent monitors (e.g., "support", "sales")',
              },
              fields: [
                {
                  name: 'channelSlug',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'keywords',
              type: 'array',
              admin: {
                description: 'Keywords that trigger this agent',
              },
              fields: [
                {
                  name: 'keyword',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'isDefault',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Use this agent as default when no other matches',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'roles',
      type: 'select',
      access: {
        create: adminOnlyFieldAccess,
        read: adminOnlyFieldAccess,
        update: adminOnlyFieldAccess,
      },
      defaultValue: ['customer'],
      hasMany: true,
      hooks: {
        beforeChange: [ensureFirstUserIsAdmin],
      },
      options: [
        {
          label: 'super_admin',
          value: 'super_admin',
        },
        {
          label: 'archangel',
          value: 'archangel',
        },
        {
          label: 'admin',
          value: 'admin',
        },
        {
          label: 'producer',
          value: 'producer',
        },
        {
          label: 'customer',
          value: 'customer',
        },
      ],
    },
    // ─── Google Calendar (on-demand, per provider) ──────────
    // A provider's real calendar is the ground truth for whether they are free.
    // Without this, /book only knows about bookings made THROUGH us — so an
    // appointment they took by phone, or their kid's recital, is invisible and
    // we happily double-book them. Connected per user via
    // /api/auth/google?calendar=1 (its own consent, never part of sign-in).
    {
      name: 'googleCalendar',
      access: { read: adminOrSelfFieldAccess },
      type: 'group',
      admin: { description: 'Connected Google Calendar — read busy times, write confirmed bookings.' },
      fields: [
        {
          name: 'connected',
          type: 'checkbox',
          defaultValue: false,
          admin: { readOnly: true, description: 'Set by the OAuth callback.' },
        },
        {
          // Encrypted at rest — this token grants standing access to a person's
          // calendar, which is more than any BYOAI key in this system.
          name: 'refreshToken',
          type: 'text',
          access: { read: () => false },
          admin: { hidden: true },
        },
        {
          name: 'calendarId',
          type: 'text',
          defaultValue: 'primary',
          admin: { description: 'Which calendar to read/write. "primary" unless they keep work elsewhere.' },
        },
        {
          name: 'connectedAt',
          type: 'date',
          admin: { readOnly: true },
        },
      ],
    },
    // ─── Social Auth Providers (multi-provider linking) ──────
    {
      name: 'socialProviders',
      access: { read: adminOrSelfFieldAccess },
      type: 'array',
      admin: {
        description: 'Linked social login providers (Google, GitHub, etc.). Affects suitcase portability.',
        readOnly: true,
      },
      fields: [
        {
          name: 'provider',
          type: 'select',
          required: true,
          options: [
            { label: 'Google', value: 'google' },
            { label: 'GitHub', value: 'github' },
            { label: 'Apple', value: 'apple' },
            { label: 'Discord', value: 'discord' },
            { label: 'WhatsApp', value: 'whatsapp' },
            { label: 'Telegram', value: 'telegram' },
          ],
        },
        {
          name: 'providerId',
          type: 'text',
          required: true,
          admin: { description: 'Unique user ID from the provider' },
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'displayName',
          type: 'text',
        },
        {
          name: 'avatarUrl',
          type: 'text',
        },
        {
          name: 'linkedAt',
          type: 'date',
        },
      ],
    },
    {
      name: 'orders',
      access: { read: adminOrSelfFieldAccess },
      type: 'join',
      collection: 'orders',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'cart',
      access: { read: adminOrSelfFieldAccess },
      type: 'join',
      collection: 'carts',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id', 'createdAt', 'total', 'currency', 'items'],
      },
    },
    {
      name: 'addresses',
      access: { read: adminOrSelfFieldAccess },
      type: 'join',
      collection: 'addresses',
      on: 'customer',
      admin: {
        allowCreate: false,
        defaultColumns: ['id'],
      },
    },
    {
      // The /u/<handle> address. Backfilled from the name with numeric suffixing
      // on collision; editable, because a handle is how a person is addressed.
      name: 'handle',
      type: 'text',
      unique: true,
      index: true,
      admin: { description: 'Profile address - angelos.example/u/<handle>.' },
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: { description: 'A few lines about you, shown on your profile.' },
    },
    {
      // DEFAULT 'members'. Nobody becomes world-visible because of a deploy -
      // going public is a choice a person makes for themselves.
      name: 'profileVisibility',
      type: 'select',
      defaultValue: 'members',
      options: [
        { label: 'Private - only me', value: 'private' },
        { label: 'Members - anyone signed in', value: 'members' },
        { label: 'Public - anyone', value: 'public' },
      ],
      admin: { description: 'Who can see your profile page.' },
    },
    {
      // Badges earned. An ARRAY on the user, not a collection: it rides along
      // with /api/users/me exactly like readState, and a badge is MEANT to be
      // seen - that is the point of it. Append-only, and awardBadge checks
      // before inserting so nobody earns the same badge twice.
      //
      // Deliberately in APPROVED_PUBLIC in usersFieldExposure.test.ts.
      name: 'badges',
      type: 'array',
      admin: { description: 'Earned badges. Written by awardBadge when a Work reaches 100%.' },
      fields: [
        { name: 'work', type: 'text', required: true, admin: { description: 'Work slug.' } },
        { name: 'name', type: 'text' },
        { name: 'image', type: 'text' },
        { name: 'awardedAt', type: 'date' },
        { name: 'score', type: 'number', admin: { description: 'Last quiz score, if there was one.' } },
      ],
    },
    {
      // What you have already seen, per channel: { channelSlug: isoTimestamp }.
      // Drives unread badges and the "new since" divider. A map on the user
      // rather than a channel-reads collection — it rides along with
      // /api/users/me, so read state costs no extra request on page load.
      // Written only through POST /api/chat/mark-read, which merges
      // monotonically so two tabs cannot lose each other's progress.
      name: 'readState',
      access: { read: adminOrSelfFieldAccess },
      type: 'json',
      admin: {
        hidden: true,
        description: 'Per-channel last-read timestamps. Managed by /api/chat/mark-read.',
      },
    },
    {
      // Per-user dashboard widget preferences — collapsed/dismissed/order. Saved
      // server-side so they follow the user across devices + the Nimue client.
      name: 'dashboardPrefs',
      access: { read: adminOrSelfFieldAccess },
      type: 'json',
      admin: {
        description: 'Dashboard widget preferences: { collapsed: string[], dismissed: string[], order: string[] }',
      },
    },
  ],
}
