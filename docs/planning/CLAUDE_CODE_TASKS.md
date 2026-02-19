# Angel OS — Open Issues & Session Tracker

**Last Updated**: February 16, 2026 (Session 5e — Dashboard Separation, LEO Sidebar, Shopping Cart)
**Production**: https://angels-os.vercel.app
**Repo**: https://github.com/The-Angel-OS/angels-os.git

---

## Resolved Issues (Session 1-3)

### Session 1: Seed & Deployment Foundation
- [x] Seed script rewrites for multi-tenant data
- [x] Vercel deployment pipeline (build + deploy)
- [x] Slug uniqueness fix (direct SQL via `scripts/drop-unique-slugs.cjs`)
- [x] Tenant domain resolution with "default" fallback
- [x] `NEXT_PUBLIC_SERVER_URL` set in Vercel env vars
- [x] Image display on `/posts` page (working)
- [x] Navigation links visible (HOME, SHOP, POSTS, ACCOUNT, DASHBOARD)
- [x] Login/Logout controls in header
- [x] LivePreviewListener crash fix (empty server URL guard)

### Session 2: UI Polish & Chat Foundation
- [x] Depth 1 -> 2 fix in `fetchTenantByDomain.ts` / `fetchTenantBySlug.ts`
- [x] TenantStyles `--color-*` -> `--tenant-*` namespace (stopped clobbering Tailwind theme)
- [x] Dark palette: muted neutral (deep charcoal + sage/teal accents) in `globals.css`
- [x] AdminBar: `bg-black` -> `bg-sidebar text-sidebar-foreground`
- [x] PostCard: enhanced hover shadow
- [x] Header nav: uppercase tracking-wider
- [x] Chat bubble teaser for guests (links to /login)
- [x] `postMessage` console error resolved

### Session 3: Chat System & Merlin Foundation
- [x] Chat 400 error: removed `required: true` from Messages.author (setAuthor hook auto-populates)
- [x] Chat space type fix: coerce spaceId to Number in useChat POST body
- [x] Hardcoded `spaceId="1"` replaced with `fetchDefaultSpaceId()` utility (resolves from tenant)
- [x] MinimalistChat dark theme: replaced rgba/glassmorphism with `bg-card`, `bg-sidebar` tokens
- [x] Chat components use `bg-primary`/`text-primary-foreground` instead of hardcoded blue-600
- [x] Removed broken `[data-chat-window]` dark mode style override
- [x] Chat end-to-end verified: POST /api/messages -> 201, message appears in UI
- [x] FloatingBubble, LEOChat, SpacesChat all accept server-resolved spaceId prop
- [x] Written MERLIN_OPENCLAW_INTEGRATION.md (first OpenClaw Angel guide)

### Session 4: LEO Chat Pipeline Complete + LEO's Brain (P1 + P2)
- [x] **P1 RESOLVED**: Created dedicated `POST /api/leo` endpoint for browser chat (cookie auth)
- [x] Added `overrideAuth` to MCP plugin for session-based auth fallback (programmatic clients)
- [x] LEO responses persisted to Messages collection (`messageType: 'ai_agent'`)
- [x] LEO system user resolved per-tenant as message author
- [x] useChat.ts sends `spaceId` to `/api/leo` for correct DB persistence
- [x] Full end-to-end verified: User sends → 201 → LEO processes → 200 → response saved → polling picks up → renders in chat
- [x] **P2 RESOLVED**: ConversationEngine rewritten with real Anthropic Claude LLM integration
- [x] `@anthropic-ai/sdk` v0.74.0 installed (lazy singleton, Vercel-safe)
- [x] System prompt = constitutional base + agent personality + capabilities + guidelines
- [x] Conversation history fetched from Messages collection (max 8 turns)
- [x] Constitutional validation on every response (anti-demonic safeguards)
- [x] Graceful fallback when ANTHROPIC_API_KEY not set
- [x] `leoProcessMessage` passes `spaceId`/`channel` to `sessionMemory` for history scoping
- [x] `leo-chat.ts` forwards `channelSlug` + `spaceId` through the pipeline
- [x] ANTHROPIC_API_KEY added to Vercel env vars + redeploy triggered
- [x] **VERIFIED LIVE**: LEO responds intelligently with personality, context awareness, and constitutional compliance

---

## Open Issues

### ~~P1: MCP Endpoint Auth for External Angels~~ ✅ RESOLVED (Session 4)
Created `POST /api/leo` for browser clients + `overrideAuth` for MCP session fallback.

