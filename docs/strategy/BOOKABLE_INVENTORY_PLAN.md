# Bookable Inventory / Reservations — Vertical Plan

> 260718 (Fable, with Ken) — supersedes the earlier RENTALS_VERTICAL_PLAN. **Plan, not shipped code.**
>
> Reframe from the discussion: this is **one bookable-inventory engine with three modes and two payment rails**, not a "rentals" one-off. The church-lot van-life stall idea is dropped. The point is a horizontal primitive the platform can morph into almost any reservation web use case.

---

## 1. The thesis

Everything below is the same primitive:

> **a unit** (room / hall / site / property) × **an availability calendar** × **a reservation** (a slot or a date range) × **a payment** (deposit, one-off, or recurring)

The verticals differ in only three axes:

| Axis | Facilities | Stays | Rent |
|---|---|---|---|
| **Unit taxonomy** | hall, gym, classroom, meeting room, coworking desk | motel room, cabin, campsite, RV pad, slip | apartment, unit, storage bay, seasonal site |
| **Time granularity** | hourly / per-day | per-night, multi-day range, min-stay | monthly / recurring |
| **Payment rail** | card (deposit or full) | card (deposit + balance) | **ACH** (recurring) |

One engine. The vertical templates are just skins that seed taxonomy + pages + copy — the same "one engine, many templates" doctrine already running for church/gym/markets.

---

## 2. Three modes, by build cost (the recommended sequence)

### Mode 1 — Facilities (hourly / per-day) · SHIPPABLE ON EXISTING ENGINE · **lead here**
Halls, gyms, classrooms, meeting/coworking rooms, event venues. **`generateTimeSlots` already does hourly, single-day slots today** — this mode needs no new booking model. Drops straight into the **church vertical** (~80% done): a provisioned church gains "Book our fellowship hall / gym / classrooms." Generalizes instantly to community centers, VFW halls, coworking, event spaces.
- **Wedge:** every small church and community org has a bookable room and no software for it. Config-light, fits the 99% doctrine.
- **Payment:** card deposit or full — the existing `booking-ops/checkout` Stripe Connect flow works as-is.

### Mode 2 — Stays (nightly, multi-day) · THE SUBSTANTIVE BUILD
Small motels, B&Bs, cabins, vacation rentals, **campgrounds / RV parks**, marinas (slips). Needs the genuinely new work: **unit-as-listing + per-night date-range booking** (check-in → check-out, nightly rate, min-stay, cleaning fee).
- **Wedge:** campgrounds/RV parks are the strong one — incumbents (Campspot, RoverPass, Aspira) are expensive and hostile to small operators; motels/Airbnb are a crowded bloodbath. A **site-map picker** ("tap site 42") reuses the geospatial/timeline primitive.
- **Payment:** card deposit + balance.

### Mode 3 — Rent (recurring) · NEEDS ACH ENABLEMENT
Long-term leases (the landlady use case), storage/RV/boat storage bays, seasonal campsites. Recurring — rides the existing **Memberships + Stripe subscription** rails, NOT the booking-deposit rail.
- **Blocker:** must be **ACH**, not card (see §4). ACH is the one net-new payment dependency.

---

## 3. Data model

Two granularities of "parent aggregation" — keep them distinct (both already have a live analog on payloadnuke):

- **Listings under one endeavor** — halls, campsites, motel rooms, storage bays, rental units. **Rows the operator owns, NOT separate tenants.** A church with 3 halls; a campground with 80 sites; the landlady with 4 units. → new **`Listings`** collection.
- **Sub-endeavors under an umbrella** — independent operators, each its own tenant/portal. Live proof: **`dunedin-fresh-market.payloadnuke.com`** with its vendors encapsulated within (the market-vendor `parentEndeavor` model). → existing pattern, not part of this build.

The reservation engine cares about the first. The marketplace/discovery layer cares about the second. Don't conflate.

**New `Listings` collection (tenant-scoped, admin-editable):**
`title`, `description`, `media[]`, `owner`→users, `endeavor`→tenants, `isActive`, `mode` (facility | stay | rent), `unitType` (free-ish, template-seeded taxonomy), `capacity`, plus:
- **rate model:** `rateCents` + `rateUnit` (hour | day | night | month), `minUnits` (min-stay / min-hours), optional `cleaningFeeCents`, `depositCents`/`depositPercent`, `securityDepositCents`.
- **attributes bag** (`attributes` json) for mode-specific extras without schema churn: campsite hookups (30/50-amp, water, sewer, full), pad type, max rig length, pull-through/back-in, pet-friendly; room amenities; hall AV/capacity.
- **availability:** for facilities, reuse the provider/`Availability` weekly-hours model; for stays, per-listing **booked date ranges** (a `reservations` query or blackout ranges on the listing).

