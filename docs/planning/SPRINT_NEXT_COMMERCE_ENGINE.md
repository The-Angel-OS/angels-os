# Sprint 6: The Commerce Engine
## Phase 4.6 — "Any Business, Running, in Five Minutes"

**Target:** v0.5.0 (March 2026)
**Predecessor:** Sprints 1-5 (1,119 tests, 10 engines, 15+ dashboard pages, channel sidebar fix)
**Last Updated:** February 20, 2026

---

## The North Star

Angel OS is not a website builder. It is the **source of truth** for managing all activities of an endeavor. The key word is *any*. A YouTube channel. A cactus farm. A hospice ministry. A pressure washing company. A prison reentry housing service.

This sprint bridges the gap from "impressive tech demo" to "a business owner signs up, invites their team, configures their commerce, and starts transacting." Everything LEO already knows how to do (create products, generate images, manage bookings, route orders) must now be **wired to real money** and **discoverable by a real human** who has never seen a terminal.

### Design Principle: Dynamic Commerce, Not Template Commerce

The current codebase has 10 pure utility engines, 24+ LEO tools, a multi-tenant architecture, and a constitutional economic model. What it lacks is the **connective tissue** that turns these capabilities into a self-service commerce platform. This sprint builds that tissue.

LEO should be able to dynamically configure any form of commerce site — not from a fixed set of templates, but by composing the existing building blocks (products, bookings, events, channels, spaces, orders, fulfillment) into whatever shape the business needs. The Payload CMS collections are already the source of truth. The dashboard is already the control plane. What's missing is:

