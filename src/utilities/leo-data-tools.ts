/**
 * LEO Data Tools — P2.5
 *
 * Defines the tools LEO can use to query Payload collections.
 * Uses Claude's tool_use feature so LEO can decide when to fetch data.
 *
 * Architecture:
 *   - Tool definitions → sent to Claude API as `tools` parameter
 *   - Tool executor   → runs the Payload query when Claude requests a tool call
 *   - All queries use overrideAccess: true for public data, false for private data
 *
 * Note: We use `any` casts for Payload Where clauses and doc mappings because
 * the tool handlers build queries dynamically from LLM-provided inputs. The
 * Payload Where type system doesn't support runtime-constructed filter arrays
 * without explicit collection-specific generics.
 *
 * @see ConversationEngine.ts — integrates these tools into generateResponse()
 */

import type { Payload, Where } from 'payload'
import type Anthropic from '@anthropic-ai/sdk'

// ---------------------------------------------------------------------------
// Tool Definitions (sent to Claude API)
// ---------------------------------------------------------------------------

export const LEO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'query_products',
    description:
      'Search the product catalog. Returns products with title, price, description, and inventory status. Use when users ask about products, shop items, pricing, or inventory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Optional text to search product titles/descriptions',
        },
        category: {
          type: 'string',
          description: 'Optional category to filter by',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_posts',
    description:
      'Search blog posts and content. Returns posts with title, excerpt, published date, and categories. Use when users ask about articles, news, content, or blog posts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Optional text to search post titles',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_bookings',
    description:
      'Look up bookings and appointments. Returns booking details including status, date/time, and type. Use when users ask about appointments, scheduling, or booking status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
          description: 'Filter by booking status',
        },
        upcoming: {
          type: 'boolean',
          description: 'If true, only return future bookings',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_spaces',
    description:
      'List available spaces (communities/workspaces) and their channels. Use when users ask about available spaces, channels, or navigation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        includeChannels: {
          type: 'boolean',
          description: 'If true, include channels for each space',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_projects',
    description:
      'Search projects in the portfolio. Returns project details including type, status, timeline, and budget. Use when users ask about projects, portfolio, or work history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['planning', 'in-progress', 'completed', 'on-hold', 'cancelled'],
          description: 'Filter by project status',
        },
        search: {
          type: 'string',
          description: 'Optional text to search project titles',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 5, max 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'query_availability',
    description:
      'Check provider availability and open time slots. Use when users ask about scheduling, available times, or booking windows.',
    input_schema: {
      type: 'object' as const,
      properties: {
        providerId: {
          type: 'number',
          description: 'Optional provider user ID to check specific provider',
        },
      },
      required: [],
    },
  },
]

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

export type ToolExecutorContext = {
  payload: Payload
  tenantId?: number
  spaceId?: number
}

/**
 * Executes a tool call from Claude and returns the result as a string.
 */
