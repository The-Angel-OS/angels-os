import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { publicAccess } from '@/access/publicAccess'

/**
 * FederationPeers — a remote **Diocese** (Enterprise) in the Angel OS mesh.
 *
 * Per the Diocese model: the ENTERPRISE is the unit of federation, identity, and
 * trust/probation. A peer here is one remote Enterprise/Diocese. Its Endeavors
 * (parishes) are carried inline (`endeavors`) and inherit the Diocese's standing
 * — they are NOT independent trust units.
 *
 * Node-global (not tenant-scoped): this is the local node's view of the network
 * roster. Written by the federation handlers (bootstrap/heartbeat/ping/vouch) via
 * overrideAccess; readable for discovery.
 */
export const FederationPeers: CollectionConfig = {
  slug: 'federation-peers',
  admin: {
    group: 'Federation',
    useAsTitle: 'name',
    defaultColumns: ['name', 'domain', 'ministryStatus', 'trustLevel', 'lastHeartbeatAt'],
    listSearchableFields: ['name', 'domain', 'federationId', 'region.country', 'region.city'],
    description: 'Remote Enterprises (Dioceses) in the Angel OS federation mesh.',
  },
  access: {
    // The federation roster is a public, discoverable network.
    read: publicAccess,
    create: adminOnly, // federation handlers use overrideAccess
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    // ── Identity (immutable) ────────────────────────────────────────────────
    {
      name: 'federationId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Immutable federation identity (UUID) of the remote Diocese' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'domain', type: 'text', index: true },
    {
      name: 'publicKey',
      type: 'text',
      admin: { description: 'Ed25519 public key (hex SPKI DER) — verifies this peer’s signatures' },
    },
    // ── Trust / probation (Diocese-level) ───────────────────────────────────
    {
      name: 'ministryStatus',
      type: 'select',
      required: true,
      defaultValue: 'applicant',
      index: true,
      options: [
        { label: 'Applicant', value: 'applicant' },
        { label: 'Probation', value: 'probation' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Dormant', value: 'dormant' },
      ],
      admin: { description: 'Trust/probation status of the Diocese. Endeavors inherit this.' },
    },
    {
      name: 'trustLevel',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Probationary', value: 'probationary' },
        { label: 'Vouched', value: 'vouched' },
        { label: 'Full', value: 'full' },
      ],
      admin: { description: 'Derived trust level (cached for routing/queries).' },
    },
    {
      name: 'vouchesReceived',
      type: 'array',
      admin: { description: 'Vouches FOR this Diocese (full-trust peers vouch for probationers).' },
      fields: [
        { name: 'voucherId', type: 'text', required: true },
        { name: 'voucherName', type: 'text' },
        { name: 'vouchedAt', type: 'date' },
        { name: 'reason', type: 'text' },
        { name: 'isValid', type: 'checkbox', defaultValue: true },
      ],
    },
    { name: 'constitutionVersion', type: 'text' },
    { name: 'capabilities', type: 'json', admin: { description: 'string[] — what this Diocese can do' } },
    {
      name: 'region',
      type: 'group',
      fields: [
        { name: 'country', type: 'text' },
        { name: 'region', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
      ],
    },
    // ── Liveness / lifecycle ────────────────────────────────────────────────
    { name: 'networkVisible', type: 'checkbox', defaultValue: true, index: true },
    { name: 'firstSeenAt', type: 'date' },
    { name: 'probationStartedAt', type: 'date' },
    { name: 'activatedAt', type: 'date' },
    { name: 'lastHeartbeatAt', type: 'date', index: true, admin: { description: 'Last contact — drives health/freshness.' } },
    {
      name: 'consecutiveFailures',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Outbound heartbeat failures in a row (circuit-breaker input).' },
    },
    { name: 'capacitySnapshot', type: 'json', admin: { description: 'Latest CapacitySnapshot — for workload routing.' } },
    // ── Parishes (Endeavors) of this Diocese — inherit its trust ────────────
    {
      name: 'endeavors',
      type: 'json',
      admin: { description: 'The Diocese’s network-visible Endeavors (offerings). Inherit Diocese trust.' },
    },
  ],
  timestamps: true,
}
