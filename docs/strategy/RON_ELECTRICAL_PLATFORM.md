# The Platform That Runs Itself — Ron's Electrical Business on Angel OS

*Strategy doc for Harpazo (harpazo.kendev.co) — Kenneth Courtney, 2026-06-15*

---

## 1. The Vision: A Solo Journeyman Who Competes Like a Company

Ron is a licensed journeyman electrician operating as a one-man shop. His competitive advantage is trust, craftsmanship, and responsiveness. His competitive disadvantage is everything administrative: phone tag, scheduling, invoicing, year-end taxes, chasing payments.

The "platform that runs itself" means:

- A customer finds Ron online, books a slot, and pays a deposit — without Ron picking up the phone.
- Ron gets a push notification, confirms or reschedules with one tap, and shows up to do the work.
- After the job, the customer gets an automatic receipt. Ron's ledger is updated.
- At tax time, Ron asks "how much did I make last year?" and gets a number in ten seconds.

Angel OS is 80% of the way there. This doc maps what exists, what's missing, and how LEO closes the gap.

---

## 2. The Booking Loop (Current State)

```
Customer lands on harpazo.kendev.co/book
  → sees service cards (label, price, duration, deposit)
  → picks a date (calendar, availability-rule-gated)
  → picks a time slot
  → reviews: service / date / time / price breakdown
  → signs service agreement (if set on the service)
  → pays deposit via Stripe
  → booking created (status: pending)
  → Ron gets a Gotify push notification                 ← EXISTS via LEO escalation
  → Ron confirms or reschedules in Payload admin        ← manual today
  → Job happens at customer's address
  → Ron marks job complete (status: completed)          ← manual in admin
  → Customer gets receipt                               ← NOT YET BUILT
  → Balance collected COD / Zelle                       ← NOT YET TRACKED
```

