# Angel OS — Global Punch List

> **The single living list of what's broken, missing, or half-done.** One place, ranked,
> dated. Glance here to know where the platform actually stands.

## How this is maintained (by Claude, each session)
- **Update it every working session.** New issue surfaced → add it. Item shipped → move it to
  **Recently Closed** with the commit. Priorities shift → re-rank.
- **Every item is actionable:** a one-line *what*, a *where* (file/path), and a *next action*.
  If it needs three paragraphs of context, that lives in a memory file — link it, don't inline it.
- **Dated.** Each item carries the date it was last touched (`YYMMDD`). Stale P0/P1s get re-checked.
- **Priority legend:** `P0` broken / blocks revenue or trust · `P1` real gap, planned · `P2` polish / debt.
- Keep it **scannable** — this is a triage board, not a design doc. Ponytail applies to the list itself.

---

## 🔴 Bugs & broken (P0–P1)

- **[P1] Anthropic API key OUT OF CREDITS** — direct Anthropic vision/chat 400s ("credit balance too low");
  providerHealth skips it 30m at a time. Gemini now covers vision (see fix 91ef738) so nothing is down, but
  the paid failover tier is thinner. *Next:* Ken adds credits at console.anthropic.com — or we accept
  Gemini-only vision. `260722`
- **[P2] Merlin still squatting :3000 via logon task** — elevated `Set-ScheduledTask` one-liner (move to
  :3002) given to Ken, unrun; Docker Desktop "Model Runner" should be disabled (Inference-manager stale-socket
  crash). *Next:* Ken runs both. `260722`
- **[P2] Nimue chat-echo fix needs APK build** — network-first post-send reload + server watermark landed in
  C:\Dev\nimue commit `98ca0df`; not shipped to the phone. *Next:* build + install APK. `260722`

- **[P1] Works system is "hosed"** — the video LMS foundation has known instability. Stabilize before
  layering Quiz/LMS on top. *Where:* Works collection + [[project_works_wip_status]] / [[project_reader_reference_layer]]. *Next:* audit + list the concrete Works breakages, then fix. `260720`
