# STATE OF ANGEL OS — 260704 (late) Handoff

> Bridge for a fresh thread after a very long marathon session. Everything below
> is committed + pushed. Prior handoff: `docs/STATE_OF_ANGEL_OS_260704.md`.
> Memory header (MEMORY.md) is current; read it first.

## Deploy state
- **Core (angels-os)** prod: LIVE and healthy. Latest commit ~`df543ab`. Both Vercel
  projects auto-deploy `main`: **angels-os** (prj_18HdwoPYXit5bEWMgSthSQ32PofF, spacesangels)
  + **angels-os-kendev** (prj_pwL4xPPb8Jw2AjDWdHUS78gOMexQ). Team team_mUAdmcHUYakY4VyhumLMHUNd.
  RULE: green push ≠ green deploy — always `list_deployments` → state READY.
- **Nimue** `main` `db8e394` (+ this session's later work). Installed build **v1.2.4 (code 16)**
  on device 192.168.0.233:35713 + BlueStacks 127.0.0.1:5555 (its ADB toggle is in Advanced
  settings). **Signed AAB for Play Store built**: `C:\Dev\nimue\android\app\build\outputs\bundle\release\app-release.aab`.
- **Merlin**: Ken was rebuilding the Windows service (runs on :3000, same box as 192.168.0.234);
  dev shuffling 3000/3007. Don't spin a preview server — it collides.

## What shipped this session (Core, in order)
- **Deploy blocker fixed** (`f0726c1`): `/api/docs` readdir'd `docs/` in the payload-config
  graph → nft globbed the whole repo into every fn (427MB > 250MB cap). `outputFileTracingExcludes`
  → 83MB. See [[project_nft_tracing_gotcha]].
- **Daily Bread** (`2082353`): `/api/works-ops/daily` + `get_daily_bread` tool; deterministic
  3-verses/day; also fixed blank-Bible-chapters (getWorkJson renders verse arrays to md).
- **Admin tenant-chooser** follows portal to its domain (`fc53809`).
- **LEO fixes** (`d4b40d6`): stringified-JSON tool-param coercion + tool errors → nervous system.
- **DB hardening** (`9ebb1b7`): idle pg-pool error listener (stopped /dashboard fatals) + surface
  real pg error in health digest.
- **LEO health count()** (`76187c3`): find({limit:0}) → count(); dodges kendev orders enum/column drift.
- **Daily Bread ref deep-link** (`f713eb4`).
- **Handbook rewritten** (`32d097c`, `59543b0`): Nimue-first + three bodies (satellite/lander/
  away-team) + One-Mind lore; Google-only auth (AVAILABLE_PROVIDERS=['google']). Message-backed
  Work → RE-IMPORTED on platform + clearwater-cruisin (docs-moving/wdeg are on the kendev node).
- **READMEs** (`6f6c2b8` angels-os + org profile `.github` `503046b`): mission-current.
- **Hippocampus** (organism): Slice A `43c4780` (LEO senses its own unresolved-error count in the
  health digest) + Slice B `0a31fe6` (nightly `/api/log-ops/consolidate` cron — keep unresolved,
  forget resolved>14d + info/debug>7d, rollup "dream"; dry-run verified: wouldForget 8 / kept 551).
- **NVIDIA + the Hydra**: provider `d9753cc`; config-key storage `8e93754` (aiConfig.nvidiaApiKey +
  MIGRATION `20260704_060000_add_nvidia_ai_config` — verified applied, tenant queries safe);
  real model `fa1d4a4` (`nvidia/nemotron-3-ultra-550b-a55b`); **the Hydra** `1890a65` — intent
  pipes (default/tool_use/max/chitchat/sensitive) with the SENSITIVE PRIVACY GUARD (excludes
  data-logging providers; 6 tests).
- **/learn network map** (`efb3c97` + animated `df543ab`): `OneMindThreeBodies` LCARS SVG module.

## Nimue shipped this session (versions 1.1.0 → 1.2.4)
Daily Bread quest-widget (feminine LISTEN + ref deep-link) · reader read-aloud + Core-serif/LCARS
theme + **two-column on wide** · live tool-use chips (askLeoStream) · **LiveKit call overhaul**
(full-screen overlay so controls always show, facingMode flip, join/left msgs, RED+capture
anti-scratch) · **voice autosubmit (default on) + auto-read reply** · **"Talk to Leo" = shortcut
to the Leo DM channel** via the unified chat control (copy/speak/AUTO).

## Ken's pending actions (not code — his hands)
1. **AI_PROVIDER_ORDER** in Vercel env: to actually ROUTE to NVIDIA, put `nvidia` where he wants
   (e.g. `nvidia,ollama,groq,gateway,openrouter`) — groq wins first otherwise. Env change → redeploy.
   NOTE (260704 decision): production `chitchat`/bulk should point at **OpenRouter open models**,
   NOT NVIDIA's free *trial* endpoint (it rate-limits + LOGS/TRAINS on inputs). NVIDIA-direct =
   dev/eval + zero-budget bootstrap only. `sensitive` pipe already excludes it in code.
2. **Publish the Home page** (platform admin → pages/7 → "Publish changes") — the `AngelOSThreeBodies1`
   meta image is in an UNPUBLISHED draft, so LinkedIn's og:image serves the template default. Then
   **re-scrape via linkedin.com/post-inspector**. (generateMeta.ts is correct; it's a publish + cache issue.)
3. **Play Console**: upload the AAB (Internal testing → new release), finish store listing (name/short/
   full description drafted), content rating, data safety, privacy URL. **App category = Books & Reference**
   (NOT Communication).
4. **TLZ email**: reply drafted + tiered device-reset pricing sheet drafted (VoIP/POS/PC tiers).
5. Uploads re-test live; /dashboard/media error; $9.99/mo provisioning-flow design.

## Next build slices (mapped, foundations in place)
- **The Hydra, phase 2**: thread `intent` at call sites (LEO loop=tool_use, moderation=chitchat,
  flagged-sensitive=sensitive); config-driven provider registry (add any OpenAI-compatible provider
  via a DB row, no deploy); **Merlin registers as a pipe** + ai-broker routes by purpose+sensitivity.
- **Organism motor/efferent** (next organ after the hippocampus): leo-wake transport → errors-channel
  subscriber → phased repo_fix loop ([[project_error_nervous_system_audit]]).
- **Nimue local cortex channel** (`/nimue`): the local personality surface over the Dexie event log +
  watch loop (autosubmit/auto-read primitives already built). Ken's "everything cycles through Nimue".
- **reimport_work LEO tool**: whatever I do via curl+CRON_SECRET (e.g. re-import a Work) should be a
  LEO tool Nimue can broker ([[feedback_ask_leo_first_autonomy]] north star).
- Encrypt-at-rest pass on aiConfig plaintext keys.

## Durable gotchas re-confirmed tonight
- `limit: 0` = UNLIMITED in Payload → use `count()`.
- aiConfig group field = a `tenants` column (`ai_config_*`) → needs a migration (build runs
  `payload migrate && next build`, so column+code ship together or the build fails safe).
- `pnpm test:unit` only (bare `vitest run` sweeps tests/int → live-DB timeouts). ~8 gateway tests
  + ensureTenantMembership are pre-existing failures.