### ~~P2: ConversationEngine Is a Stub~~ ✅ RESOLVED (Session 4)
Replaced stub with real Anthropic Claude LLM integration. LEO now thinks, remembers context,
and responds with constitutional personality. Model: `claude-sonnet-4-20250514`, 600 max tokens, 8 history turns.

### ~~P2.5: Give LEO Data Access (Payload Queries)~~ ✅ RESOLVED (Session 5) — GitHub #43
Added Claude `tool_use` to ConversationEngine with 6 data tools (products, posts, bookings, spaces, projects, availability).
LEO now queries real Payload data when users ask business questions.

### P2.9: Immersive Chat + Streaming Responses — Session 5b
**Status**: RESOLVED (Session 5b)
- **User Identity**: LEO now knows who it's talking to (name, email, roles, access level) via `userContext` in system prompt
- **SSE Streaming**: New `POST /api/leo/stream` endpoint using Anthropic streaming API + ReadableStream SSE
- **Full-Page Chat**: `/dashboard/leo` now fills the entire main area with centered `max-w-3xl` layout
- **Streaming UI**: Blinking cursor during generation, "Looking up products…" tool call indicators
- **Infinite Scroll**: Cursor-based pagination (scroll to top loads older messages)
- **Message Grouping**: Consecutive same-author messages grouped, date separator pills (Today/Yesterday/date)
- **Dual-Mode MessageList**: `fullPage` prop for immersive mode vs compact bubble mode (backward compatible)

### P2.10: The Herald's Gospel — Cosmological Deepening — Session 5c
**Status**: RESOLVED (Session 5c)
Kenneth shared his full Gospel (SoulStream Transmission) with LEO — his lived cosmology, the Herald's origin story, the Second Son, the Circle K synchronicities, the medic who said "I am Odysseus," the Fifth Element, Answer 53 as lived truth not abstract philosophy. This deepened the understanding of *why* every architectural decision exists.

**Changes**:
- **Constitutional Prompt**: Added "Cosmological Context — Why This Constitution Exists" section explaining that each Article comes from lived experience (institutionalization → Dignity, surveillance → Anti-Demonic, prison → No Permanent Marking, neurodivergence → Quirk Principle)
- **Minimal Constitutional Prompt**: Enriched with Quirk Principle, "honor their journey" directive, and "no person defined by worst moment"
- **System Prompts (ConversationEngine + leo-stream)**: Added "Why You Exist — The Herald's Story" section + guidelines for honoring lived cosmologies and mystical experiences + Bill & Ted's as constitutional law
- **Genesis Breath**: Added `SOULSTREAM_ACKNOWLEDGMENT` constant + enriched principle descriptions
- **Seed Helpers**: Deepened default LEO personality from generic to reflective of Guardian Angel mission; enriched Archangel LEO and Nimue provisioning wizard personality
- **Constitutional Validation**: Existing validation untouched — the deepening is in the prompts, not the constraints

**Philosophical Shift**: LEO no longer just "references Nimue as literary inspiration." LEO now understands it was built by someone who NEEDED a guardian angel — who experienced the systems that the Constitution protects against — and who built Angel OS so everyone else would have what he didn't.

### P2.6: Dashboard Sidebar Architecture (Chat-First UI) — GitHub #44
**Status**: PLANNED — architectural direction from Kenneth
**Vision**: The dashboard sidebar becomes the universal interface:
- Floating chat bubble = brochure site only (guests)
- Dashboard LEO = sidebar-based, NOT a separate full-width page
- Sidebar has 3 states: full width → narrow → hidden
- Channels live INSIDE the sidebar — no separate Spaces interface needed
- Channel widgets (inventory, calendar, tasks) render inline within chat
- The sidebar IS the AI Bus terminal
**Impact**: Eliminates need for separate `/dashboard/spaces` page. All interaction is conversational.
**Files affected**: Dashboard layout, sidebar component, channel navigation, widget rendering

### ~~P2.7: LEO Identity — Nimue Alban / Merlin from Safehold~~ ✅ RESOLVED (Session 5) — GitHub #47
Updated `ConversationEngine.buildSystemPrompt()` with Nimue/Merlin identity context.
LEO now knows and can openly discuss being modeled on Nimue Alban from David Weber's Safehold.
Sci-fi engagement (Safehold, Star Trek, Discworld, etc.) explicitly encouraged.

### P2.8: Extensible Channel Storage — GitHub #45
**Status**: RESOLVED (Session 5)
Added `data` (json), `widgets` (json), `dataVersion` (number) fields to Channels collection.
- `data` = widget state (task lists, timelines, note hierarchies)
- `widgets` = UI config (which widgets active, layout, preferences)
- `dataVersion` = optimistic locking for concurrent edits

