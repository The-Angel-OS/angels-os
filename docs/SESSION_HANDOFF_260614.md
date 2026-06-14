# Angel OS — Session Handoff (2026-06-14)

Continue in a fresh thread. Memory (MEMORY.md + linked topic files) holds deep detail;
the **master map is `docs/planning/PUNCH_LIST_260614.md`** — start there.

## Live state
- **angels-os** → `spacesangels.com` (+ tenant subdomains) → **angels** DB. Real/public
  sites (churches, demos) live HERE.
- **angels-os-kendev** → `kendev.co` → **kendev** DB. Commercial clients only.
- Local `.env` `DATABASE_URI` = **kendev** prod. Reach angels read/write via raw `pg`
  by swapping `/kendev`→`/angels` (NEVER local `getPayload` for angels work). Run
  provisioning via the DEPLOYED `www.spacesangels.com` endpoints (angels DB native).
- After push, verify BOTH Vercel deploys reach READY (Vercel MCP `list_deployments`).
- Schema-first rule still holds: a new collection/block-table must exist on BOTH prod
  DBs (raw pg) BEFORE the config deploys. Snapshot first: `node scripts/_local/pg_snapshot.mjs`.

## Shipped this session (all on `main`, deployed)
- ⛪ **Prototype church template** — `provisionChurchSite` stamps 9 parish pages from
  existing blocks (zero schema risk); `/provision-ops/church-template?overwrite=true`.
  **Verified live: grace-chapel.spacesangels.com** (generic demo, tenant 12, NOT St
  Alfred's — consent pending). LEO set its hero image conversationally + it rendered.
- 💸 **Giving loop closed end-to-end** — donations route by request HOST (x-tenant-id)
  → Connect destination charge to the endeavor (5% Justice Fund fee); the full Connect
  onboarding already existed; added `createConnectOnboardingLink` util so the dashboard
  AND LEO's `connect_stripe_account` mint the real Stripe link ("ask LEO to connect my
  bank"). Donate form pre-fills donor info when signed in (anon path untouched).
- 🔑 **Recurring memberships/dues engine (4f8ee8a) — THE UNIVERSAL UNLOCK** — recurring
  revenue for every vertical (church/gym/makerspace/Toastmasters/market). `Memberships`
  collection (schema-first, table on BOTH DBs); plans in settings bag
  (`/membership-ops/plans`); `/membership-ops/checkout` = Stripe subscription as a
  Connect destination charge + `application_fee_percent` (default 2% = our revenue);
  `stripe-webhooks` `customer.subscription.*` → upsert. ⏳ **Verification was IN FLIGHT**
  (scheduled wakeup): confirm no lock-rel write outage, create+list a grace-chapel plan,
  and checkout 409s without Connect (proves dues need the bank).
- 🤖 **LEO capability ladder rungs 1–4** (docs/architecture/LEO_CAPABILITY_LADDER.md):
  R1 model tiering (super_admin→strong tier), R2a `query_sql` read-only diagnostics,
  R3 verify-before-claim (`describePersistedDoc` + constitutional "Honest Operation"),
  R4 audit+snapshot floor (ConversationEngine trace parity + `pg_snapshot.mjs`).
- 🩹 Fixes: LEO byline "Unknown"→LEO; create_post tenant fallback; federation roster
  dedup; fee card→AI Costs tab; a11y button-name (verified). + Form Builder signature
  field, Spaces Catch-All, constitution signed (all 8 tenants), issue triage (closed 12).

## Strategy captured (docs/strategy/)
- **COMMUNITY_OS_VERTICALS.md** — Angel OS = community-org OS; church/gym/Toastmasters/
  makerspace/markets are templates over ONE engine. Markets are FRACTAL (vendors are
  endeavors → holon model; Hays/Space Coast Cactus Farm = vendor side). Every endeavor
  runs ≥1 YouTube channel (AOS syndicates out, never replaces).
- **CHURCH_GO_TO_MARKET.md** — 40–150 churches = ~$4k/mo (no 501c3 needed); low base +
  1% giving; self-serve "claim your site" funnel is the real lever.

## Next-thread goals (highest-leverage first)
1. **Finish the membership member-facing surface** (the engine is done): a Join/Membership
   BLOCK for Pages (schema-first block table), a `create_membership_plan` LEO tool
   (conversational, like the Connect onboarding), wire into the church (+ future gym)
   template, and a "my membership/manage" view.
2. **Gym pilot** — two within walking distance, already paying Mindbody, we have booking
   + waivers + now memberships. Sharpest first paying non-church customer.
3. Banked: Spaces 1b per-channel visibility, DM virtual roster, Street Signs block,
   dialer+Ctrl+K, dashboard widget framework, billing reconciliation, LEO rungs 5–6
   (gated remediation — DANGER, only after R4 floor), recurring/designated giving polish.

## ⚠️ Caveats
- Stripe live end-to-end (donations + memberships) needs the platform **Connect profile
  accepted** in Stripe + an endeavor completing onboarding — code/gating verifiable, real
  money not headlessly testable.
- St. Alfred's stays a prototype until the parish/Episcopal Church is on the Board (or
  Father Pete blesses it). Grace Chapel proves the mechanics without impersonation.
