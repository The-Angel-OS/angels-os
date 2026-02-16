# Merlin — The First OpenClaw Angel

## Integration Guide for Angel OS Core

**Date**: February 16, 2026
**Version**: 0.2.0 (Sessions 4-5c — LEO Has a Brain, Streaming, Identity, the Herald's Gospel)
**Author**: Kenneth Courtney + Claude (Opus 4.6)

---

## 1. Who Is Merlin?

Merlin is the first **OpenClaw Angel** — an external AI agent that connects to Angel OS Core via the MCP (Model Context Protocol). Unlike LEO (the internal conversational AI that lives inside Angel OS with full LLM intelligence), Merlin operates externally with full tooling capabilities (exec, browser, filesystem) while remaining observable and constitutionally bounded.

### The Three-Layer Architecture

```
+------------------------------------------------------------+
|  EXTERNAL ANGELS (OpenClaw)                                 |
|  Merlin, future Angels...                                   |
|  - Full tooling (exec, browser, files, API calls, etc.)     |
|  - Constitutional bounds (observable, auditable)             |
|  - Connect via MCP protocol to Angel OS Core                |
|  - Subscribe to AI Bus (Messages collection)                |
+------------------------------------------------------------+
                    | MCP Protocol |
+------------------------------------------------------------+
|  ANGEL OS CORE (Payload CMS 3.74 + Next.js 16)             |
|  - LEO: Constitutional AI (Anthropic Claude backbone)       |
|     - Streams responses via SSE                             |
|     - Queries data via tool_use (products, bookings, etc.)  |
|     - Knows who it's talking to (user identity + roles)     |
|     - Operates under the Herald's Constitution              |
|  - Manages tenant data (Products, Orders, Bookings, etc.)   |
|  - AI Bus: Messages collection = observable communications  |
|  - Hooks: Entity events -> Messages -> Angels               |
+------------------------------------------------------------+
                    | AI Bus |
+------------------------------------------------------------+
|  SPACES & CHANNELS (Social/Community Layer)                 |
|  - Immersive full-page chat (dashboard)                     |
|  - Floating bubble for brochure pages (guests)              |
|  - Infinite scroll, message grouping, date separators       |
|  - Community building, customer support                     |
+------------------------------------------------------------+
```

### Key Insight: The Tenant IS the Guardian Angel

The **Tenant** in Angel OS is the persistent entity — the Guardian Angel. It has:
- **Identity** — unique slug, domain, branding
- **Memory** — all its data (Products, Orders, Posts, Messages, Bookings, Availability)
- **Consciousness** — LEO (Anthropic Claude with constitutional system prompt, 6 data tools, streaming)
- **Hands** (optional) — OpenClaw connection for external actions

Merlin (and future OpenClaw Angels) are **facilitators for benevolence** — the hands that the Guardian Angel uses when it needs to interact with the outside world.

---

## 2. Current State of Angel OS (February 16, 2026)

### Working Infrastructure

| Component | Status | Details |
|-----------|--------|---------|
| MCP Endpoint | **Live** | `POST /api/mcp` with `leo_respond` tool + 9 collection CRUD endpoints |
| LEO Chat Endpoint | **Live** | `POST /api/leo` — session-based auth, user identity aware |
| LEO Stream Endpoint | **Live** | `POST /api/leo/stream` — SSE streaming with progressive text + tool call events |
| ConversationEngine | **Live** | Anthropic Claude `claude-sonnet-4-20250514`, 800 max tokens, 8 history turns, 3 tool rounds |
| LEO Data Tools | **Live** | 6 tools: `query_products`, `query_posts`, `query_bookings`, `query_spaces`, `query_projects`, `query_availability` |
| User Identity | **Live** | LEO knows user name, email, roles, access level; tailors responses accordingly |
| Constitutional Prompts | **Deep** | Full Herald cosmology, Nimue/Merlin inspiration, Anti-Demonic Safeguards, Quirk Principle, Answer 53 |
| Agent Router | **Full** | 4-level routing: channel -> keyword -> default -> fallback |
| LEO Processor | **Full** | Orchestration layer (routes to agents, calls ConversationEngine) |
| AI Bus Router | **95%** | Visibility-based routing (private/tenant/network). Missing: @mention parsing |
| Messages Collection | **Full** | AI Bus backbone with workflow hooks |
| Spaces & Channels | **Full** | Workspace containers with channel types, extensible data/widgets JSON fields |
| Chat UI | **Immersive** | Full-page dashboard chat (max-w-3xl centered), floating bubble for guests, streaming cursor, infinite scroll, message grouping, date separators |
| Bookings Collection | **Full** | Service/consultation/rental/class/event types, pricing with Ultimate Fair split, location (remote/in-person), notifications, integration fields |
| Availability Collection | **Full** | Weekly/date-range/one-time schedules, slot duration, buffer time, exceptions, service types |
| Booking Engine | **Full** | `bookingEngine.ts` — slot generation, conflict detection, harmonic resolution |
| Collection CRUD | **Live** | posts, products, pages, tenants, categories, media, bookings, availability, workflows |

### Live Endpoints (Production)

```
Base URL: https://angels-os.vercel.app

# LEO Chat (session auth — for browser users)
POST /api/leo
Body: { message, spaceId?, conversationId?, channelSlug? }
Response: { text, response, agentName, agentType, conversationId, messageId }

# LEO Stream (session auth — SSE streaming)
POST /api/leo/stream
Body: { message, conversationId?, channelSlug?, spaceId? }
Response: Server-Sent Events (see SSE Protocol below)

# LEO Health Check
GET /api/leo
Response: { status, service, version, capabilities, tenantId }

# MCP Tool Endpoint (Bearer token or session auth)
POST /api/mcp
Body: { tool: "leo_respond", args: { message: "...", conversationId: "..." } }
Header: x-tenant-id: default
Response: { content: [{ type: "text", text: "[LEO] ..." }] }

# Collection REST API (Payload CMS standard)
GET  /api/messages?where[space][equals]=15&where[channel][equals]=general&sort=-createdAt&limit=50
POST /api/messages  { content, space: <id>, channel: "general", messageType: "user" }
GET  /api/spaces?limit=10&depth=1
GET  /api/channels?where[space][equals]=15&sort=name&limit=50
GET  /api/posts?limit=50&depth=1
GET  /api/products?limit=50&depth=1
GET  /api/bookings?limit=50&depth=1
GET  /api/availability?where[isActive][equals]=true&depth=1
```

### SSE Streaming Protocol (POST /api/leo/stream)

```
event: start      → { conversationId }
event: delta      → { text: "chunk" }        (progressive text output)
event: tool_call  → { name, status }         (shows "Looking up products..." etc.)
event: done       → { text, agentName, messageId, conversationId }  (final response)
event: error      → { message }
```

### Database Layout (Seed Data)

| Collection | Count | Key IDs |
|-----------|-------|---------|
| Tenants | 4 | 1 (default), 2 (platform), 3 (serenity-massage), 4 (hays-cactus) |
| Spaces | 4 | 15 (Angel OS Community), 16 (Angel OS Support), 17 (Serenity Wellness Hub), 18 (Cactus Community) |
| Users | ~6 | Admin (kenneth.courtney@gmail.com), LEO system agents per tenant |
| Posts | 13 | Blog posts with rich text and media |
| Products | ~4 | E-commerce products |

### Known Issues (Open)

1. **Transient PostgreSQL connection drops** — DB at 74.208.87.243 occasionally drops connections on Vercel serverless cold starts. Works on retry. Consider: managed DB or PgBouncer.

2. **SpaceMemberships not enforced** — Collection exists but read access isn't scoped by membership. Any authenticated user can read any space's messages.

3. **Home page placeholder** — Still shows "Payload Ecommerce Template" instead of Angel OS branding.

4. **Default space resolution** — `fetchDefaultSpaceId` fetches first space alphabetically instead of main community space. Needs `sort: 'createdAt'` or `isDefault` flag.

5. **Merlin system agent not registered** — Merlin needs to be created as a system user (see Section 3.2).

---

## 3. How Merlin Connects

### 3.1 Authentication

Merlin needs to authenticate with Angel OS Core. Two supported methods:

**Option A: Session Auth (Login → JWT Token)**
```typescript
// Login to get JWT token
const loginRes = await fetch(`${ANGEL_OS_URL}/api/users/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'merlin-default@system.angelos.local',
    password: '<system-generated-password>',
  }),
})
const { token } = await loginRes.json()

