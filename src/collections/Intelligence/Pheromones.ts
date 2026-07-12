/**
 * Pheromones Collection — Sprint 29
 *
 * Digital scent trails for Angel OS's swarm intelligence layer.
 * Every successful LEO tool navigation creates or strengthens a pheromone.
 * Trails decay over time (exponential, ~21-day half-life) and weaken
 * when users bounce/abandon a path.
 *
 * The colony finds the shortest path to food without a central controller.
 *
 * Access pattern follows FederationAuditLog: system-created via
 * overrideAccess, admin-readable, never user-editable.
 *
 * @see src/utilities/pheromone-engine.ts — pure computation
 * @see src/endpoints/leo-stream.ts — recording integration
 */

import type { CollectionConfig } from 'payload'

export const Pheromones: CollectionConfig = {
  slug: 'pheromones',
  admin: {
    group: 'Intelligence',
    useAsTitle: 'path',
    defaultColumns: ['contextHash', 'path', 'toolName', 'strength', 'successfulTraversals', 'lastTraversedAt'],
    listSearchableFields: ['path', 'contextHash', 'toolName'],
    description: 'Digital pheromone trails — swarm intelligence for LEO navigation paths.',
  },
  access: {
    // Admin-only read (like FederationAuditLog)
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
    // System-only — engine uses overrideAccess: true
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  timestamps: true,

  fields: [
    // ── Context Key (the "scent signature") ─────────────────────────
    {
      name: 'contextHash',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Deterministic hash of user intent (e.g., "ph_a3f7c012"). Same intent → same hash.',
      },
    },
    {
      name: 'path',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'The UI route this pheromone leads to (e.g., "/dashboard/products").',
      },
    },
    {
      name: 'toolName',
      type: 'text',
      index: true,
      admin: {
        description: 'Which LEO tool triggered this trail (e.g., "create_product").',
      },
    },

    // ── Strength Metrics ─────────────────────────────────────────────
    {
      name: 'strength',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      max: 100,
      admin: {
        description: 'Pheromone intensity (0-100). Computed from traversals, age, and abandonments.',
      },
    },
    {
      name: 'successfulTraversals',
      type: 'number',
      defaultValue: 1,
      min: 0,
      admin: {
        description: 'How many times users successfully followed this trail.',
      },
    },
    {
      name: 'abandonments',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'How many times users bounced or back-navigated after following.',
      },
    },

    // ── Temporal ──────────────────────────────────────────────────────
    {
      name: 'lastTraversedAt',
      type: 'date',
      required: true,
      index: true,
      admin: {
        description: 'When someone last followed this trail.',
      },
    },
    {
      name: 'decay',
      type: 'date',
      index: true,
      admin: {
        description: 'TTL date — trails past this date are candidates for cleanup.',
      },
    },
  ],
}
