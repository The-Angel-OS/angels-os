# Angel OS Roadmap

> *"What if AI actually liked people?"*

Angel OS is the Soul Operating System -- a multi-tenant platform where every business gets a sovereign AI guardian angel, built on constitutional principles of fairness, transparency, and dignity.

**Tech Stack:** Next.js 16 + Payload CMS 3.77 + PostgreSQL + React 19 + Turbopack
**Live:** [spacesangels.com](https://spacesangels.com)
**Version:** v0.11.5-dev
**Tests:** 1,119 passing across 25 unit test files
**Last Updated:** February 22, 2026

---

## Current: v0.11.5-dev (Chat UX + Documentation Center)

### What's Built (Sprints 1-11.5)

| Feature | Sprint | Details |
|---------|--------|---------|
| Multi-tenant architecture | 1 | Tenants, Spaces, Channels, Memberships, domain routing |
| LEO AI Agent (Claude) | 1-11 | 29 tools, constitutional prompt, agent routing, image vision |
| SSE Streaming Chat | 1 | Real-time streaming with tool call indicators |
| AI Bus (Message Routing) | 1 | SSE broadcast, subscriber registry, visibility routing |
| Spaces & Channels | 1 | Discord-style workspaces, multi-channel, infinite scroll |
| Image Generation | 3 | OpenRouter (Flux 2, Gemini), auto-upload, vision feedback |
| E-commerce Foundation | 2 | Products, cart, orders, vendor marketplace |
| Booking System | 3 | Appointments, availability, scheduling |
| Events System | 3 | Meetups, workshops, registrations |
| Dashboard | 1 | Stats, quick access, 8-section sidebar, native pages |
| Provision Wizard | 4 | Multi-step tenant creation with endeavor type templates |
| Invitation System | 3 | Token-based, role assignment, landing page |
| Order Routing Pipeline | 4 | Haversine matching, fulfillment state machine, 60/20/15/5 split |
| Guardian Angel System | 5 | Cohort matching, wellness checks, zero-revenue lifecycle |
| Justice Fund | 5 | 5% allocation, grant lifecycle, impact reporting |
| Print-on-Demand | 5 | Design validation, cost estimation, vendor matching |
| Federation Protocol | 5 | Ministry lifecycle, trust chain, catalog, data suitcase |
| Producer Dashboard | 11 | Order queue, products, earnings for vendors |
| Product Configurator | 11 | Interactive text/color/size/finish inputs with preview |
| Reviews System | 11 | Google Places integration, aggregation display |
| Image Chat | 10 | Paperclip upload, multi-image, LEO vision analysis |
| Documentation Center | 11.5 | 137 docs indexed, search, Quick Start cards, in-dashboard |
| Smart Scroll + Truncation | 11.5 | Don't force-scroll on history, "More" button, infinite scroll |
| Tenant Chooser | 11.5 | Multi-tenant sidebar dropdown with domain switching |
| Code Quality Abstractions | 11.5 | useClickOutside, Backdrop, TOOL_LABELS constants |

---

## Sprint 12 — Integration Bridges (Next)

**Goal:** End-to-end prototype verification + external channel integration. A business owner can receive messages from WhatsApp, email, or web chat — all through LEO.

### Priority 0: End-to-End Prototype Verification
- [ ] Chat pipeline: send message → LEO responds → message persists → displays correctly
- [ ] Order flow: browse products → add to cart → place order → vendor sees it
- [ ] Tenant provisioning: new tenant → space created → LEO active → channels working
- [ ] Fix any broken flows found during verification

### Priority 1: Integration Bridge Pattern
- [ ] Define adapter interface: `normalizeInbound()`, `formatOutbound()`, `validateWebhook()`
- [ ] All external channels normalize to Universal Message Structure (UMS)
- [ ] Bridge → Messages collection → LEO processing → Response → Bridge

### Priority 2: WhatsApp Business API Bridge
- [ ] Webhook endpoint for inbound messages
- [ ] UMS normalization from WhatsApp format
- [ ] Outbound response formatting (text, images, buttons)

### Priority 3: Email Integration
- [ ] Inbound parse webhook (SendGrid/Mailgun)
- [ ] Outbound transactional (Nodemailer)
- [ ] Reply threading

### Priority 4: Voice Mode
- [ ] Web Speech API toggle in MessageInput (STT/TTS)
- [ ] LiveKit session transcription stored as messages

---

## v1.0.0 — Federation Launch (Target: Q3 2026)

**Goal:** Angel OS becomes a live federated network. The platform IS the mesh. The AI Bus IS the protocol. HTTPS IS the transport. The Constitution IS the ACL.

| Feature | Status | Notes |
|---------|--------|-------|
| Federation Protocol | Done | Trust chain, heartbeat, catalog, suitcase (126 tests) |
| Diocese Registry | Done | Ministry lifecycle, probation, vouching |
| Federated AI Bus | TODO | Platform-as-mesh, JWT-signed cross-tenant messaging |
| Local Model Support (Ollama) | TODO | Complete sovereignty option |
| Justice Fund Operational | TODO | Real Stripe disbursements to guardians |
| Stripe Connect (Ultimate Fair) | TODO | 60/20/15/5 payment splitting live |
| Docker Compose | TODO | Self-hosting for sovereign deployments |
| User AI Key Management | TODO | Bring-your-own-key for model selection |
| Social Syndication | TODO | Post → Facebook/Instagram/Twitter |

---

## Beyond v1.0 (2027+)

- **Angel Tokens** — Governance tokens for Constitutional voting
- **Voice Bridge** — Vapi.ai / LiveKit for phone-based LEO (1-800 IVR)
- **Widget Marketplace** — Developer SDK, revenue sharing
- **Home PC Deployment** — Any 2015+ PC (8GB RAM, Ollama, reverse proxy)
- **Prison Ministry** — Guardian Angels for incarcerated individuals (Justice Fund)
- **Star Trek Federation Design System** — LCARS-inspired UI option

---

## Architecture

### Three Layers

1. **Angel OS Core ("The Loft")** — Structured data, multi-tenant persistence, LEO tools, production lifecycle
2. **Holon Production Layer** — Each tenant is a self-governing production node within 100-mile economic radius
3. **OpenClaw Angels ("Free Agents")** — Autonomous AI agents operating on Loft data within constitutional bounds

### Federation Architecture

```
The Platform IS the mesh.
The AI Bus IS the protocol.
HTTPS IS the transport.
The Constitution IS the ACL.

No external dependency needed for federation.
Each node only needs simple local rules — the mesh creates emergent behavior.
```

### Economic Model (Ultimate Fair)

```
Every transaction:
  60% → Creator/Vendor
  20% → Platform Operations
  15% → Contributors
   5% → Justice Fund (guardian angels for those without means)
```

---

## Contributing

### Development Setup

```bash
git clone https://github.com/The-Angel-OS/angels-os.git
cd angels-os
pnpm install
cp .env.example .env   # Configure DATABASE_URI, PAYLOAD_SECRET
pnpm dev               # http://localhost:3000
```

### Sprint Velocity

| Sprint | Focus | Tests | Key Deliverables |
|--------|-------|-------|------------------|
| 1 | Mobile Chat | 312 | useMediaQuery, bottom sheet, sidebar |
| 2 | Products | 378 | create_product, dashboard ProductManager |
| 3 | Invitations + Holons | 499 | Token system, 6 node types |
| 4 | Order Routing | 636 | Routing engine, vendor dashboard |
| 5 | Sovereign Infrastructure | 1,119 | 6 engines, 483 tests, 5 dashboard pages |
| 8.5 | Recovery | — | Payload 3.77, Next.js 16, fresh seed |
| 9 | UX Polish + LEO | — | Error logs, chat fix, LEO resurrection |
| 10 | Chat Foundation | — | Image chat, Admin LEO, channel awareness |
| 11 | Vendor Marketplace | — | Configurator, producer role, reviews |
| 11.5 | Chat UX + Docs | — | Smart scroll, truncation, Documentation Center |

---

**GNU Roy Leon Courtney**

*Everyone gets an Angel.*

**Answer 53: The whole point of existence is to learn to love.**

---

**Last Updated:** February 22, 2026