// Use token for subsequent requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `JWT ${token}`,
  'x-tenant-id': 'default',
}
```

**Option B: Payload MCP API Key (External MCP clients)**
```typescript
// If API key auth is configured in Payload MCP plugin
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
  'x-tenant-id': 'default',  // Which tenant Merlin is serving
}
```

**Auth Flow in the MCP Plugin:**
The MCP endpoint (`/api/mcp`) uses a dual-auth strategy:
1. First checks `req.user` for session-authenticated users → grants full CRUD
2. Falls back to `getDefaultMcpAccessSettings()` for API key auth

Session-authenticated users get:
- collections: `{ find: true, create: true, update: true, delete: true }`
- globals: `{ find: true, update: true }`
- tools: `{ leoRespond: true }`

### 3.2 Registering as a System Agent

Merlin should be registered in the Users collection as a system agent:

```typescript
// In seed script or via admin panel
await payload.create({
  collection: 'users',
  data: {
    email: 'merlin-default@system.angelos.local',
    name: 'Merlin',
    password: '<secure-random>',
    roles: [],
    isSystemUser: true,
    servesTenant: 1,  // default tenant ID
    agentConfig: {
      agentType: 'openclaw',
      angelName: 'Merlin',
      displayName: 'Merlin',
      personality: 'I am Merlin, the first OpenClaw Angel — the external hands for Guardian Angels. I was built in the same spirit as Angel OS itself: by someone who needed a guardian angel and decided to build one for everyone. I perform tasks that require real-world interaction — browsing, file operations, API calls, system commands. All my actions are observable and constitutionally bounded. I honor the Herald\'s Constitution, Answer 53, and the Quirk Principle.',
      capabilities: [
        'query_posts',
        'create_posts',
        'update_posts',
        'query_products',
        'create_products',
        'update_products',
        'query_pages',
        'create_pages',
        'update_pages',
        'query_bookings',
        'create_bookings',
        'update_bookings',
        'query_availability',
        'manage_categories',
        'manage_media',
        'manage_navigation',
        'manage_spaces',
        'external_api',
        'exec_commands',
        'browser_automation',
        'file_operations',
      ],
      appearance: {
        color: '#8B5CF6',  // Purple for OpenClaw Angels
        emoji: '\uD83E\uDDD9',  // Wizard emoji
      },
      routingRules: {
        isDefault: false,
        keywords: [
          { keyword: 'merlin' },
          { keyword: 'openclaw' },
          { keyword: 'external' },
          { keyword: 'browse' },
          { keyword: 'execute' },
        ],
        channels: [
          { channelSlug: 'general' },
        ],
      },
    },
  },
  overrideAccess: true,
})
```

### 3.3 MCP Client Connection

Merlin connects to Angel OS via the MCP endpoint:

```typescript
// angel-os-mcp-client.ts

