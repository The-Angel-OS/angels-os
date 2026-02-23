# Angel OS — Session Handoff: Sprint 16 Complete

**Date:** February 23, 2026
**Branch:** `main`
**Status:** TypeScript clean, build passing, 29 Leo tools, v0.16.0-dev
**Sprint:** Sprint 16 complete (Spaces Management UI) — Sprint 17 next
**Stack:** Payload 3.77.0 · Next.js 16.1.6 · React 19.2.1 · Claude Sonnet 4 · Turbopack
**Last commit:** `ad7b458` (Sprint 16 — Spaces menu header)

---

## Critical Context: The Federation Pivot

**Read this first.** Between Sprint 14 and Sprint 15, the core model was clarified:

- **"Tenant" → "Diocese"** — operators who ARE Angel OS in their territory
- **"Product/service" → "Endeavor"** — the unified constitutional object (business / cause / creator / community / media)
- **Revenue model corrected:** 60/20/15/5 → **70/20/4/1/5** (Endeavor / Diocese / Protocol / Archdiocese / Justice Fund)
- **The Toward-53 Principle** — the split direction is unalterable, asymptotic target 53% to Endeavors
- **Leo Wizard** — Sprint 16's primary deliverable: Diocese comes into existence through a 17-minute Leo conversation
- **Federation = automatic** — Constitution IS the gate, no approval queue

Full specs:
- `docs/planning/260222 CLAUDE_CODE_BRIEFING.md` — the pivot session
- `docs/planning/260223 FEDERATION.md` — federation architecture spec
- `docs/REVENUE.md` — economic model with Toward-53

---

## What Was Done (Sprint 16)

### Spaces Management UI

#### 1. `SpacesMenuHeader` — New Component
**File:** `src/components/ChatControl/SpacesMenuHeader.tsx`
- Thin wrapper that replaces the bare `SpaceSelector` in `MultiChannelChat`
- Desktop layout: `[SpaceIcon] Space Name [▼]   [👥] [⚙] [+]`
- `compact=true` (collapsed sidebar): action buttons hidden, only icon shows
- Props: `spaces`, `activeSpaceId`, `onSpaceSelect`, `onSpaceCreated`, optional `onSpaceUpdated`/`onSpaceDeleted`/`activeSpaceNumericId`
- Manages `createOpen`, `settingsOpen`, `membersOpen` state internally
- Renders `CreateSpaceDialog`, `SpaceSettingsDialog`, `MemberPanel` as children

#### 2. `CreateSpaceDialog` — 4-Step Wizard
**File:** `src/components/ChatControl/CreateSpaceDialog.tsx`
- Step 1 (Info): Space name (required) + optional description
- Step 2 (Visibility): Radio cards — Public / Invite-only / Private — with Globe/Users/Lock icons
- Step 3 (Template): service-provider, retail-commerce, creator-content, booking-based, custom
- Step 4 (Invite): Repeatable email rows with role selectors (member/moderator/guest)
- Calls `POST /api/spaces/create` → switches to new space → `router.refresh()`

#### 3. `SpaceSettingsDialog` — 3-Tab Settings
**File:** `src/components/ChatControl/SpaceSettingsDialog.tsx`
- **General tab:** Name + description + visibility radio (Public/Invite-only/Private) + Save via `PATCH /api/spaces/{id}` + Danger Zone with delete confirmation
- **Applets tab:** Toggle switches — Chat (locked on), Files, Tasks + Save
- **Members tab:** Invite form (email + role + Invite button → `/api/spaces/invite`) + scrollable member list with role badges + Remove buttons

#### 4. `POST /api/spaces/create` — New Endpoint
**File:** `src/endpoints/space-create.ts`
- Auth check + tenant resolution from `x-tenant-id` header (injected by middleware since Sprint 15)
- Creates Space with user-chosen name/slug/description/visibility
- Creates `SpaceMembership` for creator as `space_admin`
- Reads `SPACE_TEMPLATES[template].channels` and creates each channel
- Sends batch invitations via `createInvitation()` + `sendInvitationEmail()` (non-fatally)
- Returns `{ success, space: { id, name, slug }, channelsCreated }`

#### 5. `MultiChannelChat` — Wired to SpacesMenuHeader
**File:** `src/components/ChatControl/MultiChannelChat.tsx`
- Imports `SpacesMenuHeader` (replaces direct `SpaceSelector` import)
- Added `useRouter` from `next/navigation`
- Added `handleSpaceCreated(newId)`: calls `handleSpaceChange(newId)` + `router.refresh()`
- Desktop sidebar: `SpaceSelector` → `SpacesMenuHeader` with `compact={!channelsPanelOpen}`
- Mobile top bar: `SpaceSelector` → `SpacesMenuHeader` (always expanded, always shown)

#### 6. `payload.config.ts` — Endpoint Registered
- Added `import { spaceCreateHandler } from '@/endpoints/space-create'`
- Registered `{ path: '/spaces/create', method: 'post', handler: spaceCreateHandler }`

---

## What Was Done (Sprint 15)

### Security Hardening

