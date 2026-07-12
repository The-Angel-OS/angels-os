/**
 * TokenLedger — the persisted, hash-linked, append-only token ledger.
 *
 * Each entry is built by src/utilities/tokenLedger.ts (hash links to the previous
 * entry; balance is a deterministic replay). This collection just stores them.
 * Append-only: programmatic create, never update/delete — tamper-evidence comes
 * from the hash chain, and editing history would break it.
 *
 * Per-tenant chain: seq + prevHash run within a tenant (the Diocese is its own
 * bank, its own chain). Cross-Diocese clearing via the Justice Fund is a later slice.
 *
 * @see src/utilities/tokenLedger.ts  @see src/utilities/creditQuestPayout.ts
 */
import type { CollectionConfig } from 'payload'

export const TokenLedger: CollectionConfig = {
  slug: 'token-ledger',
  admin: {
    group: 'Economy',
    useAsTitle: 'hash',
    defaultColumns: ['account', 'tokenKind', 'direction', 'amount', 'balanceAfter', 'createdAt'],
    listSearchableFields: ['account', 'reason', 'ref', 'hash'],
    description: 'Hash-linked, append-only token ledger (Angel Tokens, Karma Coins, Legacy Tokens).',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
    create: () => false, // programmatic only (via creditQuestPayout etc.)
    update: () => false, // append-only — never mutate a posted entry
    delete: () => false,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'account', type: 'text', required: true, index: true,
      admin: { description: "Namespaced account, e.g. 'user:123', 'float:tenant:5', 'reserve:justice-fund'." } },
    { name: 'tokenKind', type: 'select', required: true, index: true,
      options: [{ label: 'Angel Token', value: 'AT' }, { label: 'Karma Coin', value: 'KC' }, { label: 'Legacy Token', value: 'LT' }] },
    { name: 'direction', type: 'select', required: true,
      options: [{ label: 'Credit', value: 'credit' }, { label: 'Debit', value: 'debit' }] },
    { name: 'amount', type: 'number', required: true, admin: { description: 'Positive integer, minor units (cents-equivalent).' } },
    { name: 'reason', type: 'text', required: true },
    { name: 'ref', type: 'text', index: true, admin: { description: "Source, e.g. 'questParticipation:42'." } },
    { name: 'seq', type: 'number', required: true, index: true, admin: { description: 'Per-tenant chain sequence.' } },
    { name: 'balanceAfter', type: 'number', required: true },
    { name: 'prevHash', type: 'text', required: true },
    { name: 'hash', type: 'text', required: true, unique: true, index: true },
    { name: 'at', type: 'text', required: true, admin: { description: 'ISO timestamp used in the hash (authoritative over createdAt).' } },
  ],
  timestamps: true,
}