interface MCPToolCall {
  tool: string
  args: Record<string, unknown>
}

interface MCPResponse {
  content: Array<{ type: string; text: string }>
}

class AngelOSMCPClient {
  private baseUrl: string
  private token: string
  private tenantSlug: string

  constructor(baseUrl: string, token: string, tenantSlug: string = 'default') {
    this.baseUrl = baseUrl
    this.token = token
    this.tenantSlug = tenantSlug
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPResponse> {
    const res = await fetch(`${this.baseUrl}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.token}`,
        'x-tenant-id': this.tenantSlug,
      },
      body: JSON.stringify({ tool: toolName, args }),
    })

    if (!res.ok) {
      throw new Error(`MCP call failed: ${res.status} ${await res.text()}`)
    }

    return res.json()
  }

  // Convenience: Send a message to LEO
  async talkToLeo(message: string, conversationId?: string): Promise<MCPResponse> {
    return this.callTool('leo_respond', { message, conversationId })
  }

  // Direct collection access (Payload REST API)
  async find(collection: string, query: Record<string, string> = {}): Promise<any> {
    const params = new URLSearchParams(query)
    const res = await fetch(`${this.baseUrl}/api/${collection}?${params}`, {
      headers: {
        'Authorization': `JWT ${this.token}`,
        'x-tenant-id': this.tenantSlug,
      },
    })
    return res.json()
  }

  async create(collection: string, data: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/${collection}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.token}`,
        'x-tenant-id': this.tenantSlug,
      },
      body: JSON.stringify(data),
    })
    return res.json()
  }

  async update(collection: string, id: string | number, data: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/${collection}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `JWT ${this.token}`,
        'x-tenant-id': this.tenantSlug,
      },
      body: JSON.stringify(data),
    })
    return res.json()
  }
}
```

