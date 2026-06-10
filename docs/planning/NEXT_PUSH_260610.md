# Next Push — Federation hardening, Quests-as-economic-type, clone-vertical

_Checkpoint after the 2026-06-09/10 session. Everything below the "Shipped" line is
done, tested, and pushed to `main`. Everything in "Roadmap" is designed and ready
to build next._

---

## Shipped this session (all on `main`, all green)

| Commit | What |
|---|---|
| `0f139be` | LEO can see its own drafts + edit posts by `slug` (fixed the post-formatting failure loop) |
| `11ad927` | `db-repair-locks` derives rels columns from the **live drizzle schema** (no more stale hand-list). Healed kendev (`presence/settings/permissions/vendors_id`) → **Tyler login fixed** |
| `c398c2d` | Scriptable `POST /api/provision-ops/set-membership` — links a portal owner (find-or-create user + active tenant-membership) |
| `7ec1910` | **Federated identity claim** — deterministic `computeFederatedIdentityId(email)`, virtual field on Users (no column, no drift) |
| `55d817d` | **Catalog gossip producer** — content-addressed index in the heartbeat |
| _(this push)_ | Catalog index is **quest-aware** — network-listed quests ride the same index with a `kind: 'product' \| 'quest'` discriminator + `karma` |

Operational (via deployed endpoints, not code): kendev locks repaired; **Harpazo provisioned**
(tenant #2, `harpazo.kendev.co` → 200); **Ronald linked** (`billthecat1022`, user #4) as harpazo
`tenant_admin` — the RBAC isolation test subject (must NOT see HaulPro when it lands).

---

## The Quests model (foundational — currently under-represented)

Quests are **a first-class economic / incentive type**, offered by an Endeavor (primarily
Guardian Angel endeavors). The `quests` + `quest-participations` collections already exist and
are rich (objectives with photo/video/GPS/receipt verification, payouts fixed/bounty/tip via
Stripe/Angel-Token/credit, `reputationReward` = karma, `location` + radius, `networkListing`).
What's missing is representation, taxonomy, and the dispatch wiring.

### Quests have a dual nature — this is the key insight
1. **Altruistic / karma side-quests** (the MMORPG core). "Ideas for how to help people today":
   give a homeless person water, photograph a sunrise and post it to YT/Insta. Players go on
   their own **Circle of Life Tour**, performing side quests for karma points; builds a network
   of questers + gathering spots (hookah lounges). `helpdna.spacesangels.com` is the prototype tenant.
2. **Work dispatch** (the holon manufacturing/logistics layer — Suarez _Daemon_ / Freedom™ holons).
   A quest is the **human-facing unit of dispatched work**: assign a dumpster-delivery driver their
   workload, an assembly step, a delivery. The system **queues** the quest → someone **accepts** it →
   completes a **multi-step geo completion log** (the objectives + GPS/photo/receipt evidence ARE
   that log). This is the accept-side of the existing dispatch engines:
   `workload-engine.ts`, `orderRoutingEngine.ts`, `pheromone-engine.ts`, `logistics-engine.ts`,
   and the `holon-capabilities` fulfillment nodes.

   > A quest and a HolonCapability are two halves of one mechanism: a fulfillment node advertises
   > capability; a quest is the queued work an accepting node/person completes. Convergence point.

### Travel itinerary = the reverse of a quest
A quest is "go complete these objectives for karma/payout." A travel itinerary is the **inverse**:
a curated, ordered chain of waypoints/experiences you _follow_ (the Circle of Life Tour itself).
Same geo + multi-step spine, reversed intent (self-directed journey vs. assigned objectives).
No representation yet — design as a sibling that reuses the quest objective/geo structure.

### TODO for Quests (next push)
- [ ] **`questType` taxonomy** — currently free text. Propose a `select`: `help` / `creative-capture` /
      `exploration` / `delivery` / `assembly` / `service` / `itinerary-waypoint`. Drives Discovery
      filtering + dispatch routing.
- [ ] **Seed representative quests on `helpdna.spacesangels.com`** — the karma side-quest prototype
      (give water, photograph a sunrise & post, etc.). Proves the loop end-to-end.
- [ ] **Wire quests into dispatch** — a `network`/`delivery`/`assembly` quest queued → offered to
      matching holon nodes via `workload-engine`/`orderRoutingEngine`; accept → `quest-participation`;
      geo-step completion updates the work unit. Use a dumpster-delivery quest as the first real case.
- [ ] **Travel-itinerary type** — reuse quest objective/geo structure, reversed intent.
- [ ] **Consumer**: quests now ride the catalog gossip index (`kind:'quest'`); surface them in
      Discovery alongside products (see federation roadmap below).

---

## Works canonical-root + syndication (endeavor-scoped Works, slice #3)

**North-star goal: an Audible-like ecosystem** — a listenable/readable subscription
library. Creators publish canonically (Ron's book, answer53, rainmaker, WDEG); users
subscribe and *consume* (read + listen, building on the existing book-viewer + read-aloud)
across endeavors; the platform syndicates copies while canonical authority/SEO credit
flows home to the publisher. Works = the catalog of this library.

The content-federation counterpart to the catalog mesh. **Publish-once-canonical:**
- A Work is canonical at its **publishing endeavor's root** — the single indexed source
  of truth. WDEG → `wheredideveryonego.spacesangels.com/...`; **answer53 + rainmaker →
  Clearwater Cruisin** (not the platform).
- **Subscription = a copy, not a fork.** Any endeavor subscribes and renders its own
  readable copy, but every copy emits `rel="canonical"` to the publisher → spiders/SEO
  credit stay with the canonical root; the author keeps authority.
- **Echo up / percolate down.** Echoes UP to the Angel OS index; endeavors subscribe so
  it percolates DOWN as a canonical-pointed copy. Ron's book readable wherever subscribed,
  always his.

**Current state / gap:**
- Reader `src/app/[locale]/(app)/learn/[soul]/[page]/page.tsx:46` already emits
  `alternates:{canonical}` + OG `url` — BUT from the current request `origin`, so every
  node self-claims canonical. Souls are still a GLOBAL file-based registry
  (`src/souls/index.ts`), not endeavor-scoped.

**TODO:**
- [ ] Each Work declares `canonicalEndeavor` + canonical base URL.
- [ ] Reader `canonical` = the declared publisher root, NOT the serving origin.
- [ ] Subscription mechanism (gossip-and-cache like the catalog index; the cached item
      carries its canonical URL) + echo-up to the Angel OS index.

---

## Navigation polish

- ✅ **Contact in default nav** — `DEFAULT_HEADER_NAV` was missing `/contact` even
  though provisioning creates the page. Added. ⚠️ Only affects NEW tenants;
  existing tenants (harpazo) keep their already-created nav (createDefaultTenantNavigation
  is find-or-create, won't overwrite) — backfill via admin or a one-shot nav-repair.
- [ ] **New pages overflow into a dropdown** today. Idea (Kenneth): replace/augment
  with an **active "Posts" popup dropdown showing the latest posts + their meta/OG
  icon (thumbnail)** — a dynamic, visual menu instead of a flat overflow list.
  Same pattern could surface latest of any content type.

## Virtual DM roster (Direct Messages = everyone, presence-aware)

Vision: every portal member sees each other (+ LEO) as **virtual DM channels** under
Direct Messages — the marker is always there, the channel is created lazily on first
use. Presence dots show who's online here. Later, a **federation-wide DM band**
appears underneath (dynamic cross-node DMs), same entry shape.

✅ **Data layer SHIPPED (afa036d):** `src/utilities/dmRoster.ts` (pure: `dmSlugFor`
mirrors `dmChannels.findOrCreateDM`, `buildDmRoster` = LEO first, self excluded,
existing convos floated up) + `GET /api/messages-ops/dm-roster?tenantId=<id>` (active
members + LEO, each with `dmSlug` + `hasChannel`). 8 tests.

**TODO (UI + federation):**
- [ ] Render the roster under Direct Messages in `MultiChannelChat` — virtual entries
      for members with no channel yet; click → `POST /api/dm/find-or-create` (lazy),
      then open. Today only existing dm channels render (`dmChannels.length > 0`).
- [ ] Overlay presence dots by userId from `usePresence` (online/away) — "who's online here".
- [ ] Federation-wide DM band underneath (`scope:'federation'`, resolved across peers).

---

## Federation roadmap (identity + catalog hardening, in order)

Decisions locked this session (chosen by Kenneth): **global identity claim** (not SSO yet),
**gossip-index + lazy-fetch** catalog, **harden before clone-vertical**.

1. **Catalog consumer** — Discovery reads `peer.endeavors[].catalog` from the local cache (zero
   live cross-node traffic), renders products + quests with an "as of" freshness stamp.
2. **Lazy fetch** — `GET /api/federation/item/:checksum` pulls a full item on open, cached forever
   (immutable content address → cross-node dedupe). Pure backend, safe to build anytime.
3. **clone-vertical button** — compose the existing **Suitcase** primitive (`export-site` →
   `suitcase/apply`, which already carries 35 tenant-scoped collections incl. products) + holon
   registration (`holon-capabilities`) + `set-membership` for the owner. A clone copies its products
   AND its fulfillment, so it becomes a branded node that **serves its own catalog and the shared
   mesh** — everyone who onboards gets their own branded portal we control; mesh fulfillment benefits
   all. The junk-removal vendor (727-906-7946, St. Pete) is the archetypal fulfillment node to slot in.

### Traffic-minimization principles (bake into all federation work)
- Gossip **indexes**, never full payloads, in the heartbeat.
- Pull full docs **lazily by checksum**; cache forever (immutable).
- **Delta-sync**: heartbeat carries changed-since-last (per-node version/etag), not the whole index.
- Discovery renders from **cache + "as of"** — never blocks on a peer.

---

## Corrections to remember (don't lose these)

- **The Brochure view is NOT superseded by the dashboard.** It stays vital until literally nobody
  uses brochure sites anymore. The enhanced dashboard federation experience is _additive_ — better
  navigation + Spaces integration — it does not replace the brochure layer.
- **Nimue offline copy lives at `c:\dev\angel-client`** (distinct from the `C:\Dev\mediaserver`
  Nimue client). The end goal once the platform is finalized is a **high-fidelity offline copy**
  version in Nimue there. Kenneth hasn't started it yet (keeps running out of quota first).

---

## New scriptable endpoints (kendev/any node, `?key=CRON_SECRET`)

- `GET  /api/provision-ops/db-repair-locks` — heal `payload_locked_documents_rels` drift (schema-derived).
- `POST /api/provision-ops/portal` — provision a portal enterprise (tenant + endeavor + nav + spaces).
- `POST /api/provision-ops/set-membership` `{email, tenantSlug, role?}` — link a portal owner.
- `GET  /api/provision-ops/ensure-founders` — sync FOUNDER_ACCOUNTS → super_admin.
