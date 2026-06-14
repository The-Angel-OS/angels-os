# LEO Capability Ladder — toward "query anything, remediate safely"

How to imbue LEO (the in-platform agent) with roughly the capabilities of a strong
agentic assistant (Claude Code class): query anything in the DB/collections and
**potentially remediate it** — without making that an unguarded footgun.

> **The reframe:** the gap is *not* "tools to touch the database." LEO already has a
> role-scoped Payload CRUD MCP surface (`payload-mcp-tool`) + ~127 tools. The real
> gap is: a **frontier model on the agentic path**, a **real observe→act→verify
> loop**, **verify-before-claim discipline**, and — the hard part — a **remediation
> harness** that makes "change anything" safe. The thing that makes a strong agent
> safe-ish is the *harness*, not the model.

## What LEO is missing vs. a strong agent
1. **Model tier** — reasoning is the foundation. Route LEO's admin/agentic sessions
   to an Opus-class tier via `ai-gateway`; keep a cheap model for ordinary chat. A
   weak model + write access = confidently wrong remediation.
2. **Agentic loop** — observe→plan→act→**verify**→reflect→iterate with a step budget,
   not request→a-few-tool-calls→done. (The "cortex" of the cerebellum/cortex split.)
3. **Verify-before-claim** — re-query what it just changed before reporting success.
   Current LEO over-claims (mis-tenanted post 38; claimed metadata it never set). This
   is the trust killer and is half loop-design, half model capability.
4. **Code-level remediation** — read source, patch, ship. The biggest trust surface;
   last rung.

## "Query anything" — cheap, low risk
- Generic **query-any-collection** tool (filters + aggregation) — partly via MCP.
- **Read-only SQL diagnostic** tool (SELECT-only guard; ideally a read replica) — the
  cross-collection diagnostics done via raw `pg`.
- The **message logs** are already a collection → queryable as audit AND as the memory
  that can make LEO smarter over time (Dreams / consolidation).

## "Remediate anything" — the awesome responsibility (harness, not raw power)
- **Read is cheap; write is graduated.** Mutations require role (super_admin/archangel);
  **bulk/destructive ops require dry-run/preview + explicit confirm or second-agent
  review.** Rulebook already exists: `docs/architecture/DESTRUCTIVE_OPERATIONS.md`.
- **Append-only audit of every action** — substrate exists (`ExecutionTrace`,
  `createLogger`, ApplicationLogs, message logs). Route every tool call through the
  single `executeToolCall` chokepoint into a trace.
- **Reversibility / snapshots** — pg_dump snapshot is a *precondition* LEO enforces on
  itself before any schema/data remediation. No rollback path = no remediation.
- **Scope limits** — tenant-scoped by default; cross-tenant / money / identity /
  deletion / platform actions require elevation or a governance quorum.

## Why Angel OS can do this legitimately
Constitution + federated governance + Diocese trust model = the rails most platforms
lack. High-stakes remediation routes to the governance DAO / human approval, not an
autonomous loop. Tiered trust (Diocese probation model) — LEO earns scope over time.
Autonomy leash + noise budget bound it. "Proof of Human Worth" applies to the AI too:
it acts **in the open, logged, reversible**.

## Build sequence (safe-capability first; danger last)
1. **Model tiering** — route agentic/admin LEO to Opus-class. (Big jump, cheap.)
2. **Read-anything** — generic query tool + read-only SQL diagnostic. (Safe.)
3. **Agentic loop + verify-before-claim.** (Fixes over-claiming; no new write power.)
4. **Audit + snapshot floor** — ExecutionTrace through `executeToolCall` + pg_dump
   before remediation. (Build BEFORE any unlock.)
5. **Gated remediation** — writes with dry-run/preview + role gate + reversibility;
   bulk/destructive need confirm or quorum.
6. **Code remediation** — LAST, most gated. PR-based, worktree-isolated, CI + human
   review, never direct-to-prod. ("LEO as software agent / Nimue-as-body" end state.)

Steps 1–4 are safe capability + verification hygiene. The "awesome responsibility"
lives in 5–6 and must not move until 4 (audit + snapshot + reversibility) is solid.

## First slice (building now)
Read-only **`query_system`** LEO tool (any collection, filters/aggregation, super_admin
or admin gated, hard read-only) + a verify-before-claim convention. Delivers "query
anything" with zero new destructive power.

See: [[project_proactive_agent_roadmap]], [[project_processor_pipeline_audit]],
[[project_leo_tool_fixes_260613]], DESTRUCTIVE_OPERATIONS.md.
