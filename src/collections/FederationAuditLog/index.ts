/**
 * Federation Audit Log Collection
 *
 * Immutable behavioral audit trail for all federation actions.
 * Every inbound and outbound federation request is logged here
 * with full context: who, what, when, allowed/denied, why.
 *
 * This is the behavioral monitoring layer. Patterns like
 * "100 skill invocations in 2 minutes" or "payment attempts
 * from a probationary Enterprise" become visible and queryable.
 *
 * Constitutional Reference: Article II (Anti-Demonic Safeguards) —
 * "All actions observable." This collection makes that real.
 *
 * Article III (Agent Conduct) — "Angels do not hide their activity."
 * The audit log is the structural enforcement of transparency.
 */

import type { CollectionConfig } from 'payload'

export const FederationAuditLog: CollectionConfig = {
  slug: 'federation-audit-log',
  admin: {
    group: 'Federation',
    useAsTitle: 'action',
    defaultColumns: ['action', 'sourceFederationId', 'allowed', 'createdAt'],
    listSearchableFields: ['sourceFederationId', 'sourceDomain', 'sourceName', 'targetAction', 'deniedReason'],
    description: 'Immutable audit trail of all federation network activity.',
  },
  access: {
    // Only super admins can read the audit log
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
    // Programmatic creation only — never updated or deleted
    create: () => false,
    update: () => false,
    delete: () => false,
  },

  fields: [
    // ── Action Classification ──────────────────────────────────────
    {
      name: 'action',
      type: 'select',
      index: true,
      required: true,
      options: [
        { label: 'Discovery', value: 'discovery' },
        { label: 'Heartbeat', value: 'heartbeat' },
        { label: 'Catalog Browse', value: 'catalog_browse' },
        { label: 'Skill Invoke', value: 'skill_invoke' },
        { label: 'Payment', value: 'payment' },
        { label: 'Vouch', value: 'vouch' },
        { label: 'Skill List', value: 'skill_list' },
      ],
      admin: {
        description: 'The type of federation action performed',
      },
    },
    {
      name: 'direction',
      type: 'select',
      required: true,
      options: [
        { label: 'Inbound', value: 'inbound' },
        { label: 'Outbound', value: 'outbound' },
      ],
      admin: {
        description: 'Whether we received (inbound) or initiated (outbound) this action',
      },
    },

    // ── Source Identity ─────────────────────────────────────────────
    {
      name: 'sourceFederationId',
      type: 'text',
      index: true,
      required: true,
      admin: {
        description: 'Federation UUID of the Enterprise that initiated this action',
      },
    },
    {
      name: 'sourceDomain',
      type: 'text',
      admin: {
        description: 'Domain of the source Enterprise (if known)',
      },
    },
    {
      name: 'sourceName',
      type: 'text',
      admin: {
        description: 'Name of the source Enterprise (if known)',
      },
    },

    // ── Target ──────────────────────────────────────────────────────
    {
      name: 'targetAction',
      type: 'text',
      admin: {
        description: 'What specific resource/action was requested (e.g., skill name, catalog query)',
      },
    },

    // ── Trust Context ───────────────────────────────────────────────
    {
      name: 'trustLevel',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Probationary', value: 'probationary' },
        { label: 'Vouched', value: 'vouched' },
        { label: 'Full', value: 'full' },
      ],
      admin: {
        description: 'Trust level of the source Enterprise at the time of the request',
      },
    },

    // ── Decision ────────────────────────────────────────────────────
    {
      name: 'allowed',
      type: 'checkbox',
      required: true,
      admin: {
        description: 'Whether the action was permitted',
      },
    },
    {
      name: 'deniedReason',
      type: 'text',
      admin: {
        description: 'If blocked, why (rate limit, trust level, signature invalid, etc.)',
        condition: (_, siblingData) => siblingData?.allowed === false,
      },
    },

    // ── Performance ─────────────────────────────────────────────────
    {
      name: 'responseTimeMs',
      type: 'number',
      admin: {
        description: 'How long the request took to process (milliseconds)',
      },
    },

    // ── Metadata ────────────────────────────────────────────────────
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional context (request size, response status, skill params, etc.)',
      },
    },
  ],

  // Index for efficient querying
  timestamps: true,
}
