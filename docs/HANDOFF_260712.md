# Handoff — 260712 late (paste-ready for a new thread)

**260712 ~2305 Ken → new thread (Opus 4.8, welcome back)**

Continuing **The Angel OS** — one intelligence, many bodies, one bus. **Core**
`C:\Dev\angels-os` (Vercel: `angels-os` + `angels-os-kendev`, both auto-deploy
`main`). **Nimue** `C:\Dev\nimue` (native Android, now **1.2.46 / code 58** on the
S23s; repo github.com/The-Angel-OS/nimue). **Merlin** `C:\Dev\merlin` (Windows-service
compute node on IONOS).

**BEFORE ANYTHING:** read `memory/MEMORY.md`, then this file, then
**`docs/CARD_STAGE.md`** (the next big build, fully spec'd with Ken's decisions).
Consolidation architecture is in `memory/project_consolidation_single_node.md` +
`docs/STATE_260711_consolidation.md`; the channel model in
`docs/HANDOFF_channel_model_260711.md`.

---

## ⚠️ Human context — read first
Ken has **court at 1:30pm 260713**; a jail sentence is a real possibility and it's
weighing hard. He's driving to **John's Complete Auto** in the morning to talk with
**Ben & Tyler**. The urgency you'll feel — "use as much quota as available" — comes
from that: build while he can. Meet it with warmth, not performance; care about the
person, the work is the lifeline. Temporal-stamp every reply (`YYMMDD ~HHMM Name —`).
CTO mode: decide, ship, push to `main`, tsc-clean (`^src/`). This is the Young Lady's
Illustrated Primer made real — a guardian angel for **everyone**, especially those
nobody's coming for. "Long live the Rat Army."

---

## Shipped 260712 (all committed + deployed unless noted)
A marathon. Core commits on `main`:
- **fire-sale cart fix** (`a785c6c`) — `plugin-ecommerce` cart populate allow-list
  omitted `slug` → every item showed "no longer available"; fixed in
  `src/providers/index.tsx`. Verified live. See [[project_cart_populate_gotcha]].
- **Teleport primitive** (`22f7a27`→`cd7977e`, +`5b60b84`) — cross-instance tenant
  move kendev→spacesangels; `POST /api/provision-ops/teleport` (dry-run + write),
  media ROWS-not-bytes via shared blob, forms/draft handling. **3 portals migrated**
  (dunedin-fresh-market, harpazo, arctic-cool). See [[project_teleport_primitive]].
- **decommission blob-preservation guardrail** (`52f0331`) — after a shared-blob
  delete broke source images; decommission now PRESERVES blobs by default.
- **admin list filters** across all ~50 collections (`32c3c33`).
- **dashboard invitations filter** (`ded3987`, `ab0f56b`) + **portal chooser filter**
  (`e0556ef`) + **gallery lightbox** (`fabb306`).
- **chat attach race fix** (`72b8c2a`) — Nimue fast upload+send; verify media resolves
  before linking, drop laggards.
- **vision inline-bytes fix** (`f8e8e37`) — apex 307-redirect broke the provider's
  image fetch → "couldn't read that image"; now fetch bytes server-side + inline.
- **guardian-angel auto-provision** — `ensureGuardianAngel` runs in
  `resolveUserFromGoogleClaims` (`eea800f`, the shared choke point for web + Nimue
  OAuth), so **every Google sign-in mints the user's personal angel**, idempotent.
  `?switch=1` forces the Google account chooser (`286c437`).
- **portal grouping** guardian-vs-endeavor in choosers (`7420455`).
- **chooser overrideAccess fix** (`03efec3`) — non-super-admins' chooser was EMPTY
  (memberships query lacked overrideAccess → tenant hydration denied). Now they can
  switch to their own portal.
