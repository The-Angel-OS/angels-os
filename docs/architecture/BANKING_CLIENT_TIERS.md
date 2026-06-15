# Banking Client Tiers — Web vs Native, by What's at Stake

**Status:** Design decision (2026-06-14). The native client (Nimue) is intentionally
NOT being built against until we're near final — this doc pins the *policy* so the
banking surface is designed correctly in the meantime. Aligns with
[KARMA_PRINCIPLES](./KARMA_PRINCIPLES.md) Guardrail #2 (gate opportunities, never
dignity).

## The decision

**Self-custody and high-value money movement require the Angel OS native client;
earning, holding, viewing, and all social karma stay on the open web.**

Not "banking = app." Tier by risk:

| Tier | Actions | Client | Rationale |
|---|---|---|---|
| **Universal (web, no app)** | Earn/receive quest payouts; view balances + ledger history; all **KC** (social, non-cashable); send a voluntary tip | Any browser | Receiving money and social karma carry ~no custody risk. This is the **dignity on-ramp** — earning AT from a quest must never require owning a current phone. |
| **High-assurance (native)** | Cash-out (AT→fiat); transfers above a threshold; **self-custody key signing**; governance signing with a personal key | Angel OS client (Nimue) | Hardware-backed keys + biometric + device attestation. The risk is real here, so the friction belongs here. |

## Why native earns the high tier (capabilities web structurally lacks)

- **Hardware-backed keys** — iOS Secure Enclave / Android StrongBox. A browser can't
  hold a signing key this way.
- **The self-custody path** — moves AT from *custodial* (server holds it) to the person
  holding their own keys and signing their own transactions. This is the app as
  *liberation*, not leash: it's how the keys leave our hands. Aligns with Karma
  Guardrails #3 (federated, no central owner) and #5 (owned, portable).
- **Attestation = anti-sybil without invasive KYC** — Play Integrity / App Attest gives
  "real device, plausibly one human," strengthening proof-of-human-worth and
  one-human-one-wallet without demanding papers. Pairs with quest geo-evidence.
- **Push as transaction 2FA**, biometric step-up, offline signing.

This is what Nimue is *for* ([[project_nimue_android_client]] — "Leo's body"); banking
on native is not a new dependency, it's the existing roadmap.

## Hard constraints (don't violate)

1. **Never gate earning/receiving/viewing/KC behind the app.** The served population
   (van-lifers, re-entering, unbanked) is the most likely to lack a current device.
   Gating the *dignity* path = a Guardrail #2 violation.
2. **App-store hostility is real.** Apple/Google restrict wallet/crypto/"earn money"
   apps, take 30%, reject unpredictably. Design so sensitive *signing* lives in the app
   while commerce is framed carefully (or distributed via PWA/sideload where policy
   allows). Needs a deliberate review before any store submission.
3. **The client choice is orthogonal to regulation.** AT→fiat cash-out is
   money-transmitter / KYC-AML territory regardless of web vs native. The app helps
   security + identity assurance; it does NOT substitute for the legal cash-out review
   ([[billing_reconciliation]] — needs counsel).

## Open parameter: the threshold

The dollar line above which the native client is required (for transfers/cash-out)
should be a **governance-votable parameter**, like monetary policy — not a hardcoded
constant. Low/zero threshold = stricter (more actions need the app); higher = more
permissive. Let each Diocese (or the federation) tune it. ⬜ Decide default + wire to
the Settings bag so it's adjustable without deploy.

## Status
Policy pinned; implementation deferred until near-final (per Kenneth). The web banking
surface should be built to this tiering now so the native step-up slots in cleanly
later.
