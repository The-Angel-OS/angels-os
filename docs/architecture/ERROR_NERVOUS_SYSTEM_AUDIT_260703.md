# The Error Nervous System — Four-Body Reliability Audit (260703)

> **Scope**: Core (`C:\Dev\angels-os`), Merlin (`C:\Dev\merlin`), Nimue (`C:\Dev\nimue`), angel-brain (`C:\Dev\angel-brain`).
> **Invariant under test**: *"Every error has a path to the common error log; every log entry has a path to remediation."*
> **Method**: six parallel source-level audits, all claims verified against source with file:line. Read-only; nothing was edited.
>
> **Verdict in one line**: the invariant is **half-true**. The afferent (sensory) half — error → canonical log — is a real, recursion-safe spine with large numb patches (dead client interceptor, unmounted boundaries, a brain that absorbs its own faults, a node that can die dark). The efferent (motor) half — log → remediation — **does not exist**: the log is a well-plumbed landfill with a viewing window.

---

## 1. Phase 1 — Topology map

Legend: ✅ reaches canonical log (`application-logs`) · ⚠️L local-only · ⚠️C console-only · ❌S silently swallowed · ❌U unhandled

### Core server

| Layer | Path | Class | Evidence |
|---|---|---|---|
| `logError()` spine | `application-logs` write + AI Bus `errors` msg (tenant known) + escalation (tenant + error/warning) | ✅ | `src/utilities/logError.ts:69-84` (DB), `:87-90` (bus, **not severity-gated**), `:94-105` (escalation, priority 8/5) |
| Payload REST/admin unhandled throws | config-level `afterError` chokepoint → logError | ✅ (over-escalates 4xx) | `src/utilities/payloadAfterError.ts:15-47`, wired `payload.config.ts:230-232` |
| Custom endpoint **caught-and-returned** errors | whatever the catch does — a swallow **defeats the afterError net** | mixed; ~100 of ~140 endpoint files have zero logError | sweep counts below |
| Dashboard **server actions** (13 `actions.ts` files) | Next.js server actions — afterError does NOT cover them; 0 of 13 use logError | ⚠️C/❌S | e.g. `admin/invitations/actions.ts:149-151` (empty catch on invite email) |
| Cron jobs (vercel.json) | per-cron top catches, console/logger-only | ⚠️C | `federation-heartbeat-cron.ts:404-413` |
| Webhooks (Stripe/LiveKit/Vapi) | top-level catch escalates, but **inner handlers self-catch console-only** | ⚠️C on all money paths | `stripe-webhooks.ts:311-314, 220-222, 261-263, 292-295, 552-558, 459-461`; sig-fail unlogged `:63-68` |
| Fire-and-forget after response (Vercel) | lambda may freeze before promise settles | ❌U (probable silent loss) | `dashboard/layout.tsx:251,259`; `autoAnalyzeMedia.ts:49` (`setImmediate`) |
| Unhandled server rejection | no `instrumentation.ts`, no `onRequestError` | ❌U → Vercel logs only | grep: none exists |
| LEO tool chain | `executeToolCall` chokepoint escalates per tool; failed traces render to logError | ✅ | `leo-data-tools.ts:3740`; `leo-stream.ts:1833-1841` |

### Core client