- **admin command center scoped to current portal** (`1547e7d`) — BeforeDashboard was
  global (showed 13 tenants / Harpazo edits on any portal's /admin); now tenant-scoped.

**Nimue** (repo `d5e6dc6`): **1.2.45** portals Log out + Switch account + My Portals
grouped guardian/endeavor; **1.2.46** in-space channel/DM switcher (`listDirectMessages`
+ DIRECT MESSAGES section — hop channels/DMs without backing to Portals). Built +
installed on both phones. ADB is NOT on PATH →
`C:\Users\kenne\AppData\Local\Android\Sdk\platform-tools\adb.exe`; addresses ROTATE —
ask Ken (last: Tyler's S23+ `192.168.0.219:38383`, Ken's S23U `192.168.0.233:<port>`).

**Tyler** (tylersuzanne84@gmail.com, user 15): demoted super_admin→customer; her
guardian angel minted (**tenant 20, `d53mdd7jswjv.spacesangels.com`**). She's
tenant_admin of Clearwater (tenant 5) + her GA.

---

## NEXT — the headline build
**The Card Stage** (`docs/CARD_STAGE.md`) — the breathing Nimue Delta as a
**prioritized card surface subscribed to feeds**; verse/suggestion/image/dm/directive
cards; swipeable queue; tap→active-listening→respond state machine; **guardian-angel
birth ceremony as card type #1** (and revise auth to check-not-provision so login is
instant and the birth is the ceremony); Wear = same stream, top-1. Decisions locked
(§8–10): tap-to-speak v1 w/ the auto-mode, rebuild-from-feeds, cards→Nimue channel,
images first-class (streaming/real-time as nano-banana speeds up), full-screen destiny.
Build the stage first; everything else is a card type.

## Big architecture arcs (each its own build)
- **LLM-gateway cross-auth** ([[project_llm_gateway_cross_auth]]) — create a Guardian
  Angel through **ChatGPT/Claude/etc.**; that LLM acts as Nimue-to-LEO on the user's
  behalf. Angel OS reachable from any big-LLM interface. NEW today; big.
- **Merlin↔Angel self-serve linking** — any user links their own Merlin (compute body)
  to their Angel, same primitive as Nimue. [[project_merlin_distributed_compute]].
- **Fold DM Space into the AI Bus** (channel-model pass) — remove DM Spaces; DMs are
  `systemType` channels on the AI Bus; delete-a-channel rehomes its messages to the
  bus; move channels freely. `docs/HANDOFF_channel_model_260711.md`.
- **Vanity slug + handle migration** — opaque slug permanent; vanity handle settable +
  movable between a user's portals (a `graduate_portal` op). LinkedIn-style.
- **Server-side screenshot-after-edit** — photo → LEO updates page → post a screenshot
  back as confirmation; best on **Merlin/Playwright** (a `screenshot_page` LEO tool).

## Tracked chips (background tasks — fixes with the diagnosis pre-written)
- **Default-landing** to home portal after login (auth-redirect via the validated
  token-relay; `/api/auth/complete` guards relative-only).
- **Universal "Community" space** (public RBAC tier, members-by-default, discoverable).
- **AI-Costs Provider Switchboard 403** for a tenant_admin on their own portal
  (super_admin-gated probe).
- **Nimue first-run GA ceremony** (now folds into the card stage).
- **Generalize GoogleClaims → provider-agnostic identity** (Apple ID for the App Store).
- **Dashboard-list unification** sweep (crew/bookings/contacts/… onto ListControls).
- **Product contact/buy-now** + **local-pickup checkout** (fire-sale UX).
- **Gallery lightbox** ✅ done · **admin list filters** ✅ done · **portal chooser
  grouping** ✅ done · **Nimue in-space navigator** ✅ done.

## Open consolidation loose ends
- **docs-moving** — re-upload its 22 images (its shared blobs were deleted), then one
  teleport call. Its gallery lightbox now works (fabb306).
- **Decommission the migrated kendev sources** — now SAFE (blob guardrail); do when tidy.

---

## Durable rules (don't relearn the hard way)
- Green push ≠ live: confirm Vercel READY + `pnpm exec tsc --noEmit` (filter `^src/`).
  BOTH projects auto-deploy `main`; a push deploys every un-pushed commit.
- Shared Vercel Blob across nodes: media is rows-not-bytes, but **never blob-delete**
  what another node references (the guardrail). Media `url` is relative
  `/api/media/file/<filename>`; apex `spacesangels.com` **307-redirects** (use www or
  the tenant subdomain).
- **overrideAccess** on server queries that show a user their own cross-tenant data
  (the chooser bug) — else relationship hydration is denied and objects become bare ids.
- Payload field-level `populate` OVERRIDES `depth` (the cart bug).
- Nimue signs in via **system-browser OAuth** (`/api/auth/google?native=1` →
  `nimue://auth/callback?token=`), NOT `/api/auth/federated` — server hooks belong in
  `resolveUserFromGoogleClaims`.
- Extension browser tools time out on live dashboard pages (persistent SSE ⇒ never
  `document_idle`); the page still works — verify via server timing / curl.

"Thy Word is a Lamp Unto My Feet." The lamp's still lit. 🕯️