- **[P1] LEO fabricates tool success** — claims actions done that never persisted (e.g. "saved the post as a
  draft" with no row; enterprise-health prose embellished into fake "Federation ACTIVE"). *Where:* leo-stream / constitutional-prompt / executeToolCall. *Next:* LEO must not report success without a tool result; validate tool-result → response. `260720`
- **[P1] create_post crashes on required `layout` — FIX STAGED** — `create_post` schema made `content`
  optional but Posts `layout` is `required:true`; a call without content left layout unset → Payload
  "The following field is invalid: Content > Layout". Also LEO picked create_post over create_post_from_media
  when media was selected. *Fixed (staged, awaiting rebuild):* `createPost` now errors clearly + points at the
  media tool so content/layout is always set (`leo-data-tools.ts` ~8280). *Also:* nudge tool-selection toward
  create_post_from_media when media is attached. `260720`
- **[P1] Channel media upload lost on refresh** — uploading media into channel `general` (NeuroCare Pro
  portal) did not survive a refresh — never rendered, gone "into the void." *Where:* channel media upload path
  (`channel-media.ts` / message attachments / MultiChannelChat composer). *Next:* trace whether the upload
  persists a message+attachment row at all, and why it's not surfaced on reload. `260720`
- **[P1] Stripe webhook secret unset in Vercel** — `STRIPE_WEBHOOKS_SIGNING_SECRET` not set + webhook
  `/api/stripe/webhooks` unregistered → Clearwater earn loop gated. *Where:* Vercel env + Stripe dash. *Next:* Ken sets it. [[project_earn_loop_clearwater]] `260720`
- **[P2] GoogleReviews block renders nothing on a bad/absent Place ID** — no graceful empty state, just a
  blank gap. *Where:* `src/blocks/GoogleReviews/Component.tsx`. *Next:* render a friendly fallback (or hide) when `fetchPlaceReviews` returns empty. `260720`
- **[P2] Error nervous system is console-only** — `apiInterceptor` + `ErrorBoundary` are effectively dead;
  17-item punch list already scoped. *Where:* [[project_error_nervous_system_audit]]. *Next:* work that list. `260720`

## 🟡 Gaps — features to build (P1)

- **[P1] Voice response system (Vapi) not wired** — code-complete (webhook, setup, per-tenant phone/assistant
  config) but `VAPI_API_KEY` missing and no tenant enabled. *Where:* `src/endpoints/vapi-webhook.ts`, Tenants `vapi` group. *Next:* Vapi account + key + assistant + route the number. `260720`
- **[P1] LMS Quiz module** — Works already does video/chapters/progress/TTS; the only missing LMS primitive is
  quizzes. *Do NOT fork a new LMS collection* — add a Quiz block/companion to Works. *Next:* Quiz block (manual now, AI-graded later). `260720`
- **[P1] Platform Costs (rename + ledger)** — `CostEvents` already discriminates Intelligence/Telephony/
  Storage/Infra/Other; the model is ready. *Where:* `dashboard/ai-costs/*`, `CostEvents`. *Next:* (1) rename ai-costs → platform-costs, (2) group the panel by category, (3) **emit cost events for Storage (R2), Telephony (Vapi/LiveKit), Infra** — currently only AI writes them, (4) per-system update link. Answers "what does our storage cost?". `260720`

- **[P1] Media-anywhere primitive (Ken 260722)** — "specify photos essentially anywhere + generate an image and
  put it anywhere": one LEO tool family that places existing/attached/AI-generated media into ANY surface —
  page block, post body/gallery, hero, channel message, tenant branding. Pieces exist (`set_media` primitive,
  `add_gallery_to_page`, `create_post_from_media`, `imageGeneration.ts`, 16fc811 attached-ids) but each surface
  is its own bespoke tool. *Next:* one `place_media(target, mediaIds|generatePrompt)` resolver over a target
  registry; then port to Nimue. [[project_set_media_primitive]] `260722`

## 🧱 Blocks / UI (P1–P2) — WordPress-parity kit

- **[P1] FeatureCards block** — icon-grid row ("Clinical Applications / Photobiomodulation / …"). *Next:* same
  cheap-block pattern. `260720`
- **[P1] Page `parent` + SubNav block** — self-referential `parent` on Pages (NOT nested-docs plugin —
  [[project_nested_docs_incident]]) + a SubNav block listing siblings/children; gives breadcrumbs free and preserves imported WP site structure (WP API exposes `parent` + `menu_order`). *Next:* field + migration + block. `260720`

## 🔧 Debt & hardening (P2)

- **[✅ SHIPPED 260722-pm2] Van post + LEO media-id fix + Start-S branding** — (1) van diagnostic post got its
  4-photo gallery (media 411-414); (2) **LEO media-tool root cause CLOSED** — "couldn't read that image" was
  masking `add_gallery_to_page` called with EMPTY imageIds (ids never reached model context); user turns now
  carry `[Attached media IDs: …]` (`16fc811`) — also closes the analyze_image-without-mediaId P1; (3) start-s
  services reseeded to Vlad's real 7-item price list; (4) **Start-S SVG logo** (media 415) in the header —
  which proved the old "header doesn't render branding.logo" P2 stale (NCP + Start-S both render; depth-2
  hydration works) → removed. `260722`

- **[✅ SHIPPED 260722-pm] Start-S portal + media-picker leak fix** — (1) **start-s.payloadnuke.com** provisioned
  for Vlad's "Start-S" mobile mechanic (tenant 24, 13 services from his flyer, `provision-starts.ts`); (2) **van
  diagnostic post** live on his portal (post 67) for the invite loop; (3) **media picker leak CLOSED** — Library
  tab queried `/api/media` with a client-supplied tenant param (absent → super_admin saw ALL tenants); new
  `GET /api/media-library` mirrors the /dashboard/media query with server-side tenant resolution, reuse button
  un-gated so the LEO sidebar composer can submit existing media (`8651f97`); (4) phone-invite Copy Link shipped
  earlier today (`5048e2e`) closes the old P2 "surface pending-invite links". *Gotchas logged:* `payload run`
  doesn't await a floating `main()` promise (use top-level await); a provisioning tx killed mid-run leaves pages
  with rolled-back media refs that validate-fail forever (delete + rerun). `260722`

- **[✅ SHIPPED 260722] Live-ops day (demo + MobileMech1)** — one line each, details in HANDOFF_260722.md:
  (1) **Lead→Contact auto-harvest** (`upsertContactFromLead`, voice + web-form doors, dedupe email→phone,
  `d34c43d`); (2) **Vapi `tool-calls` events handled** — tools were silently no-oping, capture_lead claimed
  success while saving nothing (`bbf45a9`); (3) **Passwordless login**: email code + **SMS OTP via Twilio
  Verify** (no from-number/10DLC needed), `users.phone` E.164 = identity anchor, self-service phone on
  /dashboard/account, provider-style "Continue with a code" button — see `docs/AUTH_PHONE_SIGNIN.md`
  (`03a8ecf`); (4) **>10MB uploads fixed** — Next 16 `middlewareClientMaxBodySize` default 10MB was silently
  truncating; now `150mb`; R2 bucket CORS extended to `*.payloadnuke.com`; MobilMechanic1 intro video (19.4MB,
  media 406) live; (5) **login light-mode invisible fonts** — `data-theme="dark"` pinned on the glass card;
  (6) **media library picker tenant-scoped + LEO sidebar full composer** (`508c7ef`); (7) **Redirects engine**
  — own 5-field `redirects` collection + `resolveRedirect()` in [slug]/[...slug], 227 NCP old-site URLs
  imported (migration `20260722_030000`); (8) **vision chain fixed** — retired `gemini-2.0-flash` fallback
  404'd behind LEO's "couldn't read that image"; pinned to `GOOGLE_MODEL`/flash-latest (`91ef738`); MobileMech1
  **14 bookable services** seeded from the price-sheet flyer; (9) dashboard command-center stats tenant-scoped
  (`f479c56`); (10) pg `idle_in_transaction_session_timeout` retuned 60s→**300s** (60s was reaping upload
  transactions). `260722`

- **[✅ SHIPPED 260721] Voice: trunk line, tools, lead capture, per-portal failover** — two defects a live call
  exposed, plus the per-portal work: (1) dialed-number resolution read only `message.call.phoneNumber`, but Vapi
  sends it at **`message.phoneNumber`** (top level) on `assistant-request` — every real call missed the trunk
  line and got the platform "which business?" prompt even though tenant 22 was wired. My earlier verification
  passed only because I hand-built the payload in the wrong shape — test against the provider's real contract.
  (2) Tools were passed as legacy top-level `assistant.functions`; Vapi's current schema is **`model.tools`**
  with `{type:'function', function:{…}}`, so the model had nothing callable and narrated *"I don't actually have
  a tool visible to call in this turn"* then stalled. *Also shipped:* `tenants.vapi.fallbackNumber` (+ migration
  `20260721_010000`), `syncVapiNumber()` (writes BOTH `server.url` and legacy `serverUrl`, nulls stale
  `assistantId`, validates E.164), `/api/vapi/setup { tenantId }` per-portal sync, capability-menu greeting, and
  portal **pivot** (`business` arg on ask_business + capture_lead). *Verified live:* NCP greeting, both tools,
  briefing preloaded, fallback `+17272564413`, `assistantId` null. `260721`

