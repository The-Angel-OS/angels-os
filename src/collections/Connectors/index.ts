import type { CollectionConfig } from 'payload'

import { connectorScopedAccess, connectorCreateAccess } from '@/access/connectorAccess'

/**
 * Connectors — Endeavor-level integration configuration.
 *
 * Each connector represents a configured integration (email inbound, Cloudflare Worker,
 * Stripe, WhatsApp, etc.) that routes messages/events to a specific channel.
 *
 * Configuration hierarchy:
 *   1. Space-level connector (type + space + tenant) — most specific
 *   2. Endeavor-level connector (type + tenant, space=null) — default
 *   3. Environment variables — backwards compatibility fallback
 *
 * Supports multiple instances of the same type per tenant (e.g., support@ and sales@
 * email connectors), each routing to its own channel.
 */
export const Connectors: CollectionConfig = {
  slug: 'connectors',
  admin: {
    group: 'Configuration',
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'status', 'tenant', 'space'],
    listSearchableFields: ['name', 'errorMessage'],
    hidden: ({ user }) =>
      !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  // Endeavor owners self-serve their own tenant's integrations (tenant_admin /
  // tenant_manager); super_admin manages all. See @/access/connectorAccess.
  access: {
    create: connectorCreateAccess,
    read: connectorScopedAccess,
    update: connectorScopedAccess,
    delete: connectorScopedAccess,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable name (e.g., "Support Email", "Sales WhatsApp")',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Email Inbound (IMAP)', value: 'email_inbound' },
        { label: 'Email Outbound (SMTP/Resend)', value: 'email_outbound' },
        { label: 'Cloudflare Worker', value: 'cloudflare_worker' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Google Chat', value: 'google_chat' },
        { label: 'SMS', value: 'sms' },
        { label: 'Webhook', value: 'webhook' },
        { label: 'LiveKit', value: 'livekit' },
        { label: 'Discord', value: 'discord' },
        { label: 'Telegram', value: 'telegram' },
        { label: 'Slack', value: 'slack' },
        { label: 'YouTube Channel', value: 'youtube_channel' },
        { label: 'LinkedIn Page', value: 'linkedin_page' },
        { label: 'Gotify', value: 'gotify' },
        { label: 'X (Twitter)', value: 'x_twitter' },
      ],
      admin: {
        description: 'Integration type. Multiple connectors of the same type are allowed.',
      },
    },
    // NOTE: `tenant` field is auto-injected by @payloadcms/plugin-multi-tenant.
    // Do NOT define it here — Payload will throw DuplicateFieldName.
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      index: true,
      admin: {
        description:
          'Optional Space override. When set, this connector applies only to this Space. When blank, it applies Endeavor-wide.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Toggle connector on/off without deleting configuration',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Ordering priority (higher = preferred). Used when multiple connectors match.',
      },
    },
    // ─── Type-specific configuration ───────────────────────────
    {
      name: 'config',
      type: 'json',
      admin: {
        description: `Type-specific JSON config. Examples:
• email_inbound: { "imapHost": "imap.ionos.com", "imapPort": 993, "emailAddress": "hello@...", "pollIntervalMinutes": 2 }
• cloudflare_worker: { "workerName": "angel-os-image-gen", "workerUrl": "https://...", "kvNamespace": "TENANT_CACHE" }
• stripe: { "accountId": "acct_xxx", "mode": "direct" }
• webhook: { "url": "https://...", "secret": "whsec_xxx", "events": ["order.created"] }
• discord: { "botToken": "MTI...", "applicationId": "123...", "guildIds": ["987..."], "leoChannelName": "leo", "webhookSecret": "..." }
• telegram: { "botToken": "123:ABC...", "webhookSecret": "..." }
• youtube_channel: { "channelId": "UCxxxx", "limit": 10, "status": "published", "categories": ["Ministry"] }
• linkedin_page: { "organizationId": "123456", "accessToken": "AQV...", "limit": 10, "status": "published", "categories": ["Updates"] }
• gotify: { "serverUrl": "https://gotify.kendev.co", "appToken": "A…" (send), "clientToken": "C…" (receive), "lastSeenMessageId": 0, "escalation": { "enabled": true, "rateLimitPerMin": 10, "cooldownSeconds": 300, "events": { "error": { "enabled": true, "minPriority": 8 } } } }
• x_twitter: { "clientId": "...", "clientSecret": "...", "accessToken": "...", "refreshToken": "...", "expiresAt": "ISO-8601", "handle": "@Sl4rt1b4rtf45t", "userId": "123...", "scopes": ["tweet.read", "tweet.write", "users.read", "offline.access"] }`,
      },
    },
    // ─── Routing ───────────────────────────────────────────────
    {
      name: 'routingChannel',
      type: 'relationship',
      relationTo: 'channels',
      admin: {
        description:
          'Channel that receives messages from this connector. Each connector routes to ONE channel.',
      },
    },
    {
      name: 'systemUser',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Bot/system user for this connector (e.g., LEO agent user)',
      },
    },
    // ─── Status & Monitoring ──────────────────────────────────
    {
      name: 'status',
      type: 'select',
      index: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Error', value: 'error' },
        { label: 'Provisioning', value: 'provisioning' },
      ],
    },
    {
      name: 'lastActivity',
      type: 'date',
      admin: {
        description: 'Last time this connector processed an event',
        readOnly: true,
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: {
        description: 'Last error message (cleared on successful activity)',
        readOnly: true,
      },
    },
  ],
}
