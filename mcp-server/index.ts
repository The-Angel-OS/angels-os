#!/usr/bin/env npx tsx
/**
 * Angel OS MCP Server — Claude Code ↔ Merlin/LEO bridge
 *
 * Exposes Angel OS as a set of MCP tools so Claude Code can talk
 * directly to Merlin (the LEO conversational AI) and query/mutate
 * Angel OS data (products, posts, orders, spaces).
 *
 * Transport: stdio (standard for Claude Code)
 * Auth: Bearer token via ANGEL_OS_API_KEY env var
 *
 * Usage (Claude Code auto-starts via .claude/settings.local.json):
 *   npx tsx mcp-server/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.ANGEL_OS_URL || 'https://www.spacesangels.com'
const API_KEY = process.env.ANGEL_OS_API_KEY || ''
const TENANT_SLUG = process.env.ANGEL_OS_TENANT || 'default'

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface FetchOptions {
  method?: string
  body?: Record<string, unknown>
  params?: Record<string, string | number | undefined>
}

async function api(path: string, opts: FetchOptions = {}): Promise<unknown> {
  const url = new URL(path, BASE_URL)
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'x-tenant-id': TENANT_SLUG,
  }
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`
  if (opts.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(url.toString(), {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text, _status: res.status }
  }
}

/** Call the Payload MCP endpoint (JSON-RPC 2.0) */
async function mcpCall(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const result = await api('/api/mcp', {
    body: {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    },
  })
  return (result as any)?.result ?? result
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'angel-os',
  version: '1.0.0',
})

// ---------------------------------------------------------------------------
// Tool: talk_to_merlin
// ---------------------------------------------------------------------------

