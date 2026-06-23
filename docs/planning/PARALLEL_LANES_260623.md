# Parallel Lanes — Fan-Out Execution Guide (260623)

> A branch-per-lane plan to distribute the recent three-body work (node bus, Merlin
> Console, camera/sentinel, file bridge, lock-on, universal controls) + the bus
> hardening spine across multiple Claude Code sessions (e.g. on IONOS) safely.
>
> Prereq DONE: everything checked in + pushed — Core `3d1be2f`, Merlin `77765e7`.
> Branch from a clean `main`. Companion: docs/STATE_OF_ANGEL_OS_260623.md (§3 punch list).

## Execution model (read first)
- **One lane = one branch = one PR.** Branch name `lane/<id>-<slug>`. Open a PR per lane.
- **File ownership is the safety mechanism, not agent count.** No two CONCURRENT lanes
  may edit the same file. Ownership is listed per lane below — stay inside it.
- **Integrate the SPINE (L0) first.** Every other Core lane rebases onto `main` after L0
  merges. Merlin/Nimue lanes are independent repos — no rebase needed.
- **Per-lane gate before PR:** `npx tsc --noEmit` — only `^src/` errors block. Merlin: `npx tsc --noEmit`.
- **No big-bang merge.** Merge in dependency order: L0 → (L1,L4,M1,M2,M3,N1) → (L2,L3,N1-net).

## Laws every session must honor (do not break)
- Temporal-stamp replies `YYMMDD ~HHMM Claude —` (preface + suffix).
- Messages.content MUST be `{ text }` (required JSON field) — never a bare string (→ 500).
- Do NOT start the Merlin bus loop from `instrumentation.ts` (drags node→`fs` into the edge
  build, white-screens every page). Loop starts from node API routes (nodejs runtime).
- New Pages/collection field/block → create the prod column/table on BOTH DBs before deploy.
- The `req` rule (docs/architecture/PASS_REQ_RULE.md): in-request ops pass `req`; fire-and-forget must NOT.
- Commit on the lane branch; push when ready; PR for merge. Verify against live state — the
  bug is never where the error points.

## IONOS notes (Ken's box)
- Windows Server 2019, same Claude Code version, stable Node, Python available, 4 Xeon
  cores, fast SSD, >1Gb. Substantially faster for iteration. One Claude Code session per
  lane; each session: `git pull`, create the lane branch, work inside its file-ownership,
  `tsc` gate, push, open PR.

---

## CORE lanes (C:\Dev\angels-os)

### L0 — Bus hardening SPINE  ⭐ (serial, single-thread / focused — Ken + Claude)
**Branch:** `lane/l0-bus-spine` · **Depends:** none · **Blocks:** L2, L3
The contract everything rides. Do this carefully, not fanned out.
1. **Typed envelope SDK** — `src/lib/busEnvelope.ts`: one `postBusMessage({space,channel,kind,text,metadata,author,tenant})` that validates + builds the exact shape (content `{text}`, numeric space, slug channel, `metadata.kind`). Replace hand-built creates in `chat-send.ts` + `node-ops.ts` (chat, media, node-command) with it.
2. **Delivery guarantees** — ack-on-success + bounded retry + dead-letter, keyed on `requestId`. The node poll loop (Merlin side, coordinate via M2 or a follow-up) must NOT advance the cursor / mark processed on a failed post.
3. **Channel-grain ACL** — extend `PermissionService` (buildSpaceVisibilityFilter) to channel grain so bus read/write is enforced, not convention. Security-sensitive: a node may only read/write its own `node:<endeavor>:<nodeId>` channel + endeavor-public channels.
**Owns:** `src/lib/busEnvelope.ts` (new), `src/endpoints/chat-send.ts`, `src/endpoints/node-ops.ts`, `src/services/PermissionService.ts`. **Accept:** all producers post via the SDK; a forced bad shape is rejected before create; a failed reply post retries (not dropped); a node token cannot read another node's channel (test).

### L1 — Media Library: filter + pagination
**Branch:** `lane/l1-media-library` · **Depends:** none
`/dashboard/media` is at 64+ files. Add type filter (images/videos/docs), text filter, and paging.
**Owns:** the dashboard media page + its components only (find under `src/app/(dashboard)/.../media` + `src/components/dashboard/...media...`). **Accept:** filter by type + text; paged (e.g. 24/page); no `^src/` tsc errors; no edits outside media UI.