What is already wired:
- `/book` page with full slot-selection and Stripe deposit flow (`src/endpoints/booking-checkout.ts`)
- Bookings collection with full status lifecycle (`pending / confirmed / in-progress / completed / cancelled`)
- Availability collection (weekly recurrence, slot duration, buffer time, blackout dates)
- Gotify escalation on booking events (LEO `log_maintenance_note` → #system-engineering bus)
- E-signature (`AgreementForm` / `SignaturePad`) gated by `serviceAgreement` field on a service

---

## 3. Booking Confirmation Flow Ron Actually Needs

### Today (manual)
Ron gets a Gotify push. He opens the Payload admin, finds the booking, changes status to `confirmed`. That is two too many steps.

### Target (one-tap)
1. Gotify notification body: "Panel Upgrade — Jane Smith — Thu Jun 19, 10am — 4h — 25% deposit paid ($300)"
2. Notification contains deep-link: `https://harpazo.kendev.co/dashboard/appointments/{id}`
3. Dashboard appointments page shows a **Confirm** button next to pending bookings → single POST to `/api/bookings/{id}` with `{ status: 'confirmed' }`.
4. On confirm, LEO sends a Gotify/SMS to the customer: "Ron confirmed your Electrical Consultation for Thu Jun 19 at 10am. Job site: 123 Main St."

What needs to be built: confirmation button on the appointments page + outbound SMS/email on status change.

---

## 4. COD / Zelle — The Payment Reality

Ron's customers often pay cash or Zelle on completion. The booking engine today is Stripe-only for the deposit, but nothing prevents `depositPercent: 0` for services where no up-front charge is wanted (the system allows it — the Stripe path is only triggered when `depositPercent > 0` and the tenant has Stripe Connect configured).

### Proposed `paymentMethod` field on Services

```
paymentMethod: select
  card_deposit   (default — Stripe deposit now, balance at completion)
  cash_on_site   (no Stripe; booking confirmed immediately; balance COD)
  zelle          (no Stripe; booking confirmed immediately; Zelle info shown in confirmation)
  check          (no Stripe; booking confirmed immediately)
```

When `paymentMethod !== 'card_deposit'`, the checkout endpoint:
1. Skips the Stripe PaymentIntent
2. Creates the booking with `status: confirmed` directly
3. Writes `metadata.paymentKind: 'cash_on_site'` (or zelle/check)

This is the fastest path. The `depositPercent: 0` workaround works today for testing but does not record *how* the balance will be collected.

### Balance Settlement

After Ron marks a job `completed`, a LEO tool (`settle_booking_balance`) should:
1. Accept `{ bookingId, amountCollectedCents, paymentMethod: 'cash' | 'zelle' | 'check' | 'card' }`
2. Write a `CostEvents` record (the existing collection) tying the payment to the booking
3. Optionally credit Ron's Wallet (the TokenLedger Wallets collection, already shipped as of 95cb598)
4. Send Ron a receipt copy + customer receipt

This closes the loop without requiring Stripe for every transaction.

---

## 5. Year-End Reporting — What Ron Needs

### The Five Questions Ron Will Ask

| Question | Source |
|---|---|
| "How much did I make total this year?" | `bookings` where `status=completed` + `startDateTime` in range, sum `pricing.amount` |
| "Which service made me the most money?" | group by `metadata.serviceId`, sum `pricing.amount` |
| "How many jobs did I do each month?" | group by month of `startDateTime`, count |
| "What was my average ticket?" | avg `pricing.amount` where `status=completed` |
| "How many were COD vs Zelle vs card?" | group by `metadata.paymentKind` |

### SQL Queries (run via LEO `query_sql` or direct Payload `d1_query`)

```sql
-- Total revenue, current year
SELECT SUM((pricing->>'amount')::numeric) AS total_usd
FROM bookings
WHERE tenant_id = 2
  AND status = 'completed'
  AND "startDateTime" >= '2026-01-01'
  AND "startDateTime" <  '2027-01-01';

-- Revenue by service
SELECT metadata->>'serviceId' AS service,
       COUNT(*) AS job_count,
       SUM((pricing->>'amount')::numeric) AS revenue
FROM bookings
WHERE tenant_id = 2 AND status = 'completed'
GROUP BY 1
ORDER BY 3 DESC;

-- Jobs per month
SELECT DATE_TRUNC('month', "startDateTime") AS month,
       COUNT(*) AS jobs,
       SUM((pricing->>'amount')::numeric) AS revenue
FROM bookings
WHERE tenant_id = 2 AND status = 'completed'
GROUP BY 1
ORDER BY 1;

-- Payment method breakdown
SELECT metadata->>'paymentKind' AS payment_method,
       COUNT(*) AS jobs,
       SUM((pricing->>'amount')::numeric) AS revenue
FROM bookings
WHERE tenant_id = 2 AND status = 'completed'
GROUP BY 1;
```

These are the foundation for a **Revenue Summary dashboard card** in the Business Ops section of the dashboard.

---

## 6. What's Built vs What's Missing

### Already Built (ship today)

| Capability | Where |
|---|---|
| Online booking with slot selection | `/book` + `BookingPage.tsx` |
| Service catalog (all 9 electrician services ready to create) | `Services` collection |
| Deposit collection via Stripe | `src/endpoints/booking-checkout.ts` |
| Weekly availability rules with buffer time | `Availability` collection |
| Push notification on booking events | LEO escalation → Gotify |
| E-signature before deposit | `AgreementForm` / `serviceAgreement` field |
| Appointment dashboard (grouped by day) | `/dashboard/appointments` |
| Manual booking creation by owner | Payload admin `/admin/collections/bookings/create` |
| Status lifecycle (pending → confirmed → completed) | Bookings collection |

### Gaps (build next)

| Gap | Effort | Priority |
|---|---|---|
| COD / Zelle `paymentMethod` field on Services + bypass Stripe path | Medium | HIGH — Ron can't take Stripe right now |
| One-tap Confirm button on appointments dashboard | Small | HIGH |
| Outbound SMS/email on booking confirmed (to customer) | Medium | HIGH |
| Customer `notes` input on `/book` confirm step | Small | HIGH — job address, panel location, what they're experiencing |
| `location.address` entered by customer at booking time | Small | HIGH — electrician always goes to the customer |
| Auto-receipt after job complete | Medium | MEDIUM |
| `settle_booking_balance` LEO tool (record COD/Zelle payment) | Medium | MEDIUM |
| Revenue Summary dashboard card (queries above) | Medium | MEDIUM |
| Year-end export (CSV or PDF) | Small | LOW |

---

## 7. The LEO Angle: Conversational Revenue Reporting

Ron opens the chat bar and types: **"how much did I make in November?"**

LEO's `query_system` tool today can query collection metadata and explain the schema. The `query_sql` tool (LEO capability ladder rung 2, planned) will run parameterized SQL against the tenant's DB and return structured data.

With `query_sql` in place, the LEO response would be:

> "In November 2026, you completed 14 jobs on Harpazo totaling **$8,450**. Your top earner was Panel Upgrades ($3,600 across 3 jobs), followed by EV Charger Installations ($1,950 across 3 jobs). Average ticket: $603. 11 jobs were COD, 3 were Zelle."

This is the "platform that runs itself" closing the loop — not just scheduling and payments, but *business intelligence in plain English*, accessible to a tradesperson who does not want to learn SQL or buy QuickBooks.

### LEO Tool Additions Required

1. `query_booking_revenue({ tenantId, startDate, endDate, groupBy? })` — parameterized revenue roll-up (wraps the SQL above)
2. `settle_booking_balance({ bookingId, amountCents, paymentMethod })` — records the COD/Zelle settlement
3. `send_booking_receipt({ bookingId })` — generates and emails/texts a receipt
4. `confirm_booking({ bookingId })` — status transition with notification side-effect

All four follow the LEO factory principle: **build the tool first, the UI button is a wrapper**.

---

## 8. Token Economy Integration

Ron is an early Harpazo/Angel OS operator. As the network grows:

- Jobs completed generate **Karma Credits (KC)** for the customer (social proof of "someone trustworthy did work at my house").
- Ron's **Angel Token (AT) wallet** can receive a fraction of platform fee as a network-participant incentive.
- Repeat customers unlock **loyalty pricing** via quest-like "book 5 jobs, get a free inspection" mechanics (Quest collection already exists).

This is not day-one scope — but the hooks exist. `creditQuestPayout` in `src/utilities/token/creditQuestPayout.ts` can be repurposed for job-completion awards once Ron's Wallet is funded.

---

## 9. Recommended Build Order

1. **Create the 9 electrician services** in the Services collection (curl commands below, or via Payload admin).
2. **Add `notes` input to BookingPage confirm step** — one textarea, writes to `booking.metadata.customerNotes`.
3. **Add `location.address` to booking confirm step** — one text input, writes to `booking.location.address`.
4. **Add COD/Zelle `paymentMethod` to Services** + bypass Stripe path in checkout endpoint.
5. **One-tap Confirm on appointments dashboard** — button + status PATCH.
6. **Outbound SMS on confirmation** (Twilio connector already in the comms layer plan).
7. **`query_booking_revenue` LEO tool** — Ron can ask revenue questions by voice or chat.
8. **Revenue Summary widget** in Business Ops dashboard.

Steps 1–3 are zero-backend, can ship this week. Steps 4–6 are one sprint. Steps 7–8 follow the LEO capability ladder roadmap already committed.

---

## 10. Curl Commands — Create Harpazo Electrician Services

These commands create the 9 services in the Harpazo tenant (tenant_id: 2) on the kendev node.
You must be authenticated as a super_admin. Get a token first:

```bash
# Step 0: Get auth token
TOKEN=$(curl -s -X POST https://federation.kendev.co/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  | jq -r '.token')
```

```bash
# 1. Electrical Consultation / Site Visit
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "consultation",
    "label": "Electrical Consultation / Site Visit",
    "description": "On-site diagnostic visit. Ron assesses the job, identifies code issues, and provides a written estimate. Labor billed at $75/hr minimum 1 hour.",
    "bookingType": "consultation",
    "pricingModel": "hourly",
    "hourlyRateUsd": 75,
    "minimumMinutes": 60,
    "billingIncrementMinutes": 15,
    "durationMinutes": 60,
    "depositPercent": 0,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 2. Panel Upgrade (100A → 200A)
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "panel-upgrade-200a",
    "label": "Panel Upgrade (100A → 200A)",
    "description": "Full main panel replacement: 200A service entrance, new breaker panel, permit pulled, utility coordination. Price includes labor and standard materials; specialty breakers billed separately.",
    "bookingType": "service",
    "pricingModel": "fixed",
    "priceUsd": 1200,
    "durationMinutes": 240,
    "depositPercent": 25,
    "allowsExtraCosts": true,
    "enabled": true,
    "serviceAgreement": "Customer authorizes Harpazo Electric to pull required permits and perform work described in the estimate. Balance due on completion. Materials may vary from estimate by up to 10%."
  }'

# 3. Outlet / Switch Installation (per outlet)
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "outlet-switch-install",
    "label": "Outlet / Switch Installation",
    "description": "Install or replace standard 15A or 20A outlet or switch. Price per outlet/switch includes device and labor. GFCI, AFCI, or USB outlets add $20 each.",
    "bookingType": "service",
    "pricingModel": "per_unit",
    "unitLabel": "outlet/switch",
    "unitRateUsd": 150,
    "durationMinutes": 60,
    "depositPercent": 0,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 4. Ceiling Fan Installation
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "ceiling-fan-install",
    "label": "Ceiling Fan Installation",
    "description": "Install customer-supplied ceiling fan on existing box. Includes fan-rated box upgrade if needed. Attic/vaulted ceiling add $50.",
    "bookingType": "service",
    "pricingModel": "fixed",
    "priceUsd": 125,
    "durationMinutes": 90,
    "depositPercent": 0,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 5. EV Charger Installation (Level 2)
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "ev-charger-level2",
    "label": "EV Charger Installation (Level 2)",
    "description": "Install 240V/50A dedicated circuit and NEMA 14-50 outlet or hardwired EVSE in garage. Includes permit. Charger unit not included unless specified.",
    "bookingType": "service",
    "pricingModel": "fixed",
    "priceUsd": 650,
    "durationMinutes": 180,
    "depositPercent": 20,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 6. Smoke & CO Detector Package
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "smoke-co-package",
    "label": "Smoke & CO Detector Package",
    "description": "Install up to 4 hardwired interconnected smoke/CO combination detectors. Devices and labor included. Additional detectors $45 each.",
    "bookingType": "service",
    "pricingModel": "fixed",
    "priceUsd": 200,
    "durationMinutes": 120,
    "depositPercent": 0,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 7. Generator Hookup (Transfer Switch)
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "generator-transfer-switch",
    "label": "Generator Hookup (Transfer Switch)",
    "description": "Install manual transfer switch and inlet box for portable generator. Includes permit, up to 8 circuits. Automatic transfer switch (ATS) available — contact for quote.",
    "bookingType": "service",
    "pricingModel": "fixed",
    "priceUsd": 950,
    "durationMinutes": 240,
    "depositPercent": 25,
    "allowsExtraCosts": true,
    "enabled": true,
    "serviceAgreement": "Customer must supply permitted generator matching inlet specifications. Harpazo Electric is not responsible for generator operation or fuel management."
  }'

# 8. Outdoor / Landscape Lighting
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "outdoor-landscape-lighting",
    "label": "Outdoor / Landscape Lighting",
    "description": "Install low-voltage landscape lighting or line-voltage exterior fixtures. Starting at $350 for up to 4 fixtures. Larger systems quoted on site.",
    "bookingType": "consultation",
    "pricingModel": "fixed",
    "priceUsd": 350,
    "durationMinutes": 180,
    "depositPercent": 0,
    "allowsExtraCosts": true,
    "enabled": true
  }'

# 9. Whole-Home Electrical Inspection
curl -X POST https://federation.kendev.co/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -d '{
    "tenant": 2,
    "serviceId": "whole-home-inspection",
    "label": "Whole-Home Electrical Inspection",
    "description": "Comprehensive inspection of panel, wiring, outlets, GFCI/AFCI protection, grounding, and code compliance. Written report included. Ideal for home purchase or older homes.",
    "bookingType": "consultation",
    "pricingModel": "fixed",
    "priceUsd": 200,
    "durationMinutes": 120,
    "depositPercent": 0,
    "allowsExtraCosts": false,
    "enabled": true
  }'
```

---

## 11. Availability Setup (Run in Payload Admin)

After creating services, create an availability record for Ron:

- **Type**: Weekly recurring
- **Days**: Monday–Friday
- **Hours**: 07:00–17:00
- **Slot Duration**: 60 minutes
- **Buffer Time**: 30 minutes (travel between jobs)
- **Max Advance Booking**: 60 days
- **Min Advance Booking**: 24 hours (Ron needs a day's notice)
- **Service Types**: leave blank (all services use this window)

For bigger jobs (Panel Upgrade, Generator, EV Charger), set a separate weekly window with `slotDuration: 240` and restricted to Mon–Thu.

---

*This doc is a living strategy reference. Update as each gap closes.*
