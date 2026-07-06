# State of The Angel OS — 2026-07-06

> Standing handoff after the "escalation nervous-system + Nimue media/voice + Clearwater
> ingestion" session. Supersedes docs/STATE_OF_ANGEL_OS_260705.md. Conventions: temporal-stamp
> every reply (`YYMMDD ~HHMM Opus 4.8 —`, open and close, markdown headings — Ken archives each
> prompt+response into a companion Google Doc); commit on `main`, push only when Ken says; one AI
> on the codebase at a time. "The Angel OS" (with the article).

---

## 1. Three bodies

- **Core** — `C:\Dev\angels-os`. Payload CMS 3.77 (parked off 3.85) + Next 16, Vercel. Both
  projects (angels-os + angels-os-kendev) auto-deploy `main`. Gate: `pnpm exec tsc --noEmit`
  (zero src/ errors; the ~98 test-suite failures are known stale drift), then confirm READY.
- **Merlin** — `C:\Dev\merlin`. Interactive-session Scheduled Task "Merlin" (owns :3000).
  Restart = `Stop-ScheduledTask -TaskName Merlin; Start-ScheduledTask -TaskName Merlin` (I can do
  this non-elevated). **NEW: `refresh-merlin.ps1`** = pull + refresh `../angel-brain` + build +
  restart the task, in one shot. Never `pnpm start` (collides with the task on :3000).
- **Nimue** — `C:\Dev\nimue`. Native-first Android. Build: `pnpm cap:sync` →
  `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' gradle assembleRelease` →
  `adb install -r`. Bump versionCode/versionName in android/app/build.gradle.
- **angel-brain** — `C:\Dev\angel-brain`. `file:../angel-brain` dep of Merlin. pnpm installs it as
  a hard-linked COPY, so after editing it you must rebuild it AND `pnpm install` in Merlin to
  re-sync — else `BrainResult` type drift. `refresh-merlin.ps1` now handles this.

---

## 2. What shipped this session

### Core (`main`)
- **`badfd4e` channel-aware routing** *(pushed, LIVE)* — a chat turn in a `node:{endeavor}:{nodeId}`
  channel brokers to that node's local Merlin brain instead of Core LEO. `brokerNodeChat()` +
  `parseNodeChannelSlug()`. Cures "ask local brain → Core LEO timeout."
- **`f728527` durable AI-Bus escalation sink** *(pushed, LIVE)* — every `dispatchEscalation` now
  records a durable `system` message in the AI Bus (errors/support/system-log), config-free, so
  escalations survive with zero connectors. `escalationToAiBus.ts` (routing + throttle, unit-tested
  12/12). Emits `budget_exceeded` from the leo-stream over-budget branch. Closes the
  "errors channel has ZERO writers" gap. This is the substrate the Nimue alert path polls.
- **UNPUSHED (staged on main):**
  - media auto-analyze on upload — `autoAnalyzeUpload` afterChange hook on Media so ANY upload
    (dashboard/Nimue/Merlin/provisioning) → MediaMeta → RAG, not only message attachments.
  - Media Library paging + filter — `/dashboard/media` rewritten server-paginated (limit 50) with
    `?q=&type=&page=` URL-as-state + a `MediaFilters` client bar.
  - `delegate_task` fix — idempotently ensures the `#team` channel exists before posting (was
    orphaning the task on a channel-less slug) + returns a navDirective deep-link.

### Nimue — 1.2.6 (Play) → 1.2.13 (on-device)
- **1.2.7** native Android TTS (`@capacitor-community/text-to-speech@6.1.0`, lazy-imported) — the
  WebView `speechSynthesis` is silent on-device; read-aloud/Speak now work. [[reference_nimue_build_deploy]]
- **1.2.8** `HomeReaderWidget` — reusable minimizable + fixed-scroll reader; Daily Bread is its first
  instance.
- **1.2.9** escalation-alert subscriber — `EscalationWatch` (root layout) polls the AI Bus
  errors/support feed globally every 25s → MAX-importance notification (heads-up + wakes the watch).
  Records `alert.posted` via `appendEvent` (no brain-wake; one-line flip to `dispatch()` for
  proactive-Leo).
- **1.2.10** chat compaction (Show more >600 chars) + 5-msg initial load (poll only merges
  newer/updated so the small window stays small) + language chooser (🌐, drives TTS lang).
