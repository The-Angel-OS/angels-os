# Rentals Vertical — Evaluation & Implementation Plan

> 260718 — drafted overnight (Fable) for Ken's morning ruling. **This is a plan, not shipped code.**
> Scope: the "stall / distributed-Airbnb / rent" vertical — list a unit → set availability → book/rent → collect a one-off or recurring payment. Same shape covers church-lot stalls for van-lifers, short-term rentals, small-motel rooms, and monthly property rent.

---

## 1. TL;DR / recommendation

The platform is **~70% of the way there** for *slot-style* rentals (equipment, day-use, hourly) and can ship that as a template almost immediately by cloning the market-vendor template. The genuinely new work is **lodging-style rentals** (per-night, multi-day ranges, check-in/out, unit-as-listing), which the current booking engine does **not** model — it is minute/slot-oriented within a single day.

**Recommended sequencing:**
- **Slice A (cheap, high-value):** `provisionRentalSite` + `RentalProfile` + wire `rentals` into `apply_site_template`. Reuses BookingEngine's existing `rental` bookingType, Stripe Connect deposit flow, and the block-based page template. Ships a working "list a rentable thing, take a deposit, book a slot" vertical with **zero new tables**.
- **Slice B (the real gap):** a unit-centric **`Listings`/`RentalUnits`** collection + per-night date-range availability + nightly pricing. This is what makes it "distributed Airbnb" rather than "equipment booking."
- **Slice C:** recurring rent (monthly) by bridging a listing to the existing `Memberships` + `membershipPlans` subscription primitive.
- **Slice D (optional):** parent-portal aggregation (one portal, many hosts) — depends on the market-vendor `parentEndeavor` work, still partly unbuilt.

Slice A is a night's work. Slice B is the substantive build. Recommend shipping A first to validate the vertical, then B.

---

## 2. What already exists (reuse as-is)

| Primitive | File | Reuse for rentals |
|---|---|---|
| **BookingEngine** — slot gen, conflict/overlap check, reschedule, cancel, harmonic alt-times | `src/utilities/bookingEngine.ts` | Slot-style rentals directly; conflict-check reusable for date ranges with adaptation |
| **`bookings` collection** — `bookingType` **already includes `rental`** ("Equipment Rental"), pricing+split, Stripe payment intent, status lifecycle | `src/collections/Bookings.ts` | The booking record for a rental. Ready. |
| **`availability` collection** — weekly/date-range/one-time rules, blackout exceptions | `src/collections/Availability.ts` | Provider-centric; usable for slot rentals, **not** ideal for per-unit nightly calendars (see gap) |
| **Booking checkout** — `POST /api/booking-ops/checkout`, Stripe Connect direct charge w/ application fee, or COD fallback | `src/endpoints/booking-checkout.ts` | Deposit collection for rentals. Ready. |
| **`bookableServices`** — `pricingModel: fixed/hourly/**per_unit**`, `depositPercent`, `serviceAgreement` (e-sign lease) | `src/config/bookableServices.ts` | Per-unit pricing + lease e-sign directly applicable; but code-level/single-tenant (gap) |
| **Stripe Connect split** — direct charge + application fee | `src/lib/stripe-connect-config.ts`, `angelOsStripeAdapter` | Payment rails. Ready. |
| **Memberships + membershipPlans** — recurring Stripe subscription per member/plan; explicitly cites "market booth fees" | `src/collections/Memberships/index.ts`, `src/utilities/membershipPlans.ts` | **Monthly rent** (Slice C). Ready to bridge. |
| **Template pattern** — `provisionMarketVendorSite.ts` (best copy target), church/fitness siblings | `src/utilities/provisionMarketVendorSite.ts` | Clone → `provisionRentalSite`. Zero new tables for pages. |
| **`apply_site_template` LEO tool** + `/api/provision-ops/*-template` endpoints | `src/utilities/leo-data-tools.ts:8406`, `src/endpoints/market-vendor-template.ts` | Wire `rentals` in |
| **Calendar block**, `ensurePolicyPages`, revenue-split `participants[]` | `src/blocks/Calendar/config`, Products | Listing page calendar + policies + splits |

---

## 3. Gaps (the actual work)