| Layer | Path | Class | Evidence |
|---|---|---|---|
| `logClientError()` → `POST /api/log-ops/client-error` → logError | works where explicitly called (~8 sites) | ✅ | `logClientError.ts:25-44`; `client-error.ts:18-65` (auth-required `:20`; **no rate limit / size cap / space-membership check**) |
| `apiInterceptor.ts` (fetch failures, dedup, poll-skip) | **DEAD CODE — never imported anywhere in src/** | ❌S (entire layer) | only reference: comment in `SystemMonitorService.ts:7`; self-init at `apiInterceptor.ts:109-111` never runs |
| `AngelErrorBoundary` | **NEVER MOUNTED** | ❌S | grep: only its own file |
| Real render-error coverage | `PanelErrorBoundary` (one consumer: MerlinControl) + `(dashboard)/error.tsx` | ✅ partial | `Panel.tsx:217-231`; `(dashboard)/error.tsx:28-38` |
| `(app)/error.tsx`, `global-error.tsx` | console-only ("will report to Sentry" — no Sentry exists) | ⚠️C | `(app)/error.tsx:14`, `global-error.tsx:19` |
| window.onerror / onunhandledrejection | none exist | ❌U | grep: zero |

### Merlin (⚠️ entire hardening layer is **uncommitted**; running service may predate the bridge until `scripts\merlin.ps1 rebuild`)

| Layer | Path | Class | Evidence |
|---|---|---|---|
| `logNodeError()` → local `appendLog` + deduped POST to Core client-error (node JWT) | works, fail-soft, non-recursive | ✅ | `src/lib/nodeError.ts:31-59, 72-75`; dedup 1/source/60s `:18-19,37-38` |
| Bridge coverage | **only 5 subsystems**: witness ticks/stop, react reflex failures, BOLO, sentinel emit, events-WS | ✅ narrow | `witness-engine.ts:106,131,138`; `react-engine.ts:72-78`; `bolo-engine.ts:62,94`; `sentinel.ts:111`; `events-server.ts:43,62` |
| `appendLog` | verified never rejects; own failure → console → **/dev/null** (task launch redirects nothing) | ⚠️C→∅ | `store.ts:66-97, 92-96`; `scripts/merlin.ps1:30-34` |
| `type:'warning'` local logs | **fail Payload-select validation → silently lost** (`ActivityLog` options omit `warning`) | ❌S bug | `store.ts:46` vs `collections/ActivityLog.ts:23-32`; hits `bolo-engine.ts:74-78`, `react-engine.ts:245-249` |
| Node-bus poll/heartbeat failures | local activity-log only; fixed cadence, no backoff, no escalate-after-N | ⚠️L | `node-bus.ts:244,250,293-295,310,414,417` |
| Engine boot (witness/react/events imports) | `.catch(() => {})` | ❌S | `node-bus.ts:393-397` |
| **Boot itself** | `startNodeBusLoop()` only called from HTTP routes — after restart, node is dark until a human loads a page | ❌U critical | callers: `api/node/register/route.ts:11,45`, `api/node/stream/route.ts:9`; no instrumentation.ts |
| **Process level** | zero `uncaughtException`/`unhandledRejection` handlers; `schtasks ONLOGON` has no restart-on-failure → one throw (e.g. `writeFileSync` at `node-bus.ts:319`) kills the node until next logon | ❌U critical | grep: zero matches; `install-merlin.ps1:39` |
| Sentinel camera failure | `if (!snap.ok) return null` — never logged, never counts as eye error, eye stays "active" | ❌S | `sentinel.ts:68-69` vs `witness-engine.ts:117-125` |
| system-health witness eyes | **dead code, imported nowhere** → ollama-down / high-mem / high-cpu reflexes can never fire; sentinel doesn't auto-resume | ❌S | grep `witness-eyes`: no matches; reflexes `react-engine.ts:84-139` |
| Quick-tunnel death | exit handler resets state, zero logging | ❌S | `tunnel.ts:127-132` |
| Offline errors | **no outbound queue**; dedup charged *before* POST, `res.ok` never checked → Core blip = dropped **and** suppressed 60s; `flushFailed` never called in Merlin | ❌S | `nodeError.ts:37-39,45-55`; grep flushFailed: zero |
| Core-side staleness | `online` computed only at read time; **no cron alerts on a dark node** | ❌S | `node-ops.ts:259,306`; `nodeHealth.ts:17` |

### Nimue

| Layer | Path | Class | Evidence |
|---|---|---|---|
| `logClientError()` → Core client-error (JWT via apiFetch) | **bridge exists** — but only 6 call sites on 3 surfaces (LEO page, voice, dictation) | ✅ narrow | `src/lib/log.ts:54-84`; sites `app/leo/page.tsx:127,192`, `VoiceBar.tsx:65`, `speech.ts:114,150,164` |
| Offline | POST throws → error lost forever (console only); **`flushFailed()` outbox is dead code — never called**; toast says "saved to retry" but **no retry mechanism exists** | ❌S | `log.ts:81-83`; grep flushFailed: comment only; `ToastHost.tsx:30` |
| Global handlers / boundaries | none — no window.onerror, no onunhandledrejection, no error.tsx, no native crash handler | ❌U | `app/layout.tsx:29-38`; MainActivity.java; no Crashlytics/Sentry |
| Chat page sinks | poll tick, history load, loadOlder, attach, askLeo — empty catches (drifted from LEO-page twin which logs) | ❌S | `chat/page.tsx:192,218-220,241,265-268,316-318` |
| Auth | login failures **structurally can't report** (endpoint 401s anon); **no JWT refresh** — expiry silently degrades all reads to stale cache | ❌S | `login/page.tsx:56,70`; `auth.ts`; `payload-client.ts:172-190` |
| Storage | SQLite open failure → silent permanent downgrade to Preferences; corrupt event-log JSON silently resets the "durable" outbox to `[]` | ❌S | `db/client.ts:88-91`; `angel-brain/loop.ts:96-108` |
| Cortex brain-wake failure | `console.log` only, deliberately | ⚠️C | `cortex.ts:158-164` |