Reuse for the reservation record: the existing **`bookings`** collection (`rental` is already a `bookingType`; add `facility`/`stay`/`lease` as needed) + BookingEngine conflict-check. Add a **date-range conflict check** to BookingEngine (the existing one is minute-slot within a day).

---

## 4. Payments — card for bookings, ACH for rent (the make-or-break)

**Card will kill a rent model.** Standard Stripe card = **2.9% + $0.30**.

| | Card (2.9% + 30¢) | **ACH (0.8%, cap $5)** |
|---|---|---|
| $1,500 rent | ~$43.80/mo | **$5.00/mo** |
| $2,500 rent | ~$72.80/mo | **$5.00/mo** |

The whole rent-tech industry (Avail, Baselane, RentRedi) runs on **ACH direct debit**: Stripe supports it at **0.8%, capped at $5.00**. On a $1,500 lease that's noise — a landlord won't blink, and a platform application fee still fits under what card would've cost.
- **Bookings** (motel night, hall rental, campsite) → **card** at 2.9%+30¢ is fine; it's a one-off the guest expects, and the Connect **application fee is the booking-fee revenue** — the vertical is **self-funding by design** the moment it takes a reservation.
- **Rent** (leases, storage, seasonal) → **ACH**, recurring via Stripe Billing.
- **Honest dependency:** the current `angelOsStripeAdapter` runs **card** Connect direct-charges. ACH is a real (small) config add — `us_bank_account` payment method + mandate handling on the subscription path, plus simple failed-payment/retry handling (ACH settles ~4 business days and can return on insufficient funds). This is the one net-new payment build, and only Mode 3 needs it.

---

## 5. Reusable as-is (from the 260718 scout)

BookingEngine (slot gen, conflict/overlap, reschedule, cancel), `bookings` collection (`rental` bookingType, pricing+split, Stripe payment intent), `Availability` (facilities), Stripe Connect direct-charge + application-fee split, `bookableServices` (`per_unit`/`hourly` pricing + `serviceAgreement` e-sign for leases), `booking-ops/checkout`, the block-based page-provisioning template pattern (`provisionMarketVendorSite.ts` = best copy target), Calendar block, `ensurePolicyPages`, and the LEO-tool + `/api/*-ops/*` registration pattern.

## 6. Gaps (the build)
1. **`Listings` collection** — unit-as-listing, admin-editable, with rate model + attributes bag (all three modes).
2. **Date-range booking** in BookingEngine (Mode 2) — nightly, check-in/out, min-stay, cleaning fee.
3. **ACH** payment method + recurring lease flow (Mode 3).
4. **Vertical templates** — `provisionFacilitiesSite` first (Mode 1), then stays; wire into `apply_site_template` (enum today is only `['fitness','church']`).
5. **Facilities-in-church** — expose bookable rooms inside the existing church template (Mode 1's fastest path to a real user).

---

## 7. Recommended sequence
1. **Mode 1 — Bookable Spaces (facilities)** as a church-vertical module. Rides the existing slot engine; near-free; real users (small churches) immediately. `Listings` collection (facility mode) + a Book-a-Space block + `provisionFacilitiesSite` template.
2. **Mode 2 — Stays** (campground-first skin): date-range listings + booking engine extension + site-map picker.
3. **Mode 3 — Rent** (landlady/storage): ACH enablement + recurring lease on Memberships rails.

## 8. Open questions for Ken
1. **The landlady** — real near-term target (pulls **Mode 3 + ACH** forward), or someday? Only thing that reorders the sequence.
2. **Lead skin for Mode 2** — campground (recommended: underserved) vs motel/Airbnb (crowded)?
3. **Monetization shape** — booking-fee % (Connect app fee, already built, self-funding) vs flat SaaS to the operator vs both? (Changes the pitch more than the model.)

---

*North star (Ken 260718): "we want to be able to morph into just about any web use case." This bookable-inventory primitive IS that — one engine that becomes a church hall scheduler, a campground reservation system, or a rent-collection portal by template alone.*
