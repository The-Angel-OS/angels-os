# Angel OS — Open Issues & Session Tracker

**Last Updated**: February 15, 2026 (Session 3)
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

---

## Open Issues

### P1: MCP Endpoint Auth for External Angels
**Status**: Blocking Merlin integration
**Issue**: `POST /api/mcp` returns 401 when called from browser or external client. The MCP plugin inherits Payload's auth, but:
- Browser uses cookie auth (which works for collection REST API but not MCP)
- External Angels need API key or JWT auth
**Impact**: LEO can't respond to chat messages (the `leo_respond` tool call fails)
**Fix Options**:
1. Add API key auth layer to `src/plugins/mcp.ts`
2. Have useChat call `/api/messages` + a separate `/api/leo` endpoint instead of `/api/mcp`
3. Forward user's JWT token in the MCP call headers

### P2: ConversationEngine Is a Stub
**Status**: LEO says "I received your message. How can I assist you?" for everything
**File**: `src/utilities/ConversationEngine.ts`
**What's stubbed**:
- Intent detection (only checks for "help" keyword)
- Response generation (hardcoded placeholder)
- Action execution (no path from intent to action)
- State management (basic phase tracking only)
**What works**:
- Agent routing (full 4-level system via AgentRouter)
- Message processing pipeline (leoProcessMessage orchestration)
- Agent personality/capabilities defined in agentConfig
**Fix**: Integrate with Anthropic API or other LLM. The ConversationEngine class has TODOs marking exactly where to plug in.

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

### Commits This Session
- `9690dd1` — fix: Chat message send 400 error + dark theme consistency
- `110607f` — refactor: Resolve spaceId from tenant context instead of hardcoding

### Key Files Modified (Session 3)
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

### Environment Variables (Vercel)
```
NEXT_PUBLIC_SERVER_URL=https://angels-os.vercel.app   (set session 2)
DATABASE_URI=postgresql://postgres:K3nD3v!host@74.208.87.243:5432/angels
PAYLOAD_SECRET=(existing)
BLOB_READ_WRITE_TOKEN=(existing)
```

### Database Quick Reference
| Collection | Notable IDs |
|-----------|-------------|
| Tenants | 1 (default), 2 (platform), 3 (serenity-massage), 4 (hays-cactus) |
| Spaces | 15 (Angel OS Community), 16 (Angel OS Support), 17 (Serenity), 18 (Cactus) |
| Users | Admin (kenneth.courtney@gmail.com), LEO agents per tenant |

### Slug Uniqueness
Slug indexes are non-unique (dropped via `scripts/drop-unique-slugs.cjs`). If `payload migrate:fresh` is ever run, re-run the script.