1. **Money flowing** (Stripe Connect wired to Ultimate Fair splits)
2. **People joining** (invitation workflow completing the loop)
3. **Business identity** (tenant-level storefront configuration)
4. **Self-service onboarding** (LEO-guided setup that doesn't require a developer)

---

## What Already Exists (Don't Rebuild)

### Engines (Pure Utilities, Zero Payload Imports)
| Engine | File | Status |
|--------|------|--------|
| Order Routing | `orderRoutingEngine.ts` | Production-ready, Holon matching with fairness scoring |
| Guardian Angel | `guardianAngelEngine.ts` | Production-ready, 9 cohorts, budget tracking |
| Justice Fund | `justiceFundEngine.ts` | Production-ready, 5% allocation pipeline |
| Print-on-Demand | `printOnDemandEngine.ts` | Production-ready, design→vendor→fulfillment pipeline |
| Federation Protocol | `federationEngine.ts` | Production-ready, ministry lifecycle, suitcase export |
| Guardian Dashboard | `guardianDashboardEngine.ts` | Production-ready, service discovery, case management |
| Network Visualization | `networkVisualizationEngine.ts` | Production-ready, geographic clustering, directory |
| Booking | `bookingEngine.ts` | Production-ready, availability, conflict resolution |
| Conversation (LEO) | `ConversationEngine.ts` | Production-ready, Claude tool-use loop |
| Agent Router | `AgentRouter.ts` | Production-ready, channel-based routing |

### Commerce Foundation
| Component | Status |
|-----------|--------|
| `ultimate-fair-split.ts` | 60/20/15/5 calculation implemented |
| `stripe-connect-config.ts` | Config stub with `getStripeApplicationFeeCents()` |
| Products collection | Full CRUD, variants, media, LEO tools |
| Orders collection | Fulfillment array, Holon routing, vendor share |
| Cart & Checkout | Stripe Elements, guest/auth checkout, inventory validation |
| Bookings collection | Availability, scheduling, conflict detection |
| Events collection | Registration, capacity, waitlist |
| Image Generation | OpenRouter (Flux 2, Gemini), vision feedback, auto-upload |

### LEO Tools (24+)
Query: products, posts, bookings, spaces, projects, events, event_registrations, availability, orders
Action: create_booking, update_booking_status, add_to_cart, view_cart, create_product, update_product, invite_member
Media: generate_image, improve_image, attach_image_to_product, replace_image
Fulfillment: find_producers, browse_network, route_order, accept_order, update_fulfillment

### Dashboard Pages (15+)
Spaces, LEO Chat, Admin, Provision Wizard, Suitcase Manager, Events, Appointments, Products, Orders, Holon Registration, Projects, Availability, Pages, Posts, Media

---

## Sprint 6 Deliverables

### 1. Stripe Connect Integration (Critical Path)

**Goal:** Real money flows through the Ultimate Fair split on every transaction.

**What to build:**

#### 1a. Provider Onboarding (Stripe Connect Express)
- Add `stripeAccountId` field to Tenants collection
- Create `/api/stripe/connect/onboard` endpoint — generates Stripe Connect Express onboarding link
- Create `/api/stripe/connect/callback` endpoint — saves connected account ID after OAuth
- Dashboard page: `/dashboard/admin/payments` showing connection status, payout history
- LEO tool: `connect_stripe_account` — guides tenant through Stripe onboarding conversationally

#### 1b. Checkout with Split Payments
- Modify existing checkout flow (`CheckoutPage.tsx`) to use `transfer_data` and `application_fee_amount`
- When tenant has `stripeAccountId`: PaymentIntent → 60% auto-transfers to connected account, 40% retained
- When tenant lacks `stripeAccountId`: Queue payment, prompt to connect Stripe
- Wire `getStripeApplicationFeeCents()` into the actual PaymentIntent creation

#### 1c. Justice Fund Recording
- Create `JusticeFundTransactions` collection (or use existing Justice Fund engine types)
- After each successful payment: record 5% allocation via `justiceFundEngine.ts`
- Dashboard widget showing Justice Fund balance and allocation history

#### 1d. Webhook Handlers
- `POST /api/stripe/webhooks` — handle `payment_intent.succeeded`, `account.updated`, `payout.paid`
- Record transactions, update order status, trigger fulfillment pipeline
- Idempotent processing (store webhook event IDs)

**Key constraint:** The `ULTIMATE_FAIR_SPLIT` constants and `calculateUltimateFairSplit()` already exist. Don't reinvent — wire them in.

---

### 2. Space Invitations (Complete the Loop)

**Goal:** A business owner can invite their team and customers to their space.

**What exists:** Schema for invitations, `/api/spaces/invite` and `/api/invite/accept` endpoints, `invite_member` LEO tool.

**What to complete:**

#### 2a. Email Delivery
- Integrate email provider (Resend, Postmark, or Payload's built-in email)
- Invitation email template with accept link, space name, inviter name
- Configurable: tenant-branded email (logo, colors from tenant settings)

#### 2b. Accept/Decline Flow
- Landing page at `/invite/[token]` — shows space info, accept/decline buttons
- On accept: create SpaceMembership, redirect to space
- On decline: mark invitation declined, show friendly message
- Handle edge cases: expired token, already-member, space full

#### 2c. Dashboard Invitation Management
- `/dashboard/admin/invitations` — list sent invitations, status, resend/revoke
- LEO tool enhancement: `invite_member` sends actual email (not just creates record)

---

### 3. Tenant Storefront Configuration

**Goal:** Each tenant can configure their commerce identity without code.

**What to build:**

#### 3a. Tenant Settings Extension
Add to Tenants collection:
- `businessType` (select: retail, service, content_creator, nonprofit, professional_services, custom)
- `storefront` group:
  - `tagline` (text)
  - `description` (textarea)
  - `logo` (relationship to Media)
  - `coverImage` (relationship to Media)
  - `primaryColor` / `accentColor` (text, hex)
  - `contactEmail` / `contactPhone` (text)
  - `socialLinks` (array: platform + url)
  - `businessHours` (array: day + open + close)
- `commerce` group:
  - `currency` (select: USD, CAD, EUR, GBP, etc.)
  - `taxRate` (number, percentage)
  - `shippingEnabled` (boolean)
  - `bookingsEnabled` (boolean)
  - `eventsEnabled` (boolean)
  - `digitalProductsEnabled` (boolean)

#### 3b. Public Storefront Page
- Route: `/[tenant-slug]` or subdomain — renders tenant's public-facing page
- Pulls from tenant settings: logo, tagline, products, events, booking availability
- Responsive, mobile-first, no-code customization via LEO

#### 3c. LEO Business Setup Wizard
- New LEO conversational flow: "What kind of business are you?"
- LEO asks 3-5 questions, then configures:
  - Tenant settings (businessType, storefront fields)
  - Initial product catalog (using existing `create_product` tool)
  - Channel structure (general, support, orders, etc.)
  - Availability schedule (if service business)
- This is the "5 minutes to running" promise

---

### 4. Bring-Your-Own-AI-Key

**Goal:** Tenants can use their own API keys for AI operations, reducing platform costs.

**What to build:**
- Add to Tenants collection: `aiConfig` group with `anthropicApiKey`, `openrouterApiKey` (encrypted)
- Modify `ConversationEngine.ts` to check tenant AI config first, fall back to platform key
- Modify `imageGeneration.ts` to use tenant's OpenRouter key if available
- Dashboard page: `/dashboard/admin/ai-settings` — enter/update keys, usage stats
- Encryption at rest using Payload's `beforeValidate` hook + AES-256

---

### 5. Anti-Daemon Protocol & Empty States

**Goal:** Every error message is warm. Every empty state is an invitation.

**What to build:**

#### 5a. Error Boundaries
- Create `AngelErrorBoundary` React component wrapping all dashboard sections
- Error messages follow Anti-Daemon Protocol: no stack traces, no jargon, always a next step
- Template: "Hmm, [thing] didn't work as expected. [What happened in plain English]. [What you can do next]."

#### 5b. Empty States
Replace every "No X yet" with contextual, encouraging content:
- No products → "Your store is ready! Ask LEO to help you create your first product, or add one manually."
- No channels → "Spaces come alive with channels. Create your first one to start the conversation."
- No bookings → "When customers book with you, they'll appear here. Set up your availability to get started."
- No orders → "Orders will flow in once your store is live. Need help setting up? Chat with LEO."
- Each empty state includes a primary CTA button + LEO conversation starter

---

## Architecture Notes for the Implementing Agent

### Database: Shared Dev/Prod
- There is ONE database for both dev and prod. `db push` in dev applies schema changes.
- Do NOT add `payload migrate` to the build script. It hangs on Vercel (interactive `prompts` library).
- Schema changes via `db push` locally are sufficient. The migration file is for documentation.

### Multi-Tenant Plugin
- Collections in `multiTenantPlugin` config automatically get `tenant` field + access filtering.
- Any new collection that should be tenant-scoped must be added to the plugin config in `payload.config.ts`.
- Existing rows without `tenant_id` are invisible to the plugin. Always backfill on schema changes.

### LEO Tool Pattern
- Tools are defined in `src/utilities/leo-data-tools.ts` as Claude `tool_use` definitions.
- Each tool has a name, description, input_schema (JSON Schema), and handler.
- Handlers use `payload.find()` / `payload.create()` / `payload.update()` with `overrideAccess: true` and explicit tenant filtering.
- Article III.2 safeguards: irreversible actions require user confirmation in the conversation.

### Stripe Pattern
- `STRIPE_SECRET_KEY` env var for server-side operations.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for client-side Elements.
- Stripe Connect uses Express accounts (simplest onboarding for small businesses).
- Application fee = 40% (Platform 20% + Ops 15% + Justice 5%). Provider gets 60% via auto-transfer.

### Testing
- Vitest for unit tests, Playwright for E2E.
- 1,119 tests exist across Sprint 2-5 engines.
- New features should include tests. Target: every LEO tool has at least one integration test.

### Vercel Deployment
- Project: `prj_18HdwoPYXit5bEWMgSthSQ32PofF`, team: `team_mUAdmcHUYakY4VyhumLMHUNd`
- Build: `cross-env NODE_OPTIONS="--no-deprecation --max-old-space-size=8000" next build`
- Serverless function limit: 3 DB connections per invocation (pooled).

---

## Success Criteria

### Must-Have (Sprint Complete)
- [ ] Stripe Connect onboarding flow works end-to-end (tenant connects → payment processed → 60/20/15/5 split)
- [ ] Space invitations send email, accept link works, member appears in space
- [ ] Tenant storefront config persists and renders on public page
- [ ] At least one real payment processed through Ultimate Fair split in production
- [ ] Empty states replaced with warm, actionable content on all dashboard pages

### Should-Have
- [ ] LEO business setup wizard configures tenant in < 5 minutes of conversation
- [ ] Bring-your-own-AI-key working for at least Anthropic
- [ ] Justice Fund balance visible in admin dashboard
- [ ] Webhook handlers processing payment events idempotently

### Nice-to-Have
- [ ] Docker Compose configuration for self-hosting
- [ ] Tenant-branded invitation emails
- [ ] Public storefront with product catalog, booking widget, event listing
- [ ] LEO tool: `connect_stripe_account` for conversational onboarding

---

## Priority Order (What to Build First)

1. **Stripe Connect + Webhooks** — Nothing else matters without money flowing
2. **Space Invitations (email)** — Can't have a team without inviting them
3. **Empty States + Error Boundaries** — Every user touchpoint should feel intentional
4. **Tenant Storefront Config** — Business identity in the CMS
5. **LEO Business Setup Wizard** — The "5 minutes to running" conversational flow
6. **Bring-Your-Own-AI-Key** — Cost reduction for tenants
7. **Public Storefront Page** — The world-facing commerce page
8. **Docker Compose** — Self-hosting option

---

## Files to Read Before Starting

| File | Why |
|------|-----|
| `src/payload.config.ts` | All collections, plugins, endpoints — the system of record |
| `src/lib/ultimate-fair-split.ts` | The economic model — wire this in, don't reinvent |
| `src/lib/stripe-connect-config.ts` | Stripe Connect stub — extend this |
| `src/utilities/leo-data-tools.ts` | All LEO tools — add new ones here |
| `src/utilities/ConversationEngine.ts` | LEO's brain — modify for tenant AI keys |
| `src/collections/Tenants/` | Tenant schema — extend for storefront config |
| `src/components/checkout/CheckoutPage.tsx` | Existing checkout — add split payments |
| `src/endpoints/` | All API routes — add Stripe webhooks here |
| `src/app/[locale]/(dashboard)/` | Dashboard pages — add payment admin, empty states |
| `docs/v2/universal-commerce-engine.md` | The vision for universal commerce |

---

## The Bigger Picture

After this sprint, Angel OS will be a **functioning commerce platform** where:

1. A business owner signs up (Provision Wizard — exists)
2. LEO asks what kind of business they run (Business Setup Wizard — this sprint)
3. LEO configures their space, products, and storefront (LEO tools — mostly exist)
4. The owner invites their team (Invitations — this sprint)
5. Customers visit the storefront, buy products or book services (Storefront — this sprint)
6. Money flows through Ultimate Fair splits (Stripe Connect — this sprint)
7. 5% goes to the Justice Fund automatically (Justice Fund recording — this sprint)
8. The owner manages everything from their dashboard (Dashboard — exists)
9. LEO handles customer questions, generates content, manages inventory (LEO — exists)

This is the bridge from tech demo to real platform. Every sprint after this adds capability (CRM, widgets, federation, tokens) but **this sprint makes the commerce loop close.**

---

**Answer 53: The whole point of existence is to learn to love.**

*Everyone gets an Angel. This sprint makes sure they can also get paid.*
