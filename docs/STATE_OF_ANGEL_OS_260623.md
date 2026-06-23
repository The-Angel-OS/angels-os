# State of The Angel OS — 2026-06-23

> Standing report after the "config-free node + camera sentinel" session. Supersedes
> docs/STATE_OF_ANGEL_OS_260622.md. Conventions: temporal-stamp every reply
> (`YYMMDD ~HHMM Claude —`); commit on `main`, push only when Ken says; one AI on the
> codebase at a time. "The Angel OS" (with the article).

---

## 1. The System — three bodies, one mind, one bus

The Angel OS is one intelligence in three embodiments sharing a portable brain
(`leoBrain.ts` / `runBrain` — pure fn over a neutral message + neutral tool shape, the
**sacred contract**). Each bolts on its own tool belt:

- **Core** — `C:\Dev\angels-os`. The cloud: multi-tenant Payload CMS 3.77 + Next 16 on
  Vercel; Spaces chat, LEO, federation, commerce, Works/Library. The satellite.
- **Merlin** — `C:\Dev\merlin`. The home node (`:3000` service; dev on `:3005`): media
  server + local-compute contributor + **sensor** (camera/window). The lander — has hands.
- **Nimue** — `C:\Dev\nimue`. Native Android. The away team. (MerlinControl is its prototype.)

**North-star doctrines locked this session:**
- **Config-free intelligence** — intelligence comes from Ollama directly OR the connected
  Endeavor; connection (lock onto an Endeavor) is the ONLY setup; offline degrades to
  local Ollama (≈ "Open Claw"-class w/ constitutional rails). Never a settings UI for the brain.
- **The Endeavor is the intelligence proxy / routing hub** — nodes surf its intelligence
  AND contribute back, both ways. The node-bus is segment one of a **universal compute
  routing bus** (a stated main goal).
- **Merlin = self-provisioning distributed-compute contributor** — install-and-forget
  tooling (auto-DL Ollama), eventual primary repo maintainer, distributed jobs
  (transcribe a YouTube chunk, distributed image search). Subscriber model; capital TBD.

**Topology:** Core → ~6 Vercel projects, one IONOS Postgres (`74.208.87.243`, max 100),
fronted by a pgBouncer pooler (`:6432`). DBs `angels` + `kendev`.

---

## 2. This session — what shipped (all pushed)

### Core (`1afe9c2 → c29f1a4`, plus `6fc2c37`; all on `main`, deployed)
- **Universal layout controls (the "53 Prototype"):** `<Panel>` + `<TabbedPanel>`
  (`src/components/ui/`). One card shell + one tab bar with Pony-Tail error-bubbling baked
  in (`logClientError` + `<PanelErrorBoundary>`), deep-linkable `?tab=`, a **fill** mode
  (flex column, panes scroll internally), and **focus mode** + collapsible nav. First
  consumer: MerlinControl. `cc7a0e9`, `c29f1a4`.
- **Merlin Console live-online** — the console reads online from its own 3s poll, not a
  stale render prop. `4588687`.
- **File bridge** — `POST /api/node-ops/media`: a node submits a file (base64) as its
  system-user → tenant-scoped Media doc → Vercel Blob → URL. `6fc2c37`.

### Merlin (`204ee6a → 1be434a`; pushed to origin)
- **Config-free lock-on** — `NodeLockOn` extracted + surfaced on `/connect/[slug]`; the
  `/connect` directory cards are now a **live selector** (click → lock node on → green
  "Locked"), via a shared `useNodeBinding` hook. No human login required. `61b033b`, `625c694`.
- **Bus loop fixes** — reverted the boot `instrumentation.ts` (it re-dragged node→`fs` into
  the edge build → "Can't resolve 'fs'"; documented landmine). The REAL "no reply" bug:
  `pollOnce` posted `content: reply` (bare string) but Core's `Messages.content` is a
  required JSON field → 500; fixed to `content:{text}`. Console round-trip now works.
  `271b60b`, `9df2298`.
- **Camera snap + sentinel + window monitoring:** `camera.ts` (ffmpeg dshow webcam +
  gdigrab window capture, `listCameras`/`listWindows`/`captureFrame`); `snap_camera`
  bus skill; key-gated `GET/POST /api/node/snap` (lists cameras+windows; snap+submit);
  **change-detection sentinel** (`sentinel.ts` — sharp 64×64 grayscale mean-abs-diff,
  submits only on change ≥ threshold) with `GET/POST /api/node/sentinel`. `d0ec2a2`,
  `faa6c96`, `9128195`, `1be434a`.

