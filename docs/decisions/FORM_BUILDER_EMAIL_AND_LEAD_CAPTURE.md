# Form Builder: Branded Emails, AI-Bus + Gotify Escalation, Lead Capture

**Date:** 2026-06-10
**Status:** Branded email + escalation shipped (`feat/branded-form-emails`). Per-tenant / LEO-generated forms are blocked on a schema change (below).

## Why

Payload Form Builder is the substrate for **LEO-dynamically-generated lead-capture
forms** placed on campaign pages that need not appear in navigation. A submission
should: (1) confirm cleanly to the visitor, (2) email the operator with on-brand
chrome, (3) land on the AI Bus so LEO sees it, and (4) escalate to the operator's
phone. (1)–(4) are now in place except where noted.

## What shipped

- **Branded submission email.** `src/utilities/angelOsEmailLayout.ts` is the shared
  Angel OS shell (green "A" mark + "Powered by Angel OS — Everyone gets an Angel."
  footer), extracted from `sendTenantInvitationEmail.ts` so all outbound mail
  shares one look. Wired via `formBuilderPlugin.beforeEmail` in `src/plugins/index.ts`
  — every submission email is wrapped, heading = the email subject.
- **AI-Bus routing (pre-existing).** `routeFormToAIBus` (formSubmissionOverrides
  afterChange) posts a `form_submission` Message into the tenant's space for LEO.
- **Gotify escalation.** `form_submission` added to `EscalationEventType`
  (`src/utilities/escalation.ts`); `routeFormToAIBus` now calls
  `dispatchEscalation` (fail-soft, policy-gated per connector, deduped per form via
  `dedupeKey: form:<id>`). Enable per gotify connector in `config.escalation` — see
  [GOTIFY.md](../integrations/GOTIFY.md).

## Gotcha worth remembering

The Form block (`src/blocks/Form/Component.tsx`) renders `confirmationMessage`
**only on success** (`hasSubmitted`); a real error renders separately as
`"<status>: <message>"`. So a confirmation message *worded* like a validation
error ("Please ensure all fields are entered correctly") looks like a failure even
though the submit succeeded. Word confirmation messages as a thank-you.

## Blocked: per-tenant / LEO-generated forms (schema change required)

`src/utilities/ensureTenantContactForm.ts` find-or-creates a tenant's contact form
and wires a `formBlock` onto its `/contact` page — but it currently **throws**:
`The following path cannot be queried: tenant`. Cause: **`forms` is not in the
`multiTenantPlugin` collections list** (`src/payload.config.ts`), so it has no
`tenant` field. The helper is written against a schema that doesn't exist yet.

To make it work (migration-first, per the schema-field-deploy rule):

1. Add `forms` (and likely `form-submissions`) to the `multiTenantPlugin` list.
2. Migration: `ALTER TABLE forms ADD COLUMN tenant_id` **and** add the `forms_id`
   column to `payload_locked_documents_rels` (lock-drift gotcha — see
   [DESTRUCTIVE_OPERATIONS.md](../architecture/DESTRUCTIVE_OPERATIONS.md) / the
   `db-repair-locks` endpoint).
3. Land the prod column **before** deploying code — a new field without its column
   takes every tenant query down to the platform home page (site-wide outage).
4. Then `ensureTenantContactForm` runs safely and becomes the foundation for both
   per-tenant contact forms and LEO `create_lead_form(campaign)`.

Until then, the existing "Contact Us" form is **global** (no tenant) — a tenant
that needs its own form must get a duplicated global form wired onto its page.
