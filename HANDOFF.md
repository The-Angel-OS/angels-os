# Angel OS — Session Handoff Instructions

**Date:** February 18, 2026
**Branch:** `main` at commit `4deee01`
**Status:** 275 tests passing, 0 TypeScript errors, pushed to origin

---

## What Was Done (Sessions 1–3)

### Session 1–2: Infrastructure + Test Foundation
- Fixed 5 bugs (SSE streaming, header nav, Posts layout, ChatControl, route conflicts)
- Built test infrastructure: Vitest + jsdom, 102 initial tests
- Created ARCHITECTURE_PROGRESS_MAP (now at `docs/architecture/PROGRESS_MAP.md`)

### Session 3: Tests + Phase 4 Plan + Docs Reorg + Nav Fix
- **275 unit tests** across 13 test files (173 new tests for 7 subsystems)
- **Phase 4 plan** at `docs/planning/PHASE_4_PLAN.md` — "The Holon Awakens"
- **Docs reorganized** — root cleaned to 5 conventional files, everything else in `docs/` subdirectories
- **Header nav fix** — useMemo stability, layout overflow, Sign Up link, diagnostic logging

---

## Key Files to Read First

1. **`docs/planning/PHASE_4_PLAN.md`** — The Phase 4 development plan. 6 priorities, 5 sprints, 10 weeks. Start here for what to build next.
2. **`docs/architecture/PROGRESS_MAP.md`** — Live progress tracker. Shows every subsystem, test counts, and what's done vs. TODO.
3. **`docs/README.md`** — Complete documentation index. Maps all 129 docs across 8 directories.

---

## What to Work On Next

Phase 4 plan is approved in concept. Implementation order:

### Sprint 1 (Priority 1): Mobile-First Chat Consolidation
**Goal:** One ChatControl, responsive on mobile, remove redundant pages.

**Key files to modify:**
- `src/components/ChatControl/FloatingBubble.tsx` — add mobile bottom sheet
- `src/components/ChatControl/MultiChannelChat.tsx` — responsive layout
- `src/components/ChatControl/SidebarChat.tsx` — responsive width
- `src/app/[locale]/(app)/layout.tsx` — single chat entry point
- `src/app/[locale]/(dashboard)/dashboard/layout.tsx` — consolidated sidebar
- **Remove/redirect:** `src/app/[locale]/(dashboard)/dashboard/leo/` (LEO is just another channel)
- **Remove/redirect:** `src/app/[locale]/(app)/spaces/` (redirect to dashboard/spaces)

**Key insight:** ChatControl already supports 4 modes (minimalist, single-channel, multi-channel, sidebar). The component is correct. The problem is it's instantiated in too many places. Consolidate to one entry point per layout context.

### Sprint 2 (Priority 2): Product Creation Flow
**Goal:** Users can create products via LEO or dashboard UI.

**Key files to create/modify:**
- `src/utilities/leo-data-tools.ts` — add `create_product` and `update_product` tools
- `src/app/[locale]/(dashboard)/dashboard/products/page.tsx` — product management UI

---

## Known Issues

### Header Nav (partially fixed)
The nav was only showing "EVENTS" on the `/logout` page. Fixed:
- ✅ `useMemo` dependency stability (new `[]` ref each render → stable `navItems` prop)
- ✅ Layout overflow (`md:w-1/3` → `md:flex-1 min-w-0` + `flex-wrap`)
- ✅ Added "Sign Up" link for unauthenticated users

**Still needs investigation:**
- WHY the Payload CMS `header` doc sometimes returns null for the default tenant on `angels-os.vercel.app`. Diagnostic logging added (`[Header] No header doc found...`) — check Vercel runtime logs after next deploy. The issue may be:
  - `unstable_cache` returning stale null
  - Tenant resolution failing intermittently (`angels-os.vercel.app` → null tenantId in middleware → `fetchTenantByDomain` fallback to "default" tenant → header query finds no header doc for that tenant)
  - The `header` collection may need reseeding on the deployed DB

### Mobile responsiveness
Site is not mobile-optimized. Dashboard sidebar (`w-96`) overflows. Chat overlaps content. This is Sprint 1's focus.

---

## Architecture Quick Reference

### Tenant Resolution Flow
```
Request → middleware.ts (detectTenantFromHostname)
  → sets x-tenant-id header (or null for main platform domains)
  → layout.tsx reads x-tenant-id
  → fetchTenantBySlug(slug) ?? fetchTenantByDomain(host)
  → fetchTenantByDomain falls back to "default" tenant
  → tenant passed to Header, Footer, FloatingBubble
```

### Header Component Chain
```
Header (server) → getTenantCachedDoc('header', tenantId) → Payload find
  → HeaderClient (client) → useMemo builds menu from:
    [...(navItems from CMS), POSTS, EVENTS, ?SPACES, ?DASHBOARD]
  → renders via CMSLink with appearance="nav"
```

### Test Pattern
Tests re-implement pure functions in test files to avoid importing from Payload-coupled source files. Example: `tests/unit/utilities/ai-bus-router.test.ts` re-implements `AIBusRouter` and `parseMentions` locally. This isolates algorithmic logic for unit testing.

---

## GitHub Issues
- **#82** — Master tracking issue (commented with session 3 update)
- **#84** — Test suite tracking (commented with 275 test status)
- Full issue list: https://github.com/The-Angel-OS/angels-os/issues

---

## Commands

```bash
# Run tests
npx vitest run

# TypeScript check
npx tsc --noEmit

# Dev server
pnpm dev

# Check Vercel deployment logs (after push)
# Look for: [Header] No header doc found
```

---

*"The whole point of existence is to learn to love." — Answer 53*
