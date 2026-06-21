# Works: Federation Syndication + Hierarchical Nav — Review & Insights

> 260621 ~1905 Claude — review captured at Ken's request ("hold off until everything
> reviewed; you might find insights"). NO CODE SHIPPED. This is the design to sequence.

## Trigger / symptoms reviewed
- `clearwater-cruisin.spacesangels.com/learn/answer53` renders fine (angels DB has it).
- `federation.kendev.co/learn/answer53/about` → **"Document not found."**
- Nimue Works Viewer **errors on the Holy Bible** specifically.
- Bible reader shows a flat "page 16 / 1189" with no book→chapter structure.

## Root cause (verified against live DBs)
The `/learn` reader is **DB-first with a disk fallback**:
- Sidebar/index renders from the **bundled soul manifest** (file shipped in every deploy →
  always shows, even when there's no content).
- Document **body** comes from `getWorkJson` (`src/utilities/getWorkJson.ts:70-89`) → looks up
  the `works` table → if no row, returns null → page falls back to reading `.md` from disk
  (`src/app/[locale]/(app)/learn/[soul]/page.tsx:165`).
- answer53 is **message-backed only** (no `.md` files on disk). The **kendev DB has only 2 works**
  (`angel-os-handbook`, `ready-player-everyone`) — answer53/holy-bible were never replicated there.
- Net: index from file, content from DB → mismatch → "Document not found."

## Decision (Ken, 260621 ~1822)
- answer53 fix = **Option C (federation fetch)**; **kendev.co is the ROOT Angel OS portal and
  should mirror ALL works**.
- Bible nav layer = **hold / design only** for now.

## ⭐ Insight 1 — "federation fetch" must be REPLICATION, not render-time fetch
A render-time cross-node fetch inside `getWorkJson` is a trap the codebase already learned to avoid:
> `src/utilities/federationDiscovery.ts:205` — "Prefer cached gossip … immune to WAF/serverless-egress
> blocks that can defeat a render-time cross-node fetch."

Discovery tried live peer fetch, got blocked by the Vercel→IONOS WAF, and retreated to
heartbeat-carry + read-local. A works reader doing the same would: re-introduce intermittent 404s,
eat a 12s cold-boot timeout per page load, and drag multi-MB works (Bible = 1189 pages) through the
user request.

**Correct shape:** an out-of-band **works replication pull**. The root portal:
1. Knows what every peer hosts (heartbeat already gossips each peer's catalog index —
   `catalogIndex.ts`, cached on `FederationPeers.endeavors[].catalog`).
2. Diffs local vs peer checksums (`/api/works-ops/checksums` already exists).
3. Pulls full content for missing/changed works (`/api/works-ops/get?soul=` already returns it).
4. Upserts a **local subscriber copy** with `canonical.origin` → home (SEO stays with author;
   `Works.canonical` field already exists, `works.ts:90`).
- **Reader (`getWorkJson`) stays local-only — hot path unchanged.** WAF risk confined to a
  retryable background job, never a page render.
- This is the "percolate DOWN to subscribers" half of [[project_works_canonical_syndication]].
- **Option A (manual import) = simply the first run of this sync, by hand** — not throwaway.

Primitives that already exist (reuse, don't rebuild): heartbeat catalog gossip, FederationPeers
roster + domain→origin (`federationDiscovery.ts:36`), Ed25519 signing (`federationClient.ts:130`),
`works-ops/checksums` + `works-ops/get`, `Works.canonical`/`checksum`/`json_version`.

What's NOT needed: the planned render-time `/api/federation/item/:checksum` + getWorkJson remote
fallback. Skip it.

## ⭐ Insight 2 — the Bible nav layer also FIXES the Nimue crash
Works have two content backends: bundled-manifest (Bible, ~1189 flat pages) and message-backed DB
(answer53). Nimue errors on the **Bible specifically** — the one work that ships ~1189 page objects
at once. Almost certainly a payload-size / all-at-once load failure, not content.
- A book→chapter hierarchy is the **lazy-load boundary**: load Genesis on demand vs all books up
  front. **Hierarchy = chunked loading = Nimue stops choking.** The nav layer and the crash are the
  same problem. (Confirm in the Nimue repo before building — separate project.)

## ⭐ Insight 3 — hierarchy belongs on the soul manifest (backend-agnostic)
Nav grouping should be declared on the **soul manifest** (`groups?`/`section`), independent of
file vs message backend, so the sidebar renders uniformly:
- Bible derives groups for free from existing `book`/`bookName`/`chapter` metadata in
  `public/library/holy-bible/manifest.json`.
- answer53 stays flat (no groups declared).
- Sidebar (`SoulViewer.tsx:386`) gains a grouped/collapsible render path; flat stays default.
- This is Ken's "hierarchical layers for all works" instinct at the right altitude: one concept,
  both backends, fixes web + Nimue together.

## Suggested sequence (not started)
1. **Works replication pull** (Insight 1) — root-portal sync job; answer53 + holy-bible land on
   kendev as subscriber copies; reader unchanged. First run can be manual.
2. **Manifest `groups` + grouped sidebar** (Insight 3) — Bible gets book→chapter on web.
3. **Nimue lazy-load by group** (Insight 2) — verify Bible payload-size theory in Nimue repo first.

## Open / to verify
- Is `federation.kendev.co` Vercel- or IONOS-hosted? Determines whether even the *background* pull
  hits the WAF (the IONOS path) or is clean Vercel→Vercel. Confirm before building the sync.
- `kendev.kendev.co` double-subdomain ghost still surfacing (portal-host resolution; separate from
  the above; prior partial fix `13eb474`).
- Confirm Nimue Bible error is payload-size (vs the getWorkJson richText drop noted in
  [[project_nimue_offline_works]]) before assuming hierarchy fixes it.