#### 1. Middleware: /api Routes Now Receive x-tenant-id
**File:** `src/middleware.ts`
- Matcher previously excluded `/api` — Payload API endpoints never received `x-tenant-id`
- Fixed matcher: `'/((?!admin|_next|_vercel|.*\\..*).*)'` (removed `api|` from exclusion)
- Added path check: API routes inject tenant header and pass through, skip i18n routing

#### 2. detectTenant Edge Cases
**File:** `src/middleware/detectTenant.ts`
- `www.` prefix → returns `null` (was returning `'www'` as tenant slug)
- Bare IP addresses (e.g. `192.168.1.1`) → returns default tenant (was returning `'192-168'`)
- Unknown 2-part hostnames → returns `null` (was returning whole hostname)

#### 3. adminOrSelf Role Check Expanded
**File:** `src/access/adminOrSelf.ts`
- Added `super_admin` and `archangel` to role check
- Super admins were previously restricted to their own user record only — inconsistent with `userHasAccessToAllTenants` in the multi-tenant plugin

#### 4. comments/add Cross-Tenant Injection Blocked
**File:** `src/payload.config.ts`
- Replaced ad-hoc hostname parsing with `detectTenantFromHostname()`
- Added `findByID` validation: parent post/product must belong to the resolved Diocese
- Made tenant required (was previously optional with `...(tenantId != null && { tenant: tenantId })`)
- Prevents: `evil.localhost` POSTing a comment onto a post from `clearwater-cruisin.localhost`

#### 5. COOKIE_DOMAIN Cleared for Local Dev
**File:** `.env.local`
- `COOKIE_DOMAIN=".spacesangels.com"` (from `vercel env pull`) → cleared to empty
- Chrome silently rejected auth cookies on `*.localhost` when domain was set to `.spacesangels.com`

### UX / Assets

#### 6. Favicon PNG Set
**Files:** `src/app/[locale]/(app)/layout.tsx`, `src/app/[locale]/(dashboard)/layout.tsx`
- Replaced `.ico`/`.svg` with PNG set: 64px, 512px, apple-touch-icon
- `generateMetadata()` updated with apple-touch-icon in icons object
- Assets added to `public/`: `favicon.png`, `icon-512.png`, `apple-touch-icon.png`

#### 7. Nav Rename
**Files:** `DashboardSidebar.tsx`, `dashboard/page.tsx`
- "LEO & Spaces" → "Spaces" (desktop + mobile nav, dashboard quick-access card)

#### 8. Chat Horizontal Overflow Fix
**Files:** `src/components/ChatControl/MessageList.tsx`, `MultiChannelChat.tsx`
- `CompactMessageList`: added `overflow-x-hidden` + inner `max-w-4xl` wrapper
- `MultiChannelChat` main area: added `min-w-0 overflow-x-hidden`
- Wide code blocks no longer break the layout on narrow screens

### Documentation

#### 9. Docs Reorganized
- `docs/podcast-ep01.md` → `docs/transcripts/260222 Angel OS podcast-ep01.md`
- Added: `docs/planning/260222 CLAUDE_CODE_BRIEFING.md`
- Added: `docs/planning/260223 FEDERATION.md`

---

## What Was Done (Sprint 14)

### Leo Content Management Tools
**File:** `src/utilities/leo-data-tools.ts`

Six new tools added:
- `create_post` — title, body, status, categories (Lexical richText)
- `update_post` — update any field by post ID
- `create_page` — title, body, slug, status
- `update_page` — update any field by page ID
- `query_media` — search media library by filename/alt
- `manage_categories` — create/update/delete categories

All tools: respect `ctx.tenantId` for Diocese isolation, default to `'draft'` status.
Helper added: `textToLexical()` + `textToContentLayout()` for plain text → Lexical/layout conversion.

### Channel Sidebar Stability
**File:** `src/components/ChatControl/useChat.ts`, `ChatProvider.tsx`
- Added `channelSpaceId` option to `useChat` — sidebar channels always load from the regular space, not `effectiveSpaceId` (which flips to `dmSpaceId` on DM selection)
- Prevents channel list from clearing when switching to a DM

### Email Auto-Reply Loop Prevention
**File:** `src/endpoints/email-poll.ts`
- Detects RFC 3834 `Auto-Submitted` header, `X-Autoreply`, no-reply patterns, OOO subjects
- Skips Leo processing and Resend reply for auto-replies — prevents infinite loop with IONOS auto-responder

### Markdown Rendering
**File:** `src/components/ChatControl/MessageList.tsx`
- Leo messages now render with `react-markdown` + `remark-gfm`
- Code blocks, bold, italic, tables, lists all render properly

---

## Known Issues / Next Sprint Scope

### Priority 1 — Leo Wizard (Sprint 17)
The federation pivot requires a Leo-guided Diocese setup experience:

1. `npx create-angel-diocese` installer
2. Leo wizard: 8-step conversational Diocese onboarding
3. Cryptographic Constitution signing (Diocese joins by covenant)
4. Federation ping: signed introduction JSON to Archdiocese
5. `src/federation/` protocol directory