export async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolExecutorContext,
): Promise<string> {
  const { payload, tenantId } = ctx

  try {
    switch (toolName) {
      case 'query_products':
        return await queryProducts(payload, toolInput)
      case 'query_posts':
        return await queryPosts(payload, toolInput)
      case 'query_bookings':
        return await queryBookings(payload, toolInput)
      case 'query_spaces':
        return await querySpaces(payload, toolInput, tenantId)
      case 'query_projects':
        return await queryProjects(payload, toolInput)
      case 'query_availability':
        return await queryAvailability(payload, toolInput)
      default:
        return `Unknown tool: ${toolName}`
    }
  } catch (err) {
    console.error(`[LEO Tools] Error executing ${toolName}:`, err)
    return `Error querying data: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely read a string property from a Payload doc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function str(doc: any, key: string, fallback = ''): string {
  const val = doc?.[key]
  return typeof val === 'string' ? val : fallback
}

/** Safely read a number property from a Payload doc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function num(doc: any, key: string): number | undefined {
  const val = doc?.[key]
  return typeof val === 'number' ? val : undefined
}

// ---------------------------------------------------------------------------
// Individual Query Handlers
// ---------------------------------------------------------------------------

async function queryProducts(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }
  if (input.category && typeof input.category === 'string') {
    conditions.push({ 'categories.title': { contains: input.category } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'products',
    where,
    limit,
    depth: 1,
    overrideAccess: true, // Products are public catalog data
  })

  if (result.docs.length === 0) {
    return 'No products found matching your criteria.'
  }

  const products = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const price = num(p, 'priceInUSD')
    const priceStr = price != null ? `$${price}` : 'Price not set'
    const slug = str(p, 'slug')
    return `- **${title}** (${priceStr})${slug ? ` — /products/${slug}` : ''}`
  })

  return `Found ${result.totalDocs} product(s)${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${products.join('\n')}`
}

async function queryPosts(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ _status: { equals: 'published' } }]

  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }

  const result = await payload.find({
    collection: 'posts',
    where: { and: conditions } as Where,
    limit,
    sort: '-publishedOn',
    depth: 1,
    overrideAccess: true, // Published posts are public
  })

  if (result.docs.length === 0) {
    return 'No published posts found.'
  }

  const posts = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const publishedOn = str(p, 'publishedOn')
    const date = publishedOn ? new Date(publishedOn).toLocaleDateString() : 'No date'
    const slug = str(p, 'slug')
    return `- **${title}** (${date})${slug ? ` — /posts/${slug}` : ''}`
  })

  return `Found ${result.totalDocs} post(s)${result.totalDocs > limit ? ` (showing first ${limit})` : ''}:\n${posts.join('\n')}`
}

async function queryBookings(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  if (input.status && typeof input.status === 'string') {
    conditions.push({ status: { equals: input.status } })
  }
  if (input.upcoming === true) {
    conditions.push({ startDateTime: { greater_than: new Date().toISOString() } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'bookings',
    where,
    limit,
    sort: '-startDateTime',
    depth: 1,
    overrideAccess: false, // Bookings are private — respect user access
  })

  if (result.docs.length === 0) {
    return 'No bookings found matching your criteria.'
  }

  const bookings = result.docs.map((b) => {
    const title = str(b, 'title', 'Untitled booking')
    const status = str(b, 'status', 'unknown')
    const startDT = str(b, 'startDateTime')
    const start = startDT ? new Date(startDT).toLocaleString() : 'TBD'
    const type = str(b, 'bookingType')
    return `- **${title}** [${status}]${type ? ` — ${type},` : ' —'} ${start}`
  })

  return `Found ${result.totalDocs} booking(s):\n${bookings.join('\n')}`
}

async function querySpaces(
  payload: Payload,
  input: Record<string, unknown>,
  tenantId?: number,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []
  if (tenantId) {
    conditions.push({ tenant: { equals: tenantId } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'spaces',
    where,
    limit: 20,
    depth: 0,
    overrideAccess: true, // Space listing is navigational
  })

  if (result.docs.length === 0) {
    return 'No spaces found.'
  }

  let output = `Found ${result.docs.length} space(s):\n`

  for (const space of result.docs) {
    const name = str(space, 'name', 'Unnamed')
    const visibility = str(space, 'visibility', 'public')
    output += `\n- **${name}** (${visibility})`

    if (input.includeChannels === true) {
      const channels = await payload.find({
        collection: 'channels',
        where: { space: { equals: space.id } } as Where,
        limit: 20,
        depth: 0,
        overrideAccess: true,
      })
      if (channels.docs.length > 0) {
        for (const ch of channels.docs) {
          output += `\n  - #${str(ch, 'name')} (${str(ch, 'type')})`
        }
      }
    }
  }

  return output
}

async function queryProjects(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  const limit = Math.min(Number(input.limit) || 5, 10)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = []

  if (input.status && typeof input.status === 'string') {
    conditions.push({ projectStatus: { equals: input.status } })
  }
  if (input.search && typeof input.search === 'string') {
    conditions.push({ title: { contains: input.search } })
  }

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'projects',
    where,
    limit,
    sort: '-createdAt',
    depth: 1,
    overrideAccess: true, // Public portfolio projects
  })

  if (result.docs.length === 0) {
    return 'No projects found matching your criteria.'
  }

  const projects = result.docs.map((p) => {
    const title = str(p, 'title', 'Untitled')
    const status = str(p, 'projectStatus', 'unknown')
    const type = str(p, 'projectType')
    return `- **${title}** [${status}]${type ? ` — ${type}` : ''}`
  })

  return `Found ${result.totalDocs} project(s):\n${projects.join('\n')}`
}

async function queryAvailability(
  payload: Payload,
  input: Record<string, unknown>,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [{ isActive: { equals: true } }]

  if (input.providerId && typeof input.providerId === 'number') {
    conditions.push({ provider: { equals: input.providerId } })
  }

  const result = await payload.find({
    collection: 'availability',
    where: { and: conditions } as Where,
    limit: 10,
    depth: 1,
    overrideAccess: true, // Availability is public scheduling data
  })

  if (result.docs.length === 0) {
    return 'No availability records found. The provider may not have set up their schedule yet.'
  }

  const slots = result.docs.map((a) => {
    const title = str(a, 'title', 'Availability')
    const type = str(a, 'availabilityType', 'unknown')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (a as any).provider
    const providerName =
      typeof provider === 'object' && provider?.name
        ? String(provider.name)
        : 'Unknown provider'
    return `- **${title}** (${type}) — Provider: ${providerName}`
  })

  return `Found ${result.docs.length} availability record(s):\n${slots.join('\n')}`
}
