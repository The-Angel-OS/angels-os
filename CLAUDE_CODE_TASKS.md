# Angel OS — Open Issues & Session Tracker

**Last Updated**: February 16, 2026 (Session 4b — P2 Complete)
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

### P2.5: Give LEO Data Access (Payload Queries)
**Status**: NEW — LEO can converse but cannot access business data
**Issue**: User asked "Can you tell me what products are in the shop?" and LEO correctly replied he has no access to product databases. The `payload` instance IS available in `sessionMemory` but the ConversationEngine doesn't use it for data queries yet.
**Impact**: LEO can't answer business questions, check inventory, look up orders, etc.
**Fix**: Add tool-use or function-calling pattern to ConversationEngine so LEO can query Payload collections (Products, Orders, Spaces, etc.) and return structured data.

### P2.6: Dashboard Sidebar Architecture (Chat-First UI)
**Status**: NEW — architectural direction from Kenneth
**Vision**: The dashboard sidebar becomes the universal interface:
- Floating chat bubble = brochure site only (guests)
- Dashboard LEO = sidebar-based, NOT a separate full-width page
- Sidebar has 3 states: full width → narrow → hidden
- Channels live INSIDE the sidebar — no separate Spaces interface needed
- Channel widgets (inventory, calendar, tasks) render inline within chat
- The sidebar IS the AI Bus terminal
**Impact**: Eliminates need for separate `/dashboard/spaces` page. All interaction is conversational.
**Files affected**: Dashboard layout, sidebar component, channel navigation, widget rendering

### P3: Transient PostgreSQL Connection Drops
**Status**: Intermittent, self-healing on retry
**Issue**: PostgreSQL at `74.208.87.243:5432/angels` occasionally drops connections, causing 500 errors on Vercel serverless cold starts.
**Impact**: First page load after idle period sometimes shows "Application error" — works on refresh.
**Fix Options**:
1. Add PgBouncer connection pooler
2. Migrate to managed DB (Neon, Supabase, Vercel Postgres)
3. Add retry logic in Payload's DB adapter config

### P4: SpaceMemberships Not Enforced
**Status**: Collection exists, not wired into access control
**Issue**: Any authenticated user can read messages from any space. The `SpaceMemberships` collection tracks user-space-role relationships but isn't checked in Messages/Spaces read access.
**Impact**: No privacy between tenant spaces (all messages visible to all users)
**Fix**: Add access control to Messages.read that checks SpaceMemberships.

### P5: Home Page Placeholder Content
**Status**: Shows "Payload Ecommerce Template" text
**Issue**: The home page still shows the default Payload template content instead of Angel OS branding.
**Fix**: Create a proper home page in the Pages collection via seed script or admin panel.

### P6: Default Space Resolution Order
**Status**: Minor — fetches first space alphabetically instead of main community space
**Issue**: `fetchDefaultSpaceId` queries `spaces` with `limit: 1` but no ordering. For the default tenant, this returns space 16 (Angel OS Support) instead of space 15 (Angel OS Community).
**Fix**: Add `sort: 'createdAt'` or add an `isDefault` flag to Spaces.

### P7: Merlin System Agent Not Registered
**Status**: Pending — instructions written but agent not yet created
**Issue**: Merlin needs to be registered as a system user in the Users collection to be routable by the AgentRouter.
**Ref**: `MERLIN_OPENCLAW_INTEGRATION.md` Section 3.2
**Fix**: Add Merlin to seed script or create via admin panel.

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