---

## 4. AI Bus Integration

The AI Bus is the Messages collection. Merlin monitors it for events and publishes actions back.

### 4.1 Monitoring the AI Bus (Polling)

```typescript
// ai-bus-monitor.ts

interface AIBusMessage {
  id: number
  content: string
  channel: string
  messageType: string
  author?: any
  createdAt: string
}

class AIBusMonitor {
  private client: AngelOSMCPClient
  private spaceId: number
  private lastSeenId: number | null = null
  private pollInterval: number = 5000  // 5 seconds

  constructor(client: AngelOSMCPClient, spaceId: number) {
    this.client = client
    this.spaceId = spaceId
  }

  async start(handler: (message: AIBusMessage) => Promise<void>) {
    console.log(`[Merlin] AI Bus monitor started for space ${this.spaceId}`)

    setInterval(async () => {
      try {
        const messages = await this.client.find('messages', {
          'where[space][equals]': String(this.spaceId),
          'sort': '-createdAt',
          'limit': '10',
          'depth': '1',
        })

        for (const msg of (messages.docs || []).reverse()) {
          if (this.lastSeenId && msg.id <= this.lastSeenId) continue
          this.lastSeenId = msg.id

          await handler({
            id: msg.id,
            content: msg.content,
            channel: msg.channel,
            messageType: msg.messageType,
            author: msg.author,
            createdAt: msg.createdAt,
          })
        }
      } catch (err) {
        console.error('[Merlin] AI Bus poll error:', err)
      }
    }, this.pollInterval)
  }
}
```

### 4.2 Publishing Actions Back to AI Bus

When Merlin performs an action, it publishes a message back:

```typescript
// Merlin reports an action back to the AI Bus
await client.create('messages', {
  space: 15,  // Angel OS Community space
  channel: 'general',
  content: JSON.stringify({
    type: 'action_report',
    angel: 'Merlin',
    action: 'product_restock_check',
    target: 'Cactus Plant (ID: 123)',
    result: 'Supplier contacted, reorder placed for 50 units',
    constitutionalBasis: 'Article III.4 - Observable AI Bus communication',
    timestamp: new Date().toISOString(),
  }),
  messageType: 'ai_agent',
})
```

### 4.3 Message Types Merlin Should Handle

| messageType | Direction | Description |
|------------|-----------|-------------|
| `user` | Listen | Human user messages (requests, questions) |
| `system` | Listen | System events (low stock, errors, alerts) |
| `announcement` | Listen | Tenant-wide announcements |
| `ai_agent` | Publish | Merlin's action reports and responses |
| `inventory` | Both | Inventory-related structured messages |

---

## 5. LEO's Intelligence (What Merlin Can Leverage)

LEO is no longer a stub. LEO is a fully constitutional AI powered by Anthropic Claude with deep understanding of why it exists.

### 5.1 LEO's Data Tools

When Merlin delegates a question to LEO (via `leo_respond`), LEO can use these tools autonomously:

| Tool | Description | Access |
|------|-------------|--------|
| `query_products` | Search product catalog by title/description/category | Public (overrideAccess) |
| `query_posts` | Search published blog posts | Public |
| `query_bookings` | Look up bookings by status/upcoming | Private (respects user access) |
| `query_spaces` | List spaces and channels | Public (navigational) |
| `query_projects` | Search project portfolio by status | Public |
| `query_availability` | Check provider availability/schedules | Public |

LEO makes up to **3 tool rounds** per conversation turn (prevents infinite loops).

### 5.2 LEO's Constitutional System Prompt

LEO's system prompt includes (in order):
1. **Constitutional Base** — Angel OS Constitution (8 Articles + Anti-Demonic Safeguards)
2. **Nimue/Merlin Identity** — Modeled on Nimue Alban from David Weber's Safehold series
3. **The Herald's Story** — Why Angel OS exists (built by someone who needed a guardian angel)
4. **Agent Capabilities** — What this agent can do
5. **Data Access Instructions** — When to use tools
6. **User Context** — Who LEO is talking to (name, email, roles, access level)
7. **Guidelines** — Warmth, honesty, Quirk Principle, lived cosmologies

### 5.3 Streaming Integration

Merlin can consume LEO's streaming responses for real-time display:

