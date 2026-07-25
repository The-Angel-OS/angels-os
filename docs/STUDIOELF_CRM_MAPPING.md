# StudioElf CRM (Oqtane) → Angel OS mapping & design

> 260725 — Handoff for the primary dev thread. Maps the studio-elf.net Oqtane CRM
> feature set onto what Angel OS already has, flags true gaps, and recommends what to
> build vs. what to *not* clone. Ponytail lens throughout: Angel OS already owns most
> of this via existing primitives — the win is wiring, not a 15-collection CRM fork.

## TL;DR

Angel OS is **already a CRM** — it just calls the parts different names. `Contacts` +
`Messages`/`Channels` (comm log + timeline) + `Endeavors`/`Memberships` (tenancy) +
LEO (165 tools, provider-agnostic AI) + `CostEvents`/`ApplicationLogs`/`FederationAuditLog`
(audit substrate) cover ~70% of StudioElf out of the box.

**Do not port StudioElf's collection sprawl.** It has ~15 EF entities because Oqtane gives
it nothing for free. We have the opposite problem. The genuine net-new primitives are:
**Companies, Deals/Pipeline, Tasks, ConsentLog, and a unified Timeline projection.** Everything
else is a rename, a view, or already shipped.

---

## Coverage map

| StudioElf concept | Angel OS today | Status | Note |
|---|---|---|---|
| **Contact** | `Contacts` collection | ✅ **have** | Richer than StudioElf on the funnel side: email/phone dual-anchor, `source`, `contactStatus` (lead→invited→accepted→bounced→unsub), `inviteStatus`, campaign metering (`unsubscribeToken`/`lastEmailedAt`/`emailCount`). Tenant-scoped via `multiTenantPlugin`. |
| **Company** | — (`Vendors` is adjacent) | ❌ **gap** | No org entity that contacts roll up to. `Vendors` is marketplace-seller, not CRM account. See Build #1. |
| **Organization** (parent of companies) | `Endeavors` / `Tenants` | ⚠️ **conceptual overlap** | Don't build StudioElf's Organization. The parent-of-companies role is what `Endeavor` already is. If a "holding co → subsidiaries" view is ever needed it's a `parent` self-ref on Company, not a 3rd tier. |
| **Deal / Pipeline / Stages** | — (`Orders`/`Bookings` = closed revenue only) | ❌ **gap** | No pre-sale opportunity tracking. This is the biggest real gap. See Build #2. |
| **Task / action item** | `Projects`, `Quests`, `CrewAssignments` | ⚠️ **partial** | Nothing lightweight/contact-linked. `Quests` is gamified-economic, wrong altitude. See Build #3. |
| **Communication Log** | `Messages` + `Channels` (AI Bus) + Contact call-log (Vapi `5382358`) | ✅ **have (substrate)** | Voice calls already append call metrics/transcript to the matching Contact. Email/SMS sends are metered on Contact. Needs a thin per-contact *projection*, not a new table. |
| **Activity Log** (append-only audit) | `ApplicationLogs`, `FederationAuditLog`, `CostEvents` | ⚠️ **substrate, not per-entity** | No generic "who changed what on this Contact/Deal" trail. Cheapest path: a Payload `afterChange` hook writing to one `activity-log` collection. See Build #4. |
| **Timeline** (unified feed) | AI Bus channel timeline; `leo-stream` | ⚠️ **partial** | Merge (activity + comms + tasks + deal events) per entity = a *query/projection*, not stored. Build once Deals/Tasks/ActivityLog exist. See Build #5. |
| **Tags** (Tag + TagLink m2m) | `Contacts.tags` = `text hasMany` | ⚠️ **weaker** | Free-text tags, no color/definition/reuse across entities. Fine for now (ponytail); upgrade to a `tags` collection only if cross-entity tagging is actually requested. |
| **Consent Log** (GDPR) | scattered (`Signatures`, Services consent copy) | ❌ **gap** | No per-contact consent history. Small, real for church/health verticals. See Build #6. |
| **File Attachments** (polymorphic) | `Media` + `MediaMeta` + `set_media` | ✅ **have** | Media-anywhere primitive already places media on any surface. Attaching to a Contact/Deal = a relationship field, not a new FileAttachment table. |
| **Email Templates + dispatch** | campaign sender (`sendCampaignChunk`), `sendQuickInvite` | ⚠️ **partial** | Sending is shipped (chunked, resumable, unsubscribe, idempotent). No reusable *template* records with token replacement. Add a small `email-templates` collection if the vertical needs it — otherwise LEO drafts inline. |
| **Webhooks** (subscription + delivery log + HMAC) | `Connectors`; Stripe webhooks in | ⚠️ **partial (inbound)** | We *consume* webhooks; no outbound subscription registry for external systems. YAGNI until a customer asks. Don't pre-build. |
| **AI assistance** (draft reply, tag suggest, provider-agnostic) | LEO: 165 tools, `ai-gateway.ts` provider-order, `leo-stream` SSE | ✅ **have (stronger)** | StudioElf bolts one OpenAI-compatible endpoint on. We have a full agent with a tool registry, provider failover, local Ollama tier. Draft-reply/tag-suggest = two thin LEO tools over Contacts. |
| **Scheduled jobs** (re-engagement, retention/anonymize) | pg_cron / "Dreams", `providerHealth` breaker | ⚠️ **substrate** | Cron substrate exists; the two *policies* (7-day re-engage, 365-day anonymize) aren't wired. Small cron jobs once Contact has `lastContactedAt`. See Build #7. |
| **CSV Import Wizard** | bulk import (Clerk/CSV/JSON `source`s on Contact) | ✅ **have** | Import paths exist; a stepper UI is polish, not a primitive. |
| **Duplicate detection / merge** | dedupe-on-write (email→phone in `upsertContactFromLead`) | ⚠️ **partial** | Prevents dupes at capture; no review/merge UI for existing dupes. P2 polish. |
| **Configurable reference data** (status/size options) | hardcoded `select` enums on Contact | ⚠️ **weaker** | StudioElf stores these as option tables per module. Ours are enums. Only make them data-driven if a tenant needs custom pipeline stages — otherwise config-free wins. |
| **Right to be forgotten / anonymize** | — | ❌ **gap** | Ties to ConsentLog + retention cron. See Build #6/#7. |
| **Permission enforcement / tenancy / audit fields** | `access` fns, `multiTenantPlugin`, Payload timestamps + `createdBy` | ✅ **have** | Framework parity — Payload is our Oqtane. |

