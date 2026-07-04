# Guardian Witness Node & Self-Healing Error Escalation

> Status: **built + verified (uncommitted), 2026-07-02.** Core escalation is type-clean;
> Merlin engine work is tsc-green with 53 engine tests passing. Merlin needs an elevated
> service rebuild + restart to go live. See the punch list at the end.

This documents three things that came together in the "Three-Body" sessions:

1. **One Mind, Three Bodies** — the shared-brain architecture (Core / Merlin / Nimue).
2. **Merlin as a Guardian Witness node** — the perception system (Witness Engine, React
   Engine, Guardian Conduct / BOLO vision, Events server).
3. **The self-healing slice** — making *anything that can raise an error* reach a single
   system error log where it can be recognized and remedied, on both Core and Merlin.

---

## 1. One Mind, Three Bodies

| Body | Role | Form factor |
|------|------|-------------|
| **Core** (`C:\Dev\angels-os`) | Enterprise hub — aggregates nodes, surfaces to the federation, owns the canonical system error log | Payload CMS + Next.js on Vercel |
| **Merlin** (`C:\Dev\merlin`) | Headless compute/witness node — file share, GPU, cameras, system monitoring | Next.js as a Windows service (nssm, LocalSystem, :3000) |
| **Nimue** (`C:\Dev\nimue`) | Primary interface / tricorder — phone, camera, GPS, voice | Capacitor / Android |

All three share **one portable brain** (`leoBrain.ts` — pure `runBrain`, a neutral message
format and tool shape that is the *sacred contract*). Each body injects its own tool belt.
Merlin binds to an endeavor on Core via `/api/node-ops/register`, which returns a bus
channel, space, and a minted node token (payload-token cookie) the node uses to talk back.

Design doctrines this rests on:

- **Config-free intelligence** — the only setup is *connection* (lock onto an endeavor).
  Intelligence is Ollama directly or the connected Endeavor, nothing else.
- **The Endeavor is the intelligence backbone** — nodes surf its intelligence *and* share
  theirs back outbound; the node-bus is the first segment of a compute/intelligence mesh.
- **Witness first, tool execution second** — "Batman's 1000 eyes." A node's first job is to
  perceive and report; acting is secondary and constrained by the Constitution.

---

## 2. Merlin as a Guardian Witness node

Perception is decoupled into two engines plus a vision governor, all booted from
`startNodeBusLoop()` in `src/lib/node-bus.ts`.

### Witness Engine (`src/lib/witness-engine.ts`)
A generalized perception loop. **Eyes** (camera, file-watch, system-health, …) are
registered with a **producer** per type; each eye ticks on its own interval and emits
**Signals** through a dedup'd pipeline that (1) triages + graduates worthy signals to Core
via `messageLog.ts`, (2) feeds the React Engine, and (3) pushes to local WebSocket
subscribers. State lives on `globalThis.__witnessEngine` so it survives hot reloads.

### React Engine (`src/lib/react-engine.ts`)
The autonomic reflex layer — perception and response are separate concerns. Reflexes match
signal patterns, are cooldown-gated (no storming), and fire fire-and-forget actions. Built-in
reflexes: high memory / high CPU / Ollama-down incidents, single-eye auto-restart, file-arrival
logging, and the BOLO reflexes (critical/high → `createIncident`, medium → warning).

### Guardian Conduct + BOLO vision (`src/lib/guardian-conduct.ts`, `src/lib/bolo-engine.ts`)
The ethical framework (Yin/Yang Rules of Conduct + the abridged Constitution) is injected as
the **vision model's system prompt**, not hard-coded — so every BOLO analysis is auditable and
carries a `yinYangBalance` field. `bolo-engine.ts` sends motion frames to a local Ollama vision
model (llava/bakllava/moondream), and `validateAnalysis()` coerces + **clamps** the model's
JSON (confidence 0..1, non-negative integer counts, string-only flag arrays).

### Events server (`src/lib/events-server.ts`)
A standalone `ws` server (port `EVENTS_WS_PORT`, default 3002) that bridges WebSocket clients
to the Witness Engine subscriber registry for real-time signal push (e.g. to a local Nimue).

---

## 3. The self-healing slice — every error reaches one log

**Goal:** anything that can raise an error has a path to a single system error log where it
can one day be recognized and remedied. Silent failure is the enemy.

### The canonical pipeline (Core)
```
logError({ source, message, details, statusCode?, tenantId?, userId?, level? })
  ├─ 1. application-logs collection   (admin triage dashboard; has a `resolved` flag)
  ├─ 2. AI Bus `errors` channel       (LEO + agents see it in real time; needs tenantId)
  └─ 3. Gotify                        (push escalation; errors/warnings only, rate-limited)
```
- `src/utilities/logError.ts` — the server-side entry point.
- `src/utilities/logClientError.ts` → `POST /api/log-ops/client-error` — the client→server
  bridge (`src/endpoints/client-error.ts`, requires an authenticated user; resolves the tenant
  from `spaceId`).