**Files to create:**
- `src/federation/protocol.ts` — signed HTTP requests, registry ping
- `src/federation/constitution.ts` — signing + verification
- `src/collections/Endeavors/index.ts` — unified Endeavor collection

### Priority 2 — Revenue Model Implementation
Revenue split constants exist in test utilities but need production wiring:
- Update all revenue split constants to 70/20/4/1/5
- `JusticeFundTransactions` should get Diocese-scoped or documented as intentionally global
- `ProcessedStripeEvents` not in multi-tenant plugin — add or document as platform-only

### Priority 3 — Remaining Security Items (from Sprint 15 audit)
These were triaged as future sprint work:
- `ApplicationLogs` access should be `super_admin` only (currently allows `admin` + `archangel`)
- Leo `/api/leo` + `/api/leo/stream` fall back to `DEFAULT_TENANT_SLUG` when `x-tenant-id` missing — should call `fetchTenantByDomain()` instead
- `Reviews` collection: plugin auto-scopes but no explicit `tenant` field defined

### Priority 4 — Integration Bridges
- WhatsApp Business API bridge (Twilio/Meta webhook → `POST /api/bridge/inbound`)
- Stripe Connect vendor onboarding (issue #86)
- Voice mode in chat UI (Web Speech API)

---

## Current DB State

**Diocese:** `clearwater-cruisin` is the active test Diocese
**Admin user:** `kenneth.courtney@gmail.com` — roles: `['super_admin', 'customer']`
**Auth:** COOKIE_DOMAIN is empty in `.env.local` — cookies work on `*.localhost`
**Seed:** `pnpm seed:reset` was run this session to update Kenneth's roles

---

## Environment

```bash
# Dev
pnpm dev               # http://localhost:3000 (platform)
                       # http://clearwater-cruisin.localhost:3000 (Diocese)

# Seed
pnpm seed:reset        # Update roles on existing user without full reset

# Tests
npx vitest run tests/unit/
npx tsc --noEmit
```

**`.env.local` key values (local dev):**
- `COOKIE_DOMAIN=` (empty — required for `*.localhost` auth cookies to work)
- `DEFAULT_TENANT_SLUG=clearwater-cruisin`
- `ANTHROPIC_API_KEY=` (set to your key)

---

## Files Changed (Sprint 16)

| File | Change |
|------|--------|
| `src/components/ChatControl/SpacesMenuHeader.tsx` | **New** — Space selector + action buttons header |
| `src/components/ChatControl/CreateSpaceDialog.tsx` | **New** — 4-step Create Space wizard |
| `src/components/ChatControl/SpaceSettingsDialog.tsx` | **New** — 3-tab Space settings (General/Applets/Members) |
| `src/endpoints/space-create.ts` | **New** — POST /api/spaces/create endpoint |
| `src/components/ChatControl/MultiChannelChat.tsx` | SpaceSelector → SpacesMenuHeader (desktop + mobile); useRouter + handleSpaceCreated |
| `src/payload.config.ts` | Registers /spaces/create endpoint |

---

## Files Changed (Sprint 15)

| File | Change |
|------|--------|
| `src/middleware.ts` | Matcher includes /api; API paths bypass i18n |
| `src/middleware/detectTenant.ts` | www./IP/unknown hostname edge cases |
| `src/access/adminOrSelf.ts` | super_admin + archangel role check |
| `src/payload.config.ts` | comments/add injection fix + detectTenantFromHostname import |
| `.env.local` | COOKIE_DOMAIN cleared |
| `src/app/[locale]/(app)/layout.tsx` | Favicon PNG set + generateMetadata |
| `src/app/[locale]/(dashboard)/layout.tsx` | Favicon PNG set |
| `src/app/[locale]/(dashboard)/dashboard/page.tsx` | "Spaces" rename |
| `src/app/[locale]/(dashboard)/dashboard/DashboardSidebar.tsx` | "Spaces" rename |
| `src/components/ChatControl/MessageList.tsx` | Overflow fix + inner wrapper |
| `src/components/ChatControl/MultiChannelChat.tsx` | min-w-0 + overflow-x-hidden |
| `public/favicon.png` | New 64px PNG favicon |
| `public/icon-512.png` | New 512px PNG icon |
| `public/apple-touch-icon.png` | New 180px apple touch icon |
| `.gitignore` | .vercel + .env*.local added |
| `docs/planning/260222 CLAUDE_CODE_BRIEFING.md` | New — federation pivot session |
| `docs/planning/260223 FEDERATION.md` | New — federation architecture spec |
| `docs/transcripts/260222 Angel OS podcast-ep01.md` | Moved from docs/podcast-ep01.md |

---

## Files Changed (Sprint 14)

| File | Change |
|------|--------|
| `src/utilities/leo-data-tools.ts` | 6 new content management tools |
| `src/components/ChatControl/useChat.ts` | channelSpaceId option |
| `src/components/ChatControl/ChatProvider.tsx` | Pass channelSpaceId: activeSpaceId |
| `src/endpoints/email-poll.ts` | Auto-reply detection |
| `src/components/ChatControl/MessageList.tsx` | react-markdown rendering |

---

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Diocese operator, Clearwater Cruisin*
