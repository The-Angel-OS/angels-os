# Market Vendor Vertical — Pinellas County Go-To-Market

**Date:** 2026-06-16
**Thesis:** Take the Hays Cactus Farm site template and replicate it out to local-market vendors who have no payment/website solution. Group them under a `makerspacepinellas` parent portal, let participating vendors interlink on the Discovery page, and provision a vendor on the spot — at the market, off a laptop.

This is the [Community OS verticals](../strategy/COMMUNITY_OS_VERTICALS.md) thesis applied to **markets as fractal endeavors** (a market is an endeavor; each vendor stall is a child endeavor) and the [LEO factory principle](build the factory, not the prototype): every step here ships as a LEO tool first, UI button second.

---

## 1. Pinellas County Weekly Markets (the target list)

Low-hanging fruit = recurring markets with published vendor directories. Walk the directory, find vendors with no site / Instagram-only / Etsy-only presence, offer them a solution.

| Market | Day / Time | Location | Scale | Directory |
|--------|-----------|----------|-------|-----------|
| **St. Petersburg Saturday Morning Market** | Sat 9–2 (Al Lang lot Oct–May / Williams Park Jun–Sep) | 101 1st St S, St. Pete | Large, established | saturdaymorningmarket.com (vendor list published) |
| **Clearwater Farmers & Flea Market** | Sat **&** Sun 7–2 | Clearwater | 200+ vendors | pinellasmarket.com |
| **The Market Marie @ Coachman Park** | 2nd Sat monthly | Coachman Park, Clearwater | 130+ vendors | themarketculture.com |
| **Dunedin Downtown Market** | Sat 9–1 | 420 Main St, Dunedin | 50+ vendors | downtowndunedin.com |
| **Safety Harbor Market** | (seasonal/weekend) | 401 Main St, Safety Harbor | Mid | safetyharbor market listings |
| **Tarpon Springs Market** | (weekend) | 160 E Tarpon Ave, Tarpon Springs | Mid | — |
| **Gulfport Tuesday Fresh Market** | Tue 9–2 | Beach Blvd S, Gulfport | Mid | gulfportma.com |
| **Gulfport Saturday Market** | Sat 9–2 | 230 1st St SE, Gulfport | Mid | — |
| **Corey Avenue Sunday Market (St. Pete Beach)** | Sun 9–1 | Corey Ave, St. Pete Beach | 70+ vendors | coreyave.com |
| **Largo Evening Market** | 4th Sat 5–9 | Ulmer Park, Largo | Mid | — |

**Best first targets** (published directory + lots of Instagram/Etsy-only vendors): **The Market Marie / Coachman Park**, **St. Pete Saturday Morning Market**, **Dunedin Downtown Market**.

**Vendor archetype to target** (from the Coachman Park tour — this is the exact pattern):
- Has a brick-and-mortar but **no standalone site** → *The Waffle Dream* (delivery-platform menu only).
- **Etsy + Instagram only**, no site → *Knit Craft by Mona*.
- Has a basic one-pager, no commerce/booking → *Psalms Brittle*, *The Rolling Pin*, *Iris Photo Gallery*.

Each is a one-click `makerspacepinellas` child site away from products + bookable services + a blog.

> **Sourcing the vendor list:** scrape each market's directory page (most publish a vendor list with IG handles). Cross-reference vendors who appear at **multiple** markets — they're the most invested, best buy-in candidates. For products, grab Google Photos snapshots of their booth + their IG grid; LEO classifies into draft products. (This maps directly to the [Nimue life-log ingestion](../../memory/project_nimue_lifelog_ingestion.md) photo→classify pipeline.)

---

## 2. Gap Analysis — what Angel OS already has vs. what's missing

Verdict: **the framework is all there.** What's missing is a thin market-vendor orchestration layer. Nothing here needs new engines — it's templates, two small schema fields, and one LEO tool.

| # | Capability | Status | Where it lives | Gap to close |
|---|-----------|--------|----------------|--------------|
| 1 | **Site replication / templating** | ✅ Partial | `provisionPagesFromSpec.ts`, `pages-from-spec` endpoint, church + fitness templates as the pattern | No **Hays template**; no `{{vendor.*}}` variable substitution; no bulk "clone to N vendors" |
| 2 | **Events w/ vendor booths** | ⚠️ Events exist, booths don't | `Events.ts` (eventType `market_appearance`), `Vendors/index.ts` | No `vendors[]` / booth field on Events; no "vendor X sells products Y,Z at this market" scoping |
| 3 | **Products / Services / Posts per site** | ✅ Yes | `Products`, `Services`, `Posts` (all tenant-scoped) | Works as-is per vendor site (each vendor = own tenant/endeavor) |
| 4 | **Discovery + cross-linking** | ✅ Federation-wide | `FederationDiscover.tsx`, `FederationCard` | No **local/market-scoped** discovery view ("vendors at this market"); no vendor↔vendor recommend link |
| 5 | **Parent portal grouping** | ⚠️ Portals are isolated | `provisionPortal.ts`, `Endeavors`, `FederationPeers` (endeavors inherit Diocese) | No `parentEndeavor` grouping so `makerspacepinellas` rolls up its vendor children |
| 6 | **YouTube channel help / syndication** | ⚠️ Cron poll only | `youtube-poll.ts`, `Connectors` (`youtube_channel`) | No setup wizard ("find your channel ID"), no manual "sync now", no collective promo page |
| 7 | **Vendors collection** | ✅ Lead-routing only | `Vendors/index.ts`, `VendorRoutingService` | Lightweight (no catalog/branding) — but that's fine; a vendor that "graduates" becomes its own Endeavor |

