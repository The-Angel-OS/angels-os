#!/usr/bin/env npx tsx
/**
 * Angel OS MCP Server — Claude Code ↔ Merlin/LEO bridge
 *
 * Exposes Angel OS as a set of MCP tools so Claude Code can talk
 * directly to Merlin (the LEO conversational AI) and query/mutate
 * Angel OS data (products, posts, orders, spaces).
 *
 * Transport: stdio (standard for Claude Code)
 * Auth: Auto-derives JWT from PAYLOAD_SECRET (zero-config) or
 *        falls back to ANGEL_OS_API_KEY bearer token
 *
 * Usage (Claude Code auto-starts via .mcp.json):
 *   npx tsx mcp-server/index.ts
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---------------------------------------------------------------------------
// Load .env.local / .env (same as `npx vercel env pull`)
// ---------------------------------------------------------------------------

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

const cwd = process.cwd()
loadEnvFile(path.join(cwd, '.env.local'))
loadEnvFile(path.join(cwd, '.env'))

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.ANGEL_OS_URL || 'https://www.spacesangels.com'
const TENANT_SLUG = process.env.ANGEL_OS_TENANT || 'default'

// ---------------------------------------------------------------------------
// JWT Auto-Auth — obtain session-backed token from PAYLOAD_SECRET
// ---------------------------------------------------------------------------

let AUTH_TOKEN = process.env.ANGEL_OS_API_KEY || ''

/**
 * Obtain a proper JWT with session ID by calling /api/auth/system-token.
 *
 * The endpoint validates the PAYLOAD_SECRET hash and creates a session
 * in the database, returning a JWT that Payload 3.77+ accepts (has `sid`).
 *
 * Fallback: if the endpoint isn't available yet (pre-deploy), sign a
 * basic JWT locally (works for unauthenticated endpoints like list_products).
 */
