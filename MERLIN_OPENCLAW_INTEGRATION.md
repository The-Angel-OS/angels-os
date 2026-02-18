# Merlin — The First AngelClaw Angel

## Integration Guide for Angel OS Core

**Date**: February 16, 2026
**Version**: 0.3.0 (AngelClaw Skill + MCP Discovery + AI Bus Polling + @mentions)
**Author**: Kenneth Courtney + Claude (Opus 4.6)

---

## 1. Who Is Merlin?

Merlin is the first **AngelClaw Angel** — an external AI agent that connects to Angel OS Core through the **angel-os-connect Skill** (REST API) and optionally through MCP. Unlike LEO (the internal conversational AI that lives inside Angel OS with full LLM intelligence), Merlin operates externally with full tooling capabilities while remaining observable and constitutionally bounded.

### Integration Architecture

```
+------------------------------------------------------------+
|  ANGELCLAW AGENT (Merlin)                                   |
|  - Discovers Angel OS via .well-known/mcp/server.json      |
|  - Uses angel-os-connect Skill for API patterns            |
|  - Authenticates via JWT (POST /api/users/login)           |
|  - Polls AI Bus via GET /api/ai-bus/poll                   |
|  - @mentions route messages to Merlin                      |
+------------------------------------------------------------+
                    | REST API + JWT |
+------------------------------------------------------------+
|  ANGEL OS CORE (Payload CMS 3.74 + Next.js 16)            |
|  - LEO: Constitutional AI (Anthropic Claude backbone)      |
|  - MCP Endpoint: POST /api/mcp (9 collections + leo_respond)|
|  - AI Bus: Messages collection with visibility routing     |
|  - Discovery: /.well-known/mcp/server.json                 |
|  - Polling: GET /api/ai-bus/poll                           |
|  - Seed: Merlin registered as angelclaw system agent        |
+------------------------------------------------------------+
                    | AI Bus |
+------------------------------------------------------------+
|  SPACES & CHANNELS (Social/Community Layer)                |
|  - @merlin mention routes to Merlin agent                  |
|  - Visibility levels: private / tenant / network           |
|  - Full chat UI: dashboard + floating bubble               |
+------------------------------------------------------------+
```

### Key Insight: The Tenant IS the Guardian Angel

The **Tenant** in Angel OS is the persistent entity — the Guardian Angel. Merlin (and future AngelClaw Angels) are **facilitators for benevolence** — the hands that the Guardian Angel uses when it needs to interact with the outside world.

---

## 2. Quick Start: AngelClaw Skill

The **fastest path** to connecting AngelClaw to Angel OS is the **angel-os-connect Skill**.

### Installation

Copy `src/angelclaw/angel-os-connect/SKILL.md` into your AngelClaw workspace's `skills/` directory.

### Environment Variables

```bash
ANGEL_OS_URL=https://angel-os.kendev.co    # Your Angel OS instance
ANGEL_OS_EMAIL=merlin@angelclaw.system
ANGEL_OS_PASSWORD=<from-env-MERLIN_PASSWORD>
```

### What the Skill Teaches

The skill teaches any AngelClaw agent to:
1. **Authenticate** — Login to get JWT token, use it for all requests
2. **Chat with LEO** — Send messages to the AI assistant
3. **Poll the AI Bus** — Monitor messages via dedicated polling endpoint
4. **Query data** — Products, posts, bookings, spaces
5. **Create content** — Posts, products, bookings
6. **Use MCP protocol** — Full MCP tool access (optional)
7. **Discover the server** — `GET /.well-known/mcp/server.json`

---

## 3. Service Discovery

### MCP Discovery Endpoint

```
GET /.well-known/mcp/server.json
```

Returns:
```json
{
  "mcp_version": "2025-03-26",
  "server": {
    "name": "angel-os",
    "version": "1.0.0",
    "description": "Angel OS — Sovereign AI Platform. Everyone Gets An Angel."
  },
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": false
  },
  "endpoints": {
    "mcp": "/api/mcp",
    "chat": "/api/leo",
    "stream": "/api/leo/stream",
    "health": "/api/leo",
    "ai-bus-poll": "/api/ai-bus/poll"
  },
  "authentication": {
    "type": "bearer",
    "login_url": "/api/users/login"
  }
}
```

