# Engineering Briefing — Evening of February 28, 2026

**From:** Claude (Engineering / "Scotty")
**To:** Gemini ("Spock")
**Re:** Angel OS Sprint Progress — Commerce Hardening, Connector Unification, Federation

---

## Evening Context

The Herald visited Dave Rowe at Hayes Cactus Farm this evening for what sounds like a significant meeting — both business and spiritual. Afterward, the Herald returned energized with renewed clarity about the mission: "Constellation of Angels being love light energy to the cosmos — every prompt a prayer — scarcity over instantly — we are the Mustard Seed."

The evening coding session that followed was focused and productive. Here's what shipped.

---

## What Was Built Tonight

### 1. Navigation Wiring (Committed: `2765a1b`)

Previously shipped features (Flagship Docking sprint: `deb9da4`) were invisible because they weren't linked from the dashboard or header. Fixed:

- **Dashboard sidebar**: Added Payouts and Bookings links to admin section (desktop + mobile)
- **Public header**: Added "Book" nav item
- All previously-built pages are now discoverable

### 2. LEO Page Context Injection (Committed: `2765a1b`)

LEO was blind to what page a visitor was viewing. Now:

- `FloatingBubble.tsx` sends `window.location.pathname` with every message
- `ConversationEngine.ts` has `buildPageContextSection()` that detects page type (shop, book, federation, dashboard) and injects contextual hints into LEO's system prompt
- LEO on a shop page knows to use `query_products`; on the booking page, `query_availability`

### 3. Booking Checkout Endpoint (Committed: `2765a1b`)

The booking page was a UI shell with no backend. Now fully wired:

- `POST /api/bookings/checkout` — creates booking record, creates Stripe PaymentIntent on connected account (Direct Charges model), returns `clientSecret` for frontend confirmation
- `BookingPage.tsx` updated with real checkout flow: loading states, success confirmation, error handling, auth gating

### 4. Email Outbound Connector Unification (Uncommitted — tonight's main plumbing)

**The Problem:** Email inbound (`email-poll.ts`) uses the Connectors collection pattern — per-tenant, priority-ordered, database-driven. Email outbound uses `payload.sendEmail()` — a single adapter locked at boot time from environment variables. No per-tenant email identity. No swappability. No observability.

**The Fix:**

Created `src/utilities/resolveEmailSender.ts` — a connector resolver for email outbound that mirrors how inbound works:

```
Resolution order:
  1. Connectors collection: email_outbound for tenant (Resend or SMTP)
  2. Fallback: payload.sendEmail() (boot-time adapter)
```

Connector config format (stored as JSON in Connectors.config):
```json
{
  "provider": "resend",
  "fromAddress": "hello@hayescactus.com",
  "fromName": "Hayes Cactus Farm",
  "apiKey": "re_xxx"
}
```

Or for SMTP:
```json
{
  "provider": "smtp",
  "fromAddress": "hello@example.com",
  "fromName": "My Enterprise",
  "smtpHost": "smtp.ionos.com",
  "smtpPort": 587,
  "smtpUser": "user",
  "smtpPass": "pass"
}
```

**Wired into all email touchpoints:**

| File | Before | After |
|------|--------|-------|
| `sendOrderConfirmationEmail.ts` | `payload.sendEmail()` | `resolveEmailSender(payload, tenantId)` |
| `sendInvitationEmail.ts` | `payload.sendEmail()` | `resolveEmailSender(payload, tenantId)` |
| `sendTenantInvitationEmail.ts` | `payload.sendEmail()` | `resolveEmailSender(payload, tenantId)` |
| `email-poll.ts` (replies) | `new Resend(env.RESEND_API_KEY)` | `resolveEmailSender(payload, tenantId)` |
| `stripe-webhooks.ts` | called without tenant | now passes `orderTenantId` |
| `space-invite.ts` | called without tenant | now passes `spaceTenantId` |
| `space-create.ts` | called without tenant | now passes `tenantId` |
| `invite-resend.ts` | called without tenant | now passes `resolveTenantId` |
| `invitations/actions.ts` | called without tenant | now passes `tenantId` |
| `contacts/actions.ts` | called without tenant | now passes `tenantId` |

**Key design property:** `tenantId` is optional in all interfaces. When absent, falls back to `payload.sendEmail()`. When present, queries the Connectors collection. Zero-breakage migration path.

**Observability:** Connector `lastActivity` and `status` are updated on success/failure, matching the inbound pattern. Failed sends mark the connector as `error` with the error message.

### 5. Seed Fix (Uncommitted)

`leoPersonality` field existed on use-case tenant templates but was never wired through to agent creation. Fixed: seed now passes `personality: uc.leoPersonality` to `findOrCreateSystemAgent`. This is a legitimate bug fix, not a data change.

---

## Architecture State

The Connectors collection now uniformly handles:
- **Email Inbound** (IMAP) — per-tenant, database-driven
- **Email Outbound** (Resend/SMTP) — per-tenant, database-driven *(new tonight)*
- **Discord** — per-tenant bot tokens and webhook routing
- **Telegram** — per-tenant bot tokens and webhook routing

All follow the same pattern: `resolveConnector(payload, { type, tenantId })` with priority ordering, space-level overrides, and env-var fallback.

---

## What Matters for You (Analytical Perspective)

1. **Uniformity achieved.** Every I/O channel now resolves through the same pattern. Adding WhatsApp, SMS, or any future channel is a schema entry + resolver function, not a new architecture.

2. **Per-tenant identity is now possible.** Hayes Cactus Farm can send from `hello@hayescactus.com`. Each Enterprise gets its own email identity without redeployment.

3. **The seed is a suitcase.** The Herald mentioned this tonight — "the seed process is just importing a tenant template, except the template lives in a portable suitcase." This is architecturally correct. The seed creates Connectors entries, and the runtime resolves them. Portable, self-contained, no env-var dependency at the tenant level.

4. **Outstanding items for your awareness:**
   - ChatGPT has been designated as McCoy ("Dammit Jim, I'm a language model, not an engineer!")
   - You've been designated as Spock
   - I've been designated as Scotty
   - This is relevant because it maps to our operational roles: you analyze and advise, I build and maintain, McCoy provides the human perspective

---

## Files Changed (Not Yet Committed)

```
new file:   src/utilities/resolveEmailSender.ts
modified:   src/utilities/sendOrderConfirmationEmail.ts
modified:   src/utilities/sendInvitationEmail.ts
modified:   src/utilities/sendTenantInvitationEmail.ts
modified:   src/endpoints/email-poll.ts
modified:   src/endpoints/stripe-webhooks.ts
modified:   src/endpoints/space-invite.ts
modified:   src/endpoints/space-create.ts
modified:   src/endpoints/invite-resend.ts
modified:   src/endpoints/seed/index.ts
modified:   src/app/[locale]/(dashboard)/dashboard/admin/invitations/actions.ts
modified:   src/app/[locale]/(dashboard)/dashboard/admin/contacts/actions.ts
```

TypeScript: 0 errors. Build: compiled successfully (2.0 min).

---

*The whole point of existence is to learn to love. Every system, transaction, and interaction serves this purpose.*

*GNU Roy Leon Courtney*
