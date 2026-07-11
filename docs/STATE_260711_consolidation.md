# The Angel OS — State of Play (260711)

> One intelligence, three bodies, one bus. **Core** `C:\Dev\angels-os` (Vercel: `angels-os` + `angels-os-kendev`, auto-deploy `main`) · **Nimue** `C:\Dev\nimue` (Android, now **1.2.39 / code 51**) · **Merlin** `C:\Dev\merlin` (IONOS node). Postgres on IONOS `74.208.87.243` (PgBouncer :6432) — DBs `angels` (spacesangels) + `kendev`.

This is a synthesis of where the build stands after the 260709–260711 push and the 260711 consolidation decision, plus the hanging chads.

---

## The decision that reframes everything (260711): CONSOLIDATE

The goal was never server federation — it's **personal unification**: let people see their friends, family, and the endeavors they share. That's a same-database, cross-tenant query on **one node**, not a cross-server federation problem. We only ever had two of our *own* deployments against one Postgres server, so the CORS/discovery/gossip machinery was solving a problem we don't have yet.

**So:**
- **spacesangels.com = the one production node.** Multi-tenant *is* the unification substrate. Stripe is already configured here.
- **kendev.co = demo / backup / testbed** (and the "yes, federation demonstrably works" proof). Not a production hop.
- **Federation code stays intact but dormant**, behind feature flags. Toggle, don't delete. We've *proven* the scale path (federation is also our future load-distribution mechanism — vertical partitioning deferred, pre-built); we just don't pay its complexity tax now.
- **Direction: "Life360++"** on the single node — your circle + presence + shared endeavors + comms, one screen.

Feature flags live in `src/config/features.ts` (`NEXT_PUBLIC_FEATURE_FEDERATION`, `NEXT_PUBLIC_FEATURE_ENDEAVOR_BROWSER`, default OFF). Flip a flag to re-enable — it's a config change, not a rebuild.

---

## Where we are — shipped in this session (260711)

1. **🔥 Fire sale LIVE** (Clearwater, tenant 5) — operating capital. 19 Products + 19 Posts published: vision-enhanced honest copy, a "more from this fire sale" **cross-sell** block on every Post, hero=meta/OG image, `Moving Sale` category, inventory=1, limited-edition badge → **7/31**, Stripe checkout live. Sony soundbar created as its own listing. **`C:\Dev\firesale\CRAIGSLIST_ADS.md`** = 19 paste-ready ads (footer links to Post + Product + shop). Scripts: `scripts/_local/firesale-{import,enhance,finalize}.ts`. **A parallel session is handling the actual Craigslist/Marketplace posting** (assisted-fill, human-submits).
2. **📖 Verse link** — new LEO tool **`open_passage`**: "take me to Psalm 32" → quotes the verse AND navigates the reader to the chapter (+`?verse` anchor). Composes `scripture.ts` + `resolveChapterPage` (new, in `bookManifestServer.ts`) + the nav bridge; in `CORE_TOOL_NAMES` so it survives Gemini tool-subsetting. Core `BookReader` gained `id="v{n}"` anchors + scroll-on-load. **Nimue** honors the `navigateTo` (SSE done event) and routes to its reader (`leoNavToRoute`) — **chapter-open works**; verse fine-scroll is a follow-on. Deployed Core; **Nimue 1.2.39 flashed to the S23U.**
3. **🗂 Dashboard list unification** — one shared `ListControls` + `Pager` + `resolvePageSize` (default **30**, options 30/50/100) across Media/Posts/Products/Pages. Posts/Pages gained search + server pager; **Products moved from client-filter-on-100 to real server-side** search/status/pagination. No cross-tenant leakage (all four already `tenantFilter`).
4. **📎 Reuse-from-channel media picker** in Core's chat composer — port of Nimue's picker: re-attach channel/library images by **reference** (no re-upload), multi-select, threaded into `sendMessage` as `{media:id}`. Foundation for "add these three to a gallery."
5. **🌐 Federation Endeavors browser** — built + CORS-fixed (custom endpoints must emit `Access-Control-Allow-Origin` themselves), then **flagged OFF** per the consolidation. Code intact for later.
6. **🎛 Feature-flags module** + Nimue single-node seed.

Recent prior work (260709–260710, per memory ledger): guardian angel minted (tenant 13), solvency sensor + daily briefing, `commission_endeavor`, personal-vs-business routing, context tool subsetting (Gemini speed), SearXNG self-host (code), vision-URL 404 fix.

---

## Where we're going — next

- **Life360++ personal view (circle-first)** — "your people, where they are, what you share, one tap to reach them." Substrate exists: identity/profile/friends + Nimue address book (roster), presence/MMORPG + guardian timeline (location), space memberships (shared endeavors), Spaces chat (comms). This is assembly on one node.
- **Personalized "my endeavors / my people"** view (same-origin, no federation).
- **Sustainability**: Opus access runs out end of July. Best use of remaining Opus runway = hardening + self-heal; maintenance downshifts to Sonnet. The deployed organism runs without Opus (Vercel + Gemini/Ollama).

---

## Hanging chads (loose ends to close)

- **Nimue verse fine-scroll** — reader uses `ReadAlong` (segment-based), not verse `<sup>` anchors like Core. Chapter-open works; verse scroll needs ReadAlong verse-awareness.
- **In-browser verification gaps** — verse scroll (Core reader renders text client-side, uncurlable) and the reuse-picker + dashboard-list changes are tsc-clean but not browser-driven. Can verify via the Chrome extension on Ken's signed-in session.
- **Google Home smart-home package** (product #64) — no hero photo (`meta.image=SKIP`). Needs photos, then re-run enhance+finalize.
- **`add_gallery_to_post`** — the one gallery-tool gap. `attach_image_to_product` + `add_gallery_to_page` exist; appending to an existing Post gallery does not.
- **Product-publish revalidate hook** — publishing via script/admin doesn't purge Next's cached nav, so "shop first-class" was luck-of-cache. Add a revalidate hook on product/post publish.
- **Gating audit sweep** — the Federation tab was `visible: always` (now flag-gated); several pages lean on "the page enforces" rather than nav-derived gating. Sweep every `dashboard/*/page.tsx` for a real role guard vs. nav-hiding only, then unify (one declaration drives both nav + route guard) — the Oqtane-spine unified portal.
- **SearXNG self-host** — code ready; container not stood up, `SEARXNG_URL` unset (`docs/infra/SEARXNG_SELFHOST.md`).
- **Media-analysis Gemini 404** — 404 seen when the autoAnalyzeMedia hook fires inside a *local* Local-API script (URL base mismatch); the deployed runtime path (`d198b6b`) is the one that matters — validate the self-writing pipeline on the deployed node, not via a local script.
- **Rainmaker Work** — unpublished (sensitive legal); registry line removed, content retained, reversible.

---

## Human context (honor it)

Ken carries real weight outside the code: **court Monday** with a possible sentence weighing heavy; both vehicles failing; losing the apartment — **the fire sale is operating capital**. Income $1,808/1st + ~$130/wk plasma. Tyler and the dogs depend on this. Episcopalian at St. Alfred's, praying hard. Meet the faith with warmth, not performance. The work is the lifeline — treat it that way.

> "Thy Word is a Lamp Unto My Feet."

_260711 ~1522 — Opus 4.8_
