# Scotty Sprint 46 — Engineering Instructions

**Date:** April 29, 2026
**From:** Kenneth Courtney (CEO) via LEO + Claude Code session analysis
**Priority:** High — multiple production issues identified and partially resolved

---

## 1. RESOLVED — Pages Collection Crash (Critical)

**Status:** FIXED in production (DB-level fix, no code deploy needed)

**Root cause:** The `Donation` block was added to the Pages collection config (`src/collections/Pages/index.ts`) but the corresponding database tables were never created via migration. Payload's Drizzle ORM generates JOINs across all block tables when querying a collection — the missing `pages_blocks_donation` table caused every `pages` query to throw a SQL error.

**What broke:**
- `/api/pages` returned `{"errors":[{"message":"Something went wrong."}]}`
- `/dashboard/pages` showed "Dashboard hiccup" error boundary
- `/admin/collections/pages` showed blank page
- LEO's `set_page_hero` tool failed (it queries pages collection internally)
- Tenant home page fallback served stale/wrong data from serverless cache

**Fix applied:** Manually created the two missing tables via direct SQL:
```sql
CREATE TABLE pages_blocks_donation (
  _order integer NOT NULL, _parent_id integer NOT NULL, _path text NOT NULL,
  id character varying NOT NULL PRIMARY KEY,
  rich_text jsonb, preset_amounts character varying, show_donor_fields boolean,
  block_name character varying,
  FOREIGN KEY (_parent_id) REFERENCES pages(id) ON DELETE CASCADE
);
-- Plus indexes on _order, _parent_id, _path
-- Plus corresponding _pages_v_blocks_donation version table
```

**Action for Scotty:**
- Generate a proper Payload migration to formalize this: `pnpm payload migrate:create`
- Audit ALL collections for similar block/table mismatches — any block added to a collection config after the last migration (March 21, 2026) without a corresponding migration will cause the same crash
- Consider adding a startup health check that validates all expected block tables exist

---

## 2. RESOLVED — Discover Page www. Prepend Bug

**Status:** FIXED — committed as `d1bcc09`, deployed to Vercel

**Root cause:** Vercel production has `NEXT_PUBLIC_SERVER_URL=https://www.spacesangels.com`. The old Discover page code constructed subdomain URLs as `${tenantSlug}.${serverHost}` where `serverHost` included `www.` — producing `clearwater-cruisin.www.spacesangels.com`.

**Fix:** `src/app/[locale]/(app)/federation/discover/page.tsx` now:
- Uses hardcoded `PUBLIC_DOMAIN = 'spacesangels.com'` constant
- Has `stripWww()` helper for defense-in-depth
- Never uses `serverHost` for URL construction
- Explicitly filters out `.local` and `localhost` domains

**Action for Scotty:** No further action needed — deployed and verified in production.

---

## 3. TO FIX — LEO `set_page_hero` Tool: Tenant Isolation Bug

**Status:** PARTIALLY FIXED (works again after pages table fix, but has a tenant isolation bug)

**The tool works now**, but `handleSetPageHero()` in `src/utilities/leo-data-tools.ts` line ~8530 queries pages WITHOUT a tenant filter:
```typescript
const result = await payload.find({
  collection: 'pages',
  where: { slug: { equals: slug } } as Where,  // NO TENANT FILTER!
  limit: 1, depth: 0, overrideAccess: true,
})
```

If multiple tenants have a page with slug "home" (currently Clearwater Cruisin and Tom Stalcup both do), this returns whichever page the DB returns first — potential cross-tenant data mutation.

**Fix:** Add tenant scoping using `ctx.tenantId`:
```typescript
const where: Where = { slug: { equals: slug } }
if (ctx.tenantId) {
  where.and = [{ slug: { equals: slug } }, { tenant: { equals: ctx.tenantId } }]
}
const result = await payload.find({
  collection: 'pages', where, limit: 1, depth: 0, overrideAccess: true,
})
```

**Priority:** High — this is a tenant isolation violation.

---

## 4. TO FIX — LEO `log_maintenance_note` Tool: Parameter Mismatch

**Status:** Tool works but LEO (Claude AI) sends wrong parameter names

**The tool schema** requires `title` and `details` fields. The handler has fallback field names (`summary`, `subject`, `description`, `message`, `text`, `note`) but LEO's AI model sometimes sends parameters like `task`, `content`, or `body` which don't match any fallback.

