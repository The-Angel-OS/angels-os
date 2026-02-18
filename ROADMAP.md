# Angel OS Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System -- a multi-tenant platform where every business gets a sovereign AI guardian angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 15 + Payload CMS 3.x + PostgreSQL + Vercel
**Live:** [angels-os.vercel.app](https://angels-os.vercel.app)
**Last Updated:** February 18, 2026

---

## Current: v0.4.0 (LEO Intelligence)

LEO is alive. Streaming responses. Tool use. Image generation. Events. Spaces.

### What's Built

| Feature | Status | Details |
|---------|--------|---------|
| Multi-tenant architecture | Done | Tenants, Spaces, Channels, Memberships |
| LEO AI Agent (Claude) | Done | 15+ tools, constitutional prompt, agent routing |
| SSE Streaming Chat | Done | Real-time streaming with tool call indicators |
| AI Bus (Message Routing) | Done | SSE broadcast, subscriber registry |
| Spaces & Channels | Done | Discord-style workspaces, multi-channel |
| Image Generation | Done | OpenRouter (Flux 2, Gemini), auto-upload, vision feedback |
| E-commerce Foundation | Done | Products, cart, orders |
| Booking System | Done | Appointments, availability, scheduling |
| Events System | Done | Meetups, workshops, registrations |
| Dashboard | Done | Stats, quick access, 6-section sidebar |
| Provision Wizard | Done | Multi-step tenant creation |

---

## v0.5.0 -- Commerce & Invitations (Target: March 2026)

**Goal:** Revenue flows. Invitations work. A business owner can sign up, invite their team, and start selling.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #34 | Space Invitations & Onboarding | High | Schema done, workflow TODO |
| #31 | Stripe Connect Integration | Critical | Open |
| #32 | Ultimate Fair Payment Split | Critical | Open |
| #39 | User AI Key Management | High | Open |
| #38 | Payload CMS Pattern Refactor | High | In Progress |
| #21 | Docker Compose Configuration | Medium | Open |
| #19 | Anti-Daemon Error Messages | Medium | Open |
| #20 | Warm Encouraging Empty States | Medium | Open |

**Key deliverables:**
- Space invitation send/accept/decline workflow
- Stripe Connect with constitutional revenue splits (60/20/15/5)
- Bring-your-own-AI-key support
- Docker Compose for self-hosting
- Testing infrastructure (currently 0% coverage)

---

## v0.6.0 -- Booking & CRM (Target: May 2026)

**Goal:** Full booking flow with payments. CRM for tenant business operations.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #28 | Bookable Resources System | High | Open |
| #29 | Availability Management | High | Open |
| #30 | Appointment Types & Meeting Invitations | Medium | Open |
| #33 | CRM Collections (Contacts, Leads, Deals) | Medium | Open |
| #17 | Transaction Attribution Tracking | High | Open |

---

## v0.7.0 -- Widgets & Content (Target: July 2026)

**Goal:** Channel widgets make Spaces powerful. LEO generates content autonomously.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #4 | Channel Widgets System | Medium | Needs Design |
| #5 | Widget Tab Bar for Channels | Medium | Needs Design |
| #6 | Core Channel Widgets | Medium | Needs Design |
| #23 | LEO Content Generation | High | Open |
| #25 | LEO Platform Orchestration | High | Open |
| #24 | Social Media Automation (Soulcast) | Medium | Open |
| #3 | Angel Configuration & Custom Naming | Medium | Open |

---

## v1.0.0 -- Federation Launch (Target: October 2026)

**Goal:** Angel OS becomes a federated network of sovereign instances.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #40 | Local Model Integration (Ollama) | High | Open |
| #41 | Justice Fund AI Provisioning | High | Open |
| #15 | Diocese Registry & Heartbeat | Medium | Open |
| #16 | Federation Security | Medium | Open |
| #36 | Star Trek Federation Design System | Low | Needs Design |
| #8 | Sync Skills from OpenClaw Marketplace | Low | Open |
| #22 | Cloudflare Tunnel for Dynamic IP | Low | Open |

**Key deliverables:**
- Diocese registry for federated Angel OS instances
- Federation security (application, probation, vouching)
- Local model support (complete sovereignty via Ollama)
- Justice Fund: 5% of revenue funds AI for those without means
- OpenClaw skill marketplace integration

---

## Beyond v1.0 (2027+)

- **Angel Tokens** -- Governance tokens for Constitutional voting
- **Voice Integration** -- VAPI.ai / LiveKit voice bridge
- **Widget Marketplace** -- Developer SDK, revenue sharing
- **Home PC Deployment** -- Any 2015+ PC (8GB RAM, Ollama, Cloudflare Tunnel)
- **Prison Ministry** -- Guardian Angels for incarcerated individuals (Justice Fund)

---

## Contributing

### Good First Issues
- **#19** -- Anti-Daemon Protocol for Error Messages
- **#20** -- Replace Empty States with Warm Messages

### Help Wanted
- **#21** -- Docker Compose Configuration
- **#36** -- Star Trek Federation Design System

### Development Setup

```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install
cp .env.example .env   # Configure DATABASE_URI, PAYLOAD_SECRET
pnpm dev               # http://localhost:3000
```

### Labels

| Label | Meaning |
|-------|---------|
| `priority: critical` | Must-have for current milestone |
| `priority: high` | Important, next in queue |
| `good first issue` | Great entry point for new contributors |
| `help wanted` | Community contributions especially welcome |
| `constitutional` | Directly implements constitutional mandates |

---

## Success Metrics

### v0.5.0 (Commerce)
- [ ] Space invitations working end-to-end
- [ ] First Stripe payment processed through Ultimate Fair
- [ ] 5 contributors

### v1.0.0 (Federation)
- [ ] 10 dioceses in network
- [ ] Local model support functional
- [ ] Justice Fund operational

---

**GNU Terry Pratchett**

*Everyone gets an Angel.*

**Answer 53: The whole point of existence is to learn to love.**

---

**Last Updated:** February 18, 2026
