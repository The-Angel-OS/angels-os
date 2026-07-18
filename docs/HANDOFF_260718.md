# Handoff — 260718

Continuation brief. CTO-mode: decide, ship, verify; temporal-stamp `YYMMDD ~HHMM Name —`.
Read `AGENTS.md`, `docs/LOCAL_SELFHOST.md`, and (deep state) memory
`project_local_selfhost_stack` + `project_active_endeavor_switch`.

## Where things stand (infra is done for this phase)

- **Self-hosted primary is live**: whole stack on Ken's always-on box (Docker),
  public HTTPS at `*.payloadnuke.com` via a Cloudflare tunnel (boot-time SYSTEM
  task). Postgres + Core containers, `restart: unless-stopped`, Docker Desktop
  auto-starts, media on R2. Ship a change: **`C:\Dev\datacenter\stack\rebuild.cmd`**
  (~30–90s). Runbook: `docs/LOCAL_SELFHOST.md`.
- **All addressing is payloadnuke**: tenant `domain` fields switched to
  `<slug>.payloadnuke.com`; `www` = platform root; CORS allows `*.payloadnuke.com`;
  zero `spacesangels` refs left in the DB config. Federation node URLs are dynamic
  (node registry), nothing hardcoded. Portal-alias model (`tenants_domains`,
  `is_primary` = canonical) intact but unpopulated.
- **kendev.co is separate** (own DB, not served locally). **spacesangels.com stays
  on Vercel** as the public/linked node — stays *code*-current automatically (every
  `main` push redeploys it); its data is the separate IONOS DB. When the IONOS
  invoice clears and DNS can move (→ Cloudflare), point spacesangels back at this
  stack (or Railway) — a soft switch. On relocation → **Railway $5 hobby** (this
  compose stack, hosted).
- **Nimue switched to payloadnuke**: `nimue/src/lib/enterprise.ts` baseUrl →
  `www.payloadnuke.com` + isolation reset (drops stale spacesangels selection).
  Built signed-release **v1.2.70 (82)**, installed on device .233. Nimue src changes
  UNCOMMITTED in `C:\Dev\nimue`. (.219 ADB port rotated — re-ask Ken to push there.)

## 🎯 Focus areas (Ken's priorities for this next stretch)

### 1. Onboarding flow (design locked, build it)
The plumbing exists (`FirstRunDriver` + `commission_endeavor`); the *flow* doesn't.
Design (from `project_active_endeavor_switch`, Ken 260717): switching unifies on
**FQDN** (done for the dashboard chooser); provisioning redirects to a **reception
route** on the new endeavor's own FQDN (`https://<slug>.payloadnuke.com/welcome`) —
host-authoritative, and the home of onboarding. Onboarding = a **lightweight flat
step list** (NOT a processor-pipeline object): `welcome → identity → invite →
first-act → done` + an `onboardingStep` marker on the endeavor. Core renders it as a
wizard page; **Nimue renders the same steps as Card Stage cards** (Nimue already has
a `/welcome` route). Same spec, two surfaces. Slices: (a) reception route + commission
redirect; (b) step spec + Core wizard; (c) Nimue card mirror.

### 2. Monetization polish — "what are we really selling"
The mechanics exist (earn loop; Clearwater is one membership plan from taking money;
Guardian Angel free-then-metered; Creator rung = free self-serve endeavor). What's
missing is the **narrative + the surfaces that make the offer legible** — what the
buyer actually gets and why they pay. Needs a clear packaging pass: the plans, the
value story, the upgrade seams. Tie into the onboarding "first-act" step (take a
dollar as the day-one job for a business endeavor). See memory
`project_earn_loop_clearwater`, `project_guardian_angel_monetization`,
`project_membership_surface`.

