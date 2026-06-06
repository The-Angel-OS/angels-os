/**
 * leoMcpTools — generate the MCP custom-tool surface FROM LEO's tool registry.
 *
 * The whole point: "LEO's MCP exposes the same tools as LEO anywhere else."
 * Instead of hand-listing a handful of wrappers in the MCP plugin (which drifts
 * the moment a new LEO tool ships), we map EVERY entry in LEO_TOOLS → an MCP tool
 * whose handler is the same `executeToolCall` dispatcher LEO uses internally.
 * Add a tool to LEO_TOOLS and it is reachable over MCP automatically.
 *
 * Two surfaces, one backend:
 *   - leo_respond (defined in the plugin) — the conversational super-tool.
 *   - <every LEO tool> (generated here)   — the typed machine fast-path.
 * Both flow through the identity-aware dispatcher, so access control is uniform.
 *
 * IDENTITY & ACCESS. The plugin registers a custom tool only when
 * `mcpAccessSettings['payload-mcp-tool'][toCamelCase(name)] === true`, and it
 * evaluates `overrideAuth` per request. So we build that map from
 * `selectToolsForUser(roles)` in overrideAuth (see plugins/mcp.ts): a non-admin
 * caller's MCP never even sees the admin tools. The per-call guard in each
 * handler is defense-in-depth in case the two ever drift.
 *
 * toMcpToolKey mirrors the plugin's own toCamelCase (handles - _ and spaces) so
 * our access-map keys line up with what the plugin looks up.
 */
import { z, type ZodRawShape, type ZodTypeAny } from 'zod'
import type { PayloadRequest } from 'payload'
import { LEO_TOOLS, executeToolCall, type ToolExecutorContext } from './leo-data-tools'
import { selectToolsForUser } from './leoToolSelection'

/** Mirror of @payloadcms/plugin-mcp utils/camelCase.toCamelCase (dashes/underscores/spaces). */
export const toMcpToolKey = (str: string): string =>
  str
    .replace(/[-_\s]+(.)?/g, (_m, chr: string | undefined) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (_m, chr: string) => chr.toLowerCase())

// ---------------------------------------------------------------------------
// JSON Schema (LEO tool input_schema) → Zod raw shape (what the plugin wants).
// Deliberately permissive: executeToolCall handlers do their own validation, so
// we never want the MCP layer to reject an otherwise-valid LLM/agent payload.
// ---------------------------------------------------------------------------

interface JsonSchemaProp {
  type?: string
  description?: string
  enum?: unknown[]
  items?: JsonSchemaProp
}

function propToZod(prop: JsonSchemaProp | undefined): ZodTypeAny {
  if (!prop || typeof prop !== 'object') return z.unknown()

  let base: ZodTypeAny
  if (Array.isArray(prop.enum) && prop.enum.length > 0 && prop.enum.every((v) => typeof v === 'string')) {
    base = z.enum(prop.enum as [string, ...string[]])
  } else {
    switch (prop.type) {
      case 'string':
        base = z.string()
        break
      case 'number':
      case 'integer':
        base = z.number()
        break
      case 'boolean':
        base = z.boolean()
        break
      case 'array':
        base = z.array(prop.items ? propToZod(prop.items) : z.unknown())
        break
      case 'object':
        base = z.record(z.string(), z.unknown())
        break
      default:
        base = z.unknown()
    }
  }
  if (typeof prop.description === 'string' && prop.description) {
    base = base.describe(prop.description)
  }
  return base
}

export function jsonSchemaToZodShape(schema: {
  properties?: Record<string, JsonSchemaProp>
  required?: string[]
}): ZodRawShape {
  // Mutable record while building; ZodRawShape is Readonly in zod v4.
  const shape: Record<string, ZodTypeAny> = {}
  const props = schema?.properties || {}
  const required = new Set(schema?.required || [])
  for (const [key, prop] of Object.entries(props)) {
    let field = propToZod(prop)
    if (!required.has(key)) field = field.optional()
    shape[key] = field
  }
  return shape as ZodRawShape
}

// ---------------------------------------------------------------------------
// Identity resolution + access map
// ---------------------------------------------------------------------------

/**
 * Build the per-caller `'payload-mcp-tool'` access map from their roles, using
 * the SAME subsetting LEO uses when deciding which tools to show the model.
 * Returns { [camelCaseToolName]: true } for every tool the caller may run.
 *
 * Empty/unknown roles → treated as a non-privileged "mcp_anonymous" caller so we
 * never hand admin tools to an unidentified client (selectToolsForUser otherwise
 * treats empty roles as privileged — correct for the chat path, unsafe here).
 */
export function leoMcpToolAccessMap(roles?: string[]): Record<string, true> {
  const effectiveRoles = roles && roles.length > 0 ? roles : ['mcp_anonymous']
  const allowed = selectToolsForUser(
    LEO_TOOLS.map((t) => ({ name: t.name })),
    effectiveRoles,
  )
  const map: Record<string, true> = {}
  for (const t of allowed) map[toMcpToolKey(t.name)] = true
  return map
}

async function resolveCtx(req: PayloadRequest): Promise<{ ctx: ToolExecutorContext; roles?: string[] }> {
  const tenantSlug = req.headers?.get?.('x-tenant-id') ?? undefined
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
  const user = req.user as { id?: number; roles?: string[] } | null | undefined
  return {
    ctx: { payload: req.payload, tenantId, userId: user?.id },
    roles: user?.roles,
  }
}

// ---------------------------------------------------------------------------
// Generated MCP tools
// ---------------------------------------------------------------------------

export interface LeoMcpTool {
  name: string
  description: string
  parameters: ZodRawShape
  handler: (
    args: Record<string, unknown>,
    req: PayloadRequest,
    _extra: unknown,
  ) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
}

/**
 * One MCP tool per LEO tool, handler = executeToolCall (the same dispatcher LEO
 * uses). Identity is resolved per call; a per-call role guard backs up the
 * registration-time filtering done in overrideAuth.
 */
export function buildLeoMcpTools(): LeoMcpTool[] {
  return LEO_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description || tool.name,
    parameters: jsonSchemaToZodShape(tool.input_schema as never),
    handler: async (args, req) => {
      const { ctx, roles } = await resolveCtx(req)
      if (!leoMcpToolAccessMap(roles)[toMcpToolKey(tool.name)]) {
        return {
          content: [{ type: 'text' as const, text: `Error: "${tool.name}" requires elevated privileges.` }],
        }
      }
      const result = await executeToolCall(tool.name, args ?? {}, ctx)
      return { content: [{ type: 'text' as const, text: result }] }
    },
  }))
}