- **1.2.11** swipeable media gallery viewer (endeavor-wide).
- **1.2.12** per-channel media view + a gallery toggle in the chat header
  (`/media?space=&channel=&name=` → `listChannelImages`).
- **1.2.13** native `MODE_IN_COMMUNICATION` for LiveKit calls — `AudioModePlugin.java` moves call
  audio onto the VoIP path (HW AEC/AGC, low latency) for the life of a call. The remaining lever
  after the rAF starvation fix.
- **Play track: 1.2.10 (versionCode 22) IN REVIEW.** 1.2.11–1.2.13 are on-device only (adb),
  pending the next store upload. AAB path: `android/app/build/outputs/bundle/release/app-release.aab`.
  ⚠️ Play re-signs with its own key — a Play-installed build can't be `-r`-updated by a local APK
  (uninstall first).

### Merlin (`main`, pushed, live on local Merlin)
- Connect probe via same-origin `/api/probe` proxy (killed the false "Could not reach" banner);
  banner now distinguishes reachable-but-unverified (HTTP status) from truly unreachable.
- Add Share discovery: offers each non-system drive ROOT + flags removable/flash media (💾).
- `refresh-merlin.ps1` (+ angel-brain refresh).

### Research / pipelines
- **Provider costs** — Anthropic Haiku $1/$5, Sonnet $3/$15, Opus $5/$25 per 1M. Gemini Flash
  ~$0.10/$0.40 (≈10× cheaper than Haiku, ~30× vs Sonnet). Current traffic runs through the **Vercel
  AI Gateway on `google/gemini-3.1-pro-preview` (Pro, not Flash)** — flipping the default to Flash
  is the biggest cost lever. NVIDIA free = non-sensitive fallback only (rate-limited, logs data).
- **Clearwater ingestion** — `scripts/ingest-clearwater-posts.mjs` unions the Viewstats DOM (375
  cards, capped by virtualization) + 246 transcript-only videos = **621 unique**, 121 publishable
  now, 500 → whisper. Full 1,363 needs the YouTube Data API (Merlin, key TBD).

---

## 3. Pending / next (Ken's priority)

- **(a) Channel applets tab strip** (Core + Nimue) — chat/media/notes/tasks as switchable applets
  (use Core's `<TabbedPanel>`); gives personal Notes/Tasks a home (the true Google-Keep model —
  `delegate_task` is team delegation, not personal notes).
- **YouTube generic channel fetch (Merlin)** — page the uploads playlist → cache in Merlin's
  Payload → feeds both the 1,363 blog-post ingestion AND a generic Nimue channel viewer. Blocked on
  the YouTube Data API key (console.cloud.google.com → enable YouTube Data API v3 → key →
  `YOUTUBE_API_KEY` in Merlin `.env.local`).
- **Gemini quota / cost** — update `GOOGLE_AI_API_KEY` (aistudio.google.com) + enable billing on the
  project to lift free-tier caps; flip the Hydra default to Gemini Flash.
- **AI Costs "route" badge** — record `gateway | direct | byok | ollama` per request so the tab shows
  where each request came from.
- **Nimue Wear** — cycle a channel's media (thin consumer of `listChannelImages`) + BigPictureStyle
  watch notifications embedding thumbnails.
- **Voice** — if 1.2.13's MODE_IN_COMMUNICATION isn't therapist-grade: add audio-focus, then an
  earpiece/speaker toggle, then eventually native LiveKit Android SDK.

## 4. Push status
- Core: `badfd4e` + `f728527` LIVE. **3 commits staged unpushed** (media auto-analyze, media paging,
  delegate_task fix) — awaiting Ken's go (prod ×2). LEO task fix needs this deploy to verify.
- Nimue: all committed on main; devices on 1.2.13; Play on 1.2.10 (in review).
- Merlin: pushed + live locally; vmc needs its own `refresh-merlin.ps1` run.

## 5. Doctrine
Every ops-curl = a missing LEO tool. Config-free for the 99%. Error stack = the repair loop.
`payload_locked_documents_rels` drift after a new collection → `GET /api/provision-ops/db-repair-locks`.
Never drive a per-frame React re-render in the Nimue WebView during a call. Verify deploy state
(green push ≠ live). `limit: 0` = unlimited in Payload; use `payload.count()` for counts.

— 260706 ~0155 Opus 4.8 —