async function deriveAuthToken(): Promise<string> {
  const payloadSecret = process.env.PAYLOAD_SECRET
  if (!payloadSecret) return ''

  const secretHash = crypto.createHash('sha256').update(payloadSecret).digest('hex').slice(0, 32)

  // Try the system-token endpoint first (gives us a session-backed JWT)
  try {
    const res = await fetch(`${BASE_URL}/api/auth/system-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretHash, tenantSlug: TENANT_SLUG }),
    })

    if (res.ok) {
      const data = (await res.json()) as { token: string; user: { id: number; email: string }; expiresAt: string }
      process.stderr.write(
        `[angel-os-mcp] Authenticated as ${data.user.email} (session expires ${data.expiresAt})\n`,
      )
      return data.token
    }

    process.stderr.write(
      `[angel-os-mcp] system-token returned ${res.status} — falling back to local JWT\n`,
    )
  } catch (err) {
    process.stderr.write(`[angel-os-mcp] system-token endpoint unreachable — falling back to local JWT\n`)
  }

  // Fallback: sign a basic JWT locally (no session — works for public/unauthenticated endpoints)
  try {
    const secretBytes = new TextEncoder().encode(secretHash)
    const { SignJWT } = await import('jose')

    const token = await new SignJWT({
      email: `leo-${TENANT_SLUG}@system.spacesangels.com`,
      collection: 'users',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secretBytes)

    return token
  } catch (err) {
    process.stderr.write(`[angel-os-mcp] JWT fallback failed: ${err}\n`)
    return ''
  }
}

// Initialize auth token before first request
let authReady: Promise<void> | null = null
if (!AUTH_TOKEN) {
  authReady = deriveAuthToken().then((token) => {
    AUTH_TOKEN = token
    if (token) {
      process.stderr.write('[angel-os-mcp] Auto-authenticated via PAYLOAD_SECRET\n')
    } else {
      process.stderr.write('[angel-os-mcp] No auth configured (set ANGEL_OS_API_KEY or PAYLOAD_SECRET)\n')
    }
  })
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface FetchOptions {
  method?: string
  body?: Record<string, unknown>
  params?: Record<string, string | number | undefined>
}

async function api(path: string, opts: FetchOptions = {}): Promise<unknown> {
  // Ensure auth token is ready (first call may await JWT derivation)
  if (authReady) {
    await authReady
    authReady = null
  }

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
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`
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
      const price = p.priceInUSD ?? p.basePrice ?? p.price
      const priceStr = price != null ? `$${(price / 100).toFixed(2)}` : 'N/A'
      const stock = typeof p.inventory === 'number' ? p.inventory : p.inventory?.stock ?? '?'
      return `- **${p.title || 'Untitled'}** (ID: ${p.id}) — ${priceStr} | Stock: ${stock} | Status: ${p._status || 'published'}`
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
  'Full-text search across Angel OS content (products, posts, pages, events).',
  {
    query: z.string().describe('Search query'),
    collection: z
      .enum(['products', 'posts', 'pages', 'events'])
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
// Tool: list_events
// ---------------------------------------------------------------------------

server.tool(
  'list_events',
  'List events from Angel OS (tour stops, meetups, workshops, livestreams). Returns title, date, location, type, and status.',
  {
    limit: z.number().optional().default(10).describe('Max results'),
    status: z
      .enum(['draft', 'upcoming', 'live', 'completed', 'cancelled'])
      .optional()
      .describe('Filter by event status'),
    eventType: z
      .enum(['meetup', 'workshop', 'livestream', 'conference', 'screening', 'custom'])
      .optional()
      .describe('Filter by event type'),
  },
  async ({ limit, status, eventType }) => {
    const params: Record<string, string | number | undefined> = { limit, depth: 1 }
    if (status) params['where[status][equals]'] = status
    if (eventType) params['where[eventType][equals]'] = eventType

    const result = (await api('/api/events', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((e: any) => {
      const start = e.startDateTime
        ? new Date(e.startDateTime).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'TBD'
      const locType = e.location?.type || 'in-person'
      const venue = e.location?.venueName || e.location?.remotePlatform || ''
      const city = e.location?.address?.city ? `, ${e.location.address.city}` : ''
      return `- **${e.title || 'Untitled'}** (ID: ${e.id}) — ${e.eventType || '?'} | ${e.status || 'draft'} | ${start} | ${locType}${venue ? ': ' + venue : ''}${city}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Events** (${docs.length} of ${result.totalDocs ?? '?'}):\n${lines.join('\n')}`
            : 'No events found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: get_event
// ---------------------------------------------------------------------------

server.tool(
  'get_event',
  'Get full details of a single event by ID, including registrations count and location.',
  {
    id: z.union([z.string(), z.number()]).describe('Event ID'),
  },
  async ({ id }) => {
    const result = (await api(`/api/events/${id}`, { params: { depth: 2 } })) as any

    if (result?.errors) {
      return {
        content: [{ type: 'text' as const, text: `Event ${id} not found.` }],
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
// Tool: create_event
// ---------------------------------------------------------------------------

server.tool(
  'create_event',
  'Create a new event in Angel OS (tour stop, meetup, workshop, etc.).',
  {
    title: z.string().describe('Event title'),
    eventType: z
      .enum(['meetup', 'workshop', 'livestream', 'conference', 'screening', 'custom'])
      .optional()
      .default('meetup')
      .describe('Event type'),
    startDateTime: z.string().describe('Start date/time in ISO 8601 format (e.g. 2026-04-15T19:00:00-05:00)'),
    duration: z.number().optional().default(120).describe('Duration in minutes (default 120)'),
    locationType: z
      .enum(['in-person', 'virtual', 'hybrid'])
      .optional()
      .default('in-person')
      .describe('Location type'),
    venueName: z.string().optional().describe('Venue name (for in-person/hybrid)'),
    city: z.string().optional().describe('City'),
    state: z.string().optional().describe('State/province'),
    isFree: z.boolean().optional().default(true).describe('Whether the event is free'),
    amount: z.number().optional().describe('Ticket price in cents if not free'),
    maxAttendees: z.number().optional().default(0).describe('Max attendees (0 = unlimited)'),
    status: z
      .enum(['draft', 'upcoming'])
      .optional()
      .default('upcoming')
      .describe('Event status'),
  },
  async ({ title, eventType, startDateTime, duration, locationType, venueName, city, state, isFree, amount, maxAttendees, status }) => {
    const body: Record<string, unknown> = {
      title,
      eventType,
      startDateTime,
      duration,
      status,
      capacity: { maxAttendees: maxAttendees || 0, waitlistEnabled: true },
      pricing: { isFree: isFree ?? true },
      location: {
        type: locationType || 'in-person',
      },
    }

    if (venueName) (body.location as any).venueName = venueName
    if (city || state) {
      ;(body.location as any).address = {}
      if (city) (body.location as any).address.city = city
      if (state) (body.location as any).address.state = state
    }
    if (!isFree && amount) {
      ;(body.pricing as any).amount = amount
      ;(body.pricing as any).currency = 'usd'
    }

    const result = (await api('/api/events', { body })) as any

    if (result?.errors) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to create event: ${result.errors.map((e: any) => e.message).join(', ')}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Event created: **${result.doc?.title || title}** (ID: ${result.doc?.id || '?'}) — ${eventType} on ${new Date(startDateTime).toLocaleDateString()}`,
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_event_registrations
// ---------------------------------------------------------------------------

server.tool(
  'list_event_registrations',
  'List registrations for a specific event. Shows attendee names, status, and check-in times.',
  {
    eventId: z.union([z.string(), z.number()]).describe('Event ID'),
    limit: z.number().optional().default(50).describe('Max results'),
    status: z
      .enum(['registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show'])
      .optional()
      .describe('Filter by registration status'),
  },
  async ({ eventId, limit, status }) => {
    const params: Record<string, string | number | undefined> = {
      'where[event][equals]': String(eventId),
      limit,
      depth: 1,
    }
    if (status) params['where[status][equals]'] = status

    const result = (await api('/api/event-registrations', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((r: any) => {
      const name = r.attendee?.name || r.name || r.attendee?.email || r.email || 'Anonymous'
      const checkin = r.checkedInAt ? ` | Checked in: ${new Date(r.checkedInAt).toLocaleTimeString()}` : ''
      return `- **${name}** — ${r.status || '?'} | ${r.attendanceMode || 'in-person'}${checkin}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Registrations for Event #${eventId}** (${docs.length} of ${result.totalDocs ?? '?'}):\n${lines.join('\n')}`
            : `No registrations found for event #${eventId}.`,
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_tenants
// ---------------------------------------------------------------------------

server.tool(
  'list_tenants',
  'List all tenants in the Angel OS federation. Returns name, slug, domain, status, branding, and business type.',
  {
    limit: z.number().optional().default(20).describe('Max results'),
    status: z.string().optional().describe('Filter by status (e.g. active, inactive)'),
  },
  async ({ limit, status }) => {
    const params: Record<string, string | number | undefined> = { limit, depth: 0 }
    if (status) params['where[status][equals]'] = status

    const result = (await api('/api/tenants', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((t: any) => {
      const siteName = t.branding?.siteName || t.name || 'Unnamed'
      const domain = t.domain || 'none'
      return `- **${siteName}** (ID: ${t.id}, slug: \`${t.slug}\`) — ${t.status || '?'} | domain: ${domain} | type: ${t.businessType || '?'}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Tenants** (${docs.length} of ${result.totalDocs ?? '?'}):\n${lines.join('\n')}`
            : 'No tenants found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: get_tenant
// ---------------------------------------------------------------------------

server.tool(
  'get_tenant',
  'Get full details of a tenant by ID or slug, including branding, commerce config, and domain setup.',
  {
    id: z.union([z.string(), z.number()]).describe('Tenant ID or slug'),
  },
  async ({ id }) => {
    // Try direct ID first, fall back to slug query
    let result = (await api(`/api/tenants/${id}`, { params: { depth: 1 } })) as any

    if (result?.errors || !result?.id) {
      // Try by slug
      const slugResult = (await api('/api/tenants', {
        params: { 'where[slug][equals]': String(id), limit: 1, depth: 1 },
      })) as any
      result = slugResult?.docs?.[0]
    }

    if (!result?.id) {
      return {
        content: [{ type: 'text' as const, text: `Tenant "${id}" not found.` }],
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
// Tool: list_endeavors
// ---------------------------------------------------------------------------

server.tool(
  'list_endeavors',
  'List all Endeavors (enterprises) in the Angel OS federation. Shows name, type, federation status, and tenant linkage.',
  {
    limit: z.number().optional().default(20).describe('Max results'),
    networkVisible: z.boolean().optional().describe('Filter by federation network visibility'),
  },
  async ({ limit, networkVisible }) => {
    const params: Record<string, string | number | undefined> = { limit, depth: 1 }
    if (networkVisible !== undefined) {
      params['where[federation.networkVisible][equals]'] = networkVisible ? 'true' : 'false'
    }

    const result = (await api('/api/endeavors', { params })) as any
    const docs = result?.docs || []

    const lines = docs.map((e: any) => {
      const tenantName = typeof e.tenant === 'object' ? (e.tenant?.name || e.tenant?.slug) : `#${e.tenant}`
      const visible = e.federation?.networkVisible ? '🌐 visible' : '🔒 hidden'
      const ministry = e.federation?.ministryStatus || 'none'
      const types = Array.isArray(e.holonTypes) ? e.holonTypes.join(', ') : e.endeavorType || '?'
      return `- **${e.name}** (ID: ${e.id}) — tenant: ${tenantName} | ${visible} | ministry: ${ministry} | types: ${types}`
    })

    return {
      content: [
        {
          type: 'text' as const,
          text: lines.length
            ? `**Endeavors** (${docs.length} of ${result.totalDocs ?? '?'}):\n${lines.join('\n')}`
            : 'No endeavors found.',
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: get_endeavor
// ---------------------------------------------------------------------------

server.tool(
  'get_endeavor',
  'Get full details of an Endeavor by ID, including federation config, capabilities, and region.',
  {
    id: z.union([z.string(), z.number()]).describe('Endeavor ID'),
  },
  async ({ id }) => {
    const result = (await api(`/api/endeavors/${id}`, { params: { depth: 2 } })) as any

    if (result?.errors) {
      return {
        content: [{ type: 'text' as const, text: `Endeavor ${id} not found.` }],
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
// Tool: update_endeavor
// ---------------------------------------------------------------------------

server.tool(
  'update_endeavor',
  'Update an Endeavor\'s fields — name, tagline, description, federation settings, capabilities, etc.',
  {
    id: z.union([z.string(), z.number()]).describe('Endeavor ID'),
    data: z.record(z.unknown()).describe(
      'Fields to update. Common fields: name, tagline, description, endeavorType, ' +
      'holonTypes (array), capabilities (array of {name,description}), ' +
      'federation.networkVisible (boolean), federation.ministryStatus, ' +
      'region.city, region.state, region.country',
    ),
  },
  async ({ id, data }) => {
    const result = (await api(`/api/endeavors/${id}`, {
      method: 'PATCH',
      body: data as Record<string, unknown>,
    })) as any

    if (result?.errors) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to update endeavor: ${result.errors.map((e: any) => e.message).join(', ')}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Endeavor updated: **${result.doc?.name || result.name || '?'}** (ID: ${result.doc?.id || result.id || id})`,
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: update_tenant
// ---------------------------------------------------------------------------

server.tool(
  'update_tenant',
  'Update a tenant\'s fields — branding, domain, business type, commerce settings, etc.',
  {
    id: z.union([z.string(), z.number()]).describe('Tenant ID'),
    data: z.record(z.unknown()).describe(
      'Fields to update. Common fields: branding.siteName, branding.tagline, ' +
      'branding.primaryColor, domain, businessType, status',
    ),
  },
  async ({ id, data }) => {
    const result = (await api(`/api/tenants/${id}`, {
      method: 'PATCH',
      body: data as Record<string, unknown>,
    })) as any

    if (result?.errors) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to update tenant: ${result.errors.map((e: any) => e.message).join(', ')}`,
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: `Tenant updated: **${result.doc?.name || result.name || '?'}** (ID: ${result.doc?.id || result.id || id})`,
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