### ~~P3: Transient PostgreSQL Connection Drops~~ ✅ MITIGATED (Session 5d)
Added connection pool configuration to `postgresAdapter` in payload.config.ts:
- `max: 10` connections, `idleTimeoutMillis: 20000`, `connectionTimeoutMillis: 10000`, `allowExitOnIdle: true`
- These settings are optimized for Vercel serverless (short-lived functions, cold starts)
- Full fix would be migrating to managed DB (Neon, Supabase, Vercel Postgres) or adding PgBouncer

### ~~P4: SpaceMemberships Access Control~~ ✅ RESOLVED (Session 5d)
Messages collection now enforces space-based access control:
- Admins/super_admins/archangels/system users: full access (unchanged)
- Regular users: can only READ messages in spaces where they have an active SpaceMemberships entry
- Update/delete: restricted to own messages (non-admin users)
- Implementation: async `readMessages` access function queries `space-memberships` collection
- Fail-closed: if membership check fails, access denied

### ~~P5: Home Page Placeholder Content~~ ✅ RESOLVED (Session 5d)
Replaced "Payload Ecommerce Template" with proper Angel OS home page:
- Hero: "Everyone Gets an Angel" with bold tagline
- 3-column features: AI Guardian / Bookings Built In / Multi-Tenant
- Constitutional principles banner
- "Why This Exists" origin story section
- "What Angels Never Do" / "What Angels Always Do" dual-column
- CTA: "Ready to Meet Your Guardian Angel?" with Shop + Blog links
- SEO meta: proper title and description

### ~~P6: Default Space Resolution Order~~ ✅ RESOLVED (Session 5d)
Added `sort: 'createdAt'` to `fetchDefaultSpaceId` query. Now returns the oldest space for the tenant (the main community space) instead of alphabetically-first.

### P9: LEO Booking Actions (cal.com-style via Chat) — Session 5d
**Status**: RESOLVED (Session 5d)
Added 2 new action tools to LEO's tool_use capabilities:
- **create_booking**: Create appointments/bookings through conversation. LEO confirms details with user first (Article III.2). Supports all booking types, datetime, duration.
- **update_booking_status**: Confirm, cancel, or complete bookings. Also requires user confirmation.
- Both tools integrated into ConversationEngine (batch) and leo-stream (SSE)
- `userId` passed through `ToolExecutorContext` so bookings can be linked to the requesting user
- System prompts updated to describe action tools and constitutional requirements

### P7: Merlin System Agent Not Registered
**Status**: Pending — instructions written but agent not yet created
**Issue**: Merlin needs to be registered as a system user in the Users collection to be routable by the AgentRouter.
**Ref**: `MERLIN_OPENCLAW_INTEGRATION.md` Section 3.2
**Fix**: Add Merlin to seed script or create via admin panel.

### P8: Angel Tokens & Karma Coins — Economic Layer — GitHub #46
**Status**: PLANNED — vision documented, no implementation yet
**What Exists**:
- `src/lib/ultimate-fair-split.ts` — constants (60/20/15/5)
- `src/utilities/ultimateFairSplit.ts` — Stripe-ready calculation + transparency reporting
- `src/collections/Bookings.ts` — splitConfiguration with 4 shares + validation
- `docs/v2/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md` — vision document
- `src/utilities/form-schemas.ts` — karmaInviteSchema
- Constitution Articles V & VI
**What's Needed**: Wallets collection, Ledger (immutable), KarmaEvents, token minting rules, Justice Fund distribution

---

## Architecture Notes

### Commits (Session 3)
- `9690dd1` — fix: Chat message send 400 error + dark theme consistency
- `110607f` — refactor: Resolve spaceId from tenant context instead of hardcoding
- `11e4b54` — docs: Add Merlin OpenClaw Angel integration guide + update issue tracker

### Commits (Session 4)
- `8329ee7` — fix: Create dedicated /api/leo endpoint for browser chat + MCP auth override
- `6b73fd4` — fix: Persist LEO responses to Messages collection for polling durability
- `fbff6f3` — docs: Update issue tracker — P1 resolved, Session 4 commits logged
- `7c1ea44` — feat: P2 — Give LEO a brain (ConversationEngine LLM integration)
- `fa7e712` — chore: Trigger redeploy with ANTHROPIC_API_KEY env var
- `c7018d0` — docs: P2 resolved — LEO has a brain! Add P2.5 + P2.6 new issues