---

## 3. Recommended build — smallest path that ships the on-the-spot demo

Five slices, in dependency order. Each is a LEO tool first.

### Slice 1 — Hays Cactus Farm template (the seed)
Author one data-driven spec (JSON, in `provisionPagesFromSpec` format) modeled on the existing church/fitness templates: Home, Shop (products), Book (bookable services), Blog, Events/"Find us at the market", About, Contact. Max the Hays config — products, bookable services, 2–3 blog posts — as the reference instance. **This is the prototype that proves the funnel; everything else replicates it.**

### Slice 2 — `replicate_site` LEO tool with variable substitution *(closes Gap 1)*
One LEO tool: `replicate_site(template, { name, slug, products[], services[], branding, youtubeChannelId })` → provisions a child endeavor + pages from the template, substituting `{{vendor.*}}`. Wraps existing `provisionPortal` + `provisionPagesFromSpec`. On the spot at the market: type the vendor's name, paste their IG/photos, get a live draft site. (Aligns with the existing `apply_site_template` / `replicate_site` direction in [LEO factory principle](../../memory/project_leo_factory_principle.md).)

### Slice 3 — Parent portal grouping *(closes Gap 5)*
Add one optional field `parentEndeavor` (relationship) to `Endeavors`. `makerspacepinellas` is the parent; each provisioned vendor sets `parentEndeavor = makerspacepinellas`. Parent dashboard = query children. No new collection, no hierarchy engine — one field.
`// ponytail: one self-relationship field, not a sub-tenant tree. Add depth>1 only if a market-of-markets actually appears.`

### Slice 4 — Market-scoped Discovery + vendor interlink *(closes Gap 4)*
Reuse `FederationDiscover` filtering, but add a `parentEndeavor` filter so `/discover?market=makerspacepinellas` shows just the participating vendors with cross-links to each other. This is the "interlink between themselves on the Discovery page" the vendors get for joining. No new component — a query param on the existing one.

### Slice 5 — Event booth roster *(closes Gap 2)*
Add a `vendors[]` relationship to `Events.ts` (eventType `market_appearance` already exists). An event page renders "vendors at this market." Optional `boothNumber` per row. This is what lets a vendor "sell specific items at those events" — scope a product subset to the event via the existing Products + the new booth row.
`// ponytail: vendors[] + optional boothNumber on Events. No booth-marketplace/POS until a market actually asks to charge booth fees.`

### Cross-cutting — YouTube onboarding *(closes Gap 6, lowest priority)*
The cron poll already syndicates a channel → Posts. The only real gap is human onboarding: a short "how to find your channel ID + test feed" step in the provision flow, plus a `makerspacepinellas` page that lists every participating vendor's channel (collective promotion — the "unite the local businesses" ask). Defer until ≥3 vendors actually have channels.

---

## 4. The on-the-spot market playbook (what you actually do at the booth)

1. **Before the market:** scrape the directory, pick vendors with no/minimal site, pre-build *draft* sites with `replicate_site` using their IG photos → products. Bring the laptop.
2. **At the booth:** "Here's your site — already has your products and a 'book me' button. Want it live? It's free to start." Buy-in = flip draft → published + set their custom domain (or use the free `*.makerspacepinellas` subdomain — [wildcard subdomains are free](../../memory/project_kendev_commercial_arm.md), DomainService only for bring-your-own).
3. **The hook:** they're auto-listed on the parent Discovery page, interlinked with the other vendors who joined, and we help them stand up a YouTube channel we cross-promote.
4. **Commercial note:** market vendors are a commercial vertical → these live under **kendev.co Diocese**, not the pristine Angel OS mission node ([KenDev commercial arm](../../memory/project_kendev_commercial_arm.md)).

---

## 5. What NOT to build (yet)

- ❌ Booth-fee marketplace / event POS — no market has asked to charge through us. (Slice 5 stays roster-only.)
- ❌ Per-vendor inventory sync across multiple markets — until a vendor sells out at one and needs it.
- ❌ Template change-propagation (push updates to already-cloned sites) — re-run `replicate_site` with `overwrite` covers v1.
- ❌ Sub-tenant hierarchy deeper than parent→child.

---

## Sources

- [I Love the Burg — Pinellas County Market Guide](https://ilovetheburg.com/pinellas-county-market-guide/)
- [Visit St Pete/Clearwater — Markets Locals Love](https://www.visitstpeteclearwater.com/list/st-pete-clearwater-markets)
- [St. Petersburg Saturday Morning Market](https://saturdaymorningmarket.com/)
- [Pinellas Farmers & Flea Market (Clearwater)](https://pinellasmarket.com/)
- [The Market Culture / Market Marie @ Coachman Park](https://themarketculture.com/)
- [FarmMarketDex — Pinellas County](https://farmmarketdex.com/state/florida/county/pinellas)