- `src/collections/ApplicationLogs.ts` — the store, with a `resolved` checkbox for triage.

**Rule of the road:** *user actions* → escalate; *high-frequency polls* → console only (don't
spam the bus). `apiInterceptor.ts` enforces this with a poll-skip list, per-source dedup, and a
guard against recursing on its own `/api/log-ops/client-error` POST.

Escalation now covers the endpoints/hooks/boundaries that matter — payments (booking,
donation, membership, order-*, stripe-webhooks, stripe-connect-onboard), auth
(auth-system-token, auth-token-relay), cost ledger (cost-storage-probe, livekit-webhook),
onboarding (invite-resend, space-invite, provision-portal, beneficiary-claim), chat/LEO, the
tenant-resolution hooks, and the React error boundary.

### The Merlin → Core bridge (`src/lib/nodeError.ts`)  ← the crux
Before this, every Merlin engine error ended at `appendLog({ type: 'error' })`, which writes
**only** to Merlin's local SQLite `activity-log` — invisible to Core. When the machinery that
*detects* threats broke, no one upstream could see it.

`logNodeError(source, message, details?)` fixes that: it records locally **and** escalates to
Core's *same* canonical log —

```
logNodeError(...)
  ├─ appendLog({ type:'error' })                         (local detail trail; never rejects)
  └─ POST Core /api/log-ops/client-error                 (as the node system-user, cookie auth)
        └─ Core resolves tenant from spaceId → logError → application-logs + AI Bus + Gotify
```

- Deduped per-source (60s) so a flapping engine can't flood Core.
- Fail-soft: unbound node (no token) stays local-only; the POST never throws or blocks.
- Kept deliberately dependency-light (imports only `store`) to avoid the
  `witness-engine → node-bus → node-catalog → witness-engine` import cycle.

Every engine catch block now routes through it: witness ticks (`witness/eye/<id>`), react
reflexes (`react/reflex/<name>`), BOLO vision (`bolo/vision`), sentinel (`sentinel/bolo`),
events-server bind failures.

### Robustness fixes that landed alongside
- `appendLog` (store.ts) can no longer become a lost unhandled rejection.
- Witness dedup map (`recentSignals`) is pruned (was an unbounded leak) and moved onto
  `globalThis` with `producers` (a hot-reload previously re-init'd them empty and silently
  orphaned every eye).
- `startEye` clears any prior interval; the 5-consecutive-error shutdown calls `stopEye`
  (was leaving a zombie interval firing forever) and emits an `eye_error` signal.
- The `eye-error-restart` reflex now restarts the **single** failed eye (cooldown-bounded),
  not the whole engine.
- Events server idempotency is liveness-checked; bind failures flip `running:false`, free the
  port slot, and escalate.

---

## 4. Hardware safety — will it kill enthusiast hardware?

The perception loops are deliberately light, with one risk that mattered and is now fixed.

| Loop | Cost | Cadence | Verdict |
|------|------|---------|---------|
| Camera capture (ffmpeg dshow) | 1 process/tick/source | 5s | fine (bounded by #sources) |
| Frame fingerprint (`sharp` → 64×64 gray) | trivial | 5s | fine |
| System-health poll | trivial | interval | fine |
| Heartbeat / bus poll | network | 2m / 8s | fine |
| **BOLO vision (llava/moondream)** | **pegs a CPU core 30–60s** | **per motion event** | **was the risk** |

**The risk:** BOLO fired on *every* motion event with no concurrency cap. A busy scene (motion
every 5s tick) with slow CPU inference (30–60s each) would stack inferences until the box OOMs
or thermal-throttles — exactly the "kill enthusiast hardware" failure.

**The fix** (`sentinel.ts`): a node-wide concurrency cap `BOLO_MAX_CONCURRENT` (**default 1** —
at most one vision inference at a time). At capacity, a frame's BOLO is *skipped* (motion is
still recorded; vision is best-effort). A GPU node can raise the cap via env.

**Remaining knobs to consider:** a per-eye min-interval on vision regardless of motion; a
watchdog/timeout on ffmpeg capture; a ceiling on the number of registered eyes/sources.

---

## 5. Punch list / what's next

- **Deploy Merlin**: elevated `sc stop Merlin` → `pnpm build` → `sc start Merlin`.
- **Commit** both repos (Core escalation + Merlin engine work are uncommitted).
- **Self-update + installer** (design in discussion): supervisor + signed GitHub-release
  artifacts, health-gated rollback, channels, Core kill-switch; Inno Setup installer bundling
  a pinned Node + optional Ollama/cloudflared, code-signed.
- **Deepen tests**: the 53 engine tests are green but shallow — none yet assert that an error
  *escalates*. Add tick-level + escalation-assertion coverage.
- **AI gateway is open by default** (decided): keep the prompt-size cap + model allowlist as
  abuse-resistance, no auth wall.