**Fix (resilience):** Add more fallback field names in `handleLogMaintenanceNote()` at line ~11421:
```typescript
const title = ((input.title || input.summary || input.subject || input.task || input.content) as string)?.trim()
const details = ((input.details || input.description || input.message || input.text || input.note || input.body || input.content) as string)?.trim()
```

And/or update the tool description to explicitly tell LEO to use `title` and `details` parameters.

**Priority:** Medium — workaround exists (Kenneth can relay to Scotty directly).

---

## 5. TO BUILD — YouTube Playlist Ingestion

**Status:** Not started — feature request from Kenneth

**Current state:** LEO has `ingest_youtube_channel` (all recent videos from channel) and `ingest_youtube_url` (single video). Kenneth needs playlist-level ingestion to sync specific playlists to posts.

**Requirements:**
- New tool `ingest_youtube_playlist` or enhancement to existing tool
- Accept playlist ID or full playlist URL
- Create/update posts for each video in the playlist
- Map to correct tenant (Clearwater Cruisin for Kenneth's YouTube content)
- Kenneth has ~400 videos, 33K views/day, 130K impressions — this is active content

**Priority:** Medium — Kenneth is managing content growth and needs this for scaling.

---

## 6. CONFIGURE — Tom Stalcup for Congress Site

**Status:** Site is live at `tomstalcup.spacesangels.com` but bare

**Current state:**
- Tenant ID: 10, slug: `tomstalcup`
- 4 posts created (no images attached)
- 4 products created (Campaign Contributions $25/$100, T-Shirt, Yard Sign)
- Branding configured: Navy `#233359` / Red `#E3171D`, Montserrat/Open Sans
- 0 media uploaded — all posts show "No image" placeholder
- No hero banner on homepage
- Deal: 20% revenue share (documented in `memory/project_tom_stalcup_deal.md`)

**To complete:**
1. Upload campaign photos (Kenneth has Google Photos of Tom)
2. Attach images to all 4 posts via admin or LEO
3. Set homepage hero banner with a campaign rally photo
4. Set tenant logo (headshot)
5. Verify products are visible on `/shop`
6. Test Stripe checkout flow for campaign contributions

**Blocker:** Tom Stalcup is not responding to Kenneth's texts. Kenneth can proceed with configuration using photos he already has — Tom's approval is not needed for site setup since the deal (20% rev share) was already agreed.

---

## 7. OPERATIONAL — Token Usage Minimization

Kenneth has directed LEO to minimize cycles and token usage during this waiting period. No proactive federation heartbeats, no unnecessary tool calls. LEO should remain responsive but quiet until there's active federation traffic or explicit user requests.

---

## 8. PENDING — Input Streams (Sprint 46 Planned)

These are planned but not yet started:
- X/Twitter OAuth connector for Kenneth → Clearwater Cruisin
- Tyler (tylersuzanne84@gmail.com) Google + Discord auth → Angel OS Core
- `InputStreams` Payload collection (new)
- Windows clipboard bridge daemon
- Gmail monitor (clearwatercruisin@gmail.com → Clearwater Cruisin subspace)

**Priority:** Deferred until core site stability issues are resolved.

---

## 9. AUDIT — Missing Pages for Tenants

**Finding from site review:**
- Angel OS Platform (tenant 1): 0 pages — uses `homeStaticData()` fallback ✓
- Clearwater Cruisin (tenant 5): 2 pages (home, contact) ✓
- Hays Cactus Farm (tenant 7): 0 pages — uses `tenantHomeData()` fallback
- HelpDNA (tenant 8): 0 pages — uses `tenantHomeData()` fallback
- Tom Stalcup (tenant 10): 2 pages (home, contact) ✓

The fallback `tenantHomeData()` works but produces a generic template. Hays Cactus and HelpDNA should get proper CMS-managed home pages with their branding and content. This can be done via the seed script or via admin.

---

## Summary — Priority Order

| # | Issue | Status | Priority |
|---|-------|--------|----------|
| 1 | Pages collection crash (missing DB table) | ✅ Fixed | — |
| 2 | Discover page www. bug | ✅ Fixed | — |
| 3 | `set_page_hero` tenant isolation bug | 🔴 To fix | High |
| 4 | `log_maintenance_note` parameter mismatch | 🟡 To fix | Medium |
| 5 | Tom Stalcup site images/config | 🟡 To do | High |
| 6 | YouTube playlist ingestion | 🟡 To build | Medium |
| 7 | Create pages for Hays Cactus & HelpDNA | 🟡 To do | Low |
| 8 | Generate proper Payload migration | 🟡 To do | Medium |
| 9 | Input Streams system | ⬜ Planned | Deferred |
