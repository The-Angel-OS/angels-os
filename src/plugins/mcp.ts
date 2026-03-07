/**
 * Payload MCP Plugin configuration.
 * Exposes collections to MCP clients and adds leo_respond tool (ConversationEngine).
 *
 * @see https://github.com/payloadcms/payload/tree/main/packages/plugin-mcp
 */
import { z } from 'zod'

import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { executeToolCall } from '@/utilities/leo-data-tools'

export const mcpPluginConfig = mcpPlugin({
  /**
   * Allow browser-based (cookie/session) auth in addition to Bearer token auth.
   * The default MCP endpoint ONLY accepts API key Bearer tokens and throws
   * UnauthorizedError when none is provided. This override checks for a
   * session-authenticated user first, falling back to API key auth for
   * programmatic clients (e.g. Merlin / AngelClaw agents).
   */
  overrideAuth: async (req, getDefaultMcpAccessSettings) => {
    // 1. Check if user is already authenticated via session cookies
    if (req.user) {
      return {
        user: {
          ...req.user,
          collection: 'users',
          _strategy: 'session',
        },
        // Grant full collection CRUD for session-authenticated users
        collections: { find: true, create: true, update: true, delete: true },
        globals: { find: true, update: true },
        // Grant access to custom tools (leo_respond)
        'payload-mcp-tool': { leoRespond: true },
      } as any
    }

    // 2. Fall back to API key auth for programmatic clients
    return await getDefaultMcpAccessSettings()
  },
  collections: {
    'application-logs': {
      enabled: { find: true, create: false, update: false, delete: false },
      description: 'Application error/warning/info logs (read-only for diagnostics)',
    } as any,
    posts: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Blog posts and articles',
    },
    products: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'E-commerce products',
    },
    pages: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Site pages',
    },
    tenants: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Multi-tenant organizations (super_admin only)',
    },
    categories: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Content categories',
    },
    media: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Media uploads',
    },
    bookings: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Booking appointments and sessions',
    },
    availability: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Provider availability slots',
    },
    workflows: {
      enabled: { find: true, create: true, update: true, delete: true },
      description: 'Channel workflows (inventory, PDF, video processing)',
    },
  },
  mcp: {
    tools: [
      {
        name: 'leo_respond',
        description:
          'Send a message to LEO (Angel OS conversational AI). Use for chat, navigation, content queries, or assistance. LEO can list posts, products, and help with tenant operations.',
        parameters: z.object({
          message: z.string().describe('The user message to send to LEO'),
          conversationId: z
            .string()
            .optional()
            .describe('Optional conversation ID for continuity'),
        }).shape as any,
        handler: async (args, req) => {
          const { message, conversationId } = args
          if (!message || typeof message !== 'string') {
            return {
              content: [{ type: 'text' as const, text: 'Error: message is required' }],
            }
          }
          
          // Resolve tenant from x-tenant-id header
          const tenantSlug = req.headers.get('x-tenant-id')
          let tenantId: number | undefined
          if (tenantSlug) {
            const tenants = await req.payload.find({
              collection: 'tenants',
              where: { slug: { equals: tenantSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            tenantId = tenants.docs?.[0]?.id
          }
          
          const result = await leoProcessMessage({
            message,
            conversationId: typeof conversationId === 'string' ? conversationId : undefined,
            tenantId,
            payload: req.payload,
          })
          
          return {
            content: [
              {
                type: 'text' as const,
                text: `[${result.agentName}] ${result.text}`,
              },
            ],
          }
        },
      },
      {
        name: 'run_subsafe',
        description:
          'Run SUBSAFE diagnostic on this Angel OS instance. Checks errors, connectors, enterprise health, federation pulse, database integrity, and constitutional compliance.',
        parameters: z.object({
          areas: z
            .array(z.string())
            .optional()
            .describe('Specific areas to check (errors, connectors, enterprise, federation, database, constitution). Omit for all.'),
        }).shape as any,
        handler: async (args, req) => {
          const tenantSlug = req.headers.get('x-tenant-id')
          let tenantId: number | undefined
          if (tenantSlug) {
            const tenants = await req.payload.find({
              collection: 'tenants',
              where: { slug: { equals: tenantSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            tenantId = tenants.docs?.[0]?.id
          }

          const result = await executeToolCall(
            'run_subsafe_check',
            { areas: args.areas },
            { payload: req.payload, tenantId },
          )
          return { content: [{ type: 'text' as const, text: result }] }
        },
      },
      {
        name: 'query_errors',
        description: 'Query recent application error/warning logs for diagnostics.',
        parameters: z.object({
          level: z.enum(['error', 'warning', 'info']).optional(),
          since: z.string().optional().describe('ISO timestamp — logs after this time'),
          limit: z.number().optional().describe('Max results (default 20)'),
        }).shape as any,
        handler: async (args, req) => {
          const tenantSlug = req.headers.get('x-tenant-id')
          let tenantId: number | undefined
          if (tenantSlug) {
            const tenants = await req.payload.find({
              collection: 'tenants',
              where: { slug: { equals: tenantSlug } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            tenantId = tenants.docs?.[0]?.id
          }

          const result = await executeToolCall(
            'query_application_logs',
            { level: args.level, since: args.since, limit: args.limit },
            { payload: req.payload, tenantId },
          )
          return { content: [{ type: 'text' as const, text: result }] }
        },
      },
    ],
  },
})