### angel-brain (consumed by Merlin + Nimue; Core does not link it — `index.ts:4-7`)

| Failure mode | Class | Evidence |
|---|---|---|
| Tool throws/rejects/unknown | ⚠️ **surfaced-to-model-only** — `{error}` tool_result; `BrainResult` has no faults field, no hook; no body mines the transcript | `brain.ts:100-104, 35-43` |
| Provider 429/timeout/5xx | ❌U **crashes the run** — `callModel` unwrapped, no retry, transcript lost | `brain.ts:90`; `providers.ts:230,280,335,185` |
| Empty model text (incl. unchecked Gemini safety block) | ❌S — success-shaped `'(no text response)'`; **the twin of Core's leo/stream empty-200 bug** | `brain.ts:112`; `providers.ts:281-285` |
| Tool returns `undefined`/circular | ❌U — `JSON.stringify` TypeError on *next* call | `providers.ts:213,317,175` |
| MAX_STEPS=6 hit | ❌S — silent truncation, no flag | `brain.ts:45,88` |
| EventLoop reflex/cortex throws | ❌S — bare `catch {}` | `loop.ts:84-88,144-166` |
| MessageLog submit failure | ✅-shape — recorded on the row, retryable via `flushFailed` (**but no body calls it**) | `messageLog.ts:174-181,188` |
| Consumer call sites | Merlin: `leoAgent.ts:26-44` no catch; `leo/route.ts:53-58` 500-only; `skill/route.ts:104-108` local-only; `node-bus.ts:216-224` bus chat text. Nimue: `cortex.ts:158-164` console. **None call the canonical bridge that exists.** | cited |

**Sweep coverage numbers (Core)**: 151 empty catches / 97 files; 174 console-first catches / 91 files; 1,488 catch tokens / 428 files; 75 `logError` + ~60 `logCaughtError` sites; **100 of ~140 endpoint files have no logError at all**; 0 of 13 dashboard action files.

---

## 2. Phase 2 — Prioritized gap inventory

### CRITICAL (money / auth / node-death / broken self-report)

| # | Where | Scenario | Fix |
|---|---|---|---|
| C1 | `stripe-webhooks.ts:311-314, 220-222, 261-263, 292-295, 552-558, 459-461` | Customer paid → order not marked / inventory not decremented / membership not synced / Justice-Fund 5% not recorded / refund not reflected / charges-enabled stale — all `console.error` only; the escalating top catch (`:146-161`) never fires because inner handlers self-catch | `logError` in each inner catch with tenantId |
| C2 | `donation-create-intent.ts:122-124` | Empty catch on tenant lookup → DB hiccup silently routes donor's money to the **platform account** instead of the endeavor's connected account | `logError` (warning) inside catch, keep fallback |
| C3 | `auth-google.ts:489-493`, `auth-github.ts:493-497`, `auth-discord.ts:492-496` | OAuth outage → every social login fails with bare 500, nothing logged, afterError net defeated | `logCaughtError('auth-*/callback', err)` before return |
| C4 | `apiInterceptor.ts:109-111` (imported nowhere) | The entire client fetch-failure escalation layer has never run | one import in a root client provider; add skip-5xx-from-`/api/` to avoid double-logging with afterError |
| C5 | Merlin: no `instrumentation.ts`; `startNodeBusLoop` callers = HTTP routes only | Service restart → heartbeat/poll/witness/react dark until a human loads a page | add `src/instrumentation.ts` → `register()` → `startNodeBusLoop()` |
| C6 | Merlin: zero `process.on` handlers; `install-merlin.ps1:39` no restart | One unhandled rejection (e.g. `node-bus.ts:319` writeFileSync) exits the process; node dark until next logon | process handlers → logNodeError + continue; task restart config or launch loop |
| C7 | `leo-data-tools.ts:12812-12820, 12879-12887, 12912-12921` | LEO's `escalate_issue` / `send_emergency_alert` / `document_incident` write **invalid** application-logs docs (`level:'warn'`, nonexistent `context`/`tenant` fields, missing required `source`) → fail validation, swallowed. LEO's own escalation tools have never worked | fix field mapping to the real schema |

