/**
 * WorkUnits Collection — Sprint 30
 *
 * The atoms of distributed intelligence. Each work unit is a self-contained
 * packet of computation that can flow to any capable node in the federation
 * mesh. The Workload Engine scores candidates and routes units to the best
 * available worker — the wellness virus inspecting and upgrading the organism.
 *
 * Access pattern follows Pheromones/FederationAuditLog: system-created via
 * overrideAccess, admin-readable, never user-editable.
 *
 * @see src/utilities/workload-engine.ts — pure computation (scoring, routing, state machine)
 * @see src/utilities/pheromone-engine.ts — swarm learning from successful dispatches
 * @see src/utilities/federationEngine.ts — trust levels, heartbeat health
 */

import type { CollectionConfig } from 'payload'

export const WorkUnits: CollectionConfig = {
  slug: 'work-units',
  admin: {
    group: 'Intelligence',
    useAsTitle: 'workUnitId',
    defaultColumns: [
      'workUnitId',
      'type',
      'status',
      'priority',
      'assignedNode',
      'skillName',
      'createdAt',
    ],
    description:
      'Distributed work units — atoms of computation routed across the federation mesh.',
  },
  access: {
    // Admin-only read (like Pheromones, FederationAuditLog)
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
    // ── Identity ──────────────────────────────────────────────────────
    {
      name: 'workUnitId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Auto-generated ID: WU-YYYYMMDD-XXXX',
      },
    },

    // ── Classification ────────────────────────────────────────────────
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Computation', value: 'computation' },
        { label: 'Analysis', value: 'analysis' },
        { label: 'Generation', value: 'generation' },
        { label: 'Transformation', value: 'transformation' },
        { label: 'Aggregation', value: 'aggregation' },
      ],
      admin: {
        description: 'The kind of computational work being distributed.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Claimed', value: 'claimed' },
        { label: 'Executing', value: 'executing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Timeout', value: 'timeout' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description: 'Current state in the work unit lifecycle.',
      },
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'normal',
      options: [
        { label: 'Critical', value: 'critical' },
        { label: 'High', value: 'high' },
        { label: 'Normal', value: 'normal' },
        { label: 'Low', value: 'low' },
        { label: 'Background', value: 'background' },
      ],
      admin: {
        description: 'Priority level — critical work is never shed under backpressure.',
      },
    },

    // ── Input / Output ────────────────────────────────────────────────
    {
      name: 'inputData',
      type: 'json',
      required: true,
      admin: {
        description: 'The data payload to be processed by the worker.',
      },
    },
    {
      name: 'outputSchema',
      type: 'json',
      admin: {
        description: 'Expected shape of the output (optional validation hint).',
      },
    },
    {
      name: 'result',
      type: 'json',
      admin: {
        description: 'Execution output — populated on completion.',
        condition: (_data, siblingData) =>
          ['completed', 'failed'].includes(siblingData?.status || ''),
      },
    },

    // ── Requirements ──────────────────────────────────────────────────
    {
      name: 'requirements',
      type: 'group',
      admin: {
        description: 'Resource requirements for executing this work unit.',
      },
      fields: [
        {
          name: 'computeClass',
          type: 'select',
          required: true,
          defaultValue: 'standard',
          options: [
            { label: 'Lightweight', value: 'lightweight' },
            { label: 'Standard', value: 'standard' },
            { label: 'Heavy', value: 'heavy' },
          ],
        },
        {
          name: 'minTrustLevel',
          type: 'select',
          required: true,
          defaultValue: 'probationary',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Probationary', value: 'probationary' },
            { label: 'Vouched', value: 'vouched' },
            { label: 'Full', value: 'full' },
          ],
        },
        {
          name: 'requiredCapabilities',
          type: 'json',
          defaultValue: [],
          admin: {
            description: 'Array of capability strings the worker must support.',
          },
        },
        {
          name: 'estimatedDurationMs',
          type: 'number',
          min: 0,
          defaultValue: 30000,
          admin: {
            description: 'Expected execution time in milliseconds.',
          },
        },
        {
          name: 'maxDurationMs',
          type: 'number',
          min: 0,
          defaultValue: 120000,
          admin: {
            description: 'Hard timeout — work unit auto-fails if exceeded.',
          },
        },
      ],
    },

    // ── Retry Policy ──────────────────────────────────────────────────
    {
      name: 'retryPolicy',
      type: 'group',
      admin: {
        description: 'Retry configuration for failed work units.',
      },
      fields: [
        {
          name: 'maxRetries',
          type: 'number',
          min: 0,
          max: 5,
          defaultValue: 3,
        },
        {
          name: 'backoffMs',
          type: 'number',
          min: 0,
          defaultValue: 1000,
          admin: {
            description: 'Base backoff delay in milliseconds.',
          },
        },
        {
          name: 'backoffMultiplier',
          type: 'number',
          min: 1,
          defaultValue: 2,
          admin: {
            description: 'Exponential backoff multiplier.',
          },
        },
      ],
    },

    // ── Attempt Tracking ──────────────────────────────────────────────
    {
      name: 'attemptCount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: {
        description: 'Number of execution attempts (incremented on each retry).',
      },
    },
    {
      name: 'lastError',
      type: 'textarea',
      admin: {
        description: 'Error message from the last failed attempt.',
        condition: (_data, siblingData) =>
          ['failed', 'timeout'].includes(siblingData?.status || ''),
      },
    },

    // ── Assignment ────────────────────────────────────────────────────
    {
      name: 'assignedNode',
      type: 'text',
      index: true,
      admin: {
        description: 'Node ID of the worker processing this unit.',
      },
    },
    {
      name: 'claimedAt',
      type: 'date',
      admin: {
        description: 'When a worker claimed this unit.',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        description: 'When execution began.',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        description: 'When execution finished (success or failure).',
      },
    },
    {
      name: 'deadline',
      type: 'date',
      index: true,
      admin: {
        description: 'Absolute deadline — unit auto-times-out after this.',
      },
    },

    // ── Provenance ────────────────────────────────────────────────────
    {
      name: 'originNode',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Which federation node created this work unit.',
      },
    },
    {
      name: 'originTenant',
      type: 'number',
      admin: {
        description: 'Tenant ID that owns this work.',
      },
    },
    {
      name: 'skillName',
      type: 'text',
      index: true,
      admin: {
        description: 'Which skill/tool generated this work (for pheromone learning).',
      },
    },
    {
      name: 'parentWorkUnitId',
      type: 'text',
      index: true,
      admin: {
        description: 'Parent work unit ID for decomposed (fan-out) sub-tasks.',
      },
    },

    // ── Execution Metrics ─────────────────────────────────────────────
    {
      name: 'executionTimeMs',
      type: 'number',
      min: 0,
      admin: {
        description: 'Actual execution time in milliseconds.',
      },
    },
    {
      name: 'executedBy',
      type: 'text',
      admin: {
        description: 'Node ID that executed the work (may differ from assignedNode on retry).',
      },
    },

    // ── Crew Assignment (Sprint 40) ─────────────────────────────────
    {
      name: 'assignedCrewMember',
      type: 'relationship',
      relationTo: 'crew-assignments' as any,
      admin: {
        description:
          'Crew member assigned to this work unit (intra-ship routing). ' +
          'Set by the Crew Routing Engine after the Workload Engine picks the node.',
      },
    },
  ],
}
