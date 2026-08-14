/**
 * Payload MCP Plugin configuration.
 * Exposes collections to MCP clients and adds leo_respond tool (ConversationEngine).
 *
 * @see https://github.com/payloadcms/payload/tree/main/packages/plugin-mcp
 */
import { z } from 'zod'
import type { Config } from 'payload'

import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { buildLeoMcpTools, leoMcpToolAccessMap, toMcpToolKey, type LeoMcpTool } from '@/utilities/leoMcpTools'

/**
 * The conversational super-tool. Kept hand-written (it routes to the full
 * ConversationEngine, not a single LEO tool) and composed with the generated
 * machine tools below.
 */
const leoRespondTool: LeoMcpTool = {
  name: 'leo_respond',
  description:
    'Send a message to LEO (Angel OS conversational AI). Use for chat, navigation, content queries, or assistance. LEO can list posts, products, and help with tenant operations.',
  parameters: z.object({
    message: z.string().describe('The user message to send to LEO'),
    conversationId: z.string().optional().describe('Optional conversation ID for continuity'),
  }).shape as never,
  handler: async (args, req) => {
    const message = args.message
    const conversationId = args.conversationId
    if (!message || typeof message !== 'string') {
      return { content: [{ type: 'text' as const, text: 'Error: message is required' }] }
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
      tenantId = tenants.docs?.[0]?.id as number | undefined
    }
    const result = await leoProcessMessage({
      message,
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      tenantId,
      payload: req.payload,
    })
    return { content: [{ type: 'text' as const, text: `[${result.agentName}] ${result.text}` }] }
  },
}

/**
 * Lazily build + memoize the full custom-tool surface (leo_respond + every LEO
 * tool). Deferred behind a getter so generation runs at plugin-application /
 * request time — NOT during this module's evaluation. That matters: building
 * eagerly here would read LEO_TOOLS while leo-data-tools ↔ payload.config are
 * still mid-cycle, throwing a temporal-dead-zone error on boot.
 */
let _mcpToolsMemo: LeoMcpTool[] | null = null
const getMcpTools = (): LeoMcpTool[] => (_mcpToolsMemo ??= [leoRespondTool, ...buildLeoMcpTools()])

const basePlugin = mcpPlugin({
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
      const roles = (req.user as { roles?: string[] }).roles
      return {
        user: {
          ...req.user,
          collection: 'users',
          _strategy: 'session',
        },
        // Grant full collection CRUD for session-authenticated users
        collections: { find: true, create: true, update: true, delete: true },
        globals: { find: true, update: true },
        // Custom tools: the conversational super-tool + every LEO tool this
        // user's roles permit (admin tools hidden from non-admins). The plugin
        // only registers a custom tool when its camelCased key is true here, so
        // the per-caller tool LIST is identity-scoped at registration time.
        'payload-mcp-tool': { leoRespond: true, ...leoMcpToolAccessMap(roles) },
      } as any
    }

    // 2. Fall back to API key auth for programmatic clients (e.g. peer nodes).
    //    Merge in the same role-scoped tool access so API-key agents reach the
    //    same surface a session user would.
    const settings = (await getDefaultMcpAccessSettings()) as Record<string, unknown>
    const apiRoles = (settings.user as { roles?: string[] } | undefined)?.roles
    return {
      ...settings,
      // The key's own list narrows what its owner's roles allow — that is the
      // whole remaining job of stored tool access. See mcpPluginConfig below.
      'payload-mcp-tool': intersectAllowedTools(
        { leoRespond: true, ...leoMcpToolAccessMap(apiRoles) },
        (settings as Record<string, unknown>).allowedTools,
      ),
    } as any
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
    // leo_respond (conversational) + one MCP tool per LEO tool (typed machine
    // fast-path), generated from LEO_TOOLS so this surface NEVER drifts from
    // LEO's own capabilities. Behind a getter so it's built lazily — see
    // getMcpTools above. (run_subsafe / query_errors used to be hand-wired here;
    // they auto-generate now as run_subsafe_check / query_application_logs,
    // gated by the caller's roles.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ZodRawShape
    // differs structurally across the project's zod (v4) and the plugin's typing;
    // runtime-compatible, so we cast at this single boundary (as the prior code did).
    get tools(): any {
      return getMcpTools()
    },
  },
})