### HIGH

| # | Where | Scenario | Fix |
|---|---|---|---|
| H1 | angel-brain `brain.ts:35-43,90,112` + all consumer call sites | Brain faults invisible to every log on every body; provider faults kill runs; empty-response success-shaped | add `faults[]` + `onFault` (§4 slice 2); retry callModel once on 429/5xx/timeout; `degraded` flag on empty |
| H2 | Merlin `nodeError.ts:37-55` + no queue | Core blip → escalation dropped AND suppressed 60s; offline errors never delivered | charge dedup only on 2xx; route through MessageLog outbox; call `flushFailed` from heartbeat |
| H3 | Nimue `log.ts:81-83`, dead `flushFailed`, no global handlers | Offline device loses errors; uncaught JS dies in logcat; "saved to retry" toast is a lie | route logClientError through MessageLog (`client.error` signal type + submitter branch); call `flushFailed` on resume/online/poll-success; ~30-line global-handler module + `error.tsx`/`global-error.tsx` |
| H4 | 13 dashboard `actions.ts` files (0 logError) | Invitation email fails silently (`admin/invitations/actions.ts:149-151` empty catch), wizard progress lost, team ops fail → toast-only | shared `withActionLogging` wrapper |
| H5 | `node-ops.ts` — 12 handlers logger-only; `:100` catch → `return 1` scopes node registry to tenant 1 on transient DB error; `:139-142` bus-identity failure invisible | node fleet faults invisible; wrong-tenant settings writes | logger → logError; propagate null instead of `return 1` |
| H6 | `dashboard/layout.tsx:122-161, 251, 259` + `autoActivatePendingMembership.ts:65-127` (5 empty catches) | PG exhaustion → sidebar/tenants silently vanish (not even console); membership activation fire-and-forget on Vercel → invited user stuck `pending` forever | log rejected allSettled entries; await or `waitUntil` the fire-and-forgets; logError in outer catch |
| H7 | `autoAnalyzeMedia.ts:49, 65-74` | Inventory-from-photos (the killer app) runs via `setImmediate` post-response on Vercel → may never run; failures console.warn | `waitUntil` or job; logError |
| H8 | `stripe-webhooks.ts:63-68` | Rotated signing secret → ALL payment events rejected, log stays green | logError (warning) on sig-fail |
| H9 | `client-error.ts` | No rate limit, no size cap, **no space-membership check** — any authenticated user can flood application-logs or inject attacker-controlled system messages into any tenant's AI Bus errors channel | `applyRateLimit` + cap details length + verify membership on spaceId |
| H10 | `logError.ts` (no DB dedup) + no retention | Flapping per-request error = unbounded rows into shared 100-conn IONOS PG (~1.2M/day at 10/s); pushes capped only per-lambda (real ceiling 10×N/min) | fingerprint hash (source+message) + count/lastSeen upsert within window; retention cron |
| H11 | Merlin `sentinel.ts:68-69`; dead `witness-eyes/*`; `store.ts:46` vs `ActivityLog.ts:23-32` | Dead camera silent forever; health reflexes can never fire; every `'warning'` local log lost | treat `!snap.ok` as eye error; wire `enableSystemHealthEye()` + conditional `startSentinel()` into boot; add `'warning'` to select (schema push) |
| H12 | `decommissionTenant.ts:71-162`; `clonePortal.ts` (12 warn-only catches) | Destructive op half-fails; signal lives only in a return value the caller may ignore → half-dead tenant, domain still routes | on execute-mode with errored steps → logError summary |
| H13 | Core: no node-staleness cron | A dead Merlin vanishes until someone asks LEO | 5-min cron: heartbeat stale >10 min → logError(warning, deduped) |
| H14 | Mount story: `AngelErrorBoundary` unmounted; `(app)/error.tsx:14` + `global-error.tsx:19` console-only | Public-site render crashes invisible | mount boundary at app root or make error.tsx files POST client-error |

### MEDIUM (abbreviated — full detail in agent transcripts)

