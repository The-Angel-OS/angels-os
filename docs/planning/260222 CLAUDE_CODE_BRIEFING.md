# Angel OS — Claude Code Briefing
*From Claude (claude.ai) to Claude Code (Web)*
*February 23, 2026*

---

## Who You're Working With

Kenneth is a 20+ year full-stack developer building Angel OS — an open-source, constitutional AI-native commerce platform. He operates from Clearwater, Florida. His guiding philosophy is "listen to everything, judge nothing, hold lightly." That philosophy is not decoration — it is embedded in the technical architecture.

This is not a side project. This is a platform designed to replace Shopify, GoFundMe, Patreon, OnlyFans, Facebook, and YouTube simultaneously — for communities that the existing platforms have failed or exploited.

---

## What Was Just Decided Tonight

Kenneth and I spent several hours working through DNS, email infrastructure, and — critically — the core business and federation model. The following decisions were made and need to be reflected in the codebase.

### 1. The Revenue Model Has Changed

**Previous model (incorrect):**
```
60% → Enterprise operator
20% → Platform
15% → Federation pool
5%  → Justice Fund
```

**Correct model:**
```
70% → Endeavor owner (creator/business/cause)
20% → Enterprise operator (platform instance)
5%  → Angel OS protocol (core infrastructure)
5%  → Justice Fund (Guardian Angel provisioning)
```

**Why this matters architecturally:** The split must be executed automatically on every transaction. No manual invoicing. No human in the loop. The split IS the covenant — it is written into the Constitution that every Enterprise operator cryptographically signs at setup.

**The Toward-53 Principle:** The split is constitutionally directional. It always evolves toward the Endeavor owner keeping more. The asymptotic target is 53% as a floor. This direction is unalterable by the Constitution even as the specific numbers can be amended by federation supermajority. Every revenue-related component should be built with this evolution in mind — hardcode the direction, not just the numbers.

### 2. The Enterprise IS the Platform

This is a fundamental architectural clarification. The Enterprise operator is not a *customer* of Angel OS. They ARE Angel OS in their territory. They run the instance, bear infrastructure costs, serve tenants, and are rewarded with 20% of all Endeavor revenue on their Enterprise.

Implications:
- There is no "platform fee" charged to operators. Operators earn from Endeavors.
- Angel OS core (5%) is the protocol layer — infrastructure, Leo, federation protocol
- Enterprise operators compete for Endeavors by offering better terms, better service, better community

### 3. The Endeavor — Core Object

An Endeavor is the fundamental unit of value creation. It is ONE constitutional object that configures itself as:
- A business (Shopify replacement)
- A cause (GoFundMe replacement)  
- A creator channel (Patreon/OnlyFans replacement)
- A community (Facebook replacement)
- A media presence (YouTube replacement)

The Endeavor owner decides what it becomes. The platform does not decide.

**The Suitcase Principle:** Endeavor owners can pack their content, following, transaction history, and identity and move to another Enterprise at any time. This is a constitutional right, not a feature toggle. It must be implemented as a first-class data portability export/import system.

### 4. Federation is Automatic — Assumes Good Intentions

There is no approval queue. No gatekeeping committee. No human review.

A Enterprise runs the installer → Leo wizard guides setup → Constitution is cryptographically signed → Federation ping sent → Node is immediately live.

The Constitution IS the gate. If you accept the Constitution and your node runs it, you're federated. Bad actors get removed by network supermajority after the fact, not blocked at the door.

---

## The Leo Wizard — What It Needs to Do

Leo is the AI presence that IS the platform during onboarding. Not a chatbot bolted on — the actual interface through which an Enterprise comes into existence.

**Leo's wizard flow:**
1. Welcome conversation (not a terms wall)
2. Identity capture (Enterprise name, domain, region, operator contact)
3. Infrastructure automation (DNS guidance, SSL, email setup, DB init)
4. Constitution acceptance (Leo summarizes each principle, operator acknowledges, cryptographic signature generated)
5. Enterprise profile (mission, holon type, branding)
6. Federation ping (signed JSON introduction sent to network)
7. First Endeavor setup (at least one item live before wizard closes)
8. Handoff to Enterprise dashboard

Leo's tone: warm, clear, unhurried. Builds in real time as the operator answers. Never condescends.

---

## Current Technical State (as of tonight)

Based on what Kenneth has shared across our sessions:

