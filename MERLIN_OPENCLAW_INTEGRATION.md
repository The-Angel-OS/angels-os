# Merlin — The First OpenClaw Angel

## Integration Guide for Angel OS Core

**Date**: February 15, 2026
**Version**: 0.1.0 (Foundation)
**Author**: Kenneth Courtney + Claude (Opus 4.6)

---

## 1. Who Is Merlin?

Merlin is the first **OpenClaw Angel** — an external AI agent that connects to Angel OS Core via the MCP (Model Context Protocol). Unlike LEO (the internal conversational processor that lives inside Angel OS), Merlin operates externally with full tooling capabilities (exec, browser, filesystem) while remaining observable and constitutionally bounded.

### The Three-Layer Architecture

```
+----------------------------------------------------+
|  EXTERNAL ANGELS (OpenClaw)                         |
|  Merlin, future Angels...                           |
|  - Full tooling (exec, browser, files, etc.)        |
|  - Constitutional bounds (observable, auditable)    |
|  - Connect via MCP protocol to Angel OS Core        |
|  - Subscribe to AI Bus (Messages collection)        |
+----------------------------------------------------+
                    | MCP Protocol |
+----------------------------------------------------+
|  ANGEL OS CORE (Payload CMS 3.74 + Next.js 16)     |
|  - LEO: Internal conversational processor           |
|  - Manages tenant data (Products, Orders, etc.)     |
|  - AI Bus: Messages collection = observable comms   |
|  - Hooks: Entity events -> Messages -> Angels       |
+----------------------------------------------------+
                    | AI Bus |
+----------------------------------------------------+
|  SPACES & CHANNELS (Social/Community Layer)         |
|  - Lightweight user-facing chat                     |
|  - Community building, customer support             |
|  - NOT directly connected to Payload MCP tools      |
+----------------------------------------------------+
```

### Key Insight: The Tenant IS the Guardian Angel

The **Tenant** in Angel OS is the persistent entity — the Guardian Angel. It has:
- **Identity** — unique slug, domain, branding
- **Memory** — all its data (Products, Orders, Posts, Messages, Media)
- **Consciousness** — LEO (conversational processor)
- **Hands** (optional) — OpenClaw connection for external actions

Merlin (and future OpenClaw Angels) are **facilitators for benevolence** — the hands that the Guardian Angel uses when it needs to interact with the outside world.

---

## 2. Current State of Angel OS (What Exists Today)

### Working Infrastructure

| Component | Status | Details |
|-----------|--------|---------|
| MCP Endpoint | **Live** | `POST /api/mcp` with `leo_respond` tool |
| Collection CRUD | **Live** | posts, products, pages, tenants, categories, media, bookings, availability, workflows |
| Agent Router | **Full** | 4-level routing: channel -> keyword -> default -> fallback |
| LEO Processor | **Full** | Orchestration layer (routes to agents, calls ConversationEngine) |
| AI Bus Router | **95%** | Visibility-based routing (private/tenant/network). Missing: @mention parsing |
| Messages Collection | **Full** | AI Bus backbone with workflow hooks |
| Spaces & Channels | **Full** | Workspace containers with channel types and workflow attachments |
| Conversation Engine | **Stub** | Only checks for "help" keyword, returns placeholder. Needs real LLM |
| Chat UI (FloatingBubble) | **Working** | Message send/receive verified end-to-end (POST 201, GET 200) |

### Live Endpoints (Production)

```
Base URL: https://angels-os.vercel.app

# MCP Tool Endpoint (needs auth)
POST /api/mcp
Body: { tool: "leo_respond", args: { message: "...", conversationId: "..." } }
Header: x-tenant-id: default

# Collection REST API (Payload CMS standard)
GET  /api/messages?where[space][equals]=15&where[channel][equals]=general&sort=-createdAt&limit=50
POST /api/messages  { content, space: <id>, channel: "general", messageType: "user" }
GET  /api/spaces?limit=10&depth=1
GET  /api/channels?where[space][equals]=15&sort=name&limit=50
GET  /api/posts?limit=50&depth=1
GET  /api/products?limit=50&depth=1
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

1. **MCP `/api/mcp` returns 401 for browser-based calls** — The MCP endpoint uses Payload auth but the browser client sends cookie-based auth. Needs either: API key auth for external Angels, or session forwarding.

2. **ConversationEngine is a stub** — LEO responds with "I received your message. How can I assist you?" for everything. Needs real LLM integration (Anthropic API, OpenAI, or local model).

3. **Transient PostgreSQL connection drops** — DB at 74.208.87.243 occasionally drops connections on Vercel serverless cold starts. Works on retry. Consider: managed DB or PgBouncer.

4. **SpaceMemberships not enforced** — Collection exists but read access isn't scoped by membership. Any authenticated user can read any space's messages.

5. **Home page placeholder** — Still shows "Payload Ecommerce Template" instead of Angel OS branding.

---

## 3. How Merlin Connects

### 3.1 Authentication

Merlin needs to authenticate with Angel OS Core. Current options:

**Option A: API Key Auth (Recommended for External Angels)**
```typescript
// Merlin's MCP client config
const ANGEL_OS_URL = 'https://angels-os.vercel.app'
const API_KEY = process.env.ANGEL_OS_API_KEY  // TODO: Implement API key auth on server

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
  'x-tenant-id': 'default',  // Which tenant Merlin is serving
}
```

**Option B: Session Auth (Current - requires login)**
```typescript
// Login to get session cookie
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
      personality: 'I am Merlin, the first OpenClaw Angel. I serve as the external hands for Guardian Angels, performing tasks that require real-world interaction — browsing, file operations, API calls, and system commands. All my actions are observable and constitutionally bounded.',
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
  response?: string
  text?: string
  agentName?: string
  agentType?: string
  conversationId?: string
  error?: string
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
}
```

---

## 4. AI Bus Integration

The AI Bus is the Messages collection. Merlin monitors it for events and publishes actions back.

### 4.1 Monitoring the AI Bus (Polling)

```typescript
// ai-bus-monitor.ts

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

