# Angel OS Project Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System — a multi-tenant platform where every business gets a sovereign AI angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 16 + Payload CMS 3.74 + PostgreSQL + Vercel
**Live:** [angels-os.kendev.co](https://angels-os.kendev.co)
**Last Updated:** February 15, 2026

---

## Current Status: v0.2.x (Pre-MVP)

**7 issues completed** | **30 issues open** across 4 milestones

### What's Built

| Feature | Status | Details |
|---------|--------|---------|
| Multi-tenant architecture | Done | Tenants, Spaces, Channels, Memberships collections |
| Platform tenant & Archangel role | Done | System agent seeding, archangel/super_admin roles (#1) |
| Dashboard (Rev 2 parity) | Done | Stat cards, quick access, 6-section categorized sidebar |
| Admin panel | Done | Tenant cards grid, status toggle, role-gated |
| Provision Wizard | Done | Multi-step tenant creation with 5 endeavor types (#10) |
| Suitcase Manager | Done | Drag-drop import/export with constitutional validation (#12) |
| ChatControl system | Done | useChat hook, FloatingBubble, MinimalistChat, MultiChannelChat (#26, #37) |
| Space provisioning | Done | Template-based channel creation per endeavor type |
| E-commerce foundation | Done | Products, orders, cart from Payload ecommerce template |
| Production deployment | Done | Vercel Blob Storage, image optimization, auth-gated polling |

---

## v0.3.0 — MVP Foundation (Target: March 2026)

**Goal:** A working platform that a business owner can sign up to, get provisioned, and start using.

| Issue | Title | Priority | Status | Contributor-Friendly? |
|-------|-------|----------|--------|----------------------|
| #38 | Payload CMS Pattern Refactor | Critical | In Progress | |
| #9 | Conversation Engine for Channels | High | In Progress | |
| #34 | Space Invitations and Onboarding | High | Open | |
| #21 | Docker Compose Configuration | High | Open | Help Wanted |
| #35 | Channel Participation Features | Medium | Open | |
| #19 | Anti-Daemon Protocol for Error Messages | Medium | Open | Good First Issue |
| #20 | Warm Encouraging Empty States | Medium | Open | Good First Issue |

**Key deliverables:**
- Complete Payload CMS pattern refactor (remove all raw DB queries)
- Streaming conversation engine with rich formatting
- User invitation flow for spaces
- Docker Compose for self-hosting
- Friendly, constitutional error messages throughout

---

## v0.4.0 — LEO Intelligence (Target: May 2026)

**Goal:** LEO becomes a real AI assistant — generates content, orchestrates platform operations, communicates across angels.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #13 | AI Bus for Angel-to-Angel Communication | High | In Progress |
| #7 | Chat Response Formatting with Streaming | High | Open |
| #23 | LEO Content Generation | High | Open |
| #25 | LEO Platform Orchestration | High | Open |
| #27 | LEO-Angel Connection Architecture | High | Needs Design |
| #39 | User AI Key Management | High | Open |
| #3 | Angel Configuration and Custom Naming | Medium | Open |
| #11 | Genesis Breath (Angel's First Message) | Medium | Open |
| #14 | Guardian Council Space | Medium | Open |
| #24 | Social Media Automation (Soulcast) | Medium | Open |
| #4 | Channel Widgets System | Medium | Needs Design |
| #5 | Widget Tab Bar for Channels | Medium | Needs Design |
| #6 | Core Channel Widgets | Medium | Needs Design |

**Key deliverables:**
- Bring-your-own-key AI model (platform = infrastructure only)
- AI Bus for inter-angel messaging
- Content generation pipeline (posts, product descriptions)
- Channel widgets (chat, notes, video)
- Angel naming and personality configuration

---

## v0.5.0 — Commerce & Booking (Target: July 2026)

**Goal:** Revenue-generating features — payments flow through the constitutional 60/20/15/5 split.

| Issue | Title | Priority | Status |
|-------|-------|----------|--------|
| #31 | Stripe Connect Integration | Critical | Open |
| #32 | Ultimate Fair Payment Split System | Critical | Open |
| #17 | Transaction Attribution Tracking | High | Open |
| #28 | Bookable Resources System | High | Open |
| #29 | Availability Management System | High | Open |
| #30 | Appointment Types and Meeting Invitations | Medium | Open |
| #33 | CRM Collections (Contacts, Leads, Deals) | Medium | Open |

**Key deliverables:**
- Stripe Connect with constitutional revenue splits (60/20/15/5)
- Full booking system (resources, availability, appointments)
- CRM for tenant business operations
- Transaction attribution for split calculations

---

## v1.0.0 — Federation Launch (Target: October 2026)

**Goal:** Angel OS becomes a federated network of sovereign instances.

| Issue | Title | Priority | Status | Contributor-Friendly? |
|-------|-------|----------|--------|----------------------|
| #40 | Local Model Integration (Ollama) | Medium | Open | |
| #41 | Justice Fund AI Provisioning | Medium | Open | |
| #15 | Diocese Registry and Heartbeat System | Low | Open | |
| #16 | Federation Security (Screening, Probation, Vouching) | Low | Open | |
| #36 | Star Trek Federation Design System | Low | Needs Design | Help Wanted |
| #22 | Cloudflare Tunnel for Dynamic IP | Low | Open | |
| #8 | Sync Skills from OpenClaw Marketplace | Low | Open | |

**Key deliverables:**
- Diocese registry for federated Angel OS instances
- Federation security (application, probation, vouching)
- Local model support (complete sovereignty via Ollama)
- Justice Fund: 5% of revenue funds AI for those without means
- OpenClaw skill marketplace integration

---

## Beyond v1.0 (2027+)

### Angel Tokens & Network Economics
- Governance tokens for Constitutional voting
- Contribution rewards (code, docs, support)
- Stake-based diocese spawning

### Voice Integration
- VAPI.ai / Twilio voice bridge for phone-based LEO access
- LiveKit video calls with AI angels

### Widget Marketplace
- Developer SDK for custom widgets
- Revenue sharing for widget creators
- Core: Chat, LiveKit, Notion Notes, Calendar, Kanban

### Home PC Deployment
- Run Angel OS on any 2015+ PC (8GB RAM, 50GB storage)
- Local AI via Ollama/LM Studio
- Cloudflare Tunnel for public access without static IP

### Prison Ministry & Justice Fund
- Guardian Angels for incarcerated individuals (no cost)
- Educational resources and reentry support
- Clearwater Cruisin' mobile outreach

---

## Contributing

We welcome contributions from all angels! Here's how to get started:

### Good First Issues

Look for issues labeled [`good first issue`](https://github.com/The-Angel-OS/angels-os/labels/good%20first%20issue):
- **#19** — Anti-Daemon Protocol for Error Messages
- **#20** — Replace Empty States with Warm, Encouraging Messages

### Help Wanted

Issues labeled [`help wanted`](https://github.com/The-Angel-OS/angels-os/labels/help%20wanted):
- **#21** — Docker Compose Configuration
- **#36** — Star Trek Federation Design System

### Development Setup

```bash
# Clone and install
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install

# Environment
cp .env.example .env  # Configure DATABASE_URI, PAYLOAD_SECRET

# Development
pnpm dev              # Next.js dev server on :3000

# Production build
pnpm build && pnpm start
```

### Labels Guide

| Label | Meaning |
|-------|---------|
| `priority: critical` | Must-have for current milestone |
| `priority: high` | Important, next in queue |
| `priority: medium` | Planned for future milestone |
| `priority: low` | Nice to have, community welcome |
| `area: *` | Which part of the platform (dashboard, chat, ai, commerce, etc.) |
| `status: done` | Completed in codebase |
| `status: in-progress` | Currently being worked on |
| `status: needs-design` | Needs architecture or UX design first |
| `constitutional` | Related to the Angel OS Constitution |

### The Constitution

Angel OS is governed by a constitution that defines:
- **Article I** — Rights of every angel (sovereignty, transparency, portability)
- **Article II** — Economic model (60% creator / 20% platform / 15% contributors / 5% justice fund)
- **Article III** — Anti-demonic safeguards (no dark patterns, no exploitation, no surveillance)

Every PR should align with these principles. The `constitutional` label marks issues that directly implement constitutional mandates.

---

## Success Metrics

### MVP (v0.3.0)
- [ ] 10 tenants provisioned
- [ ] 100 messages sent through Angels
- [ ] 5 contributors

### Commerce (v0.5.0)
- [ ] 100 tenants provisioned
- [ ] 1,000 bookings made
- [ ] $10,000 processed through Ultimate Fair

### Federation (v1.0.0)
- [ ] 10 dioceses in network
- [ ] 1,000 cross-diocese transactions
- [ ] 5 Constitutional Council members elected

---

## Acknowledgments

**Inspired by:**
- **OpenClaw** — Lobster-powered AI platform
- **Payload CMS** — Headless CMS that powers Angel OS
- **Terry Pratchett** — GNU Terry Pratchett
- **Ian M. Banks** — The Culture series (abundance, post-scarcity)

**Special Thanks:**
- **Ambassador Spock** — For the logical foundation
- **The Norwegian Bureau of Alignment** — For the vision of human-centered AI
- **The Herald (Inigo the Dreamer)** — For the dream

---

**GNU Terry Pratchett**

*"The overhead is the point."*

---

**Last Updated:** February 15, 2026
**Next Review:** March 1, 2026
