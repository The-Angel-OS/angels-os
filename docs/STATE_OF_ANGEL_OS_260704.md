# STATE OF ANGEL OS — 260704 Handoff (Reliability marathon + deploy blocker)

> Written mid-thread because context got large. This is the bridge for a fresh thread.
> Companion docs: `docs/architecture/ERROR_NERVOUS_SYSTEM_AUDIT_260703.md` (the Fable
> four-body audit), `docs/architecture/GUARDIAN_WITNESS_AND_SELF_HEALING.md`.

---

## 🔴 #1 — THE DEPLOY IS BLOCKED (do this first)

**None of this session's Core work is live.** Production is still serving **`7d3518a`**
(pre-session, and *unpatched* — which is why uploads fail live). Three deploy attempts:
1. `e15ae93` (Batch 2) → **ERROR** — `next build` TS failure on `scripts/repro-385/*.ts`.
2. `cb66176` (upload fix) → **ERROR** — same repro-385 failure.
3. `65555b4` (removed repro-385) → **build COMPILED + TS PASSED** ✅, but **deploy FAILED**:
   > The Vercel Function `.well-known/angel-os.json` is **427.81 MB** uncompressed
   > (limit 250 MB).

So the TS build is fixed; the remaining blocker is the **`.well-known/angel-os.json`
serverless function bundle size**. It imports `@payload-config` (the whole Payload
instance). 427 MB is *data/module-graph*, not the 302 MB docs blobs (those aren't
traced — only `docs/vision/**` is, via `next.config.js` `outputFileTracingIncludes`,
and only for `/[locale]/(app)/learn/[soul]`).

**~~Why it regressed~~ SOLVED (260704, local nft measurement):** it was candidate (c).
The `/api/docs` endpoint (`src/endpoints/docs.ts:31`) does
`readdir(join(process.cwd(), 'docs'))` from inside the payload config graph, so Next's
file tracer globs **the whole checkout** into every `getPayload` function — docs,
tests/, scripts/, even gitignored files (a 55 MB `nul` shell-redirect artifact,
`tsconfig.tsbuildinfo`). Clean local build measured the function at **312.4 MB**
(Payload core itself is only ~71 MB). The Vercel 427.81 MB = ~125 MB base + the ~302 MB
of then-tracked docs blobs. Ruled out with evidence: (a) cache poisoning — a cache-free
local build still blows the cap; (b) double patched-payload — `pnpm-lock.yaml` has
exactly ONE patch hash (the local dupes are orphan dirs).

**The fix (committed):** `outputFileTracingExcludes` in `next.config.js` (docs media +
marketing/images + tests/scripts/reports/tsbuildinfo/nul) → function measures
**83.2 MB** locally. Verified: `learn/[soul]` still traces all 34 `docs/vision` files;
`/api/docs` keeps its 188 md/txt corpus. Bonus finding: the old
`outputFileTracingIncludes` key `'/[locale]/(app)/learn/[soul]'` NEVER matched (those
keys are picomatch globs — `[..]`/`(..)` are metacharacters); SoulViewer only worked on
Vercel because of the whole-repo glob. Re-keyed to `'**'` (includes are applied after
excludes; docs/vision is ~300 KB so shipping it everywhere is fine).

`VERCEL_SUPPORT_LARGE_FUNCTIONS=1` is NOT needed — keep it unset so size regressions
fail loudly. Measure locally anytime: `next build`, then sum the route's
`.nft.json` file sizes.

**Pending unpushed Core commit:** `9b575a9` (untrack the 302 MB `docs/marketing` +
`docs/images` blobs) is committed locally but **NOT pushed** (didn't want another failed
deploy). Push it *with* the `.well-known` fix / the large-functions flag.

**Vercel IDs** (angels-os = spacesangels tenants): projectId `prj_18HdwoPYXit5bEWMgSthSQ32PofF`,
teamId `team_mUAdmcHUYakY4VyhumLMHUNd`. Tools: `list_deployments`, `get_runtime_errors`,
`get_runtime_logs`, `get_deployment_build_logs`. Second project = `angels-os-kendev`
(docs-moving.kendev.co etc.).

**RULE re-learned (already in memory):** *a green push ≠ a green deploy.* Always
`list_deployments` after pushing. I failed to do this and reported "pushed" as if live.

---

## Repos & deploy state