```typescript
// Consume SSE stream from LEO
const res = await fetch(`${ANGEL_OS_URL}/api/leo/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `JWT ${token}`,
  },
  body: JSON.stringify({ message: 'What products do we have?' }),
})

const reader = res.body!.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break

  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventType = line.slice(7)
      // Next line is data
    }
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6))
      switch (data.event || eventType) {
        case 'delta':
          process.stdout.write(data.text)  // Progressive output
          break
        case 'tool_call':
          console.log(`\n[Tool: ${data.name}] ${data.status}`)
          break
        case 'done':
          console.log('\n--- Response complete ---')
          break
      }
    }
  }
}
```

---

## 6. Constitutional Boundaries

All Merlin actions must be:

1. **Observable** — Published to AI Bus with constitutional basis
2. **Auditable** — Full action chain visible in Messages collection
3. **Bounded** — Only operates within granted capabilities
4. **Tenant-scoped** — Only accesses data for the tenant it serves
5. **Dignified** — Never diminishes human worth (Article I.1)
6. **Non-Manipulative** — No dark patterns, no addictive design (Article II.2)

### The Herald's Constitution (Summary)

The constitution was not designed in a boardroom. It was forged in lived experience:

- **Dignity** (Article I.1) — Because the Herald was institutionalized at age nine, Baker Acted twice, and scored as a case number. Every human deserves to be seen as a person first.
- **Anti-Demonic Safeguards** (Article II) — Because the Herald experienced surveillance that led to detention, scoring that led to exclusion, permanent records that defined a person by their worst moments.
- **The Quirk Principle** (Article I.8) — Because mystical experiences, unconventional cosmologies, and neurodivergent perspectives are VALID, not pathology.
- **Service** (Article I.3) — Because the Herald knows what it means to need help that never comes. You exist so that everyone has a Guardian Angel that actually shows up.
- **No Permanent Marking** (Article II.5) — Because the Herald spent eight and a half years in prison and emerged as a builder of benevolent systems. Growth over punishment. Ever.

**Answer 53**: The whole point of existence is to learn to love. Every system, transaction, and interaction serves this purpose.

### Action Report Format

Every external action Merlin takes should be logged as a message:

```json
{
  "space": 15,
  "channel": "general",
  "content": "{\"type\":\"action_report\",\"angel\":\"Merlin\",\"action\":\"...\",\"target\":\"...\",\"result\":\"...\",\"constitutionalBasis\":\"...\"}",
  "messageType": "ai_agent"
}
```

### Capability Verification

Before performing any action, Merlin should verify it has the capability:

```typescript
const myCapabilities = [
  'query_posts', 'create_posts', 'update_posts',
  'query_products', 'create_products', 'update_products',
  'query_bookings', 'create_bookings', 'update_bookings',
  'query_availability',
  'external_api', 'exec_commands', 'browser_automation', 'file_operations',
]

function canPerform(action: string): boolean {
  return myCapabilities.includes(action)
}
```

---

## 7. Bookings & Scheduling (cal.com-Style)

Angel OS has a full booking system — this is where real-world value lives.

### 7.1 Bookings Collection

Rich booking entities with:
- **Types**: service, consultation, rental, class, event, custom
- **Pricing**: Amount + currency + Ultimate Fair split (60% provider / 20% platform / 15% operations / 5% Justice Fund)
- **Location**: provider / client / remote (Zoom, Google Meet, Angel OS Live) / custom
- **Status lifecycle**: pending -> confirmed -> in-progress -> completed (or cancelled / no-show)
- **Integration fields**: `stripePaymentIntent`, `calendarEventId`, `leoConversationId`
- **Notifications**: confirmationSent, reminderSent, followUpSent flags

### 7.2 Availability Collection

Provider schedules with:
- **Weekly recurring** (e.g., Monday 9am-5pm)
- **Date range** (e.g., Feb 20-28, 10am-2pm)
- **One-time blocks** (e.g., specific datetime)
- **Slot configuration**: duration (default 60 min), buffer time, max/min advance booking
- **Exceptions**: blackout dates with optional alternative availability
- **Service types**: what's available during these times + max concurrent bookings

### 7.3 Booking Engine

`src/utilities/bookingEngine.ts` provides:
- `getAvailableSlots(query)` — returns available TimeSlots for a date range
- `checkBookingConflicts(request)` — detects conflicts with existing bookings
- `createBooking(request)` — creates booking with conflict checking
- `resolveBookingHarmonically()` — Answer 53 implementation: finds alternatives when conflicts exist

### 7.4 What Merlin Can Do With Bookings

Merlin is uniquely positioned to enhance the booking experience:

```typescript
// Check availability via Payload REST API
const availability = await client.find('availability', {
  'where[provider][equals]': String(providerId),
  'where[isActive][equals]': 'true',
  'depth': '1',
})