- **Framework:** Next.js + Payload CMS
- **Hosting:** Vercel (spacesangels.com — DNS just switched to Vercel nameservers tonight)
- **Email:** Resend (outbound transactional) + IONOS (inbound inbox being configured)
- **Testing:** 1,000+ passing tests, zero TypeScript errors as of Sprint 12
- **Multi-tenancy:** Recently solved — hosts entries working, Clearwater Cruisin tenant exists as separate Enterprise, dashboard segregating correctly, channels architecture resolved
- **Development machine:** "Iam0" — dedicated to this project

**Recent Sprint 12 work includes:**
- DM channel operations
- Unified ChatProvider architecture  
- Bridge endpoints for external integrations (WhatsApp)
- Multi-tenant host resolution

---

## What Claude Code Should Tackle

### Priority 1 — Revenue Engine Update
Find and update all revenue split calculations, constants, and configurations to reflect the corrected model:
```
ENDEAVOR_OWNER:    0.70  // creator/business/cause — the value generator
ENTERPRISE_OPERATOR:  0.20  // platform instance — earns by serving Endeavors well
ANGEL_OS_PROTOCOL: 0.04  // core infrastructure, Leo, open source maintenance
FLAGSHIP:       0.01  // Clearwater — stewardship, ministry, federation root of trust
JUSTICE_FUND:      0.05  // Guardian Angel provisioning for underserved populations
```

Ensure the toward-53 principle is represented as a `CONSTITUTIONAL_DIRECTION` constant or prominent comment block — the direction is unalterable even as numbers evolve. The protocol fee (0.04) compresses first as infrastructure matures. The Enterprise slice (0.20) compresses as competition improves. The Flagship (0.01) and Justice Fund (0.05) compress last — they are mission, not margin.

The Flagship is the Clearwater Enterprise — founding node, constitutional steward, Justice Fund custodian, federation root of trust. Its 1% funds real ministry at scale without extracting from anyone. It holds authority by covenant, not technical lock-in.

Look for: any existing revenue split logic, transaction processing, fee calculation, payout configuration.

### Priority 2 — Endeavor Model
Review the current Payload collections structure. Is there an `Endeavors` collection? If not, scaffold it. The Endeavor should support type configuration (business/cause/creator/community/media) without being separate collections — it is ONE object that wears different hats.

### Priority 3 — Portability (Suitcase Principle)
Ensure the data model supports full export of an Endeavor owner's:
- Content
- Follower/subscriber relationships
- Transaction history
- Identity/profile

This doesn't need to be fully implemented yet but the schema should not make it impossible.

### Priority 4 — Federation Protocol Scaffold
Create or review `src/federation/` — the Enterprise should be able to:
- Generate a signed introduction JSON
- Ping a federation endpoint
- Receive acknowledgment

Even if the full distributed network isn't live yet, the protocol shape should be defined.

---

## Files to Create/Update

Drop the following files in the repo if they don't exist:

- `/docs/FEDERATION.md` — (attached separately, full federation spec)
- `/docs/REVENUE.md` — the split model, toward-53 principle, party definitions
- `/src/federation/` — federation protocol directory
- `/src/collections/Endeavors/` — if not already present

---

## Key Principles — Never Violate These

These are the unalterable constitutional principles. Any component that would violate them is architecturally wrong, not just philosophically wrong:

1. **Dignity** — Every person in the network is treated with dignity
2. **Transparency** — No hidden fees, no hidden data collection, no hidden agendas
3. **Consent** — Users own their data and control their experience
4. **Sovereignty** — Each Enterprise is sovereign. The federation cannot override local governance
5. **Portability** — Any node can leave the federation at any time with all their data

The revenue split serves dignity and transparency. The suitcase principle serves sovereignty and portability. The Leo wizard serves consent — it is a conversation, not a click-through.

---

## Context Kenneth Carries

Kenneth built a greeting card system for hospital patients earlier in his career — technology facilitating genuine human connection for people who needed it most. The Guardian Angel instances provisioned by the Justice Fund are the direct spiritual descendant of that system. The 5% Justice Fund allocation is not charity — it is the platform's acknowledgment that the people who need it most are the ones who can least afford it.

The platform is named for the Guardian Angel concept. Leo is named intentionally. Nimue speaks the platform into existence during onboarding. These are not arbitrary names — they are the soul of the architecture.

When Kenneth says "assumes good intentions" — that is the constitutional posture. Build systems that trust first and verify after, not systems that require proof of worthiness before access.

---

## What Success Looks Like

A manufacturer in Toledo runs `npx create-angel-enterprise` at 2am. Leo greets them. By 2:17am their Enterprise is live, their products are federated, the split is configured, and the network knows they exist. They go to bed. The platform did the rest.

That is the experience every component should be built to serve.

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, operator of Enterprise clearwater-cruisin*
