# Lead → Contact → Invitation → Campaign — collections & data flow

*The people funnel, end to end. What exists, what's wired, where the seams are. `260723`*

---

## The collections

| Collection | Role in the funnel | Key fields |
|---|---|---|
| `messages` | The **observable inbox**. Every lead lands here as a `form_submission` message on the tenant's AI Bus. | `space`, `channel`, `content`, `metadata.source` |
| `contacts` | The **CRM record**. One row per person per tenant — the harvest of every door. | `email`, `phone`, `name`, `source`, `contactStatus`, `inviteStatus`, `lastInvitedAt`, `inviteCount`, `lastEmailedAt`, `emailCount`, `unsubscribeToken`, `tags` |
| `tenant-memberships` | **Enterprise-level invite + membership.** Pending row = an outstanding invitation. | `tenant`, `role`, `status`, `invitedBy`, `invitationDetails.{invitationEmail, invitationPhone, invitationToken, invitationExpiresAt}` |
| `space-memberships` | **Space-level invite + membership** (a different, parallel system — see Seam 1). | `space`, `role`, `status`, `invitationDetails.*` |
| `crew-assignments` | **Post-membership staffing.** Department / station / rank / watch / duty status. | `tenant`, `member`, `department`, `station`, `rank`, `dutyStatus` |
| `cost-events` | Telephony + AI spend per interaction (voice calls write here). | `category`, `provider`, `costCents`, `conversationId` |

---

## The flow

```
     ┌─ VOICE  (Vapi capture_lead) ──┐
     ├─ WEB FORM (routeFormToAIBus) ─┤
     └─ CHAT   (LEO on a page) ✗ ────┘        ✗ = not wired (Gap A)
                    │
                    ▼
            deliverLead(payload, …)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  messages (AI Bus)      upsertContactFromLead
  form_submission        → contacts  [status: lead / not-invited]
  + Gotify push            dedupe: (tenant+email) → (tenant+phone)
                           fills blanks only; appends note history
                    │
                    ▼
     ── Contacts admin: /dashboard/admin/contacts ──
        │                                  │
        ▼ (Invite tab)                     ▼ (Campaign tab)
     bulkInvite()                     sendCampaignChunk()
        │                                  │
        ▼                                  ▼
  tenant-memberships                 email w/ {{name}} {{unsubscribe_url}}
  status: pending                    contacts.lastEmailedAt / emailCount++
  contacts → invited/pending         (chunked, resumable, skips
        │                             unsubscribed + bounced)
        ▼
  /tenant-invite/<token>  →  accept  →  membership active
        │                                    │
        ▼                                    ▼
  contacts → accepted              autoJoinSpaces hook →
                                   space-memberships for every
                                   tenant space EXCEPT ai-bus
                                            │
                                            ▼
                                   crew-assignments (manual)
                                   → CIC readiness, WorkUnit assignee,
                                     Endeavor CO/XO
```

**Voice tenant routing** (how a call finds the right tenant, `vapi-webhook.ts`):
1. **Dedicated number** — dialed number matches `tenant.vapi.phoneNumber` where `vapi.enabled`. *This is the scale path: add a number in Vapi, set those two tenant fields. No code.*
2. **Shared trunk** — fuzzy-match the caller's speech against tenant `branding.siteName` → `name` → `slug` → partial words.
3. **Fallback** — `DEFAULT_TENANT_SLUG`.

---

## What's actually built ✅

- **Lead → Contact** — `upsertContactFromLead` runs inside `deliverLead`, so voice *and* web forms both harvest automatically. Dedupe + note accumulation. Never clobbers existing data.
- **Contact → Invitation** — `bulkInvite()` creates `tenant-memberships` pending rows AND advances `contactStatus`/`inviteStatus`. Skips already-pending/accepted.
- **Contact → Campaign** — `sendCampaignChunk()` is chunked and resumable, mints `unsubscribeToken` lazily, stamps `lastEmailedAt`/`emailCount` (so re-runs are idempotent), and excludes unsubscribed + bounced. Templates support `{{name}}`, `{{email}}`, `{{unsubscribe_url}}`.
- **Space invite → funnel** — `createInvitation` / accept advance the Contact (`dd8675f`).
- **Voice cost + call log** — end-of-call writes `cost-events` and appends metrics/transcript/recording-URL to the matching Contact (`5382358`).

## The seams 🔧

**Seam 1 — two parallel invitation systems.** Tenant invites (`tenant-memberships` + `/tenant-invite/<token>`) and space invites (`space-memberships` + `/invite/<token>`) are separate code paths with separate tokens and separate accept routes. Both are legitimate (enterprise vs. room), but they must stay reconciled — the funnel bookkeeping was only on the space path until `dd8675f`, and is still missing on one tenant path (Gap B).

**Gap A — anonymous chat never harvests.** A visitor talking to LEO on a public page can hand over a name and email and *nothing is captured*. Voice and forms both land; chat doesn't. Same money-path, one missing call to `capture_lead` from an unauthenticated tenant-scoped session (`source: 'chat'`).

**Gap B — Quick Invite bypasses Contacts.** `sendQuickInvite` (the Invitations admin page) creates a `tenant-memberships` row but never creates or updates a `contacts` row. That's why the Invitations board (2 pending) and the Contacts board (2 leads) show disjoint people. Fix: call `upsertContactFromLead`-style upsert from `sendQuickInvite` so every invited person exists as a Contact at `invited`.

**Gap C — no invite path from Crew.** `/dashboard/admin/crew` can only assign people who are *already* members, so a new hire is a two-stop trip (Invitations → wait for accept → Crew). Fix: an invite-from-Crew affordance that sends the invite and pre-stages the department/station so they land assigned on accept.

**Gap D — phone-only contacts can't be invited.** Invites require email; a voice lead that only gave a phone number is a dead end in the Invite tab. `sendQuickInvite` *does* support a phone invite (pending membership keyed to E.164, admin texts the link), but `bulkInvite` doesn't use it. Wire the phone path into bulk invite and the voice funnel closes.

---

## Drip / sequencing (the next layer, deliberately small)

The campaign sender is a **single blast per run** today. A drip is the same primitive plus a schedule:

1. Add `campaignStep` + `campaignStartedAt` to `contacts` (or a light `campaign-enrollments` collection if more than one sequence is ever live at once).
2. A cron picks contacts whose `campaignStep`'s delay has elapsed, calls the existing `sendCampaignChunk` with that step's template, increments the step.
3. Exit conditions: replied, unsubscribed, bounced, accepted an invite.

The 6-touch/24-day cadence in the NeuroCare playbook is the first sequence to encode. **Don't build a sequencer engine** — the chunked sender + a step counter + a cron *is* the drip.