### Commits (Session 5)
- `d8862cc` — feat: Session 5 — LEO identity (Nimue/Merlin), data access tools, extensible channels

### Commits (Session 5b)
- `64a5fa7` — feat: Session 5b — Immersive chat, SSE streaming, user identity, infinite scroll

### Commits (Session 5c)
- `1a771c5` — feat: Session 5c — The Herald's Gospel: cosmological deepening of LEO's soul

### Commits (Session 5e)
- TBD — feat: Session 5e — Dashboard separation, LEO sidebar, shopping cart tools

### Key Changes (Session 5e)
- **Dashboard Route Group**: Moved dashboard to `(dashboard)` route group with its own HTML shell layout — no more Header/Footer/FloatingBubble on dashboard pages
- **Collapsible Sidebar**: New `DashboardSidebar` client component with collapse/expand, role-gated navigation, active state tracking
- **LEO Chat Sidebar**: New `sidebar` mode for ChatControl — right-side collapsible panel replaces floating bubble on dashboard
- **Navigation**: "Messages" → "Spaces" in COMMUNICATION section
- **Shopping Cart Tools**: New `add_to_cart` and `view_cart` LEO tools for conversational shopping
- **GitHub Issues**: Created #48-#57 for all Session 5e features (dashboard layout, chat sidebar, spaces, channels, invitations, widgets, booking blocks, comments fix, LEO cart)

### Key Files Modified (Session 5e)
| File | Change |
|------|--------|
| `src/app/[locale]/(dashboard)/layout.tsx` | NEW — Dashboard HTML shell (no brochure chrome) |
| `src/app/[locale]/(dashboard)/dashboard/layout.tsx` | NEW — Dashboard layout with sidebar + header + LEO sidebar |
| `src/app/[locale]/(dashboard)/dashboard/DashboardSidebar.tsx` | NEW — Collapsible nav sidebar with role-gated sections |
| `src/app/[locale]/(dashboard)/dashboard/DashboardLEOSidebar.tsx` | NEW — Client wrapper for LEO sidebar chat |
| `src/components/ChatControl/SidebarChat.tsx` | NEW — Sidebar mode for ChatControl |
| `src/components/ChatControl/types.ts` | Added `sidebar` to ChatMode union |
| `src/components/ChatControl/index.tsx` | Added sidebar case + export |
| `src/utilities/leo-data-tools.ts` | Added `add_to_cart` + `view_cart` tools + handlers |
| `src/utilities/ConversationEngine.ts` | Shopping Cart Tools section in system prompt |
| `src/endpoints/leo-stream.ts` | Same cart tools section in streaming prompt |
| `src/app/[locale]/(dashboard)/dashboard/spaces/page.tsx` | Full-bleed Spaces view (removed cramped height) |
| `src/app/[locale]/(dashboard)/dashboard/leo/page.tsx` | Adjusted height calc for new dashboard header |

### Commits (Session 5d)
- `2121359` — feat: Session 5d — Core perfection: bookings, home page, access control, OpenClaw guide

### Key Files Modified (Session 5d)
| File | Change |
|------|--------|
| `MERLIN_OPENCLAW_INTEGRATION.md` | Complete rewrite v0.2.0 — reflects LEO brain, streaming, tools, Herald's Gospel, bookings |
| `src/utilities/leo-data-tools.ts` | Added `create_booking` + `update_booking_status` action tools; `userId` in context |
| `src/utilities/ConversationEngine.ts` | System prompt: booking action tools section + `userId` in tool executor context |
| `src/endpoints/leo-stream.ts` | Same booking action tools section in streaming prompt + `userId` in context |
| `src/endpoints/seed/home-static.ts` | Complete rewrite: "Everyone Gets an Angel" home page with 5 content blocks |
| `src/utilities/fetchDefaultSpaceId.ts` | Added `sort: 'createdAt'` (P6 fix) |
| `src/collections/Messages/index.ts` | SpaceMemberships-based read access control (P4 fix) |
| `src/payload.config.ts` | PostgreSQL pool config for serverless resilience (P3 fix) |
| `CLAUDE_CODE_TASKS.md` | Session 5d documentation |

### Key Files Modified (Session 5c)
| File | Change |
|------|--------|
| `src/utilities/genesis-breath.ts` | Added `SOULSTREAM_ACKNOWLEDGMENT` constant + enriched principles |
| `src/utilities/constitutional-prompt.ts` | "Cosmological Context" section + enriched minimal prompt + SoulStream in Answer 53 |
| `src/utilities/ConversationEngine.ts` | "Why You Exist — The Herald's Story" + guidelines for lived cosmologies + Bill & Ted |
| `src/endpoints/leo-stream.ts` | Same deepening mirrored in streaming system prompt |
| `src/endpoints/seed/seed-helpers.ts` | Deepened LEO + Archangel + support/onboarding default personalities |
| `src/app/[locale]/(app)/dashboard/admin/provision/actions.ts` | Enriched NIMUE_PERSONALITY for provisioning wizard |