/**
 * ── The durable fix for MCP schema drift ────────────────────────────────────
 *
 * The plugin renders ONE CHECKBOX PER TOOL on the API-key doc, and this project
 * generates its tool list from LEO_TOOLS. On Postgres that is one BOOLEAN COLUMN
 * per LEO tool: 170 of them by 260813, none of which existed in prod, which is
 * what made `payload migrate:create` unanswerable. Every new LEO tool would have
 * been another column — a schema migration for adding a function.
 *
 * So the generated group is replaced with a single `allowedTools` list: rows in
 * one small table instead of columns in a wide one. Adding a LEO tool is now a
 * code change and nothing else.
 *
 * Two things make this cheap rather than a fork:
 *
 *  1. The plugin reads tool access out of `mcpAccessSettings['payload-mcp-tool']`
 *     at REQUEST time, and `overrideAuth` above already computes that map from
 *     the caller's roles — for both the session and API-key paths. The stored
 *     checkboxes were never the source of truth; they were a second, staler copy
 *     of an answer the role map already gives.
 *  2. Which leaves `allowedTools` doing the one job roles cannot: minting a key
 *     that is narrower than its owner. Empty means "whatever your roles allow"
 *     (the previous behaviour, since every checkbox defaulted to true). Non-empty
 *     INTERSECTS with the role map — it can only ever take access away.
 *
 * Validation lives in code (`validate` below), not in a Postgres enum, precisely
 * so that a new tool name never needs an ALTER TYPE.
 */
const TOOL_LIST_FIELD = 'allowedTools'

export const mcpPluginConfig: typeof basePlugin = (incoming) => {
  // basePlugin is typed as possibly-async; this one is synchronous in practice
  // and the config must be mutated before it is returned either way.
  const config = basePlugin(incoming) as Config
  const keys = config.collections?.find((c) => c.slug === 'payload-mcp-api-keys')
  if (!keys) return config

  /** Drop the plugin's per-tool checkbox group wherever it nests it. */
  const strip = (fields: unknown[]): unknown[] =>
    fields
      .filter((f) => (f as { name?: string })?.name !== 'payload-mcp-tool')
      .map((f) => {
        const field = f as { fields?: unknown[] }
        return Array.isArray(field.fields) ? { ...field, fields: strip(field.fields) } : f
      })

  keys.fields = strip(keys.fields) as typeof keys.fields
  keys.fields.push({
    name: TOOL_LIST_FIELD,
    type: 'text',
    hasMany: true,
    admin: {
      position: 'sidebar',
      description:
        'Tool names this key may use, e.g. query_products. Leave EMPTY for everything the key owner’s roles already allow — a list can only narrow that, never widen it.',
    },
    validate: (value: unknown) => {
      const names = new Set(getMcpTools().map((t) => t.name))
      const bad = (Array.isArray(value) ? value : []).filter((v) => typeof v === 'string' && !names.has(v))
      return bad.length ? `Not a tool: ${bad.join(', ')}. Check the name against LEO_TOOLS.` : true
    },
  } as never)

  return config
}

/**
 * Narrow a computed role map by a key's stored list. Empty list = no narrowing,
 * which is what every existing key expects.
 */
export const intersectAllowedTools = (
  roleMap: Record<string, true>,
  allowed?: unknown,
): Record<string, true> => {
  const list = (Array.isArray(allowed) ? allowed : []).filter((v): v is string => typeof v === 'string')
  if (list.length === 0) return roleMap
  const keep = new Set(list.map(toMcpToolKey))
  return Object.fromEntries(Object.entries(roleMap).filter(([k]) => keep.has(k))) as Record<string, true>
}