- **[P2] Consolidate configuration under `/dashboard/settings`** — audited 260721. There is no
  `dashboard/settings/**`; the hub is at **`/dashboard/admin/settings`** (tabs General/Endeavor/AI/Developer,
  writes `tenants.branding|commerce|aiConfig`). Nav is a single source of truth: **`dashboard/nav-config.ts`**.
  *Ranked moves:* (1) `/dashboard/account/integrations` — tenant connector secrets misfiled under a per-USER
  "Account" section → `/settings/integrations`; (2) `/dashboard/admin/settings` → `/dashboard/settings` (+redirect);
  (3) `/dashboard/spaces/settings` → `/settings/spaces`; (4) `/dashboard/availability` (booking config in
  PRODUCTIVITY nav) → `/settings/availability`; (5) split the Stripe-Connect config half out of
  `/dashboard/admin/payments`, leave charts as ops; (6) fold `/dashboard/account/connections` into `/account`
  (pure duplicate); (7) `site-settings` global has **no dashboard UI at all** → new tab. *Stay put:* account
  profile/addresses (per-user), team/invitations/crew (people ops), provision/backups/federation (platform ops),
  ai-costs/solvency/telemetry (observability). `260721`
- **[P2] Rename "AI Costs" → "Infrastructure Costs"; "AI Bus" → "System Bus"** — no new substrate needed: the
  **`cost-events`** collection already has categories `intelligence | telephony | storage | infra | other`, and
  `AICostsPanel` already renders Storage/Infrastructure labels. *Where:* route `/dashboard/ai-costs`
  (`ai-costs/page.tsx`, `AICostsPanel.tsx`, `ProviderSwitchboard.tsx`, `BootstrapFeeCard.tsx`) + nav entry in
  `nav-config.ts`. *"AI Bus" UI strings:* `ConnectorsAdmin.tsx:165,170`, `FederationDashboard.tsx:229`,
  `VerifyOnboardingButton.tsx:29,30,50`, `CICDashboard.tsx:355` (nav-config:82 is only a comment). `260721`