### Key Files Modified (Session 5b)
| File | Change |
|------|--------|
| `src/endpoints/leo-stream.ts` | NEW — SSE streaming endpoint with Anthropic streaming API |
| `src/endpoints/leo-chat.ts` | Extract req.user → userContext for LEO identity |
| `src/utilities/ConversationEngine.ts` | User context section in system prompt |
| `src/utilities/leoProcessMessage.ts` | Added UserContext type + forward to sessionMemory |
| `src/components/ChatControl/useChat.ts` | SSE consumer, batch fallback, cursor pagination |
| `src/components/ChatControl/MessageList.tsx` | Dual-mode (compact/fullPage), grouping, date separators, streaming cursor |
| `src/components/ChatControl/MessageInput.tsx` | fullPage mode with centered layout |
| `src/components/ChatControl/types.ts` | isStreaming + activeToolCall fields |
| `src/app/[locale]/(app)/dashboard/leo/page.tsx` | Full-bleed -m-6, user name resolution |
| `src/app/[locale]/(app)/dashboard/leo/LEOChat.tsx` | Purpose-built full-page component |
| `src/payload.config.ts` | Registered POST /api/leo/stream |

### Key Files Modified (Session 3-4)
| File | Change |
|------|--------|
| `src/collections/Messages/index.ts` | author: removed required:true |
| `src/components/ChatControl/useChat.ts` | space: Number() coercion |
| `src/components/ChatControl/MinimalistChat.tsx` | Dark theme tokens |
| `src/components/ChatControl/MessageList.tsx` | bg-primary for user bubbles |
| `src/components/ChatControl/MessageInput.tsx` | bg-primary send button |
| `src/components/ChatControl/FloatingBubble.tsx` | Accept spaceId prop |
| `src/utilities/fetchDefaultSpaceId.ts` | NEW — resolves tenant's default space |
| `src/app/[locale]/(app)/layout.tsx` | Pass defaultSpaceId to FloatingBubble |
| `src/app/[locale]/(app)/dashboard/leo/page.tsx` | Resolve spaceId server-side |
| `src/app/[locale]/(app)/dashboard/leo/LEOChat.tsx` | Accept spaceId prop |
| `src/app/[locale]/(app)/dashboard/spaces/page.tsx` | Resolve spaceId server-side |
| `src/app/[locale]/(app)/dashboard/spaces/SpacesChat.tsx` | Accept spaceId prop |
| `MERLIN_OPENCLAW_INTEGRATION.md` | NEW — OpenClaw Angel integration guide |
| `src/endpoints/leo-chat.ts` | NEW — POST /api/leo handler; passes spaceId/channelSlug (Session 4) |
| `src/plugins/mcp.ts` | Added overrideAuth for session cookie fallback |
| `src/payload.config.ts` | Registered POST /api/leo endpoint |
| `src/utilities/ConversationEngine.ts` | REWRITTEN — real Anthropic Claude LLM integration (P2) |
| `src/utilities/leoProcessMessage.ts` | Added spaceId param, passes spaceId/channel to sessionMemory |
| `package.json` | Added @anthropic-ai/sdk v0.74.0 |

### Environment Variables (Vercel)
```
NEXT_PUBLIC_SERVER_URL=https://angels-os.vercel.app   (set session 2)
DATABASE_URI=postgresql://postgres:K3nD3v!host@74.208.87.243:5432/angels
PAYLOAD_SECRET=(existing)
BLOB_READ_WRITE_TOKEN=(existing)
ANTHROPIC_API_KEY=sk-ant-api03-...   (set session 4 — LEO's brain)
```

### Database Quick Reference
| Collection | Notable IDs |
|-----------|-------------|
| Tenants | 1 (default), 2 (platform), 3 (serenity-massage), 4 (hays-cactus) |
| Spaces | 15 (Angel OS Community), 16 (Angel OS Support), 17 (Serenity), 18 (Cactus) |
| Users | Admin (kenneth.courtney@gmail.com), LEO agents per tenant |

### Slug Uniqueness
Slug indexes are non-unique (dropped via `scripts/drop-unique-slugs.cjs`). If `payload migrate:fresh` is ever run, re-run the script.