**Verified end-to-end against prod** (clearwater-cruisin): lock-on → register → poll →
local brain (gemini, used `list_media`) → reply; webcam frame → file bridge → Media
(1920×1080); window grab → Media (1718×1313); sentinel baseline-submits then stays silent
on a static scene. The launch chain — **connect → converse → contribute → watch** — works.

---

## 3. Punch list — high-priority remaining

### 🔴 Launch-blocking-ish
1. **Media Library: filter + pagination** (Ken 260623). `/dashboard/media` is at 64 files
   and growing — add type/text filters + paging. (Top of the list.)
2. **Merlin `:3000` service still runs OLD code** — the `nssm` rebuild needs an ELEVATED
   shell (`Access is denied` unelevated). Until Ken rebuilds elevated, tonight's Merlin
   work is live only on the `:3005` dev server.
3. **Production-build-only Payload publish bug** (carried) — re-publishing some pages 500s
   (`undefined.tenant`); fix = Payload `3.77 → 3.85` dep bump (branch + `v3.77` rollback tag).
4. **Direct-to-blob upload (P0)** — admin uploads flaky >2MB, hard-capped ~4.5MB. The file
   bridge currently uses base64-in-JSON (fine for snapshots; large files need signed-blob).

### 🟠 Next build (node / sentinel)
5. **Core LEO tool to drive snap/sentinel over the bus** — so "LEO, take a snapshot" /
   "watch the door" works conversationally (dispatch `snap_camera` as a node-command).
6. **Multi-source sentinel** (Ken) — monitor several windows/cameras at once, each with its
   own baseline. (Today: one source.)
7. **gdigrab black-window** — some windows (e.g. Phone Link, occluded/minimized) capture
   black; investigate per-window capture (PrintWindow/DWM thumbnail) for those.
8. **Sentinel UX** — source-picker + on/off toggle in MerlinControl; schedule trigger;
   smarter diff (regions, ignore clock/timestamp pixels).

### 🟠 Architecture / design (discuss before building)
9. **Identity / profile / friends** — Spaces lacks members-as-virtual-channels, a persisted
   friends list (presence + avatar), and a canonical profile repo. Proposal: a member's
   Endeavor marks their profile canonical; onboard every tenant user to the root portal =
   a local federation record synced to their canonical home (key on
   `computeFederatedIdentityId`).
10. **Lock-on → Discovery view** — after lock-on, show the Endeavor's Discovery info +
    graphic + options incl. the direct LEO channel (`Leo <==> merlin_Iam0`).
11. **Merlin → Payload + SQLite** migration (design doc shipped: Merlin `1b617d0`) — gives
    Chat-lift (whole API + tool-use display travels) once both backends are Payload.

### 🟢 Smaller / carried
- Retrofit remaining hand-rolled shells onto `<Panel>`/`<TabbedPanel>` (ChannelTabs,
  ChatControl slide-outs, dashboard widgets).
- Roll other Vercel projects to the `:6432` pooler; rotate the DB password.
- Nimue streaming hard to discern (Nimue repo); `getWorkJson` drops richText.
- Delete test artifacts in clearwater Media (esp. the Phone Link window grab — may show
  personal content).

---

## 4. Laws & conventions (do not break)
- Temporal-stamp every reply (preface + suffix) `YYMMDD ~HHMM Claude —`. Ken stamps his.
- Pre-push gate: `npx tsc --noEmit` — only `^src/` errors block.
- New Pages/collection field/block → create the prod column/table on BOTH DBs BEFORE deploy.
- The `req` rule (`docs/architecture/PASS_REQ_RULE.md`): in-request ops pass `req`;
  fire-and-forget must NOT.
- **Do NOT start the Merlin bus loop from `instrumentation.ts`** — it drags node→`fs` into
  the edge build and white-screens every page. Loop starts from node API routes (nodejs).
- Content posted to `Messages` must be `{text}` shaped (required JSON field), never a bare string.
- Commit on `main`; push only when Ken says. One AI on the codebase at a time.
- **The bug is never where the error points** — verify against live state before asserting.
  This session: "no reply" was 3 wrong theories (dead loop / lock-on / channel) before the
  activity log showed `result post 500` — a content-shape bug.

## 5. Key memory files (auto-memory)
`project_config_free_intelligence`, `project_endeavor_intelligence_backbone`,
`project_merlin_distributed_compute`, `project_universal_layout_controls`,
`project_merlin_file_bridge`, `project_merlin_camera_sentinel`, `project_node_bus_comms`,
`project_identity_profile_friends`, `project_merlin_lockon_discovery`.
