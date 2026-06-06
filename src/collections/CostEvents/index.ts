import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * CostEvents — the unified Operating-Costs ledger.
 *
 * One row per metered cost/usage event, discriminated by `category` so every
 * cost source feeds ONE substrate that the control panel reads and LEO (the
 * CEO/Captain) monitors + adjusts within budget rules:
 *
 *   - intelligence  → AI tokens (LEO responses; recorded from leo-stream)
 *   - telephony     → LiveKit / VAPI realtime minutes (from webhooks)
 *   - storage       → Vercel Blob / per-tenant object storage (periodic probe)
 *   - infra         → platform/compute spend (e.g. the Vercel spend webhook)
 *   - other         → anything not yet categorized
 *
 * Tenant-scoped via the multi-tenant plugin (adds the `tenant` field). This is
 * the efficient aggregation successor to scanning Messages.metadata — but it is
 * ADDITIVE and writes are FAIL-SOFT (see recordCostEvent), so the code is safe
 * to deploy before the table exists on a given node's DB. The AI Costs panel
 * keeps reading Messages.metadata until the ledger is populated, then flips to
 * reading here.
 *
 * Append-only: created by the system (overrideAccess); never user-edited.
 */
export const CostEvents: CollectionConfig = {
  slug: 'cost-events',
  admin: {
    group: 'System',
    useAsTitle: 'source',
    defaultColumns: ['category', 'provider', 'costCents', 'occurredAt', 'tenant'],
    hidden: ({ user }) =>
      !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  access: {
    create: () => false, // system only (overrideAccess)
    read: ({ req: { user } }) => Boolean(user),
    update: () => false,
    delete: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
  },
  fields: [
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'intelligence',
      options: [
        { label: 'Intelligence (AI)', value: 'intelligence' },
        { label: 'Telephony / Realtime', value: 'telephony' },
        { label: 'Storage', value: 'storage' },
        { label: 'Infrastructure', value: 'infra' },
        { label: 'Other', value: 'other' },
      ],
      admin: { description: 'Which cost stream this event belongs to.' },
    },
    {
      name: 'source',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'What recorded it (e.g. leo-stream, livekit-webhook, vercel-spend, blob-probe).' },
    },
    {
      name: 'provider',
      type: 'text',
      index: true,
      admin: { description: 'Vendor/provider that served (anthropic, google, groq, ollama, livekit, vercel-blob, ...).' },
    },
    // ── Cost ──────────────────────────────────────────────────────────────
    {
      name: 'costCents',
      type: 'number',
      index: true,
      admin: { description: 'Cost in cents. 0 for free/local. Best-effort estimate unless from an authoritative bill.' },
    },
    {
      name: 'costEstimated',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'True when costCents is a list-price estimate (not an authoritative bill).' },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'usd',
    },
    {
      name: 'billedToTenantKey',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { description: 'True when served via the tenant\'s OWN provider key (BYOK) — $0 to the platform.' },
    },
    // ── Generic usage quantity (works for any category) ───────────────────
    {
      name: 'quantity',
      type: 'number',
      admin: { description: 'Generic usage amount in `unit` (tokens, seconds, bytes, requests).' },
    },
    {
      name: 'unit',
      type: 'select',
      options: [
        { label: 'Tokens', value: 'tokens' },
        { label: 'Seconds', value: 'seconds' },
        { label: 'Minutes', value: 'minutes' },
        { label: 'Bytes', value: 'bytes' },
        { label: 'Gigabytes', value: 'gb' },
        { label: 'Requests', value: 'requests' },
        { label: 'Count', value: 'count' },
      ],
    },
    // ── Intelligence-specific (optional; null for other categories) ───────
    { name: 'model', type: 'text', index: true, admin: { description: 'Model that actually served (intelligence).' } },
    { name: 'tier', type: 'text' },
    { name: 'inputTokens', type: 'number' },
    { name: 'outputTokens', type: 'number' },
    { name: 'totalTokens', type: 'number' },
    { name: 'latencyMs', type: 'number' },
    { name: 'ttftMs', type: 'number' },
    { name: 'finishReason', type: 'text' },
    { name: 'toolCallCount', type: 'number' },
    { name: 'failedOver', type: 'checkbox' },
    // ── Linkage / context ─────────────────────────────────────────────────
    {
      name: 'messageRef',
      type: 'relationship',
      relationTo: 'messages' as any,
      admin: { description: 'The message this cost was incurred for (intelligence).' },
    },
    { name: 'conversationId', type: 'text', index: true },
    { name: 'userId', type: 'text', index: true },
    {
      name: 'occurredAt',
      type: 'date',
      index: true,
      admin: { description: 'When the cost was incurred (defaults to creation time).' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Extensible per-source detail (provider response ids, raw usage, etc.).' },
    },
  ],
}