---

## What to build (ranked, ponytail-scoped)

Each is a *primitive add*, not a StudioElf port. Schema-before-deploy rule applies to every
new collection/field (prod column first).

1. **`companies` collection** (P1) — the account entity. Minimal: `name, domain, industry,
   address, ownerUserId, notes, jsonData`, tenant-scoped. `Contacts.company` = relationship.
   Optional `parent` self-ref instead of a separate Organization tier. ~1 collection + 1 field
   on Contacts + migration.

2. **`deals` collection + pipeline** (P1 — biggest gap) — `title, amount, currency, stage,
   probability, expectedCloseDate, closeDate, contact, company, ownerUserId`. Stages as an
   enum first (Prospecting/Qualification/Proposal/Negotiation/Closed Won/Closed Lost), NOT a
   config table — data-drive stages only when a tenant demands custom pipelines. Add a
   `PipelineBoard` view + a weighted-value summary query. Wire to `Orders`/`Bookings` so a won
   deal can spawn the revenue row.

3. **`tasks` collection** (P1) — lightweight, contact/company-linked: `title, description,
   dueDate, priority, status, completedOn, ownerUserId, contact, company`. Distinct from
   `Quests` (economic) and `Projects` (delivery). Feeds Timeline + re-engagement cron.

4. **`activity-log` collection + generic afterChange hook** (P1) — one append-only table:
   `entityName, entityId, action, previousValue, newValue, summary, activityBy, activityOn,
   tenant`. A shared Payload `afterChange`/`afterDelete` hook on Contacts/Companies/Deals/Tasks
   writes it. This is the spine the Timeline reads.

5. **Timeline projection** (P1, after 2–4) — `GET /api/crm/timeline/{entity}/{id}` merging
   activity-log + Contact comms (Messages/call-log) + tasks + deal events into one sorted feed,
   date-range + paginated. A *query*, no stored TimelineItem table. Resolves icon/color in the
   response. `ContactTimeline` UI + a LEO tool wrapper.

6. **`consent-log` collection** (P1 for church/health verticals) — `contact, consentType,
   granted, grantedOn, revokedOn, ipAddress, tenant`. Plus an anonymize routine (replace
   name/email, clear PII, set status) writing an activity-log "Anonymized" row. Small, real
   compliance win.

7. **Two cron policies** (P2, after 3/6) — over existing cron substrate:
   - *Re-engagement*: contacts with no comm in 30d → LEO drafts / queues a follow-up.
   - *Retention*: contacts untouched 365d & not churned → anonymize (Build #6 routine).

8. **Two LEO tools** (P2) — `draft_contact_reply` and `suggest_contact_tags` over Contacts.
   Trivial once the entities exist; leverages the existing tool registry + provider failover.

## What to explicitly NOT build (YAGNI)

- **Organization tier** — `Endeavor` already is it; use a `parent` self-ref on Company if ever needed.
- **Webhook subscription registry + delivery log + HMAC** — no customer asking; we consume webhooks fine.
- **Tag/TagLink m2m + colors** — text tags hold until cross-entity tagging is a real request.
- **Configurable status/size option tables** — enums until a tenant needs custom pipeline stages.
- **FileAttachment table** — `Media`/`set_media` + a relationship field cover it.
- **A CSV import stepper** — import `source`s already exist; UI is polish.
- **A parallel AI provider layer** — LEO/`ai-gateway` is strictly more than StudioElf's single endpoint.
- **A custom email/SMTP or notification layer** — campaign sender + Payload/Twilio paths ship already.

## Build order (dependency-correct)

`companies` → `deals` + `tasks` → `activity-log` (+ hook) → Timeline projection → consent-log +
anonymize → cron policies → LEO draft/tag tools.

Net new: **5 collections** (companies, deals, tasks, activity-log, consent-log), **~4 relationship
fields**, **1 timeline endpoint**, **2 cron jobs**, **2 LEO tools** — vs. StudioElf's ~15 entities +
bespoke services. The rest is rename/view/already-shipped.

---
*260725 ~1435 — mapped against C:\Dev\angels-os collections, LEO tool registry (165 tools,
`src/utilities/leo-data-tools.ts`), and `docs/GLOBAL_PUNCH_LIST.md`. Cross-refs: People-funnel
seams (punch list P1), Guardian timeline vision, config-free-for-the-99% doctrine.*