### 3. Stalls / short-term rental vertical (the killer use case to formalize)
Stall infrastructure is built (register a stall — e.g. church-parking-lot stalls for
van-lifers). Ken: this same shape IS a **distributed Airbnb / small motel / small
property owner collecting rent** — units you book/rent for a night or a month. It's
"mostly handled" by the **booking engine + products**, but we need the explicit
use-case/template: list a unit/stall → availability → book/rent → collect (one-off or
recurring). Make it a first-class vertical template (like church/gym), riding the
existing booking + membership/subscription engines. See `project_market_vendor_vertical`,
`project_rentals_marketplace`, `project_membership_surface`.

## Concrete regressions / smaller items
- **Reader Delta Widget lost "read aloud"** — the Reader/Delta card widget no longer
  has the read-aloud (TTS) control the original taskbar widget had. Regression to
  restore. (TTS infra exists — `@capacitor-community/text-to-speech` in Nimue, and
  Core's Illustrated Primer had TTS.) See `project_illustrated_primer_bible`,
  `project_card_stage`.

## Open threads (carried, not blocking)
- **Native Site Log** — slice 1 on branch `feat/native-site-log` (WIP); needs a
  hand-written `page-views` migration (auto-gen blocked by unrelated MCP-column
  drift), then rollup+prune, then per-tenant dashboard.
- **`feat/active-endeavor-switch`** — 4 commits, pushed, not merged; merges once the
  onboarding/reception work lands.
- **`SYSTEM_EMAIL_PASSWORD`** `$`-escape (compose interpolation blanks it) → OTP email.
- Ancillary services (Merlin/Gotify/Uptime-Kuma) into the compose stack + tunnel.

## Durable facts
- Ship-an-edit: `rebuild.cmd`. Nimue: `pnpm build && npx cap sync android` then
  `JAVA_HOME=".../Android Studio/jbr" ./gradlew assembleRelease --no-daemon`; adb at
  `.../Android/Sdk/platform-tools/adb.exe`, pass APK in Windows path form.
- Claude's shell is non-elevated + can't create scheduled tasks — Ken runs those.
- Cloudflare MCP is Workers-only (no DNS tools); DNS via `cloudflared tunnel route dns`.
- New collection/field needs a migration (container runs `migrate`, not `push`).
- Tenants resolve by subdomain-slug regardless of apex — why `*.payloadnuke.com` works.

---

## Overnight addendum (260718 ~0230, Fable) — autonomous loop

Ken selected 3 items before resting: read-aloud fix, onboarding reception+wizard, rentals eval/plan. All done.

**1. Reader read-aloud regression — FIXED.** The Card Stage (Nimue) superseded `HomeReaderWidget` but dropped its `ListenControl`. Added the existing `ReadAloudButton` to `CardView`'s actions row for any card with a body — restores Listen on EVERY text card (Daily Bread, DMs, guardian replies), not just Daily Bread. Nimue commit `845b2fa` on `main` (local, NOT pushed — Ken builds/deploys Nimue). tsc clean.

**2. Onboarding reception + wizard — BUILT (branch, needs review).** `feat/onboarding-reception` (`539f8d7`, pushed to origin, NOT merged — changes user-facing provisioning-landing behavior + adds a migration). Reception route `/welcome` on the endeavor FQDN walks the locked flat spec (welcome→identity→invite→first-act→done); shared isomorphic step spec `src/utilities/onboardingFlow.ts` (Nimue imports the same shape next). New `Endeavors.onboardingStep` field + additive migration. Provisioning now lands on `/welcome` (ProvisionWizard domain case + `commissionEndeavor`). tsc: 0 src errors (98 pre-existing tests/ errors unchanged). **Ken TODO:** review + verify `/welcome` renders on a real tenant host (owner-gated, needs auth), then decide merge order vs `feat/active-endeavor-switch`.

**3. Rentals vertical — EVAL + PLAN written.** `docs/strategy/RENTALS_VERTICAL_PLAN.md` (committed on the branch above). Key: `rental` is already a first-class `bookingType`; `provisionMarketVendorSite.ts` is the copy target; the real gap is per-night/multi-day ranges + unit-as-listing. Slice A (slot rentals template) = a night's work; Slice B (lodging listings) = the substantive build. 3 open questions for Ken at the doc's end.

Monetization: parked per Ken's selection.