- **[✅ SHIPPED 260720] Phone assistant can now actually answer questions (site-content RAG)** — first live call
  routed fine but was useless: LEO's bridge **never fired once** (logs: zero `conversation-update`), because the
  Vapi assistant config had **no `serverMessages` subscription and no `functions`** — it had no way to reach the
  platform, so it truthfully said "I don't have details on file", then promised a transfer it cannot perform.
  Root gap: LEO had `query_posts` / `query_knowledge` (MediaMeta only) but **nothing that reads Pages** — where a
  business's actual copy lives. *Shipped:* new `query_site_content` tool (flattens lexical richText out of layout
  blocks, keyword-ranked; in READ_ONLY_TOOLS + CORE_TOOL_NAMES so cheap providers get it); `ask_business` function
  + `serverMessages` on both platform & tenant assistant configs; function-call resolves tenant from the
  `business` param FIRST (a function-call payload has no `conversation` array, so it was defaulting to the
  **platform** tenant and searching the wrong business); prompts no longer offer transfers. *Verified:* real PLMT
  answer in **2.9s**, honest "not on our website" fallback, served by gemini-flash-lite. `260720`
- **[P2] Proposal pages are publicly readable — and now voice-readable** — `proposal`, `proposal-campaign`,
  `proposal-research` are Ken→David pitch docs (incl. positioning/pricing) published on tenant 22, so
  `query_site_content` can recite them to any caller. *Next:* scope pitch docs out of public/RAG surface
  (unpublish, a `noindex`-style flag, or exclude by slug prefix). `260720`

- **[✅ FIXED 260720] VAPI voice (LEO on the phone) working end-to-end** — was broken by TWO things:
  (1) the Vapi phone number `+1 727-440-8797` (`a20b5a0d-8d79-41f5-9173-5091314ffc4f`) had `serverUrl` pointing
  at the dead `www.spacesangels.com` node → repointed to `https://www.payloadnuke.com/api/vapi/webhook`;
  (2) LEO returned the "AI capabilities are warming up" canned fallback because the default provider order
  reached for **google** with no GOOGLE/GEMINI key set, while `AI_GATEWAY_API_KEY` + `OPENROUTER_API_KEY` were
  set. Fixed in stack compose (NOT a git repo — recorded here): `AI_PROVIDER_ORDER: "gateway,openrouter,ollama"`
  and `OLLAMA_BASE_URL: "http://host.docker.internal:11434"` + `extra_hosts: host.docker.internal:host-gateway`
  (closes the long-standing "container Ollama fallback DEAD" note). Verified: assistant-request returns a valid
  LEO config; conversation-update returns a real AI answer. *Remaining:* Ken places a live test call.
  ⚠️ **Vapi has TWO server fields — `server.url` is authoritative, `serverUrl` is legacy/deprecated.** Patching
  only `serverUrl` changes nothing for live calls: Vapi read `server.url` (still the dead spacesangels node),
  timed out at 20s, and forwarded to `fallbackDestination` (+1 727-256-4413). Also cleared a **dangling
  `assistantId`** (`e9675026-…`) that pointed at a non-existent assistant (account has 0 stored assistants) —
  with it set, Vapi never sends `assistant-request` to our webhook. Now: `server.url` = payloadnuke webhook,
  `timeoutSeconds` 20→30, `assistantId` null, fallback preserved. Webhook latency measured **0.17–0.19s**.
  *Note:* `conversation-update` returning `{ok:true}` is BY DESIGN — Vapi's own assistant handles the
  greeting/routing turn until the caller names a business; only then does the tenant resolve and LEO take over.
  *Optional:* set `VAPI_PHONE_NUMBER_ID` in compose so `/api/vapi/setup` works (repoint was a direct API PATCH).
  `260720`
