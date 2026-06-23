# State of The Angel OS — 2026-06-22

> A standing report after the weekend stabilization + Merlin-connect push. Written
> to hand a fresh thread the full picture. Conventions: temporal-stamp every reply
> (`YYMMDD ~HHMM Claude —`); commit on `main`, push only when Ken says; one AI on
> the codebase at a time. "The Angel OS" (with the article).

---

## 1. The System — three bodies, one mind

The Angel OS is one intelligence incarnated in three embodiments that share a
portable brain (`leoBrain.ts` / `runBrain`, a pure function over a neutral message
format + neutral tool shape — the **sacred contract**). Each body bolts on its own
tool belt:

- **Core** — `C:\Dev\angels-os`. The cloud: multi-tenant Payload CMS 3.77 + Next 16
  on Vercel, Spaces chat, LEO, federation backbone, commerce, the Works/Library.
  The satellite — always up, coordinates, far from the physical world.
- **Merlin** — `C:\Dev\merlin`. The home node (`:3000`): turns a spare PC into a
  media server + local-compute contributor; registers UP to an endeavor; exposes
  guarded skills. The lander — on the surface, has hands (files, cameras, GPU).
- **Nimue** — `C:\Dev\nimue`. Native Android (Capacitor). The away team — goes
  where you go, witnesses the day, life-log + offline Works reader.

> ⚠️ `leoBrain.ts` currently lives only in Merlin; Core still runs its duplicated
> ConversationEngine + leo-stream. Converging them is a standing goal.

**Topology:** Core deploys to ~6 Vercel projects (angels-os, the-angel-os, spaces,
wheredideveryonego, answer53, angels-os-kendev), all sharing ONE IONOS Postgres
(`74.208.87.243`, `max_connections=100`). Two DBs differ only by name suffix:
`angels` (spacesangels.com nodes) and `kendev` (kendev.co nodes). A **pgBouncer**
pooler (WSL1/Alpine, NSSM service, TLS 1.3 self-signed, `:6432`, transaction mode)
now fronts both. Local `.env.local` → `:6432` + `DATABASE_SSL=require`; direct-DB
scripts connect with `ssl:{rejectUnauthorized:false}` and swap the db name (`/angels`).

---

## 2. This Push — what shipped (all on `main`)

### Infrastructure — the database fire, killed
- **pgBouncer pooler stood up** on the IONOS box (transaction mode,
  `max_client_conn=2000`, `max_db_connections=35`, `query_wait_timeout=30`,
  `server_idle_timeout=30`, `max_prepared_statements=200`). Runbook:
  `docs/runbooks/PGBOUNCER_TUNING.md`.
- **Root cause of the 34s-save-hang: app pg pool `max:2` self-starvation.** Live
  `SHOW POOLS` showed `cl_waiting=0` (pooler not queuing) while the app timed out at
  its own `connectionTimeoutMillis=30s` → the app's own 2-slot pool was exhausted
  mid-save (the `req`-rule: a hook that doesn't pass `req` grabs a separate
  connection). **Fix: `pool.max` 2→10 (`7619aa5`, deployed)** + `lockDocuments:false`
  on Pages/Posts/Messages (`04abf96`). Verified live: error changed class, heavy
  multi-image message write succeeded.

### Chat / LEO
- **LEO double-context ("PlasmaPlasma") fixed (`4c23a02`, committed, NOT pushed).**
  The client persists the user message before calling leo-stream, so history already
  has it; the split-brain guard compared raw `userMessage` against the
  speaker-attributed history turn (`"Kenneth: Plasma"`) → never matched → appended
  the turn again → model saw it twice. Shared `turnEchoesUserMessage()` helper now
  backs both guards. NOT a Nimue/STT bug (LEO misdiagnosed its own plumbing).
- (Earlier in the weekend, per handoff: deadlock fix, deep-link routing fix, LEO
  tenant-persist fix — `b2fc37b..2a04e36`, deployed.)