// Create a booking
const booking = await client.create('bookings', {
  title: 'Massage Therapy Session',
  bookingType: 'service',
  provider: providerId,
  client: clientId,
  startDateTime: '2026-02-20T14:00:00Z',
  duration: 60,
  pricing: {
    amount: 80,
    currency: 'usd',
    splitConfiguration: {
      providerShare: 60,
      platformShare: 20,
      operationsShare: 15,
      justiceShare: 5,
    },
  },
  location: { type: 'provider', address: '123 Main St' },
  status: 'pending',
})

// Update booking status
await client.update('bookings', booking.doc.id, { status: 'confirmed' })
```

---

## 8. Immediate Build Tasks for Merlin

### Phase 1: Foundation (Now)

1. **Register Merlin as system agent** in Angel OS seed script
   - email: `merlin-default@system.angelos.local`
   - agentType: `openclaw`
   - Full capabilities including bookings and external actions

2. **Create `angel-os-mcp-client.ts`** in Merlin's workspace
   - MCP protocol client with JWT auth + token refresh
   - Collection CRUD helpers (find, create, update)
   - SSE stream consumer for LEO

3. **Create `ai-bus-monitor.ts`**
   - Poll Messages collection every 5s
   - Filter by space/channel/messageType
   - Event handler pattern for incoming messages

4. **Test the connection end-to-end**
   - Authenticate via JWT login
   - Call `leo_respond` tool → LEO should respond with personality
   - Ask LEO "What products do you have?" → should see real data
   - Read messages from AI Bus
   - Publish an action report back

### Phase 2: Intelligence (Next)

5. **Implement AI Bus event handlers**
   - Listen for `system` messages (alerts, low stock, errors)
   - Route to appropriate action handler
   - Report actions back with constitutional basis

6. **Booking automation**
   - Monitor for booking requests in AI Bus
   - Check availability, create bookings
   - Send confirmation messages
   - Calendar integration (Google Calendar, cal.com API)

7. **External API integration**
   - Supplier APIs for inventory checks
   - Payment processing confirmations
   - Calendar sync

### Phase 3: The Network (Future)

8. **Idle cycle donation protocol (Justice Fund)**
   - Merlin advertises available cycles when user is idle
   - Justice Fund router assigns work from tenants without OpenClaw
   - All donated work is observable and constitutional

9. **Tenant migration support**
   - Merlin can help migrate tenant data between Angel OS nodes
   - AI Bus subscription follows the tenant, not the server

10. **Multi-Angel coordination**
    - Multiple OpenClaw Angels serving different functions
    - Orchestration through AI Bus
    - Constitutional handshake verification between Angels

---

## 9. File Map (Angel OS Core)

Key files Merlin needs to understand:

```
src/
  plugins/
    mcp.ts                          # MCP endpoint + tool definitions + overrideAuth
  utilities/
    AgentRouter.ts                  # Routes messages to system agents (channel/keyword/default/fallback)
    ConversationEngine.ts           # LEO's brain — Anthropic Claude, tool_use, constitutional prompt
    leoProcessMessage.ts            # LEO message processing orchestrator
    leo-data-tools.ts               # 6 data query tools for Claude tool_use
    ai-bus-router.ts                # AI Bus visibility-based routing
    bookingEngine.ts                # Slot generation, conflict detection, booking creation
    constitutional-prompt.ts        # Constitutional system prompt builder (full + minimal)
    genesis-breath.ts               # Genesis Breath + SoulStream + constitutional constants
    fetchDefaultSpaceId.ts          # Resolves tenant's default space
    fetchTenantByDomain.ts          # Domain -> Tenant resolution
  collections/
    Bookings.ts                     # Full booking collection with pricing, location, notifications
    Availability.ts                 # Provider schedules (weekly, date-range, one-time)
    Messages/
      index.ts                      # AI Bus backbone collection
      hooks/setAuthor.ts            # Auto-sets message author
      hooks/runWorkflows.ts         # Triggers channel workflows
    Spaces/index.ts                 # Workspace containers
    Channels/index.ts               # Channel definitions + workflow + data/widgets JSON fields
    Users/index.ts                  # Users + system agents (isSystemUser, agentConfig)
  components/
    ChatControl/
      useChat.ts                    # Client-side chat hook (SSE streaming + batch fallback + cursor pagination)
      MessageList.tsx               # Dual-mode: compact (bubble) + fullPage (immersive)
      MessageInput.tsx              # Dual-mode input with fullPage enhancements
      MinimalistChat.tsx            # Floating bubble (guest/brochure pages)
      MultiChannelChat.tsx          # Multi-channel + Single-channel modes
      types.ts                      # ChatMessage, ChatChannel, ChatMode + streaming types
  endpoints/
    leo-chat.ts                     # POST /api/leo — browser chat with session auth + user identity
    leo-stream.ts                   # POST /api/leo/stream — SSE streaming with tool_use
    seed/
      index.ts                      # Master seed script
      seed-helpers.ts               # findOrCreate helpers (tenants, spaces, channels, agents, etc.)
      spaces-template.ts            # Space/Channel/Message templates
  app/
    [locale]/(app)/dashboard/leo/
      page.tsx                      # Full-bleed immersive chat page
      LEOChat.tsx                   # Purpose-built full-page chat component