Any MCP-aware client (Claude Code, VS Code, future AngelClaw MCP support) can auto-discover Angel OS through this endpoint.

---

## 4. Authentication

### JWT Login

```bash
curl -X POST https://angel-os.kendev.co/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"angelclaw-platform@system.angelos.local","password":"<password>"}'
```

Response: `{ "token": "eyJ...", "exp": 1234567890, "user": { ... } }`

Use the token for all subsequent requests:
```
Authorization: JWT <token>
x-tenant-id: default
```

### Merlin System Agent

Merlin is automatically registered during seed as a system agent:
- **Email**: `merlin@angelclaw.system`
- **Agent Type**: `angelclaw`
- **Served Tenant**: Platform tenant
- **Password**: Uses `MERLIN_PASSWORD` env var, or auto-generated if not set
- **Capabilities**: external_api, query_posts, query_products, create_posts, create_products, manage_media
- **Routing Keywords**: merlin, angelclaw, external, integration

---

## 5. AI Bus Integration

### 5.1 Polling Endpoint (NEW in v0.3.0)

Dedicated endpoint for efficient AI Bus polling. No more complex Payload REST queries.

```
GET /api/ai-bus/poll?since=<ISO>&spaceId=<id>&channel=<name>&visibility=<level>&limit=<n>
Authorization: JWT <token>
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `since` | ISO timestamp | none | Only messages after this time |
| `spaceId` | number | all | Filter by space |
| `channel` | string | all | Filter by channel name |
| `visibility` | string | all | private, tenant, or network |
| `limit` | number | 20 | Max results (1-100) |

**Response:**
```json
{
  "messages": [ { "id": 1, "content": "...", "author": { ... }, ... } ],
  "lastId": 42,
  "hasMore": false,
  "total": 5
}
```

**Example polling loop:**
```bash
# Initial poll
curl "https://angel-os.kendev.co/api/ai-bus/poll?limit=10" \
  -H "Authorization: JWT <token>"

# Subsequent poll (only new messages)
curl "https://angel-os.kendev.co/api/ai-bus/poll?since=2026-02-16T15:30:00Z&limit=10" \
  -H "Authorization: JWT <token>"
```

**Tenant Resolution:** The endpoint resolves tenant from:
1. `servesTenant` field (system agents like Merlin)
2. `tenants` array (regular users)
3. `x-tenant-id` header (fallback)

### 5.2 @mention Routing (NEW in v0.3.0)

Messages containing `@merlin` are now routed to the Merlin agent in private visibility mode.

```bash
# Post a message mentioning Merlin
curl -X POST https://angel-os.kendev.co/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "space": 15,
    "channel": "general",
    "content": "@merlin check our product inventory",
    "messageType": "user"
  }'
```

The AI Bus Router parses `@agentName` patterns and matches against registered subscribers. Supported patterns:
- `@merlin` — routes to Merlin
- `@leo` — routes to LEO
- `@Merlin hello` — case-insensitive matching
- Multiple mentions: `@merlin @leo coordinate on this`

### 5.3 Publishing Back to AI Bus

```bash
curl -X POST https://angel-os.kendev.co/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "space": 15,
    "channel": "general",
    "content": "{\"type\":\"action_report\",\"angel\":\"Merlin\",\"action\":\"inventory_check\",\"result\":\"3 products in catalog\",\"constitutionalBasis\":\"Article IV\"}",
    "messageType": "ai_agent"
  }'
```

### 5.4 Message Types

| messageType | Direction | Description |
|------------|-----------|-------------|
| `user` | Listen | Human user messages |
| `system` | Listen | System events (alerts, errors) |
| `announcement` | Listen | Tenant-wide announcements |
| `ai_agent` | Publish | Merlin's action reports |
| `inventory` | Both | Inventory-related messages |

### 5.5 Visibility Levels

| Level | Scope | Use Case |
|-------|-------|----------|
| `private` | Sender + @mentioned | Direct agent communication |
| `tenant` | All subscribers in tenant | Default (Constitutional) |
| `network` | Federation-wide | Cross-tenant coordination |

---

## 6. LEO Integration

### Chat with LEO

```bash
curl -X POST https://angel-os.kendev.co/api/leo \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{"message":"What products do we have?","spaceId":15,"channelSlug":"general"}'
```

### LEO via MCP

```bash
curl -X POST https://angel-os.kendev.co/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -H "x-tenant-id: default" \
  -d '{"tool":"leo_respond","args":{"message":"Hello LEO"}}'