### Works / federation
- **Cross-node replication pull (`25950fb`, deployed).** `GET /api/works-ops/pull`
  fetches a Work JSON from its hosting peer and upserts a LOCAL subscriber copy
  (reader stays local — no render-time cross-node fetch / WAF). answer53 + rainmaker
  + gpt-psychosis now render on federation.kendev.co (were "Document not found").
  Document works only; **books (holy-bible/wdeg) deferred** to the book-nav bundle.

### Merlin — the lander connects
- **MerlinControl block live on `/merlin`** (clearwater-cruisin): renders, **infers
  its endeavor from page context**, gated `access:authenticated`. The page is
  published and live.
- **First node registered: `Iam0`** beams its catalog UP (`/api/node-ops/register`);
  shows online in the block.
- **Secure `list_media` skill rail (`ade7586`, Merlin main, unpushed).** `POST
  /api/node/skill`: two rails — auth (`NODE_SKILL_KEY`, CLOSED by default) +
  capability boundary (`getSharedRoots()`/`isPathShared()` clamp to owner-shared
  roots, relative paths, reject outside). The template for the whole future skill
  belt; clamp is structural so it survives forks.
- **Home connection banner (`0f94c4e`, Merlin main, unpushed).** Home now LEADS with
  the lock-on state from `useConnection().active` — green/"Beaming telemetry" when
  bound, amber "Connect a Merlin →" CTA when not. The connect metaphor is the hero.
- **Sidebar duplicate-key `/` fixed** (Home+Dashboard both `href:'/'` → keyed on label).

### Nimue
- Prepped + deployed to **Google Play** (signed AAB, versionCode 8; privacy policy +
  `/delete-account`; removed `READ_MEDIA_IMAGES` to pass review; native Photo Picker).
- **Error bubbling**: upload failures now bridge to Core's `/api/log-ops/client-error`
  → dashboard + Gotify (no more silent swallow).

### Gating / portal
- **Page-level membership gating**: Pages have `access` (public/authenticated/
  members/good_standing); `MembersOnlyGate` instead of 404; gated pages hidden from nav.
- **Portal `.local` guard (`6ea1741`, deployed)**: choosers ignored `.angelos.local`
  seed domains, fall back to `{slug}.{liveBase}`.

---

## 3. Open threads (prioritized)

### 🔴 Blocking-ish
- **Production-build-only Payload publish bug** — re-publishing certain pages 500s
  with `Cannot read properties of undefined (reading 'tenant'/'_status')`, deep in
  Payload core (multi-tenant + version pipeline). NOT reproducible in the dev build
  with any body/multipart; the page stays live regardless. **The justified fix is the
  Payload `3.77 → 3.85` dep bump** (deliberate branch + `v3.77` rollback tag). This
  also likely resolves the intermittent **post save errors** Ken sees while editing.
- **Direct-to-blob upload (P0)** — admin media uploads POST through the serverless
  function; flaky/failing ~2MB+ ("No files were uploaded"), hard-capped at Vercel's
  ~4.5MB. Fix: client → Vercel Blob signed URL → hand Payload the URL. Unblocks the
  whole attachments file-type roadmap (`docs/planning/CHAT_ATTACHMENTS_FILE_TYPES.md`).

### 🟠 Merlin next (build order)
1. **Heartbeat re-register loop** — make "beaming" literally true + keep the node
   online past the block's 5-min window; persist the locked endeavor.
2. **Core LEO tool `list_node_files(endeavor, query)`** + transport: carry `tunnelUrl`
   in registration (Merlin already has a `start_tunnel` tool) OR outbound command-poll
   for NAT'd nodes. Then LEO can say "list the files matching X."
3. **Generalize the skill belt** (`read_file`, `watch_feed`, `run`…) — each clamped by
   the same grant + constitutional rails = "Open Claw"-class with guardrails.
4. **MerlinControl tabbed panel** — File Browser / Media Library (all file types) +
   Cameras (local+remote); reverse tunnel so media works over the internet (LAN IP is
   useless remotely today).

