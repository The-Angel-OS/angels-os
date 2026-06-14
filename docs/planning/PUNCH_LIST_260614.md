# Angel OS — Master Punch List (2026-06-14)

Single tracking list of all open slice work so nothing is lost. Status legend:
**✅ done** · **🔄 in-flight** · **⬜ open** · **🅿️ banked** (explicitly deferred).
Detail lives in the linked memories / planning docs — this is the index.

---

## 0. In-flight right now
- ✅ **a11y `button-name` — VERIFIED FIXED** (`ce6fa39`, live). Re-ran axe against www.spacesangels.com: Home/Shop/Posts/Events/Book all show **0 violations**; the every-page critical is gone. (Root cause: footer ThemeSelector combobox had no accessible name — the first fix mislabeled the hamburger.) Only `/contact` color-contrast remains → §10.

## 1. Shipped this session (for the record)
- ✅ Constitution signed (all 8 tenants) · ✅ Human e-signature primitive (Signatures + SignaturePad + AgreementForm + sign-ops/capture) · ✅ Booking per-service rental agreement (gate deposit) · ✅ Form Builder signature field · ✅ LEO fixes (resolveWriteTenant tenant fallback for create_post "Assigned Tenant"; no "(edited)" on streamed msgs; maintenance note → #system-engineering AI bus) · ✅ Spaces Round 1a (AI Bus Catch-All channel + space-level Catch-All triage view) · ✅ axe a11y harness (`test:a11y`, report-only) · ✅ #131 election persistence (settings bag) · ✅ Federation roster dedup (self-peer shown twice) · ✅ Fee-tier card moved to AI Costs tab · ✅ Issue backlog triage (closed 12, filed #131).

## 2. Spaces Big Ask — remaining sub-slices  ([[project_spaces_bigask_260613]])
- ⬜ **1b · Per-channel AI Bus visibility** (this round's remaining half) — schema-first new `Channels.visibility` column (both DBs) + extend `buildSpaceVisibilityFilter` to hide private channels from non-admins + AI Bus space private→invite_only; mark sensitive channels (email-inbox, gotify) private, safe ones (leo/general/system-log/catch-all) tenant-visible.
- 🅿️ **2 · DM virtual roster in UI** — wire existing `/api/messages-ops/dm-roster` into the Direct Messages section (virtual DM per space member, lazy-created). Backend done; UI not wired.
- 🅿️ **3 · Street Signs brochure block** — `StreetSigns` block for Pages/Posts/Products (FeaturedEndeavors pattern) + RenderBlocks register + optional serving/impression instrumentation. (Events have no layout field — separate.)
- 🅿️ **4 · Dialer + Ctrl+K people search** — enterprise-wide cross-tenant people search + dialer, integrated into Ctrl+K + DM section. Federation P2P (gnutella/emule) deferred to a later sub-slice.

## 3. Community Dashboard — Discord/info-dense direction  ([[project_community_dashboard]])
- ⬜ **Generic widget framework** — collapsible + dismiss/restore + role-aware + per-user persisted prefs + mobile-responsive grid (widgets still hard-coded in dashboard/page.tsx).
- ⬜ **Presence / "who's online" roster widget** — wire `usePresence` into a dashboard panel (status rings, "N online"). Backend exists (Presence collection, ping/online endpoints, usePresence hook).
- ⬜ **Activity feed (Ship's Log) widget** · ⬜ page-as-channel convos · ⬜ governance-vote widget.
- ⬜ **Mobile-density pass** + responsive federation Command Center.

## 3b. LEO capability ladder — query anything / remediate safely  ([[project_leo_capability_ladder]], docs/architecture/LEO_CAPABILITY_LADDER.md)
- ✅ **Rung 2a · `query_sql` read-only diagnostics tool** — super_admin, single SELECT/WITH, runs in a READ ONLY transaction (writes physically blocked, verified) + statement timeout + row cap. Gives LEO the cross-collection investigation the tenant-scoped tools lack. LEO_TOOLS 127→128.
- ✅ **Rung 1 · Model tiering** — `complexityFloorForRoles` (super_admin → 'high' strong tier, env-tunable LEO_STEWARD_TIER_FLOOR; admin/archangel → 'medium'; else 'low'/no-lift) + pure `liftComplexity(tier, floor)` combinator. Wired at the single model-selection seam in leo-stream (streamViaGateway) + ConversationEngine: the escalation-rhythm tier is LIFTED to the operator's floor, THEN credit pressure downshifts. So a super_admin steering LEO rides the strong tier (Sonnet, → Opus on deep-think rounds) while regular users stay cost-optimized. Composes cleanly — capability rises with stakes, solvency keeps the final say. 8 tests.
- ✅ **Rung 3 · Verify-before-claim** — content creators (create_post/page/product) now re-read the persisted doc and report VERIFIED state (which tenant it landed on, status, whether SEO meta/image was actually set) via `describePersistedDoc`; + a constitutional-prompt "Honest Operation" directive (verify before claiming, never claim un-performed actions, surface tenant mismatches). Structurally fixes the post-38 over-claim class. (Full agentic observe→act→verify loop redesign still future; this nails the immediate trust gap.)
- ✅ **Rung 4 · Audit + snapshot floor** — (a) AUDIT: executeToolCall already records every call via ctx.trace; leo-stream already creates+persists the trace to Message.metadata.toolChain. Closed the gap — ConversationEngine (DM/webhook path, both gateway + Anthropic-fallback) now creates a per-turn ExecutionTrace, carries roles, and persists toolChain to the message metadata → every LEO action is now auditable on both paths. (b) SNAPSHOT: scripts/_local/pg_snapshot.mjs — one-command pg_dump -Fc of kendev/angels/both to timestamped restorable archives in _snapshots/ (the "snapshot before any schema/data change" discipline; restore via pg_restore). ⬜ remaining: wire snapshot as a programmatic PRECONDITION inside LEO remediation (rung 5) + optionally emit successful privileged tool-chains to a #system-engineering audit channel (today emit-on-failure only).
- ⬜ **Rung 5 · Gated remediation** (writes: dry-run/preview + role + reversibility; bulk/destructive → confirm/quorum) · ⬜ **Rung 6 · Code remediation** (PR-based, worktree-isolated, never direct). 5–6 must NOT move until 4 solid.

## 4. Billing reconciliation (NEW — design done, not built)  ([[project_billing_reconciliation]])
- ⬜ **Monthly reconciliation cron** per tenant → append-only reconciliation ledger entry, update refund liability, mint KC refund on graduation. (Build FIRST.)
- ⬜ **Stripe-balance reconciliation matcher** (financial integrity: Stripe txns ↔ internal ledger).
- ⬜ **KC→AT convertibility exchange** — gated by backing (float + Justice Fund) + governance rate + caps. (Build LAST; needs legal read for the cash-out leg.)
- ⬜ Write `docs/architecture/BILLING_RECONCILIATION.md` + reconciliation-ledger schema + monthly-close algo.

## 5. Token economy  ([[project_token_economy]])
- ⬜ **fund-float** (backed AT issuance — also the billing buy-in) · ⬜ per-quest tokenKind · ⬜ human wallet UI · ⬜ convertibility exchange (= billing item above).

## 5b. Church websites (gap analysis done — docs/planning/CHURCH_WEBSITE_GAP_ANALYSIS.md, [[project_church_websites]])
- ✅ **Church template (slice 1) — VERIFIED LIVE** at grace-chapel.spacesangels.com (angels, tenant 12; generic demo, NOT St Alfred's). `provisionChurchSite` stamps 9 parish pages from existing blocks (zero schema risk); `POST /provision-ops/church-template?overwrite=true`. 2-call stand-up: provision-portal → church-template. Commits 10f582f/34e81be/05d41c7.
  - ⬜ follow-up: a `ministry` endeavor type + Community Hub ministry channels (template currently pages-only); fold into provisionPortal so one call does it all.
- ⬜ Low-effort blocks the template needs: video/livestream embed (Pages), bulletins/downloads PDF list, clergy/staff roster (collection + block).
- ⬜ Recurring services/events (or a Service-Times block stopgap).
- ✅ **Designated giving — loop CLOSED end-to-end** (a82f563 + 4a63f44): (1) create-intent routes by request HOST (x-tenant-id) → a Connect-enabled parish's gift is a destination charge to ITS account (5% Justice Fund app fee). (2) Full Connect onboarding already existed (onboard endpoint + connect-callback + account.updated webhook status-sync + Payments dashboard) — closed the conversational mile: `createConnectOnboardingLink` util (shared by dashboard + LEO); `connect_stripe_account` LEO tool now mints the REAL Stripe onboarding URL ("ask LEO to connect my bank"). Reusable for EVERY endeavor that takes money. ⚠️ live end-to-end needs the platform Connect profile accepted + the endeavor finishing Stripe's hosted flow (can't test headlessly). ⬜ later: recurring/subscription gifts + a fund selector (General/Building/Outreach).
- ✅ **LEO byline "Unknown" → LEO** (a82f563) — mapMessage falls back to metadata.agentName||'LEO' for ai_agent msgs when no author row resolves (freshly provisioned tenants have no per-tenant LEO user).
- ⬜ St. Alfred's reference node stalfreds.spacesangels.com — ⚠️ CONSENT-gated (real parish; build unlisted demo, get Father Pete's blessing this week).

## 6. Rentals marketplace (tracked direction)  ([[project_rentals_marketplace]], docs/planning/RENTALS_MARKETPLACE.md)
- ⬜ Rentable-asset / inventory model · ⬜ deposit-hold + return reverse-pipeline (Stripe manual-capture + inspection quest) · ⬜ P2P supply (host onboarding, per-lister payout).

## 7. Consent / policy / first-members polish  ([[project_signature_capture]], SESSION_HANDOFF_260613 C)
- ⬜ **ensurePolicyPages** — Privacy/Terms/Cookie/Refund as tenant Pages (showInNav:false, footer-linked).
- ⬜ Mount `<AgreementForm>` on ToS acceptance + human-constitution acceptance + waivers.

## 8. Test/ops hardening (handoff D–E)
- ⬜ **Safe test DB** before Playwright admin e2e (current e2e global-setup writes to PROD) + a create-page admin test (catches the missing-`_pages_v`-column class of bug).
- ⬜ **pg_dump snapshot capability** (`_local` script + provision endpoint) + rule "snapshot before any schema-touching change" (Kenneth's ask).

## 9. Guardian Angel mission (handoff F)  ([[project_mission_tracks_260613]])
- ⬜ Provision the cohort: Ernesto Behrens, Matthew Takahashi, Carl Brown, Lloyd Thomas Johnson (W00102), + dormant Kenneth.
- ⬜ **HelpDNA (tenant 8) has NO pages** — create real Home + Contact.
- Guardrails: account-prune = audit-only; inmate-trust-fund = plan-only/compliance-gated.

## 10. Accessibility (beyond the button fix)  ([[project_spaces_bigask_260613]] axe)
- ⬜ `/contact` `color-contrast` (serious, 4 nodes) — design fix · ⬜ expand axe to dashboard/admin/mobile surfaces · ⬜ consider `AXE_STRICT` gate in CI once green · ⬜ (later, scoped) GitHub `accessibility-scanner` Action with a dedicated label so it doesn't flood the tracker.

## 11. Federation / infra debt
- ⬜ **Street Signs cross-holon sync protocol** (split out of #109; the audit-log itself shipped).
- ⬜ Prod heartbeat 500s ([[project_federation_discovery_finding]]) · ⬜ Diocese re-graining: peers/trust live on `endeavors`, should be Enterprise ([[project_federation_diocese_model]]).
- ⬜ LEO executor-level tenant resolution (deeper root cause behind the create_post bug; per-tool fallback shipped) ([[project_leo_tool_fixes_260613]]).

## 12. Known latent items (watch)  
- ⬜ Draft-mode 404 still latent for posts+pages ([[project_draft_mode_404]]) · ⬜ password login still host-only for cross-subdomain SSO ([[project_cross_subdomain_sso]]) · ⬜ LEO Dreams (cron memory consolidation) + escalation-event backlog (order/conversation/budget/failover) ([[project_proactive_agent_roadmap]]).

## 13. Issue backlog (GitHub)  ([[project_issue_triage_260613]])
- ✅ Triaged foundational #3–#114 (closed 12). ⬜ ~48 genuinely open (CRM collections, channel-widgets system, media-workflow cluster #110–#114, deploy scaffolding #21/#95/#96, PWA #101, Sentry #102, Three.js #87, …). 🅿️ Holodeck/federation epics #116–#129 (vision). #82 = master roadmap tracker.

---

**Suggested next pickups** (fast, surfaced organically): finish the a11y verify (0), then either **dashboard widget framework + presence roster** (§3) or **Spaces 1b visibility** (§2) — both were mid-stream. Billing (§4) and rentals (§6) are bigger design-led builds to schedule deliberately.