1. **No multi-day / per-night booking.** `generateTimeSlots` operates in minutes within a single day. Airbnb-style needs date-**range** booking (check-in → check-out), nightly rate, minimum-stay. **This is the core gap.**
2. **No unit-as-listing entity.** A "unit" today is either a Product (no time dimension) or a code-seeded `bookableService` (not admin-editable). Owners self-listing units need an admin-editable listing collection.
3. **Availability model mismatch.** `Availability` is provider-centric (weekly hours for a `users` provider), not unit-centric booked-date calendars. Lodging wants per-listing blocked date ranges.
4. **`apply_site_template` enum is `['fitness','church']` only** — market-vendor and rentals not wired in; `replicate_site` (create-new-endeavor-in-one-call) still unbuilt (spec in `docs/HANDOFF_SLICE2_REPLICATE_SITE.md`).
5. **Pricing extras** — cleaning fees, security deposit/hold, nightly-rate-with-minimum-stay not modeled.
6. **Recurring vs one-off not bridged** — both rails exist (Bookings deposit / Memberships subscription) but nothing joins a *listing* to either.

---

## 4. Implementation plan

### Slice A — Slot-style rentals template (1 night, zero new tables)
1. `src/utilities/provisionRentalSite.ts` cloned from `provisionMarketVendorSite.ts`. Define `RentalProfile` (hostName, story, `units[]` {name, description, pricingModel, ratePerUnit, depositPercent, media}, policies, contact). Stamp Home / Listings (Calendar block) / About / Policies / Contact pages from existing blocks. Idempotent by slug+tenant.
2. `src/endpoints/rental-template.ts` → `POST /api/provision-ops/rental-template` (super_admin or `?key=CRON_SECRET`), mirroring `market-vendor-template.ts`. Register in `src/payload.config.ts`.
3. Wire `'rentals'` into `apply_site_template` enum (`leo-data-tools.ts:8408`) + handler + `toolInputSchemas.ts` + `constants/toolLabels.ts`.
4. Seed a reference profile (e.g. the church-lot van-life stalls) as the `HAYS_PROFILE` analog.
5. **Exit:** LEO can stand up a rental site; a slot/day rental books + takes a deposit via existing `booking-ops/checkout`.

### Slice B — Lodging listings + per-night ranges (the substantive build)
1. New **`RentalUnits`** (a.k.a. `Listings`) collection, admin-editable, tenant-scoped: title, description, media, `nightlyRateCents`, `minNights`, `cleaningFeeCents`, `securityDepositCents`, `unitType`, address/location, `owner`→users, `endeavor`→tenants, `isActive`.
2. Per-unit availability: either a `bookedRanges[]`/`blackoutRanges[]` on the unit, or reuse `bookings` rows filtered by unit + date range. Add a **date-range conflict check** to BookingEngine (`checkDateRangeConflicts`) alongside the existing minute-slot one.
3. Extend booking checkout (or add `POST /api/rental-ops/book`) for nightly total = nights × rate + cleaning + deposit-hold, via the same Stripe Connect direct-charge + application-fee path.
4. Listing page: Calendar block showing booked ranges; check-in/check-out date picker.
5. `serviceAgreement`/e-sign reused for the lease/rental agreement.
6. **Exit:** an owner lists a unit in admin; a guest books a date range; deposit + first payment collected with platform split.

### Slice C — Recurring/monthly rent
1. Bridge a `RentalUnit` (or the profile's unit) to a `membershipPlan` (interval `month`, `amountCents`) — a "lease" is a Membership subscription on the endeavor's connected account.
2. Reuse `membership-ops/checkout`. **Exit:** monthly rent collected as a Stripe subscription; shows in member dashboard.

### Slice D — Parent-portal aggregation (optional, depends on market-vendor)
- One portal aggregating many hosts = market-vendor's parent→child endeavor model (`parentEndeavor`, Slice 3 in `MARKET_VENDOR_VERTICAL.md`, partly unbuilt). Only pursue if "distributed" means cross-host discovery. Federation discovery (`FederationDiscover.tsx`, `federation-holons.ts`) is the cross-tenant surface if needed.

---

## 5. Open questions for Ken
1. **First concrete use case** — church-lot van-life stalls (slot/nightly, cheap) vs full short-term rental (nightly, deposits, cleaning) vs monthly property rent (recurring)? This picks Slice A vs B vs C as the true first ship.
2. **Unit-as-listing** — promote `bookableServices` to an admin collection, or a dedicated `RentalUnits`/`Listings` collection? (Recommend dedicated collection — cleaner for the lodging fields.)
3. **Aggregation** — single host per endeavor, or a parent portal listing many hosts? Determines whether Slice D is in scope.

---

*Reusable-as-is: BookingEngine, Stripe Connect split, Memberships/membershipPlans, the block-based page template (`provisionMarketVendorSite` copy target), Calendar block, `ensurePolicyPages`, `serviceAgreement` e-sign, and the LEO-tool + `/api/provision-ops/*` registration pattern. The only genuinely new modeling is per-night date-range booking + unit-as-listing (Slice B).*