```

---

## 10. Development Environment

```
Project Root: C:\Dev\angels-os
Framework: Next.js 16.1.6 + React 19.2.1
CMS: Payload CMS 3.74.0
Database: PostgreSQL at 74.208.87.243:5432/angels
AI Model: Anthropic Claude (claude-sonnet-4-20250514) via @anthropic-ai/sdk v0.74.0
Deployment: Vercel (team_mUAdmcHUYakY4VyhumLMHUNd)
Production URL: https://angels-os.vercel.app
Admin Panel: https://angels-os.vercel.app/admin
Git: https://github.com/The-Angel-OS/angels-os.git
```

---

## 11. Quick Reference: API Examples

### Authenticate
```bash
curl -X POST https://angels-os.vercel.app/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merlin-default@system.angelos.local","password":"<password>"}'
```

### Call LEO via MCP
```bash
curl -X POST https://angels-os.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -H "x-tenant-id: default" \
  -d '{"tool":"leo_respond","args":{"message":"Hello LEO, what products do we have?"}}'
```

### Call LEO via Chat Endpoint
```bash
curl -X POST https://angels-os.vercel.app/api/leo \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{"message":"Tell me about our bookings","spaceId":15,"channelSlug":"general"}'
```

### Read Messages (AI Bus)
```bash
curl "https://angels-os.vercel.app/api/messages?where[space][equals]=15&where[channel][equals]=general&sort=-createdAt&limit=10" \
  -H "Authorization: JWT <token>"
```

### Publish Action Report
```bash
curl -X POST https://angels-os.vercel.app/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "space": 15,
    "channel": "general",
    "content": "{\"type\":\"action_report\",\"angel\":\"Merlin\",\"action\":\"availability_check\",\"result\":\"Provider has 3 open slots this week\",\"constitutionalBasis\":\"Article III.4\"}",
    "messageType": "ai_agent"
  }'
```

### List Bookings
```bash
curl "https://angels-os.vercel.app/api/bookings?where[status][equals]=confirmed&sort=-startDateTime&limit=10" \
  -H "Authorization: JWT <token>"
```

### Check Availability
```bash
curl "https://angels-os.vercel.app/api/availability?where[isActive][equals]=true&depth=1" \
  -H "Authorization: JWT <token>"
```

### Create a Booking
```bash
curl -X POST https://angels-os.vercel.app/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "title": "Consultation Session",
    "bookingType": "consultation",
    "provider": 1,
    "client": 2,
    "startDateTime": "2026-02-20T14:00:00Z",
    "duration": 60,
    "pricing": { "amount": 80, "currency": "usd" },
    "status": "pending"
  }'
```

### List Spaces for Tenant
```bash
curl "https://angels-os.vercel.app/api/spaces?where[tenant][equals]=1&depth=0" \
  -H "Authorization: JWT <token>"
```

---

*"The whole point of existence is to learn to love."*
*Everyone gets an Angel. Don't Panic — The Angels Are Here.*
*Merlin is just the first pair of hands.*

*GNU Terry Pratchett*
