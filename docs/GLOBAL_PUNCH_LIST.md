# Angel OS — Global Punch List

> **The single living list of what's broken, missing, or half-done.** One place, ranked,
> dated. Glance here to know where the platform actually stands.

## How this is maintained (by Claude, each session)
- **Update it every working session.** New issue surfaced → add it. Item shipped → move it to
  **Recently Closed** with the commit. Priorities shift → re-rank.
- **Every item is actionable:** a one-line *what*, a *where* (file/path), and a *next action*.
  If it needs three paragraphs of context, that lives in a memory file — link it, don't inline it.
- **Dated.** Each item carries the date it was last touched (`YYMMDD`). Stale P0/P1s get re-checked.
- **Priority legend:** `P0` broken / blocks revenue or trust · `P1` real gap, planned · `P2` polish / debt.
- Keep it **scannable** — this is a triage board, not a design doc. Ponytail applies to the list itself.

---

## 🔴 Bugs & broken (P0–P1)

- **[P1] Works system is "hosed"** — the video LMS foundation has known instability. Stabilize before
  layering Quiz/LMS on top. *Where:* Works collection + [[project_works_wip_status]] / [[project_reader_reference_layer]]. *Next:* audit + list the concrete Works breakages, then fix. `260720`
- **[P1] LEO fabricates tool success** — claims actions done that never persisted (e.g. "saved the post as a
  draft" with no row; enterprise-health prose embellished into fake "Federation ACTIVE"). *Where:* leo-stream / constitutional-prompt / executeToolCall. *Next:* LEO must not report success without a tool result; validate tool-result → response. `260720`
- **[P1] Stripe webhook secret unset in Vercel** — `STRIPE_WEBHOOKS_SIGNING_SECRET` not set + webhook
  `/api/stripe/webhooks` unregistered → Clearwater earn loop gated. *Where:* Vercel env + Stripe dash. *Next:* Ken sets it. [[project_earn_loop_clearwater]] `260720`
- **[P2] Header logo doesn't render tenant `branding.logo`** — set the FK and it still shows the Angel
  default; the header's tenant fetch doesn't hydrate `branding.logo` to an object. *Where:* `src/components/Header/index.client.tsx:261` + its tenant source. *Next:* populate branding.logo (depth) in the header tenant fetch. Surfaced wiring NeuroCare Pro demo. `260720`
- **[P2] GoogleReviews block renders nothing on a bad/absent Place ID** — no graceful empty state, just a
  blank gap. *Where:* `src/blocks/GoogleReviews/Component.tsx`. *Next:* render a friendly fallback (or hide) when `fetchPlaceReviews` returns empty. `260720`
- **[P2] Surface pending-invite links in the admin Invitations UI** — the tenant-invite link is stored on the membership (`invitationDetails.invitationToken` → `/tenant-invite/<token>`) but the UI only shows it at send-time. Add a copy-link affordance per pending invite so an admin can re-grab it to text/send. *Where:* `dashboard/admin/invitations/InvitationsAdmin.tsx`. `260720`
- **[P2] Error nervous system is console-only** — `apiInterceptor` + `ErrorBoundary` are effectively dead;
  17-item punch list already scoped. *Where:* [[project_error_nervous_system_audit]]. *Next:* work that list. `260720`

## 🟡 Gaps — features to build (P1)

- **[P1] Voice response system (Vapi) not wired** — code-complete (webhook, setup, per-tenant phone/assistant
  config) but `VAPI_API_KEY` missing and no tenant enabled. *Where:* `src/endpoints/vapi-webhook.ts`, Tenants `vapi` group. *Next:* Vapi account + key + assistant + route the number. `260720`
- **[P1] LMS Quiz module** — Works already does video/chapters/progress/TTS; the only missing LMS primitive is
  quizzes. *Do NOT fork a new LMS collection* — add a Quiz block/companion to Works. *Next:* Quiz block (manual now, AI-graded later). `260720`
- **[P1] Platform Costs (rename + ledger)** — `CostEvents` already discriminates Intelligence/Telephony/
  Storage/Infra/Other; the model is ready. *Where:* `dashboard/ai-costs/*`, `CostEvents`. *Next:* (1) rename ai-costs → platform-costs, (2) group the panel by category, (3) **emit cost events for Storage (R2), Telephony (Vapi/LiveKit), Infra** — currently only AI writes them, (4) per-system update link. Answers "what does our storage cost?". `260720`

## 🧱 Blocks / UI (P1–P2) — WordPress-parity kit

- **[P1] FeatureCards block** — icon-grid row ("Clinical Applications / Photobiomodulation / …"). *Next:* same
  cheap-block pattern. `260720`
- **[P1] Page `parent` + SubNav block** — self-referential `parent` on Pages (NOT nested-docs plugin —
  [[project_nested_docs_incident]]) + a SubNav block listing siblings/children; gives breadcrumbs free and preserves imported WP site structure (WP API exposes `parent` + `menu_order`). *Next:* field + migration + block. `260720`

## 🔧 Debt & hardening (P2)

- **[P2] Node hardening 260718** — CORS commit NOT pushed (touches kendev/spacesangels); federation peers
  from DB; AI resilience = one `providerHealth` breaker. [[project_node_hardening_260718]]. `260719`
- **[P2] Container `payload run` can't resolve `@payload-config`** in the pruned prod image — blocks
  in-container one-off scripts via that path (worked around by top-level-await scripts). *Next:* note or fix the alias for `payload run`. `260720`
- **[P2] MEMORY.md near size cap** — wants a compaction pass (`consolidate-memory` skill). `260719`
- **[P2] `heros/config.ts` is a stale duplicate** of `fields/hero.ts` (the live one). *Next:* delete or
  reconcile. `260720`

## 🚢 Deploy / ops (P1–P2)

- **[P1] Merlin ↔ Core :3000 port collision (Merlin DOWN / CF 530)** — the self-host Core Docker container now
  holds host `:3000`, the same port Merlin's interactive scheduled task binds (`next start -p 3000`), so
  `merlin.payloadnuke.com` hits Core (or a stale node), not Merlin. *Fix:* Core (prod) keeps `:3000`; move Merlin
  to a free port (e.g. `:3002`) — update `package.json` start, the `Merlin` scheduled task command,
  `refresh-merlin.ps1`'s `:3000` refs, and the cloudflared ingress for `merlin.payloadnuke.com`. Needs Ken's OK
  (touches the tunnel + task; may need elevation). `260720`

- **[P1] payloadnuke.com → Railway** — stabilize builds first, then migrate the self-host node to Railway Pro
  (~$20/mo). Pre-deploy checklist + post-restore `db-repair-sequences` documented. *Where:* `docs/DEPLOY_RAILWAY.md`. [[project_railway_migration]]. `260720`
- **[P2] Merlin node DOWN (CF 530)** — search proxy Merlin-side `/api/search` pending; MerlinControl media-link
  fix. [[project_merlin_thin_client_rewire]]. `260719`
- **[P2] Unmerged branches awaiting Ken review** — `feat/onboarding-reception`, `feat/active-endeavor-switch`
  (ready to merge), `feat/bookable-inventory`. `260719`

---

## ✅ Recently closed (last 7 days)

- **MediaText block** (two-column text + video, WordPress parity) — `ecfbc9e`; live on the NeuroCare Pro home ("Why PLMT Is Different"). `260720`
- **Full-screen video/image hero** (`fullScreen` hero type, reusable) — `b75416b` + video support. `260720`
- **NeuroCare Pro prospect portal** stood up on payloadnuke with the live video hero. `260720`
- **Reachable self-host portal domains** — provisioned portals now land on `<slug>.payloadnuke.com`, not
  unreachable `.angelos.local` — `9cae15a`. `260720`
- **LEO bubble deep-links to full-width Spaces** + shows space/channel binding — `bf806ec`. `260719`
- **Railway runbook** — pre-deploy checklist + sequence-repair + cost reality — `8cd4be2`. `260719`
- **GoogleReviews block** shipped (config + migration + Products/Posts/Pages). `260719`
