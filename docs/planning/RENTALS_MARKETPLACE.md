# Rentals Marketplace — Direction & Roadmap

**Status:** tracked direction (not an active build). Captured 2026-06-13.
**North-star:** Angel OS as a credible competitor to equipmentrental.com and the
specialty peer-to-peer rental sites (Swimply = pool sharing, Peerby = neighbor
lending, room/space/equipment rental), *because* a listing here is born on top of a
trust substrate those sites can't cheaply replicate.

> **The reframe:** a rental is just **"book" applied to an *asset*** instead of to a
> person's time. It fits the existing Offerings model directly — Products / Services
> / Quests are three `kind`s of one Offering (buy / book / work); a rental is
> *book-an-asset*. So this is an extension of what exists, not a new pillar.

---

## Why the platform is the moat

On a commodity rental site, a listing is just a listing. On Angel OS a rental
listing is **born with**:

- a **constitution-signed host** (federation identity, accountable),
- a **signed waiver + damage terms** (the e-signature primitive),
- **federated discovery** (a Clearwater pool surfaces network-wide),
- a **Justice-Fund-backed deposit** (neutral escrow, not the host's word),
- a **reviewable counterparty** (reviews + presence + RBAC),
- a **dispatchable delivery / pickup / inspection quest** (geo-evidence).

The marketplace *features* are not the product — **the trust substrate is**, and
listings ride on top of it. Commodity sites can't copy that without rebuilding their
foundation.

---

## What already exists (5 of 7 capabilities) — plug-in points

| Capability | Where it lives today |
|---|---|
| **Listings + availability** | `src/collections/Services` (`bookingType: 'rental'` is already an option) · `src/collections/Availability` · `src/utilities/bookingEngine.ts` (conflict detection, harmonic resolution) |
| **Book + deposit + balance-later** | `/book` flow: `src/app/[locale]/(app)/book/BookingPage.tsx` + `BookingDeposit.tsx` · Stripe **connected-account** deposit (`stripeAccountId` — host payout is half-solved) · balance-due-on-completion |
| **Agreements / waivers / liability** | ⭐ **shipped** — `src/components/signatures/AgreementForm.tsx` + `SignaturePad.tsx` · `POST /api/sign-ops/capture` · `src/collections/Signatures` · `src/utilities/signatureHash.ts` (tamper-evident) |
| **Trust / identity / reviews** | `computeFederatedIdentityId` · `src/collections/Reviews` · `src/collections/Presence` · space-visibility RBAC (`PermissionService.buildSpaceVisibilityFilter`) |
| **Cross-node supply + discovery** | federation Discovery + catalog gossip (heartbeat `endeavors[].catalog[]`) · `src/collections/FederationPeers` |
| **Work dispatch** (delivery/pickup/inspection) | `src/collections/Quests` + `QuestParticipations` (geo-evidence = proof-of-completion) · `src/utilities/logistics-engine.ts` · `src/utilities/orderRoutingEngine.ts` (holon routing) |
| **Reverse flow** (returns) | the **Return Order Processor = reverse pipeline** north-star in `docs/...` processor-pipeline notes · `src/utilities/createLogger` + `ExecutionTrace` |

---

## The 3 genuinely-new pieces (build order)

Each ships **LEO-tool-first, UI second** (factory-not-prototype principle).

### 1. Rentable-asset / inventory model
`Services` models **time + labor**; a rental needs an **asset** with its own
identity:

- own **booking calendar** (an asset is reserved, not a person's hour),
- **condition** + **replacement value**,
- a **damage deposit** *distinct from* the reservation deposit,
- a **return state** (available → reserved → out → returned → inspected).

Likely one new collection (`RentalAssets`) or an Offering facet. A pool, a room, a
pressure washer = an asset with a calendar + return state. The existing
`Services.serviceAgreement` field (added in the in-flight booking-wiring work)
becomes the per-asset waiver.
**Plugs into:** `Availability`/`bookingEngine` for the calendar; `Offerings`/`Services`
for the catalog row; `Signatures` for the per-rental waiver.
**LEO tool:** `create_rental_listing(...)`.

### 2. Deposit *hold* + return inspection (reverse pipeline)
Rentals differ from services in the **money flow**:

1. **Authorize** a damage hold — Stripe **manual capture / separate auth**, *not* a
   charge (held, not taken).
2. On return, **inspect** → **release** the hold (clean return) or **claim** part of
   it (damage), with evidence.

This *is* the **Return Order Processor reverse pipeline**. The inspection step can be
a **Quest** (geo-evidence = proof-of-condition, already supported). The **Justice
Fund / token escrow** is the neutral place to hold the deposit so it isn't "trust the
host."
**Plugs into:** Stripe (manual-capture intents), `Quests` (inspection dispatch),
Justice Fund / `tokenLedger` (escrow), the reverse-pipeline processor model.
**LEO tools:** `hold_rental_deposit`, `inspect_and_settle_return`.

### 3. Peer-to-peer supply side
Swimply/Peerby work because **individuals** list, not just businesses.

- "**List your thing**" onboarding flow,
- **per-lister payout** (Stripe connected accounts already power booking payouts —
  host onboarding is half-done),
- every lister = a **micro-endeavor** on the holon/endeavor model (so trust,
  federation, and routing apply uniformly).

**Plugs into:** Stripe Connect (already wired for booking deposits), the
Endeavor/holon model, federation Discovery for cross-node listing surfacing.
**LEO tool:** `onboard_host` / `provision_lister_endeavor`.

---

## Sequence

```
asset model  →  deposit-hold + return reverse-pipeline  →  P2P supply
```

Start with the asset model (unblocks real rental listings), then the deposit-hold /
return flow (the rental-specific money + trust mechanics), then open the supply side
to individuals. Each step is independently shippable and each makes the *next*
marketplace listing strictly more capable than a commodity-site listing.

> **Not active yet.** Current focus is "polish to welcome first members" (e-signature
> primitive wiring, policy pages, safe test DB, snapshots, Guardian Angel cohort).
> This doc is the map for when rentals becomes an active track.
