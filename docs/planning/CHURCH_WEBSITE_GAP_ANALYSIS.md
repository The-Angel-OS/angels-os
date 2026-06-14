# Church Website — Gap Analysis (2026-06-14)

Can Angel OS host church websites (Clearwater Cruisin is one; goal: a reusable
church template + a St. Alfred's reference node at stalfreds.spacesangels.com)?

**Verdict: ~80% today.** The substrate is there (Clearwater Cruisin already proves a
church endeavor works), and the **Spaces/community layer is a genuine differentiator**
over Tithe.ly / Subsplash / Squarespace-for-churches. What's missing is (1) a curated
**church template** (the #1 ask) and (2) a handful of church-specific blocks/features.

---

## What's solid today (host a church site now)

| Need | Built on | Status |
|---|---|---|
| Home / welcome / about / ministries prose | Pages + blocks (Content, Banner, Carousel, ThreeItemGrid, CTA, MediaBlock, Archive) | ✅ |
| Events | Events collection + Calendar block | ✅ (one-off) |
| Contact / newsletter / prayer requests | Form Builder + routeFormToAIBus (routes to clergy via AI bus + Gotify escalation) | ✅ |
| Online giving | Donation block + Stripe + /donate | ✅ (one-time) |
| Sermon / blog archive | Posts + Categories (+ Archive block) | ✅ (works, not purpose-built) |
| Photo galleries | Carousel block / Events.gallery | ✅ |
| Bulletins / PDFs | Media uploads | ✅ upload (no list block) |
| **Member community / ministry groups / prayer spaces** | Spaces + Channels + Messages + presence | ✅ ⭐ differentiator |
| Waivers / consent (e.g. youth, trips) | Form signature field + Signatures | ✅ |
| Faith content / devotionals | Works/Library publishing layer + Posts | ✅ |
| Constitution (ecumenical Christian, Episcopal polity baseline) | constitution signing | ✅ on-mission |
| New subdomain node (stalfreds.spacesangels.com) | provisionPortal + wildcard *.spacesangels.com routing | ✅ |

---

## Gaps (ranked)

### CRITICAL
1. **No church TEMPLATE / endeavor type.** New tenants get only Home + Contact
   (createDefaultTenantPages.ts). Endeavor types are service-provider / retail-commerce
   / creator-content / booking-based / custom — **no `ministry`/`church`**. A church
   needs: Home, Worship & Service Times, Sermons & Livestream, Events, Giving,
   About & Clergy, Ministries, Contact, Prayer Requests, (Bulletins). **This is the
   core ask** — "a template with all the appropriate pages."
2. **Recurring services / schedule.** Events are one-off; a church runs on a weekly
   rhythm (Sun 8/10, Wed 7). Today that's 52 manual events/year. Need a recurrence
   field on Events + Calendar rendering — OR a lightweight "Service Times" content
   block as a stopgap.
3. **Clergy / staff roster.** No people-display collection or block (BoardMembers is
   federation governance, not a parish roster). Need a `Staff`/`Clergy` collection +
   a roster block (headshot, title, bio, contact) — or a structured stopgap block.

### HIGH
4. **Recurring / pledge giving + fund designation.** Donation block is one-time only;
   churches are ~70% recurring (tithes, pledges). ⚠️ ALSO VERIFY: the donation flow
   reportedly routes to the platform Justice Fund — a church's giving must go to the
   CHURCH (the endeavor), with only the constitutional platform cut. Confirm + fix
   per-tenant fund designation; add Stripe subscriptions + designated funds.

### MEDIUM
5. **Livestream embed on Pages** — only Events have `videoEmbed`. A small Video/Embed
   block (YouTube/Vimeo iframe) lets the home page feature the Sunday stream. Low effort.
6. **Bulletins / downloads block** — list PDFs with date/title. Low effort.
7. **Sermon archive as a first-class pattern** — Posts+category works; a "sermon"
   filter/series view would polish it.

### Factory note
The LEO site-assembly tools are partial: `create_page`, `provision_tenant`,
`research_and_provision` exist; `replicate_site`, `set_branding`, `add_nav_item`,
`create_service_catalog` are still aspirational (leo_factory_principle). The church
template should ship as a provisioning function FIRST (LEO-tool wrapper second).

---

## Recommended build sequence

1. **Church template + `ministry` endeavor type** — a provisioning function that
   stamps the standard church pages (with the right blocks) + nav + a Community Hub
   space with ministry channels. One provision → a working parish site. (Makes
   Clearwater Cruisin and St. Alfred's both one call away.)
2. **The low-effort blocks the template needs:** Video/livestream embed block,
   Bulletins/downloads block, Staff/Clergy roster (collection + block).
3. **Recurring events** (or the Service-Times block stopgap).
4. **Recurring + designated giving** (Stripe subscriptions; verify/fix fund routing).
5. **Provision the St. Alfred's reference node** (see consent note).

---

## St. Alfred's reference node — plan + consent

`stalfreds.spacesangels.com`: provision a tenant, apply the church template, mirror
the public structure — Home (welcome + service times + livestream), Worship, Sermons
(embed their public YouTube stream/archive), Events, Giving, About & Clergy (Rev.
Peter A. Lane, rector; Rev. Larry D. Hooper, celebrant; Kevin V. Johnson, organist),
Ministries, Contact, Prayer Requests — with an Episcopal aesthetic.

⚠️ **Consent first.** St. Alfred's is a real parish. A reference/demo node is great
*with their blessing* — build it clearly as a "powered by Angel OS" showcase, not an
impersonation, and don't publish without their nod. Kenneth is meeting Father Pete
(via Cindy) this week — the natural moment to ask permission and, ideally, offer it
*to* them (the Herald-Trumpet relationship is the opening). Until then, build it as an
unlisted/draft demo, not a public-facing site.

---

**Bottom line:** we have the parts to host churches today; the work is assembling them
into a template + closing 3-4 church-specific gaps. The community layer makes Angel OS
*more* than a church-site builder — it's a parish that can actually gather online.
