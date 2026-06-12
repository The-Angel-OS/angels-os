/**
 * Wallets — denormalized token balances (one row per account + tokenKind + tenant).
 *
 * The authoritative record is the hash-linked TokenLedger; a Wallet is a fast
 * cache of the current balance so we don't replay the whole log on every read.
 * Written only programmatically, in lock-step with ledger entries
 * (src/utilities/creditQuestPayout.ts). A periodic reconcile can recompute any
 * wallet from the ledger via computeBalance().
 *
 * @see src/utilities/tokenLedger.ts
 */
import type { CollectionConfig } from 'payload'

export const Wallets: CollectionConfig = {
  slug: 'wallets',
  admin: {
    group: 'Economy',
    useAsTitle: 'account',
    defaultColumns: ['account', 'tokenKind', 'balance', 'tenant', 'updatedAt'],
    description: 'Denormalized token balances (cache of the TokenLedger).',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      // Admins see all; a member sees their own wallet rows (account === 'user:<id>').
      if (roles.includes('super_admin') || roles.includes('admin')) return true
      return { account: { equals: `user:${(user as { id?: number | string }).id}` } }
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'account', type: 'text', required: true, index: true,
      admin: { description: "Namespaced account, e.g. 'user:123', 'float:tenant:5'." } },
    { name: 'tokenKind', type: 'select', required: true, index: true,
      options: [{ label: 'Angel Token', value: 'AT' }, { label: 'Karma Coin', value: 'KC' }, { label: 'Legacy Token', value: 'LT' }] },
    { name: 'balance', type: 'number', required: true, defaultValue: 0, admin: { description: 'Current balance, minor units.' } },
  ],
  timestamps: true,
}