| Repo | Pushed | State |
|---|---|---|
| **Core** (angels-os) | through `65555b4` (+ local `9b575a9` unpushed) | Deploy BLOCKED (see #1). Prod live = `7d3518a`. |
| **Merlin** | `b55ea5a` ✅ | Needs **elevated rebuild** (`sc stop Merlin` → `pnpm build` → `sc start Merlin`) to run new code. Dev server: `npx next dev -p 3007`. |
| **Nimue** | `b1ec60c` ✅ | (Android — no auto-deploy.) |
| **angel-brain** | `225b71e` ✅ | NEW repo github.com/The-Angel-OS/angel-brain (private). Git-installable into Core via `"@angel-os/brain": "github:The-Angel-OS/angel-brain#<ref>"` (has a `prepare` script; pin a commit ref for prod). |

---

## What shipped this session (by commit)

**Core:** `fa95d6c` money/auth/hook error escalation · `179899a` clone_portal +
check_node_health LEO tools + node dispatch + fixed the 3 broken escalation tools ·
`ffc5c6d` payload multipart patch · `fb8c26d` docs (incl. the 302MB blob mistake) ·
`e15ae93` Batch 2 (mount apiInterceptor + AngelErrorBoundary via ClientReliability;
harden client-error; logError flood-guard; afterError triage) · `cb66176` upload
`req.file` array-guard fix · `65555b4` remove repro-385 (build fix) · `9b575a9`
(unpushed) untrack docs blobs.

**Merlin:** `b38d001` libsql fix + untrack 3,502 log files · `e43b95c` nodeError bridge +
self-healing engine hardening · `b55ea5a` LEO-page brain disambiguation + model-in-footer
+ input-contrast fix + config-free gateway.

**Nimue:** `368958e` cortex/db/speech (prior work) · `b1ec60c` android.
**angel-brain:** `048386b` initial · `225b71e` prepare script.

---

## The error nervous system (the through-line)

**Invariant:** every error → the log → remediation. Anatomy (per the audit + Ken's
"limbic system" framing): nociception ✅ · autonomic reflex ✅ · limbic salience ⚠️
(errors channel has ZERO code subscribers) · **hippocampal memory/forgetting ❌** ·
**motor/remediation ❌** · plasticity ❌.

**Done this session (all committed, pending deploy):** money/auth escalation (Batch 1);
LEO's `escalate_issue`/`send_emergency_alert`/`document_incident` fixed (they wrote
invalid `application-logs` docs and silently failed — now route through `logError`);
apiInterceptor + AngelErrorBoundary mounted (were dead code); client-error endpoint
hardened (rate-limit + size-cap + **cross-tenant AI-Bus-injection gate**); logError
flood-guard; afterError skip-404/downgrade-4xx. Merlin: nodeError→Core bridge, engine
hardening, BOLO hardware cap, libsql. Brain: `sanitizeModelText` (strips tool-call/
reasoning leaks incl. bare `{"name":...,"arguments":...}`), `model` in BrainResult.

---

## Remaining punch list (from the 17-item audit)

- **Hippocampus (memory/forget) — RECOMMENDED NEXT:** tiered retention + consolidation
  cron on `application-logs` (keep unresolved errors, roll up + prune the rest) + feed
  the unresolved-error count into LEO's session digest (it currently skips it). Rails
  exist: Vercel `crons` in `vercel.json`, CRON_SECRET-gated endpoints. Design is in the
  260703 thread; NOT built. Ken's framing: "an organism that only remembers dies of its
  own logs." Postgres `pg_cron`/stored-proc is the durable version; a scheduled endpoint
  is the MVP.
- **Batch 3 (Merlin, needs rebuild):** `instrumentation.ts` boot + `uncaughtException`/
  `unhandledRejection` handlers + task-restart (Merlin can die dark after a restart —
  the bus loop only starts from an HTTP route); the `'warning'` level-enum fix; dead-
  camera error counter; fire-once → acked escalation.
- **Batch 4 (brain + Nimue):** angel-brain `faults[]`/`onFault` + one-line per-body
  adapters (tool faults are model-visible only); Nimue `flushFailed` wiring (the offline
  outbox is dead code — "saved to retry" is a lie) + global handlers.
- **Batch 5 (efferent — the endgame):** `notificationEscalation` rename + **`leo-wake`
  as a transport** in the existing `dispatchEscalation` registry (~80% built) → an
  errors-channel subscriber that wakes LEO to triage → the phased `repo_fix` remediation
  loop (propose-only first, deny-by-path for auth/payments/schema/the pipeline itself).

---

## Open bugs / to-verify (once the deploy is unblocked)

1. **Uploads** — fixed in code (patch + `req.file` array-normalize), unverified live.
   Chat upload on clearwater-cruisin + admin upload on docs-moving both failed on the
   OLD unpatched build. Re-test after deploy.
2. **`/dashboard/media`** on clearwater-cruisin → error-redirects to `/dashboard`.
   Pre-existing (old build). Pull runtime logs once the new build is live.
3. **apiInterceptor** now patches `window.fetch` app-wide (was dead code). Untested at
   runtime — smoke-test app-load + LEO stream first. Revert = `git revert e15ae93`.
4. **Nimue speech button** broken (works in Core). Goal: Nimue Wear conversational
   assistant that overrides Google Assistant.

---

## Deployment gotchas learned (durable)

- Green push ≠ green deploy — check `list_deployments`.
- `next build` typechecks `src/` AND `scripts/` (excludes `tests/`). Never commit
  type-erroring scripts (`repro-385` broke two deploys).
- Never commit large binary/marketing assets to the app repo (302 MB → repo + checkout
  bloat). Use blob storage.
- Vercel serverless functions cap at 250 MB uncompressed; `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`
  raises it; `VERCEL_ANALYZE_BUILD_OUTPUT=1` reports what's traced.
- Merlin: `libsql` (+ `@libsql/client`) must be in pnpm `onlyBuiltDependencies` or the
  SQLite store fails to init → every settings route 500s. Service rebuild needs elevation.
- Ollama cloud sharing = config only (local daemon proxies `:cloud` via `/v1`); Core
  `.env.local` wired (`OLLAMA_BASE_URL=http://127.0.0.1:11434/v1`, model = the flip).

---

## The roadmap (integrate → instrument → innervate)

1. **Instrument / memory** (hippocampus): retention/consolidation + digest. ← next.
2. **Innervate** (salience → motor): leo-wake transport → errors-channel subscriber →
   `repo_fix` loop.
3. **Integrate** (one brain): converge Core's LEO onto the portable `runBrain` via the
   `github:` dep (pinned ref) — now unblocked.

**Immediate next action for a fresh thread:** unblock the deploy (#1) — either set
`VERCEL_SUPPORT_LARGE_FUNCTIONS=1` to ship now, or diagnose+trim the `.well-known`
function — then verify uploads, then build the hippocampus.