### L4 — Retrofit shells onto universal controls + dashboard component library (#81)
**Branch:** `lane/l4-shells-and-components` · **Depends:** none (Panel/TabbedPanel exist)
Migrate `ChannelTabs`, ChatControl slide-outs (ChannelSettingsPanel/MemberPanel), and `DashboardWidget` onto `<Panel>`/`<TabbedPanel>`; build the shared DashboardDialog/Table/StatsCards/StatusBadge (#81).
**Owns:** those specific component files (NOT node-ops/chat-send). **Accept:** each retrofit renders identically; shared components exported + used in ≥1 place; tsc green.

### L2 — Realtime/SSE for hot channels  (WAVE 2 — after L0)
**Branch:** `lane/l2-realtime-sse` · **Depends:** L0 envelope
SSE endpoint per channel + a `useChannelStream` hook; poll stays as fallback. Cuts the O(nodes×poll) load.
**Owns:** new SSE endpoint + new client hook + the poll-callers' opt-in. **Accept:** a message appears < 1s without poll; falls back to poll on SSE drop.

### L3 — Core LEO tool: drive snap/sentinel over the bus  (WAVE 2 — after L0)
**Branch:** `lane/l3-leo-snap-tool` · **Depends:** L0
A LEO tool that dispatches `snap_camera` / sentinel start-stop as a node-command (so "LEO, watch the door" works). Uses the L0 envelope.
**Owns:** the LEO tools registry file + a thin node-command dispatch helper. **Accept:** LEO can snap a bound node + toggle its sentinel; result returns to the channel.

---

## MERLIN lanes (C:\Dev\merlin) — independent repo, zero Core collision

### M1 — Screenshots tab UI + sentinel config panel
**Branch:** `lane/m1-screenshots-config` · **Depends:** none (endpoints exist:
`/api/node/submittals`, `/api/node/snap`, `/api/node/sentinel`)
A Merlin app page/tab rendering `getSubmittals()` as a gallery; a config panel for camera
device / window / interval / threshold / sentinel on-off. **Owns:** Merlin app UI (pages,
nav, components). **Accept:** gallery lists local submittals; config writes settings + start/stops the sentinel.

### M2 — Multi-source sentinel + gdigrab black-window fix
**Branch:** `lane/m2-multisource-sentinel` · **Depends:** none
Let the sentinel watch SEVERAL sources at once (array of {device|window}, each with its own
baseline). Investigate black-window capture (Phone Link/occluded) — try PrintWindow/DWM
thumbnail fallback. **Owns:** `src/lib/sentinel.ts`, `src/lib/camera.ts`, the sentinel route.
**Accept:** ≥2 sources monitored concurrently; a previously-black window captures content (or a clear unsupported-source error).

### M3 — Install-and-forget Ollama provisioner (#40)
**Branch:** `lane/m3-ollama-provisioner` · **Depends:** none
A node skill/tool that detects Ollama; if absent, downloads + configures it (config-free),
then advertises it as a provider. **Owns:** new provisioner lib + a route/skill + provider
wiring. **Accept:** on a box without Ollama, the skill installs + a local model answers.

---

## NIMUE lane (C:\Dev\nimue)

### N1 — Wrist groundwork + streaming discernibility
**Branch:** `lane/n1-wrist-streaming` · **Depends:** L0 envelope (for the talk-to-LEO path; UI can start first)
Thin subscribe-to-one-channel client path (the wrist is the minimal Nimue); fix streaming
responses being hard to discern on-device (flush/render cadence). Scaffold Wear/notification
path. **Owns:** Nimue client. **Accept:** streaming visibly streams on-device; a one-channel
minimal view talks to LEO over the bus envelope.

---

## Wave plan
- **Wave 1 (parallel):** L0 (focused), L1, L4, M1, M2, M3, N1-UI. (E read-only issue-triage optional.)
- **Wave 2 (after L0 merges):** L2, L3, N1-net.
- **Integration order:** L0 → L1/L4/M1/M2/M3 → L2/L3/N1.

## The 42 Feb issues — triage before assigning lanes
Many are shipped/superseded by recent work: #40 Ollama (→ M3), #19 anti-daemon (≈ Pony Tail),
#36 Federation Design System (≈ universal controls), #6/#4/#54 channel widgets (≈ the bus),
#81 dashboard component library (→ L4). Do a read-only triage pass (done / superseded /
active / parallelizable) and fold only the live ones into future waves. Epics (#82 roadmap,
#73 seed overhaul) stay single-thread.
