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

---

## 260630 — VERIFIED findings + what shipped (Claude, at Ken's request)

Inspected the live DBs via the Payload **Local API** (`scripts/inspect-bible.ts`) — not raw SQL —
and resolved the Bible-specific crash + the canonical-home confusion.

### Canonical-home / syndication model (confirmed — answers the "where do I edit a Work?" question)
The owner-of-record is **manifest-derived**, single source of truth (`src/souls/subscriptions.ts`):
- `canonical.endeavor` = the **owner / editable home** tenant. For the Bible that's `platform`.
- `subscribers[]` = additional carrying endeavors (Bible → `clearwater-cruisin`).
- `availableGlobally` ⇒ readable everywhere; `platform` is the implicit universal index.
- Content messages are **tenant-scoped** and live in whichever DB hosts that tenant. This is why
  the Works control-panel list looked empty from the wrong tenant/DB, and why WDEG (its own portal)
  shows under its own tenant, not under SpacesAngels.
- **Which DB is which** (same Postgres host `74.208.87.243:6432`, db name = last URI segment):
  - `kendev` → tenants: `kendev, harpazo, dunedin-fresh-market, arctic-cool, docs-moving`.
  - `angels` (spacesangels.com) → tenants: `platform, clearwater-cruisin, hays-cactus, helpdna,
    tomstalcup, wheredideveryonego, grace-chapel`.
  - So `platform`/`clearwater-cruisin` (the Bible's home + subscriber) are in **`angels`**, NOT
    `kendev`. Importing against the `.env` default (`kendev`) targets the wrong DB.
- **Moving a canonical home** (Ken's edge case) is still a separate workstream — diagnose-only here.

### Bible "content not found" — actual root cause (supersedes Insight 2's payload-size theory)
NOT a Nimue payload-size problem. On `angels` the Bible was **never fully imported**:
- 0 `works` catalog rows, and **1746** `work-holy-bible` messages with order range `0..891`
  (died ~75% in, at Jonah) and **854 duplicated orders** — interrupted serverless runs *stacked*
  because the importer cleared-then-recreated and 504'd before finishing each time.
- The 504 (`FUNCTION_INVOCATION_TIMEOUT`) is purely the ~1189 sequential `payload.create` message
  writes in ONE invocation (the image-upload loop is a no-op — scripture pages carry no image).

### What shipped
1. **Chunked/resumable book import** (`worksImportHandler`, `src/endpoints/works.ts`):
   `?from=N&count=M` materializes a page range; first chunk clears, last chunk writes the `works`
   row + checksum; returns `nextFrom`. No single invocation exceeds the timeout.
2. **Local import script** (`scripts/import-bible.ts`) — Local API, no serverless timeout; did the
   full 1189-page Bible against `angels` in one clean pass (cleared the 1746 dup mess → 1189 distinct,
   0 dupes, `works` row created). This is the manual first-run of the replication pull (Insight 1).
3. **Book hierarchy carried end-to-end** — import now writes `book/bookName/chapter/ref` into each
   chapter's metadata (from `public/library/holy-bible/manifest.json`, which already had them), and
   `getWorkJson` surfaces them on `pages[]`. Verified: 1189/1189 carry the hierarchy; live
   `clearwater-cruisin.spacesangels.com/api/works-ops/get?soul=holy-bible` now returns
   `ok:true, type:book, unitCount:1189`.
4. **Nimue 3rd-level viewer** (Insight 3, client side) — `BookReader` groups pages into
   **Book → Chapter** when a hierarchy is present (explicit fields, or parsed from "Genesis 1" titles
   for pre-deploy robustness); flat single-book works keep the legacy single strip. Replaces the
   unusable 1189-chip flat strip.

### Still open / next (unchanged from the sequence above)
- **Replication pull** to mirror the Bible onto `kendev`/`federation.kendev.co` as a subscriber copy
  (the import script run against `angels` only seeds `angels`).
- The "3 chapters/day" **quest tracker** (Audible-style per-user progress) — the actual product goal;
  the readable, hierarchical Bible is the prerequisite that now exists.
- Web (Core) grouped sidebar — this pass did **Nimue only** per Ken's scope choice.