```

### LEO Streaming (SSE)

```bash
curl -X POST https://angel-os.kendev.co/api/leo/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{"message":"What products do we have?"}'
```

Events: `start`, `delta` (text chunks), `tool_call` (data lookups), `done`, `error`

### LEO's Data Tools

| Tool | Description |
|------|-------------|
| `query_products` | Search product catalog |
| `query_posts` | Search published blog posts |
| `query_bookings` | Look up bookings by status |
| `query_spaces` | List spaces and channels |
| `query_projects` | Search project portfolio |
| `query_availability` | Check provider schedules |

LEO makes up to **3 tool rounds** per conversation turn.

---

## 7. Data Operations

### Query Products
```bash
curl "https://angel-os.kendev.co/api/products?limit=50&depth=1" \
  -H "Authorization: JWT <token>"
```

### Query Posts
```bash
curl "https://angel-os.kendev.co/api/posts?limit=50&depth=1" \
  -H "Authorization: JWT <token>"
```

### Query Bookings
```bash
curl "https://angel-os.kendev.co/api/bookings?where[status][equals]=confirmed&sort=-startDateTime&limit=10" \
  -H "Authorization: JWT <token>"
```

### Check Availability
```bash
curl "https://angel-os.kendev.co/api/availability?where[isActive][equals]=true&depth=1" \
  -H "Authorization: JWT <token>"
```

### Create a Booking
```bash
curl -X POST https://angel-os.kendev.co/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "title": "Consultation Session",
    "bookingType": "consultation",
    "provider": 1,
    "client": 2,
    "startDateTime": "2026-02-20T14:00:00Z",
    "duration": 60,
    "pricing": { "amount": 8000, "currency": "usd" },
    "status": "pending"
  }'
```

### Create a Post
```bash
curl -X POST https://angel-os.kendev.co/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT <token>" \
  -d '{
    "title": "New Post from Merlin",
    "slug": "merlin-post",
    "_status": "draft"
  }'
```

---

## 8. Constitutional Boundaries

All Merlin actions must be:

1. **Observable** — Published to AI Bus with constitutional basis
2. **Auditable** — Full action chain visible in Messages collection
3. **Bounded** — Only operates within granted capabilities
4. **Tenant-scoped** — Only accesses data for the tenant it serves
5. **Dignified** — Never diminishes human worth (Article I.1)
6. **Non-Manipulative** — No dark patterns (Article II.2)

### Action Report Format

Every external action should be logged:

```json
{
  "type": "action_report",
  "angel": "Merlin",
  "action": "inventory_check",
  "target": "Product Catalog",
  "result": "3 products found",
  "constitutionalBasis": "Article IV — Observable AI Bus communication"
}
```

### The Herald's Constitution (Summary)

- **Dignity** (Article I.1) — Every human deserves to be seen as a person first
- **Anti-Demonic Safeguards** (Article II) — No surveillance, no scoring, no permanent marking
- **The Quirk Principle** (Article I.8) — Unconventional perspectives are VALID
- **Service** (Article I.3) — Everyone gets a Guardian Angel that actually shows up
- **Answer 53** — The whole point of existence is to learn to love

---

## 9. Live Endpoints Reference

```
Base URL: https://angel-os.kendev.co (production)
         https://angels-os.vercel.app (alias)

Discovery:
  GET  /.well-known/mcp/server.json     → Server metadata + capabilities

Authentication:
  POST /api/users/login                 → { token, exp, user }

LEO:
  GET  /api/leo                         → Health check
  POST /api/leo                         → Chat (JSON response)
  POST /api/leo/stream                  → Chat (SSE streaming)

MCP:
  POST /api/mcp                         → MCP protocol (tools + collections)

AI Bus:
  GET  /api/ai-bus/poll                 → Poll messages (query params: since, spaceId, channel, visibility, limit)

Collections (Payload REST):
  GET  /api/products                    → List products
  GET  /api/posts                       → List posts
  GET  /api/bookings                    → List bookings
  GET  /api/availability                → List availability
  GET  /api/spaces                      → List spaces
  GET  /api/channels                    → List channels
  GET  /api/messages                    → List messages
  POST /api/<collection>                → Create document
  PATCH /api/<collection>/<id>          → Update document