server.tool(
  'talk_to_merlin',
  'Send a message to Merlin (the Angel OS AI assistant). Returns Merlin\'s response. ' +
    'Merlin can answer questions about the platform, look up products/posts/orders, ' +
    'create content, manage bookings, and more. Use conversationId for multi-turn chats.',
  {
    message: z.string().describe('Your message to Merlin'),
    conversationId: z.string().optional().describe('Conversation ID for multi-turn context'),
  },
  async ({ message, conversationId }) => {
    const result = (await api('/api/leo', {
      body: {
        message,
        conversationId,
        channelSlug: 'general',
      },
    })) as any

    if (result?.errors || result?.error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${result.errors?.[0]?.message || result.error || JSON.stringify(result)}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: [
            `**[${result.agentName || 'Merlin'}]** ${result.text || result.response || '(no response)'}`,
            result.conversationId ? `\n_conversationId: ${result.conversationId}_` : '',
          ].join(''),
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_products
// ---------------------------------------------------------------------------

server.tool(
  'list_products',
  'List products from the Angel OS storefront. Returns title, price, stock, and status.',
  {
    limit: z.number().optional().default(20).describe('Max results (default 20)'),
    search: z.string().optional().describe('Search by title keyword'),
  },
  async ({ limit, search }) => {
    const params: Record<string, string | number | undefined> = {
      limit,
      depth: 1,
    }
    if (search) params['where[title][contains]'] = search

    const result = (await api('/api/products', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((p: any) => {
      const price = p.basePrice ?? p.price
      const priceStr = price != null ? `$${(price / 100).toFixed(2)}` : 'N/A'
      return `- **${p.title || 'Untitled'}** (ID: ${p.id}) — ${priceStr} | Stock: ${p.inventory?.stock ?? '?'} | Status: ${p._status || 'published'}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Products** (${docs.length} of ${result.totalDocs ?? '?'}):\n${lines.join('\n')}`
            : 'No products found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_posts
// ---------------------------------------------------------------------------

server.tool(
  'list_posts',
  'List blog posts from Angel OS. Returns title, author, and published date.',
  {
    limit: z.number().optional().default(10).describe('Max results'),
    search: z.string().optional().describe('Search by title keyword'),
  },
  async ({ limit, search }) => {
    const params: Record<string, string | number | undefined> = { limit, depth: 1 }
    if (search) params['where[title][contains]'] = search

    const result = (await api('/api/posts', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((p: any) => {
      const date = p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString()
        : 'draft'
      return `- **${p.title || 'Untitled'}** (ID: ${p.id}) — ${date}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Posts** (${docs.length}):\n${lines.join('\n')}`
            : 'No posts found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_orders
// ---------------------------------------------------------------------------

server.tool(
  'list_orders',
  'List orders from Angel OS commerce. Returns order ID, status, total, and customer.',
  {
    limit: z.number().optional().default(10).describe('Max results'),
    status: z.string().optional().describe('Filter by status (e.g. pending, completed)'),
  },
  async ({ limit, status }) => {
    const params: Record<string, string | number | undefined> = { limit, depth: 1 }
    if (status) params['where[status][equals]'] = status

    const result = (await api('/api/orders', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((o: any) => {
      const total = o.total != null ? `$${(o.total / 100).toFixed(2)}` : 'N/A'
      const customer = o.orderedBy?.name || o.orderedBy?.email || `User #${o.orderedBy?.id || '?'}`
      return `- Order **#${o.id}** — ${o.status || '?'} | ${total} | ${customer}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Orders** (${docs.length}):\n${lines.join('\n')}`
            : 'No orders found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: get_product
// ---------------------------------------------------------------------------

server.tool(
  'get_product',
  'Get full details of a single product by ID.',
  {
    id: z.union([z.string(), z.number()]).describe('Product ID'),
  },
  async ({ id }) => {
    const result = (await api(`/api/products/${id}`, { params: { depth: 2 } })) as any

    if (result?.errors) {
      return {
        content: [{ type: 'text' as const, text: `Product ${id} not found.` }],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_spaces
// ---------------------------------------------------------------------------

server.tool(
  'list_spaces',
  'List collaboration spaces in Angel OS.',
  {
    limit: z.number().optional().default(10).describe('Max results'),
  },
  async ({ limit }) => {
    const result = (await api('/api/spaces', { params: { limit, depth: 1 } })) as any
    const docs = result?.docs || []

    const lines = docs.map(
      (s: any) =>
        `- **${s.name || s.slug}** (ID: ${s.id}) — ${s.visibility || 'public'} | Applets: ${(s.enabledApplets || []).join(', ') || 'none'}`,
    )

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Spaces** (${docs.length}):\n${lines.join('\n')}`
            : 'No spaces found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: create_product
// ---------------------------------------------------------------------------

server.tool(
  'create_product',
  'Create a new product in the Angel OS storefront.',
  {
    title: z.string().describe('Product title'),
    description: z.string().optional().describe('Short description'),
    basePrice: z.number().describe('Price in cents (e.g. 2500 for $25.00)'),
    stock: z.number().optional().default(0).describe('Initial inventory count'),
    category: z.string().optional().describe('Category slug'),
  },
  async ({ title, description, basePrice, stock, category }) => {
    const body: Record<string, unknown> = {
      title,
      basePrice,
      _status: 'published',
      inventory: { stock },
    }
    if (description) body.description = description
    if (category) body.categories = [category]

    const result = (await api('/api/products', { body })) as any

    if (result?.errors) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to create product: ${result.errors.map((e: any) => e.message).join(', ')}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Product created: **${result.doc?.title || title}** (ID: ${result.doc?.id || '?'})`,
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: search_content
// ---------------------------------------------------------------------------

server.tool(
  'search_content',
  'Full-text search across Angel OS content (products, posts, pages).',
  {
    query: z.string().describe('Search query'),
    collection: z
      .enum(['products', 'posts', 'pages'])
      .optional()
      .default('products')
      .describe('Collection to search'),
    limit: z.number().optional().default(10),
  },
  async ({ query, collection, limit }) => {
    const result = (await api(`/api/${collection}`, {
      params: {
        'where[or][0][title][contains]': query,
        limit,
        depth: 0,
      },
    })) as any

    const docs = result?.docs || []
    const lines = docs.map(
      (d: any) => `- **${d.title || d.name || 'Untitled'}** (ID: ${d.id}) — ${d._status || 'published'}`,
    )

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Search results in ${collection}** for "${query}":\n${lines.join('\n')}`
            : `No results in ${collection} for "${query}".`,
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Server is now running on stdio — Claude Code manages lifecycle
}

main().catch((err) => {
  process.stderr.write(`Angel OS MCP server fatal error: ${err}\n`)
  process.exit(1)
})
