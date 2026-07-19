# State of The Angel OS

> 260718 — a working snapshot: what we have, what we're testing, what's open. Maintained as the single orientation doc. The north star: **a platform where anyone can configure and sell any product or service — by voice — and it just works, config-free, for the 99%.**

---

## The stack (as of 260718)

- **One node, self-hosted.** The whole platform runs in Docker on Ken's always-on box (Postgres + Core containers), public via a cloudflared tunnel at `*.payloadnuke.com`. This killed a lot of cloud latency and made a **~5-minute rebuild/test loop** (`C:\Dev\datacenter\stack\rebuild.cmd`) — the dev inner loop is now fast enough for recursive iteration. **Railway is the near-term target** (managed PG + Docker) for durability/failover; the local stack is the rapid-dev node meanwhile.
- **Three bodies, one brain:** Core (`C:\Dev\angels-os`), Merlin (Windows node, now pointed at payloadnuke), Nimue (Android). Shared `leoBrain`.
- **payloadnuke.com is now a first-class platform apex** in its own right; kendev.co / spacesangels.com are the legacy/commercial arm on the same codebase. Nodes are **config-driven, not hardcoded** — the same image runs anywhere; peers come from the DB, origins from env.
- **Payload CMS 3.77** (parked off 3.85) + Next.js 16 + Postgres.

---

## What we HAVE (shipped / live on payloadnuke)

**Commerce & selling spine**
- `commission_endeavor` — voice → a live portal/endeavor.
- Products + shop (now paginated), bookable services (`/book`), memberships/dues, **rent + ACH** (bank-debit, fee-free option), Stripe Connect direct-charge with app-fee split (self-funding).
- `create_product` / `create_membership_plan` (with `kind:'rent'` + `feePercent`) / `apply_site_template` (church, fitness) — say what you sell, LEO builds + bills it.
- Bookable-inventory foundation (`Listings` collection: facility/stay/rent modes).

**AI / LEO**
- ~125 LEO tools, single `executeToolCall` chokepoint; ai-gateway with lane/intent routing.
- **AI resilience unified:** text/chat + vision/inventory + image-gen all fail-soft/fail-up over ONE circuit breaker (`providerHealth`) → CIC "Provider Outages" panel. `IMAGE_PROVIDER` node override.
- Image generation (Flux/DALL·E/Imagen/Gemini) + vision analysis pipeline (inventory-from-photos).

**Platform / multi-tenant**
- Multi-tenant by subdomain on any apex; tenant flavors (business/circle/guardian_angel/personal_portal).
- Spaces/channels chat (SSE + poll + Dexie), DMs on AI Bus, space-visibility RBAC.
- Guardian-angel auto-provisioning + claim/status/usage.
- Federated auth (Google id_token → session); cross-subdomain SSO.

**Nimue (Android)** — Card Stage (the Primer), address book / derived roster, offline Works, federated auth, `/welcome`.

**Verticals** — church (~80%), fitness/gym template, market-vendor, membership surface, housing-search (CL-listing parser).

---

## What we're TESTING (built, unmerged / unverified)

| Item | Branch / state | Needs |
|---|---|---|
| **Onboarding reception** (`/welcome` + Core wizard on locked flat spec) | `feat/onboarding-reception` (pushed, unmerged) | verify on a real tenant host; merge decision |
| **Active-endeavor switch** (in-app portal↔endeavor, no reload) | `feat/active-endeavor-switch` (verified logged-in) | merge; converge with reception |
| **Bookable-inventory / rentals** (facilities → stays → rent) | `feat/bookable-inventory` (Listings foundation) | mode templates, date-range engine, site-map |
| **Reader read-aloud fix** (Nimue Card Stage) | Nimue `main` local | Nimue build/deploy |
| **CORS de-couple + platform-apex + image resilience** | `main` local, **live on payloadnuke** | push to origin (touches kendev/spacesangels prod) |

---

## Decisions locked (don't re-litigate)

- **Canonical model** — Enterprise=root/AI-bus (never a tenant); Tenant=primitive; Endeavor=a tenant you organize around; Circle=family Endeavor.
- **Identity graph (260718)** — a Person is keyed on a **platform-native id**, with **email AND phone as co-equal attached anchors**; external credentials (Google/Apple/Microsoft/LinkedIn OIDC subs, email, phone) all link to one Person; **verified email/phone is the merge key**; **link only after a confirm** (no silent provider-email hijack). OIDC is the one protocol (free JWKS verification — no paid auth vendor). SMS-OTP is a first-class login/merge anchor (phone-first vendors), metered so used sparingly.
- **Consolidate on one node**; federation flagged off; peers from DB.
- **Config-free for the 99%** — "if a feature requires config, it isn't done."
- **Self-funding + self-improving.**

---

## Monetization thesis

**Turn every business listing into a living, bookable endeavor.** Craigslist (and any identified business) is the funnel; The Angel OS is the OS underneath. Reuse the CL-listing parser (from housing-search) → seed a **perfectly usable** services site from the vendor's *real* ad content (never a blank builder) → they **claim** it (= the coupling step) → self-funding via the first booking's app fee. Generate speculatively; GC unclaimed endeavors at ~30 days (pg_cron / "Dreams"). Guardrail: outreach compliance (CAN-SPAM email OK if opt-out-clean; **unsolicited SMS at volume = TCPA risk** — let the real URL do the pulling).

---

## OPEN ITEMS / gaps (prioritized)

**P0 — the coupling spine (keystone)**
1. **One coupling primitive, two doors** — link user↔endeavor as owner then land inside; door A = authenticated user (reception/active-endeavor, mostly built), door B = claim-token from a seeded endeavor (guardian-angel claim model). Converge `feat/onboarding-reception` + `feat/active-endeavor-switch` + guardian-angel claim into one spine.
2. **Identity graph schema** — Person + linked-credentials + email/phone anchors; the confirm-on-link flow. Everything hangs from this.

**P1 — prove & harden the earn loop**
3. Verify the full voice → configure → sell flow end-to-end on payloadnuke ("LEO, set me up to sell X" → storefront + checkout).
4. Multi-provider OIDC (Apple/Microsoft/LinkedIn) on the federated-auth foundation.
5. `google` IMAGE path bug — routes through OpenRouter with a Google key (fails even with quota); needs native Gemini `generateContent`.
6. Working image provider on the node (Cloudflare Flux free-tier: `CLOUDFLARE_AI_TOKEN`+`ACCOUNT_ID`+`IMAGE_PROVIDER=cloudflare`).

**P2 — verticals & polish**
7. Rentals: mode templates + per-night date-range booking + site-map picker.
8. Church template completion (giving/clergy/livestream); appointments calendar (shipped, verify).
9. Merge the shipped branches; push `main` (CORS) once kendev/spacesangels envs set.

**P3 — infra**
10. Railway migration (durability/failover off the single box).
11. Nimue build/deploy of the read-aloud fix + reception cards.
12. Payload 3.85 unpark (post-Railway).

---

## Recommended sequence

1. **Identity graph schema** (P0.2) — plant the anchor deliberately; it unblocks the coupling flow and multi-provider auth.
2. **Coupling spine** (P0.1) — converge the two doors on one primitive.
3. **Prove the earn loop** (P1.3) end-to-end.
4. Then the acquisition funnel (seed-from-listing → claim) rides on 1–3.

*The pieces are ~80% there and spread across three branches; the work now is convergence, verification, and gap-fill — not net-new architecture.*