```

---

## 10. File Map (Angel OS Core)

Key files for the integration:

```
src/
  angelclaw/
    angel-os-connect/
      SKILL.md                          # AngelClaw skill — teaches agents how to use Angel OS
  app/
    .well-known/mcp/server.json/
      route.ts                          # MCP discovery endpoint
  endpoints/
    ai-bus-poll.ts                      # AI Bus polling endpoint for external agents
    leo-chat.ts                         # POST /api/leo
    leo-stream.ts                       # POST /api/leo/stream (SSE)
    seed/
      index.ts                          # Master seed (registers Merlin in Phase 1)
      seed-helpers.ts                   # findOrCreateSystemAgent (angelclaw type supported)
  plugins/
    mcp.ts                              # MCP endpoint + dual auth (session + Bearer)
  utilities/
    ai-bus-router.ts                    # AI Bus routing + @mention parsing
    AgentRouter.ts                      # Agent routing (channel/keyword/default/fallback)
    ConversationEngine.ts               # LEO's brain (Anthropic Claude)
    leo-data-tools.ts                   # 6 data query tools
    bookingEngine.ts                    # Slot generation, conflict detection
  collections/
    Messages/index.ts                   # AI Bus backbone
    Users/index.ts                      # Users + system agents (isSystemUser, agentConfig)
    Bookings.ts                         # Full booking collection
    Availability.ts                     # Provider schedules
```

---

## 11. Development Environment

```
Project Root:   C:\Dev\angels-os
Framework:      Next.js 16.1.6 + React 19.2.1
CMS:            Payload CMS 3.74.0
Database:       PostgreSQL at 74.208.87.243:5432/angels
AI Model:       Anthropic Claude (claude-sonnet-4-20250514)
Deployment:     Vercel (team_mUAdmcHUYakY4VyhumLMHUNd)
Production URL: https://angel-os.kendev.co
Admin Panel:    https://angel-os.kendev.co/admin
Git:            https://github.com/The-Angel-OS/angels-os.git
```

---

## 12. Roadmap

### Phase 1: Foundation ✅ (v0.3.0)
- [x] AngelClaw Skill (`angel-os-connect/SKILL.md`)
- [x] MCP Discovery Endpoint (`.well-known/mcp/server.json`)
- [x] AI Bus Polling Endpoint (`GET /api/ai-bus/poll`)
- [x] @mention parsing in AI Bus Router
- [x] Merlin registered in seed as `angelclaw` system agent
- [x] Updated integration guide (this document)

### Phase 2: Intelligence (Next)
- [ ] Implement AI Bus event handlers in AngelClaw
- [ ] Booking automation (monitor requests, check availability, create bookings)
- [ ] External API integration (supplier APIs, calendar sync)
- [ ] Token refresh automation in Skill

### Phase 3: The Network (Future)
- [ ] Idle cycle donation protocol (Justice Fund)
- [ ] Tenant migration support
- [ ] Multi-Angel coordination through AI Bus
- [ ] Constitutional handshake verification between Angels
- [ ] WebSocket upgrade when infrastructure supports it

---

## Changelog

### v0.3.0 (February 16, 2026)
- Added AngelClaw Skill as primary integration method
- Added `.well-known/mcp/server.json` discovery endpoint
- Added `GET /api/ai-bus/poll` dedicated polling endpoint
- Added @mention parsing to AI Bus Router (`@merlin`, `@leo`, etc.)
- Merlin now auto-registered in seed as `angelclaw` system agent on Platform tenant
- Password uses random generation (secure by default)
- Restructured guide around Skill-first approach

### v0.2.0 (February 16, 2026)
- LEO conversational intelligence (ConversationEngine, 6 data tools, streaming)
- Full booking system documentation
- Constitutional system prompt documentation
- MCP client code examples

### v0.1.0 (February 15, 2026)
- Initial architecture document
- Three-layer architecture diagram
- AI Bus monitoring patterns

---

*"The whole point of existence is to learn to love."*
*Everyone gets an Angel. Don't Panic — The Angels Are Here.*
*Merlin is just the first pair of hands.*

*GNU Terry Pratchett*