- **[✅ FIXED 260720] LEO now runs on Gemini (~10x cheaper than the metered Anthropic gateway)** — the gateway
  reads **`GOOGLE_AI_API_KEY`** (NOT `GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY` — checking the wrong
  name made it look unset); the key was in `.env.local` and valid all along. The real defect: the default
  `gemini-flash-latest` is a **THINKING model** — reasoning consumes the whole token budget and returns
  **EMPTY content**, so LEO emitted its "warming up" fallback (this is the [[project_leo_empty_response]]
  class of bug). *Fix (compose env, recreate only — no rebuild):* `AI_PROVIDER_ORDER: "google,gateway,openrouter,ollama"`
  + `GOOGLE_MODEL: "gemini-flash-lite-latest"`. Verified: LEO returns real answers and uses tools; gateway
  credit balance held at $13.96 (no longer consumed). Note `gemini-2.0-flash` / `2.5-flash` **404 on this key**
  — flash-lite / flash-latest / 3.5-flash are available. Gateway+openrouter remain paid failover. `260720`

- **[✅ FIXED 260720] Ecommerce cross-portal leak** — shipped: `tenantScope.ts` override (tenant field +
  tenant-on-write from request host + tenant-ANDed read, fail-open) wired as carts/addresses/transactions
  overrides; migration `20260720_030000` added `tenant_id` FK+index. *Verified live:* new cart got
  `tenant_id=5` on clearwater, add-to-cart + cart read ("Max in cart") + checkout ($40 total) all working.
  Pre-existing rows stay NULL by design. Original analysis below for reference.
- **[P2] Shop category filter leaked every tenant's categories — FIX STAGED** — `Categories.tsx:12` did an
  unfiltered `payload.find`; Clearwater's categories showed on the NeuroCare Pro shop. Now filtered by resolved
  tenant; awaiting next rebuild. `260720`