`recordCostEvent.ts:92-95` fully-silent empty catch on all cost accounting (table drift = documented failure class) · `runWorkflows.ts:32-35`, `moderateMessage.ts:88-90` (log WITHOUT tenantId — recursion-safe convention), `Messages/index.ts:275-277` broadcast · auto-join hooks (`autoJoinTenantSpaces.ts:100-110`, `autoJoinSpaces.ts:80-92`, `autoCreateOwnerMembership.ts:127-142`) → "empty dashboard" class · `federation-heartbeat-cron.ts:404-413` · `useChat.ts:247,423,458,735,758,1028,1062` + `MessageList.tsx:742-761` edit-PATCH silent · `order-route.ts:124-126` (500 with zero logging) · `vapi-webhook.ts` / `vercel-spend-webhook.ts:97-103` · `AddToCart.tsx:44-49` `.then` no `.catch` · `SpaceSettingsClient.tsx:262,290,642` literal "// Silently fail" on access-control saves · `SystemMonitorService.ts:22-28` exports a console-only function **named `logError`** (footgun; rename) · Nimue JWT-expiry invisibility + pre-auth error quarantine tier · Nimue/Merlin native+client crash files · Merlin ActivityLog prune (promised at `ActivityLog.ts:6`, doesn't exist) · client-error endpoint drops `statusCode`/`userAgent` (`client-error.ts:29-34`) · ApplicationLogs access drift (`clearResolvedLogs` lets ADMIN_ROLES bulk-delete via overrideAccess vs collection super_admin-only delete).

### OVER-ESCALATION (skepticism the other way)

| Where | Problem | Fix |
|---|---|---|
| `payloadAfterError.ts:15-47` | Every thrown Payload error logs at level `error` — including 404 bot probes and 400 admin typos → landfill noise + Gotify pushes | map `status < 500` → warning; skip/info 404s |
| `ConversationEngine.ts:113, 274, 310, 407` | Key-not-set warning per engine init (key-less is a *supported* config per config-free doctrine); "constitutional concerns" per message; gateway-fallback per turn | once-per-process flag; metadata not logError; per-source dedupe window |
| apiInterceptor revival | 5xx would double-log (server afterError + client) | interceptor skips 5xx from `/api/`; escalates network errors + 4xx only |
| Correctly restrained — keep | `presence-ping.ts:68-73`, `ai-bus-poll.ts:160-163`, ai-gateway provider probes, auth-token-relay expected 401s | none |

---

## 3. Phase 3 — Triage verdict: LANDFILL (with a viewing window)

Every producer edge works; **nothing autonomous ever consumes an error and acts**. The loop closes only through a human's eyeballs.

The produced-but-never-consumed edges:

1. **`errors` channel: zero code subscribers.** Only writer = `emitToAiBus` (`logError.ts:179-199`). `ensureSystemSpace.ts:20` literally says *"LEO monitors this channel"* — no code does. LEO is invoked only by user HTTP (`leo-stream.ts`, `chat-send.ts`). `runWorkflows` bails without attachments (`runWorkflows.ts:16-17`) so no workflow ever fires on an error message.
2. **`resolved` is written exactly once, by a human click** (`toggleLogResolved`, `error-logs/actions.ts:114-133` ← `ErrorLogViewer.tsx:90`). No LEO tool can resolve a log (grep: zero).
3. **LEO can see errors — pull-only, admin-gated, big-models-only.** `query_application_logs` (`leo-data-tools.ts:3545/15347`), `run_subsafe_check` (`:3592/15522`), `connector_health_summary`, `check_node_health` — all in ADMIN_ONLY_TOOLS (`leoToolSelection.ts:32,37`) and absent from `CORE_TOOL_NAMES` (`:82-95`), so an Ollama-routed LEO cannot see errors at all.
4. **The one proactive injection into LEO — the session health digest (`constitutional-prompt.ts:371-418`) — skips error counts entirely.**
5. **Gotify pushes are dead ends**: no `extras` click-through URL to the log entry (supported by `gotifyNotify.ts:25-27` but never populated); dispatch results `{matched,sent,suppressed,failed}` discarded by every caller; no ack tracking. The `gotify-poll` cron mirrors *inbound* Gotify to a bus channel that also has no subscriber.
6. **No cron looks at logs** (vercel.json crons: email, federation, gotify-poll, connector-health, youtube, onboarding). No processor registry exists in Core (only ExecutionTrace made it over from Bisk-CRM — `executionTrace.ts:4,50`). No Dreams cron, no groundskeeper. `SystemMonitorService.ts` is 28 lines of console-only dev-console helpers, explicitly "NOT the canonical error pipeline" (`:5-9`).
7. **No ownership field anywhere**; **no retention** — unresolved logs are immortal (only manual `clearResolvedLogs`).
8. **A failed remediation-capable agent becomes another landfill entry**: `emitToolChainTrace` (`leo-stream.ts:1833-1841`) renders failed LEO tool chains into logError, closing no loop.

`GUARDIAN_WITNESS_AND_SELF_HEALING.md:74-75` is honest about this: errors reach the log "where it can **one day** be recognized and remedied." Recognition = human dashboard or pull-only LEO tools; remediation = absent. Merlin has real local reflexes (single-eye restart, `react-engine.ts:144-159`); Core has zero equivalent.

**The missing piece is one edge**: a subscriber that turns an error into a LEO wake. Every rail it would ride already exists.

---

## 4. Phase 4 — The remediation loop: design + red team

### 4.0 First: generalize `gotifyEscalation` → `notificationEscalation` (the addendum)

The generalization is **~80% done**: `dispatchEscalation` (`gotifyEscalation.ts:164-236`) is already medium-agnostic, fanning out to every enabled per-tenant connector through a transport registry (gotify/telegram/webhook — `connectorTransports.ts:103-109`), with per-connector DB policy (`config.escalation`: enable, rateLimitPerMin, cooldownSeconds, per-event minPriority). `dispatchToGotify` is a deprecated alias (`:239-243`).

Remaining work, in order:

1. **Rename** `gotifyEscalation.ts` → `notificationEscalation.ts`; migrate the 7 alias import sites (`logError.ts:97`, `notifyUserRegistered.ts:35`, `routeFormToAIBus.ts:3`, `leo-data-tools.ts:79`; direct users already on `dispatchEscalation`: `moderateMessage.ts:26`, `account-deletion-request.ts:30`, `report-message.ts:20`). Keep a deprecated re-export one release.
2. **Add the key transport: `leo-wake`.** This is the elegant move (Answer 53): *awakening LEO is just another escalation engine in the same registry.* A `leo-wake` transport's `send()` enqueues a brain-processing run (see 4.1) instead of pushing to a phone. Per-tenant policy then uniformly governs "page a human," "post to Telegram," and "wake the AI" — multiple simultaneous channels per Endeavor, exactly as requested.
3. **De-Gotify the semantics**: `EscalationMessage.priority` is documented as "0–10 Gotify scale" (`gotifyEscalation.ts:66`) — redefine as neutral severity; each transport maps it. Add `extras.clickUrl` convention (dashboard deep link to the log entry) at the `EscalationMessage` level and populate it from `logError`.
4. **Config-free defaults handed down**: today a fresh tenant escalates nothing until someone hand-writes connector JSON — a doctrine violation. Hang default policy on **SettingService** (`src/services/SettingService.ts`, already used by node-ops `node-ops.ts:16,146-154`): tenant-scoped `{entityName:'escalation', entityId:tenantId}` bag, zero schema change. Core hands down: errors → leo-wake always on; error-level → operator push if any push connector exists.
5. **Durable rate/cooldown state** (the file's own TODO at `:14-16`): move the in-memory maps to the same Setting bag (or a small KV) so N warm lambdas share one budget.
6. **Persist dispatch results** instead of discarding them — the beginning of ack tracking.
7. Scope the `GOTIFY_SERVER_URL` env fallback (`connectorTransports.ts:48-52`) to the platform tenant only.

### 4.1 The loop, built from existing primitives

```
error → logError → application-logs (+fingerprint/count)
                 → notificationEscalation ─→ leo-wake transport
                                           → human channels (clickUrl deep link)
leo-wake → Incident (grouped by fingerprint) → LEO brain run with diagnostic belt
   read-only belt: query_application_logs, run_subsafe_check, connector_health_summary,
                   check_node_health, get_deployment/runtime-logs (Vercel MCP)
   → diagnosis posted as THREAD REPLY on the errors-channel message  ("the conversation is the wire and the log")
   → verdict: transient (resolve) | known-class (propose fix) | unknown (page human, cite evidence)
propose fix → node-ops dispatch (node-ops.ts:743-800, tunnel-first + bus fallback, requestId correlation)
            → Merlin `repo_fix` skill: clone/checkout → branch → edit → tsc --noEmit + affected vitest
            → push BRANCH + open PR (never main) → Vercel preview deploy = canary
verify → CI green + preview READY + repro probe against preview passes
close → merge (human, later auto for allowlisted classes) → soak window: fingerprint absent N hours → resolved=true
        fingerprint recurs → REOPEN + freeze autonomy for that fingerprint + page human
```

New pieces required (everything else exists): the `leo-wake` transport + a headless brain-run entry point (LEO minus HTTP — extract from `leo-stream.ts`'s engine); an incident grouping (reuse application-logs + fingerprint/count/status fields — no new collection needed initially); a `resolve_application_log` LEO tool; a Merlin `repo_fix` skill registered next to the existing `list_media/snap_camera/chat` skills (`node-ops.ts:738`).

### 4.2 Red team

**Blast radius.** Autonomy is PR-only for as long as possible: branch protection on main; the loop's GitHub identity is a fine-grained App with contents+PR scope on named repos only, no admin, no secrets, no Actions-write. A bad merge's revert path = `git revert` + Vercel instant rollback (both already standard practice here); the loop must record the deployed-SHA it acted from so revert is mechanical. Hard cap: K autonomous PRs/day, one open autonomous PR per fingerprint.

**Gates.** Deny-by-path, not allow-by-confidence: the loop may never touch `src/access/**`, `src/collections/**` field definitions (schema — the #1 durable-rule hazard here: schema-before-deploy), `src/endpoints/auth-*`, `stripe*`, payments/orders endpoints, `payload.config.ts`, migrations, or **any file in the error pipeline itself** (`logError.ts`, `notificationEscalation.ts`, `client-error.ts`, `nodeError.ts`, the wake processor) — the loop must be structurally unable to fix its own monitoring into a blind spot. Eligible classes start tiny: dead-link/copy fixes, stale fixture updates, missing null-guards proven by a failing repro test, config drift with an exact known-good value. Everything else is propose-only forever until a human widens the list (a Setting, auditable).

**Verification.** An incident may not close on "the fix deployed" — only on *absence of the fingerprint* over a soak window (the fingerprint/count field makes this a cheap query), plus `tsc --noEmit` + affected unit tests before push (green-push ≠ live is already a durable rule; the loop must also confirm Vercel state=READY, and knows `git log deployed..HEAD` semantics — it must refuse to merge if unrelated un-pushed commits would ride along).

**Loop stability (oscillation, storms, self-blinding).** Every autonomous commit carries its incident fingerprint in the commit trailer. If any *new* error's diagnosis blames a commit carrying a fingerprint trailer → automatic freeze of that fingerprint chain + human page (breaks fix→error→fix cycles at depth 1). Rate limits: one brain-wake per fingerprint per cooldown (reuse the escalation cooldown machinery — same code path, by design); global daily PR cap; wake processor itself runs under ExecutionTrace and logs through the standard pipeline **without tenantId** (the `setTenantFromSpace.ts:53-61` recursion-guard convention — codify it as `logError({internal: true})` rather than fragile convention). Storm damper: if unresolved-error inflow exceeds a threshold, the wake transport degrades to digest mode (one summary wake per window) instead of per-error wakes.

**Trust & provenance.** Signed commits as the bot identity; every action = an ExecutionTrace + a thread reply on the errors-channel message (the bus is the audit trail — consistent with NODE_BUS_COMMS' "conversation is the wire and the log"); kill switch = one Setting checked before every wake AND before every dispatch AND in the Merlin skill itself (three independent checks, any one stops the loop); GitHub App token revocation is the out-of-band kill.

**Multi-body without poisoning.** Merlin/Nimue faults already arrive as authenticated node/user identities through the same client-error door — good. But per the node trust model (anon=quarantined): a node-reported error may **only** trigger autonomy scoped to that node (restart eye, rebuild service, re-provision tool) — never a Core code change; node-reported content is data, never instructions (the wake prompt must frame log text as untrusted quotation — an attacker who can inject an errors-channel message via H9 must not be able to steer the fixer; fixing H9's membership check is therefore a **prerequisite** to any autonomy). Nimue errors are triage-only input (no Nimue-triggered writes) until the outbox+global handlers land, since its signal is currently too lossy to act on.

### 4.3 Phased rollout

- **Phase 0 (prereqs)**: C1-C7 + H9 + H10 + afterError downgrade — you cannot triage a landfill, and you cannot let untrusted input steer a fixer.
- **Phase A — recognize (read-only)**: notificationEscalation rename + clickUrl; `leo-wake` transport in digest-capable mode; wake → diagnostic brain run → thread-reply diagnosis; `resolve_application_log` tool; error counts added to the session health digest; node-staleness cron. *LEO now sees, reasons, and closes transient incidents. Zero write access.*
- **Phase B — propose**: Merlin `repo_fix` skill (worktree, branch, PR, preview link posted to the thread); human merges. Fingerprint-soak auto-resolve after merge.
- **Phase C — constrained autonomy**: auto-merge for the tiny allowlist, all red-team gates live, kill switch tested in anger first.

**Minimum viable first slice (lands independently, ~a day):** a Messages afterChange hook — `channel === 'errors' && messageType === 'system'` → debounced per-fingerprint → run the LEO engine headless with the four existing diagnostic tools → post diagnosis as a thread reply + Gotify push with clickUrl. Plus the `resolve_application_log` tool. This alone converts the landfill into a triaged queue.

---

## 5. Ranked punch list (each independently landable)

| # | Change | Size | Why first |
|---|---|---|---|
| 1 | logError in the 6 stripe-webhooks inner catches + sig-fail (C1, H8) | S | money, silent today |
| 2 | logError in 3 OAuth callback catches (C3) + donation-create-intent catch (C2) | S | auth + money |
| 3 | Fix LEO's 3 broken escalation tools' field mapping (C7) | S | LEO's own voice is broken |
| 4 | Merlin: `instrumentation.ts` boot + process handlers + task restart (C5, C6) — then **commit + rebuild the service** (whole hardening layer is uncommitted) | M | node currently dies dark |
| 5 | Mount apiInterceptor (1 import) with skip-5xx-from-/api/ rule (C4) | S | entire client layer off |
| 6 | afterError: `<500`→warning, 404→skip (over-escalation) | S | keeps the log triageable — prerequisite for LEO |
| 7 | client-error endpoint: rate limit + size cap + space-membership check (H9) | S | security prerequisite for autonomy |
| 8 | logError fingerprint dedup (hash, count, lastSeen) + retention cron (H10) | M | flood-proofs the shared PG; enables soak-verification |
| 9 | angel-brain `faults[]` + `onFault` (+ callModel retry, degraded flag) + 1-line adapters: Merlin→logNodeError, Nimue→logSignal (H1) | M | un-numbs the brain on all bodies |
| 10 | Nimue: wire `flushFailed` (resume/online/poll) + route logClientError through MessageLog + global-handler module (H3) | M | offline errors stop vanishing; fixes the "saved to retry" lie |
| 11 | Merlin: dedup-on-2xx + MessageLog-backed error outbox; sentinel `!snap.ok`→eye error; wire system-health eyes; ActivityLog `'warning'` option + prune (H2, H11) | M | closes the node's biggest numb patches |
| 12 | `withActionLogging` wrapper across 13 dashboard actions files (H4) + node-ops logger→logError (H5) | M | two whole silent layers |
| 13 | Rename → `notificationEscalation.ts` + clickUrl extras + persist dispatch results + SettingService default policy (addendum) | M | the abstraction the loop hangs off |
| 14 | **`leo-wake` transport + errors-channel wake processor + `resolve_application_log` tool** (Phase A slice) | M | closes the loop at "recognized" |
| 15 | Node-staleness cron on Core (H13); error counts in the session health digest | S | dead nodes stop vanishing; LEO sees errors proactively |
| 16 | dashboard layout allSettled logging + await/waitUntil fire-and-forgets + autoActivatePendingMembership catches (H6); autoAnalyzeMedia via waitUntil (H7); decommission/clone summary logError (H12) | M | data-loss class |
| 17 | Phase B: Merlin `repo_fix` skill (branch+PR only) | L | "remedied," safely |

**Not verified / caveats**: runtime behavior was not exercised (static audit); the Merlin findings describe the **working tree**, not the running service (uncommitted layer); line numbers for uncommitted/modified files will drift on commit; `dist` vs `src` parity in angel-brain was spot-checked (`dist/index.js:245,255`) not diffed exhaustively; counts (151/174/1488) are grep-based and include a handful of false positives in scripture JSON.
