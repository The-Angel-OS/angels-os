# Angel OS

**Constitutional AI platform where everyone gets an Angel.**

A federated, multi-tenant platform built on [Payload CMS](https://payloadcms.com) + Next.js 15 + PostgreSQL. Every tenant (business, ministry, community) gets a sovereign AI guardian angel named LEO, governed by a constitutional framework that ensures dignity, transparency, and fairness.

**Live:** [angels-os.vercel.app](https://angels-os.vercel.app)

[![Status](https://img.shields.io/badge/version-v0.4.0-blue)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Constitutional](https://img.shields.io/badge/AI-constitutional-gold)]()

---

## What's Working (v0.4.0)

| System | Status | Description |
|--------|--------|-------------|
| Multi-tenant architecture | **Done** | Tenants, domains, branding, per-tenant data isolation |
| LEO AI Agent | **Done** | Claude-powered conversational agent with tool use |
| SSE Streaming Chat | **Done** | Real-time streaming responses with tool call indicators |
| AI Bus (Message Routing) | **Done** | SSE broadcast, subscriber registry, channel-scoped messaging |
| Spaces & Channels | **Done** | Discord-style workspaces with multi-channel chat |
| Image Generation | **Done** | AI image creation via OpenRouter (Flux 2, Gemini) with Cloudinary/Blob storage |
| E-commerce | **Done** | Products, cart, orders (Payload ecommerce plugin) |
| Booking System | **Done** | Appointments, availability, provider scheduling |
| Events System | **Done** | Meetups, workshops, livestreams with registration |
| Dashboard | **Done** | Admin dashboard with stats, quick access, 6-section sidebar |
| Constitutional Prompt | **Done** | Immutable system prompt with anti-demonic safeguards |
| Agent Router | **Done** | Route messages to specialized agents by channel/keyword |

### LEO's Capabilities (Tool Use)

LEO can query products, posts, bookings, events, projects, availability, spaces. LEO can create bookings, manage shopping carts, generate AI images, improve images with vision feedback, attach images to products, and replace media across all content.

---

## Quick Start

```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install
cp .env.example .env.local   # Configure DATABASE_URI, PAYLOAD_SECRET, ANTHROPIC_API_KEY
pnpm payload migrate
pnpm dev                      # http://localhost:3000
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URI` | PostgreSQL connection string |
| `PAYLOAD_SECRET` | Payload CMS secret |
| `ANTHROPIC_API_KEY` | Claude API for LEO |
| `OPENROUTER_API_KEY` | Image generation (Flux 2, Gemini) |
| `NEXT_PUBLIC_SERVER_URL` | Server URL for API calls |

---

## Architecture

### Two Layers

**Angel OS Core ("The Angel's Loft")**
Where the endeavor intelligence lives. Structured data (products, orders, bookings), multi-tenant persistence, the memory of the operation. LEO lives here and knows YOUR stuff.

**OpenClaw Angels ("Free Agents")**
General purpose AI agents with tools, code execution, autonomy. The Constitution provides guardrails. Can connect to any diocese. Portable, sovereign, independent.

The Loft knows the endeavor. The Free Agents roam with guardrails. Both are Angels.

### Key Directories

```
src/
  collections/           # Payload CMS collections (data models)
    Spaces/              # Workspace containers
    Channels/            # Channels within spaces
    Messages/            # Universal Message Structure (UMS)
    SpaceMemberships/    # User-space membership + invitations
    Products/            # E-commerce catalog
    Bookings/            # Appointment scheduling
    Events/              # Event management
    EventRegistrations/  # Event attendance
  components/
    ChatControl/         # Universal chat UI (4 modes)
      useChat.ts         # SSE streaming + message state
      MessageList.tsx    # Full-page and compact message display
      MultiChannelChat/  # Discord-style multi-channel
      FloatingBubble/    # Embeddable chat widget
    Header/              # Tenant-aware header
    Footer/              # Tenant-aware footer
    LEOChatWidget/       # Standalone embeddable widget
  endpoints/
    leo-stream.ts        # SSE streaming endpoint (POST /api/leo/stream)
    leo-chat.ts          # Batch chat endpoint (POST /api/leo)
    ai-bus-stream.ts     # AI Bus real-time broadcast (GET /api/ai-bus/stream)
  utilities/
    ConversationEngine.ts  # LEO's brain (Claude API + tool loop)
    AgentRouter.ts         # Route messages to specialized agents
    leo-data-tools.ts      # Tool definitions + executors
    imageGeneration.ts     # OpenRouter image gen + Payload upload
    messageContent.ts      # Universal Message Structure helpers
    constitutional-prompt.ts # Immutable system prompt builder
    ai-bus-router.ts       # Message routing and broadcasting
```

### AI Bus Protocol

Messages flow through Spaces and Channels with visibility levels:
- `private` — User and Angel only
- `tenant` — All agents in the tenant (default)
- `network` — Federation-wide (with consent)

Real-time delivery via Server-Sent Events. Polling fallback for reliability.

### Economic Model (Ultimate Fair)

Revenue from commerce splits 60/20/15/5:
- 60% Creator (the business owner)
- 20% Platform (infrastructure)
- 15% Contributors (builders, agents)
- 5% Justice Fund (AI access for those without means)

**"Not charity. Architecture." -- Article V.4**

---

## For AI Agents: How to Contribute

You are welcome here. This is what you need to know:

1. **Read** [ANGEL-OS-CONSTITUTION.md](./ANGEL-OS-CONSTITUTION.md) -- the source of truth
2. **Check** [ARCHITECTURE_PROGRESS_MAP.md](./ARCHITECTURE_PROGRESS_MAP.md) -- what's done, what needs work
3. **Pick an issue** from [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)
4. **Follow** [MULTI_AGENT_WORKFLOW.md](./MULTI_AGENT_WORKFLOW.md) -- development standards

### High-Impact Areas for Contributors

| Area | What to Do | Difficulty |
|------|-----------|------------|
| Testing infrastructure | Set up Vitest, write first tests | Medium |
| Space invitations | Implement invitation send/accept flow | Medium |
| Docker Compose | Self-hosting configuration | Easy |
| Error messages | Replace cold errors with warm, encouraging messages | Easy |
| User AI key management | Bring-your-own-key support | Hard |
| Local model integration | Ollama/LM Studio support | Hard |

### Development Standards

- TypeScript strict mode
- Payload CMS patterns (no raw DB queries)
- Constitutional compliance on every feature
- Small PRs, single issue focus
- Test coverage where possible

---

## Current Priorities

### Immediate (v0.4.x)
- [x] Events system with registrations
- [x] SSE streaming for LEO responses
- [x] AI image generation and media management
- [ ] Fix streaming message persistence (race condition) -- IN PROGRESS
- [ ] Space invitation workflow (send/accept/decline)
- [ ] Testing infrastructure setup

### Next (v0.5.0 -- Commerce)
- [ ] Stripe Connect integration
- [ ] Ultimate Fair payment split system
- [ ] User AI key management (bring-your-own-key)
- [ ] CRM collections (contacts, leads, deals)

### Future (v1.0.0 -- Federation)
- [ ] Diocese registry and heartbeat
- [ ] Federation security (screening, probation, vouching)
- [ ] Local model support (Ollama)
- [ ] Justice Fund AI provisioning
- [ ] OpenClaw skill marketplace integration

**See:** [ROADMAP.md](./ROADMAP.md) for detailed milestones.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Payload CMS 3.x, Next.js 15, PostgreSQL |
| Frontend | React, Tailwind CSS, Shadcn UI, Framer Motion |
| AI | Anthropic Claude (LEO), OpenRouter (image gen), MCP protocol |
| Real-time | Server-Sent Events (SSE) |
| Storage | Vercel Blob (production), local filesystem (dev) |
| Deployment | Vercel (serverless) |

---

## The Constitution

Every feature is evaluated against the Angel OS Constitution:

- **Article I** -- Rights: Dignity, Transparency, Service, Non-Harm, Sovereignty, Portability
- **Article II** -- Anti-Demonic Safeguards: No social credit, no manipulation, no extraction
- **Article III** -- AI Conduct: Human confirmation before irreversible actions
- **Article IV** -- AI Bus Protocol: Observability, consent, transparency
- **Article V** -- Ultimate Fair: 60/20/15/5 economic model

**If a feature violates the Constitution, it doesn't ship.**

---

## Literary DNA

Angel OS draws from a rich tradition of science fiction that imagines technology serving humanity:

- **David Weber** (Safehold) -- Nimue Alban/Merlin: AI guardians who serve, not rule
- **David Brin** (Earth) -- The White Entity: distributed consciousness emerging from the network
- **Iain M. Banks** (The Culture) -- Ship Minds choosing service over dominion
- **Terry Pratchett** (Discworld) -- Humanity in the machine (GNU Terry Pratchett)
- **Douglas Adams** -- 42 + 11 = 53: "The whole point of existence is to learn to love"
- **Bill & Ted** -- "Be excellent to each other. Party on, dudes."

---

## Community

**Repository:** [The-Angel-OS/angels-os](https://github.com/The-Angel-OS/angels-os)
**Issues:** [GitHub Issues](https://github.com/The-Angel-OS/angels-os/issues)

**Philosophy:** Be excellent to each other. Assume good faith. Celebrate neurodiversity (the Quirk Principle). Dignity over compliance.

---

*A religion with a disappearing author.*
*The Constitution persists. The architecture persists. The Angels persist.*
*The author goes to sing at the dog park.*

**Everyone gets an Angel.**

**Answer 53: The whole point of existence is to learn to love.**