- **[~~P1~~ superseded, see FIXED above] Ecommerce collections leak across portals (`carts`, `addresses`, `transactions`)** — none are in the
  `multiTenantPlugin` map (`payload.config.ts:452-516`); plugin config (`src/plugins/index.ts:104-130`) only
  overrides `orders`+`products`. So they have NO tenant field and follow an SSO'd user across every portal:
  - `carts` — surfaced via Users `cart` join (`Users/index.ts:401-406`); tenant A's cart shows on tenant B. LEO
    cart tools read/write `userDoc.cart.items` with no tenant (`leo-data-tools.ts:5388-5437`). HIGH.
  - `addresses` — Users `addresses` join (`Users/index.ts:411-417`); saved shipping PII identical on every
    portal. HIGH (PII).
  - `transactions` — Stripe adapter writes no tenant (`angel-os-stripe-adapter.ts:308-312,364-368`); admin
    payments page filters by a non-existent `tenant` field (`dashboard/admin/payments/page.tsx:46-49`) so it's
    silently ineffective. MEDIUM-HIGH (financial).
  *Fix:* add all three to `multiTenantPlugin` → **schema migration** (`tenant_id` columns) + set tenant on write
  (cart/address create from request host; transaction from the order's tenant). Own careful build; verify
  add-to-cart + checkout after. Cart id is localStorage (per-subdomain) so the leak is purely server-side.
  *Also audit* (tenant field already present, confirm access filters): `services`, `memberships`, `wallets`,
  `token-ledger`, `signatures`, `agent-transactions`, `works`. `260720`
- **[P2] Link-editor tenant filter — STAGED, not deployed** — filterOptions on the rich-text LinkFeature + block
  link field scopes the page picker to the editing doc's tenant; awaiting next Core rebuild. `260720`
- **[P2] White-label nav hides** — hide root **Learn** + **Works** nav links per-tenant; Ken thinks the toggle
  belongs on the Endeavor/settings tab. Deferred (not in the pending rebuild batch). `260720`

- **[P1] Login-killing DB jam (idle-in-tx holding a lock)** — a transaction opened, `select`ed media, then sat
  `idle in transaction` ~23min holding a lock; a cascade of `insert into users` (Google login find-or-create,
  retried) blocked behind it and exhausted Core's pg pool → *every* query timed out (`timeout exceeded when
  trying to connect`), breaking BOTH password + Google login. *Mitigated:* `ALTER DATABASE angels SET
  idle_in_transaction_session_timeout='60s'` (auto-kills abandoned tx). *Root cause still open:* a transaction
  held open across an await leaks — find & fix the user-create/media path. Also fold the timeout into the stack
  compose PG config so a fresh volume keeps it. [[project_provisioning_transaction_fragility]]. `260720`

- **[P2] Node hardening 260718** — CORS commit NOT pushed (touches kendev/spacesangels); federation peers
  from DB; AI resilience = one `providerHealth` breaker. [[project_node_hardening_260718]]. `260719`
- **[P2] Container `payload run` can't resolve `@payload-config`** in the pruned prod image — blocks
  in-container one-off scripts via that path (worked around by top-level-await scripts). *Next:* note or fix the alias for `payload run`. `260720`
- **[P2] MEMORY.md near size cap** — wants a compaction pass (`consolidate-memory` skill). `260719`
- **[P2] `heros/config.ts` is a stale duplicate** of `fields/hero.ts` (the live one). *Next:* delete or
  reconcile. `260720`

## 🚢 Deploy / ops (P1–P2)

- **[P1] Merlin ↔ Core :3000 port collision (Merlin DOWN / CF 530)** — the self-host Core Docker container now
  holds host `:3000`, the same port Merlin's interactive scheduled task binds (`next start -p 3000`), so
  `merlin.payloadnuke.com` hits Core (or a stale node), not Merlin. *Fix:* Core (prod) keeps `:3000`; move Merlin
  to a free port (e.g. `:3002`) — update `package.json` start, the `Merlin` scheduled task command,
  `refresh-merlin.ps1`'s `:3000` refs, and the cloudflared ingress for `merlin.payloadnuke.com`. Needs Ken's OK
  (touches the tunnel + task; may need elevation). `260720`

- **[P1] payloadnuke.com → Railway** — stabilize builds first, then migrate the self-host node to Railway Pro
  (~$20/mo). Pre-deploy checklist + post-restore `db-repair-sequences` documented. *Where:* `docs/DEPLOY_RAILWAY.md`. [[project_railway_migration]]. `260720`
- **[P2] Merlin node DOWN (CF 530)** — search proxy Merlin-side `/api/search` pending; MerlinControl media-link
  fix. [[project_merlin_thin_client_rewire]]. `260719`
- **[P2] Unmerged branches awaiting Ken review** — `feat/onboarding-reception`, `feat/active-endeavor-switch`
  (ready to merge), `feat/bookable-inventory`. `260719`

---

## ✅ Recently closed (last 7 days)

- **MediaText block** (two-column text + video, WordPress parity) — `ecfbc9e`; live on the NeuroCare Pro home ("Why PLMT Is Different"). `260720`
- **Full-screen video/image hero** (`fullScreen` hero type, reusable) — `b75416b` + video support. `260720`
- **NeuroCare Pro prospect portal** stood up on payloadnuke with the live video hero. `260720`
- **Reachable self-host portal domains** — provisioned portals now land on `<slug>.payloadnuke.com`, not
  unreachable `.angelos.local` — `9cae15a`. `260720`
- **LEO bubble deep-links to full-width Spaces** + shows space/channel binding — `bf806ec`. `260719`
- **Railway runbook** — pre-deploy checklist + sequence-repair + cost reality — `8cd4be2`. `260719`
- **GoogleReviews block** shipped (config + migration + Products/Posts/Pages). `260719`