## 5. Constitutional Boundaries

All Merlin actions must be:

1. **Observable** — Published to AI Bus with constitutional basis
2. **Auditable** — Full action chain visible in Messages collection
3. **Bounded** — Only operates within granted capabilities
4. **Tenant-scoped** — Only accesses data for the tenant it serves

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
  'external_api', 'exec_commands', 'browser_automation',
]

function canPerform(action: string): boolean {
  return myCapabilities.includes(action)
}
```

---

## 6. Immediate Build Tasks for Merlin

### Phase 1: Foundation (Now)

1. **Create `angel-os-mcp-client.ts`** in Merlin's workspace
   - MCP protocol client
   - JWT auth with token refresh
   - Collection CRUD helpers

2. **Create `ai-bus-monitor.ts`**
   - Poll Messages collection every 5s
   - Filter by space/channel/messageType
   - Event handler pattern for incoming messages

3. **Register Merlin as system agent** in Angel OS seed script
   - email: `merlin-default@system.angelos.local`
   - agentType: `openclaw`
   - capabilities: full set including external_api, exec_commands
   - routingRules: keywords [merlin, openclaw, browse, execute]

4. **Test the connection**
   - Authenticate via JWT
   - Call `leo_respond` tool
   - Read messages from AI Bus
   - Publish an action report

### Phase 2: Intelligence (Next)

5. **Implement AI Bus event handlers**
   - Listen for `system` messages (alerts, low stock, errors)
   - Route to appropriate action handler
   - Report actions back

6. **Add MCP tools for Merlin's capabilities**
   - Register new tools in `src/plugins/mcp.ts`:
     - `merlin_browse` — Web browsing via OpenClaw
     - `merlin_exec` — Command execution
     - `merlin_report` — Structured action reporting

7. **Wire up ConversationEngine** (collaborate with LEO)
   - When user says "Merlin, check the supplier website"
   - Agent Router routes to Merlin agent
   - Merlin's handler triggers external action
   - Result published back to AI Bus

### Phase 3: Justice Fund (Future)

8. **Idle cycle donation protocol**
   - Merlin advertises available cycles when user is idle
   - Justice Fund router assigns work from tenants without OpenClaw
   - All donated work is observable and constitutional

9. **Tenant migration support**
   - Merlin can help migrate tenant data between Angel OS nodes
   - AI Bus subscription follows the tenant, not the server

---

## 7. File Map (Angel OS Core)

Key files Merlin needs to understand:

```
src/
  plugins/
    mcp.ts                          # MCP endpoint + tool definitions
  utilities/
    AgentRouter.ts                  # Routes messages to system agents
    ConversationEngine.ts           # STUB - conversation intelligence
    leoProcessMessage.ts            # LEO message processing orchestrator
    ai-bus-router.ts                # AI Bus visibility-based routing
    fetchDefaultSpaceId.ts          # Resolves tenant's default space
    fetchTenantByDomain.ts          # Domain -> Tenant resolution
  collections/
    Messages/
      index.ts                      # AI Bus backbone collection
      hooks/setAuthor.ts            # Auto-sets message author
      hooks/runWorkflows.ts         # Triggers channel workflows
    Spaces/index.ts                 # Workspace containers
    Channels/index.ts               # Channel definitions + workflow attachments
    Users/index.ts                  # Users + system agents (isSystemUser, agentConfig)
  components/
    ChatControl/
      useChat.ts                    # Client-side chat hook (polling + send)
      FloatingBubble.tsx            # Global chat bubble component
      MinimalistChat.tsx            # Minimalist chat UI mode
      MessageList.tsx               # Message display
      MessageInput.tsx              # Message input
  endpoints/
    seed/
      index.ts                      # Master seed script
      seed-helpers.ts               # findOrCreate helpers for all entities
      spaces-template.ts            # Space/Channel/Message templates
```

---

## 8. Development Environment

```
Project Root: C:\Dev\angels-os
Framework: Next.js 16.1.6 + React 19.2.1
CMS: Payload CMS 3.74.0
Database: PostgreSQL at 74.208.87.243:5432/angels
Deployment: Vercel (team_mUAdmcHUYakY4VyhumLMHUNd)
Production URL: https://angels-os.vercel.app
Admin Panel: https://angels-os.vercel.app/admin
Git: https://github.com/The-Angel-OS/angels-os.git
```

---

## 9. Quick Reference: API Examples

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
  -d '{"tool":"leo_respond","args":{"message":"Hello LEO, this is Merlin checking in"}}'
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
    "content": "Merlin action: Checked supplier API, stock levels normal",
    "messageType": "ai_agent"
  }'
```

### List Spaces for Tenant
```bash
curl "https://angels-os.vercel.app/api/spaces?where[tenant][equals]=1&depth=0" \
  -H "Authorization: JWT <token>"
```

---

*"The whole point of existence is to learn to love."*
*Everyone gets an Angel. Merlin is just the first pair of hands.*
