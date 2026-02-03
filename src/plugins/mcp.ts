/**
 * Payload MCP Plugin configuration.
 * Exposes collections to MCP clients and adds leo_respond tool (ConversationEngine).
 *
 * @see https://github.com/payloadcms/payload/tree/main/packages/plugin-mcp
 */
import { z } from 'zod'

import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'

export const mcpPluginConfig = mcpPlugin({
  collections: {
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
    ],
  },
})