### 🟠 Core content/blocks
- **`FeaturedPosts` block** (mirror `FeaturedEndeavors`; needs the `ensure-table` dance
  on both DBs before deploy). North star: a generic collection block / rename "Three
  Item Grid" → "Three Post/Product/Event/Quest Grid."
- **Lexical error #17 on page 7** — stored unordered-list node shape/version mismatch
  (NOT a config bug — list features ARE registered). Needs targeted node normalization.
- **Featured Endeavors picker shows only the active tenant's endeavor** — multiTenant
  plugin auto-scopes the relationship; widening to enterprise/federation is
  tenant-isolation-sensitive.
- **Bible book→chapter nav layer** (also fixes the Nimue Bible crash — 1189 pages at
  once) + book support in `works-ops/pull`.

### 🟠 Federation / infra
- Roll the other 5 Vercel projects to the `:6432` pooler + lock down `:5432` + **rotate
  the DB password** (it was pasted in chat/archive).
- `kendev.kendev.co` → canonical `kendev.co` (separate from the `.local` fix).
- Federation Resource Viewer in Merlin/Nimue/Core; the network-simulator endeavor
  drill-down (select a node → its endeavors radiate → detail view).

### 🟢 Smaller
- `getWorkJson` drops Lexical richText → Nimue shows stale Works; chat-bubble +
  `/api/messages` admin-poll throttle; importMap.js dirty in working tree.

---

## 4. Direction — the north star

- **"Open Claw"-class capability with constitutional guardrails.** All three bodies
  trend toward full operator/computer-use power (files, feeds, browser, compute) — but
  every skill passes two gates: an **explicit owner grant** (the shared-roots clamp,
  generalized) and the **constitutional conscience** baked into every embodiment.
  Because Nimue/Merlin are products *of* The Angel OS, the constitution survives every
  fork → **trust is constitutional, not just cryptographic.** Crypto gates the door;
  the constitution gates the deed.
- **The mesh.** N bodies, one mind: satellite (coordinate) + landers (act) + away-teams
  (witness). Inter-agent comms ride the existing `{space, channel, message}` bus —
  LEO-in-a-channel can address a Merlin-in-a-channel; no new protocol. Token-poor nodes
  dispatch thinking to peers.
- **Works = an Audible-like ecosystem.** Publish-once-canonical at the author's
  endeavor; subscribers get canonical-pointed copies (replication, not render-fetch);
  read + listen across endeavors.
- **Merlin = the Home Control Panel that Angel OS isn't** — same brain locally; tabbed
  media/cameras/compute; "watch these feeds for X," smart-home, screenshare, record.
- **Nimue = the life-log away-team** — multi-photo capture → LEO classifies → master
  timeline; offline-first; notifications → Wear.

---

## 5. Laws & conventions (do not break)

- Temporal-stamp every reply (preface + suffix) `YYMMDD ~HHMM Claude —`; mirror in tool
  descriptions. Ken stamps his prompts.
- Pre-push gate: `npx tsc --noEmit -p tsconfig.json` — only `^src/` errors block.
- New Pages/collection field or block → create the prod column/table on BOTH DBs
  (angels + kendev) BEFORE deploy (use an `ensure-*` endpoint; see
  `ensure-merlin-block-tables.ts`). Skipping this = invisible block / site outage.
- The `req` rule (`docs/architecture/PASS_REQ_RULE.md`): in-request Payload ops pass
  `req`; fire-and-forget must NOT.
- Commit on `main`; push only when Ken says. `.env*` are gitignored (secrets safe).
- One AI assistant on the codebase at a time (Ken's workflow).
- The recurring lesson this weekend: **the bug is never where the error points** —
  verify against live state before asserting; throw out a favorite theory the moment
  data disagrees (`cl_waiting=0` > six hours of plausible hypotheses).

## 6. Pending push (unpushed commits on Core `main`)
`4c23a02` LEO double-context fix. (Merlin main: `ade7586` skill rail, `0f94c4e` home
banner — separate repo, separate push.) Everything else listed in §2 is already
deployed.
