# Angel OS Mission Roadmap — "A Guardian Angel for Everyone" (2026-06-13)

Synthesis of a parallel scout+plan recon (workflow `angelos-mission-recon`, 9 agents)
across four tracks. Verified against the live tree. First cohort: Ernesto Behrens,
Matthew Takahashi, Carl Brown, Lloyd Thomas Johnson (W00102), +others, +dormant Kenneth.

## Executive read
The rails to schedule, pay, advocate, and dispatch already exist as typed engines, but
money-touching write paths are under-guarded and advocacy data is being discarded.
Sequence: close live RBAC/mint holes first (free), make advocacy data lossless, build the
test harness, then carefully wire the money settlement paths last.

## ⚠️ Live findings
- **Self-approve → self-pay**: `QuestParticipations.update: authenticated` (verified L17) lets any
  logged-in user approve their own participation and mint AT. Mitigation: floats start empty
  (`creditQuestPayout` defers when underfunded). MUST fix before funding any float.
- **Paid booking never confirmed**: Stripe webhook `handlePaymentIntentSucceeded` only branches on
  `metadata.orderId`, never the `metadata.bookingId` that `booking-checkout.ts` sets → deposits never
  flip pending→confirmed.
- **Advocacy data discarded**: `handleTrackSoul` (leo-data-tools L9490) captures cohort/facility/caseNumber
  but writes none of it to the doc.
- **Dashboard drift**: `fetchUserSpaces` diverges from canonical `resolveVisibleSpaceIds`; plus a
  cross-tenant user-count leak on the main dashboard.
- `provision_tenant`/`research_and_provision` endpoint is gated; the **LEO tool path is not**.

## Do-next list (dependency-aware)
| # | Item | Track | Risk | Money/Destructive | Deps |
|---|------|-------|------|-------------------|------|
| 1 | Reviewer-identity + state-transition guard on QuestParticipations | D | med | money | — |
| 2 | Payout safety bounds in `creditQuestPayout` (cap + approved-only) | D | med | money | 1 |
| 3 | Persist soul-tracker structured fields (lossless) | B | low | no | — |
| 4 | Unify space-visibility: `fetchUserSpaces` → `resolveVisibleSpaceIds` | C | low | no | — |
| 5 | super_admin gate on `provision_tenant`/`research_and_provision` (tool layer) | B | high | money-adj | roles on ctx |
| 6 | Payment-mode resolver (live\|test\|bypass, fail-closed) | A | med | money | — |
| 7 | Bypass branch in checkout (synthetic PaymentIntent) | A | med | money | 6 |
| 8 | Close cross-tenant user-count leak | C | med | RBAC-display | 4 |
| 9 | Invite token rotation + single-use hardening | C | med | RBAC | — |
| 10 | Quest accept/submit endpoints | D | med | no | 1 |
| 11 | Wire booking confirmation to payment success | A | high | money | 6,7 |
| 12 | Reconcilable tenant-invite space auto-join | C | low | no | 4 |
| 13 | GuardianAngels (Souls) collection + migrate track_soul | B | med | no | 3 |
| 14 | `simulate_checkout` self-test endpoint + mock webhook | A | med | money(bypass) | 6,7,11 |
| 15 | Quest approve/reject endpoint + LEO dispatch tools | D | high | money | 1,2,10 |
| 16 | `find_soul_matches` read-only matching | B | low | no | 13 |
| 17 | Quest expiration cron | D | low | no | cron mech |
| 18 | LEO tool wrappers: simulate_checkout + trace_booking_pipeline | A | low | no | 14 |
| 19 | Participant quest board + my-quests UI | D | low | no | 10,15 |
| 20 | Atomic Justice Fund disbursement tool (runway-guarded) | B | high | money | 2,5,13 |
| 21 | Guarded account-cleanup endpoint (dryRun default) | C | high | destructive | audit first |

## Guardrails enforced
- Account-prune = audit-only; cleanup endpoint is LAST, built on read-only `accountAudit.ts`,
  explicit-id deletes only (never `deleteMany where:{}`), dryRun default, protected-bucket assertion.
- Trust-fund money = plan-only; disbursement tool is 2nd-to-last, runway/cap/idempotency gated.
- Test/bypass payments fail closed to 'live' in prod.
- Schema/deploy rule: add prod column / run db-repair-locks BEFORE deploy for new fields.

## Open questions (need Kenneth)
1. Feature-flag mechanism: Settings bag (Oqtane spine) vs env var? (blocks 6,14,17)
2. Stripe TEST keys provisioned in both prod envs? (blocks 6 'test' mode; else degrades to bypass)
3. Does `ToolExecutorContext` carry roles, or only userId/tenantId? (blocks 5,15)
4. Souls home: `Posts.soulTracker` stopgap vs dedicated `GuardianAngels` collection + field-level encryption?
5. Booking-confirmation timing: move notify create→paid for all entry points? balanceDue in scope?
6. Quest settlement: is AT the only live rail, or honor `paymentMethod` (stripe/platform_credit)?
7. Canonical cron registration path? (blocks 17)
8. Invite token rotation always-on vs per-tenant opt-in?
9. `find_soul_matches`: human-review-only forever, or automated outreach ever?
10. Orphan-account grace window (N days) before cleanup-eligible?

Full agent output: workflow run wf_0b2c904f-698.
