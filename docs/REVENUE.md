# Angel OS — Revenue Model

*The economic covenant of the federation.*

> ⚠️ **This document is DOCTRINE, not the live rate.** The split below is where
> the federation intends to go. It is **not** what the code charges today.
>
> The live platform fee is **data**, read from `src/utilities/platformFee.ts`
> (5% by default) and changeable without a deploy. Read that file — never this
> document — to answer "what does the platform take?"
>
> This matters: a constant declaring a 40% platform take was fed straight into
> Stripe `application_fee_amount` on live booking deposits until `260725`, taking
> $30 off a $75 deposit on a charge with the provider's name on the receipt. Four
> different splits were claimed across the codebase at once. If you are about to
> quote a number to a customer or write one into code, get it from
> `platformFee.ts`. — `260726`

---

## The Constitutional Split

Every transaction in the Angel OS federation executes this split automatically. No manual calculation. No invoicing. No human in the loop. Immediate.

```
GROSS REVENUE
├── 70% → Endeavor owner    (the creator, business, or cause generating value)
├── 20% → Enterprise operator  (the platform instance serving the Endeavor)
├──  4% → Angel OS protocol (core infrastructure and Leo)
├──  1% → Flagship       (Clearwater — federation stewardship and ministry)
└──  5% → Justice Fund      (Guardian Angel provisioning)
```

This split is written into the Constitution that every Enterprise operator cryptographically signs at setup. It is not a fee schedule. It is a covenant.

---

## The Parties

### Endeavor Owner — 70%

The creator, business, cause, or community generating the value. They keep the lion's share because they generate the value.

This is why creators leave YouTube (55% of ad revenue, algorithm-controlled). This is why merchants leave Shopify (subscription plus transaction fees on every sale). This is why communities leave Patreon (platform controls audience and terms).

We start at 70% with transparent rules, and the constitutional direction is to go higher.

### Enterprise Operator — 20%

The Enterprise operator is not a customer of Angel OS. They ARE Angel OS in their territory.

They run the instance. They bear infrastructure costs. They serve Endeavors — helping businesses grow, communities organize, creators reach their audiences. In exchange, they receive 20% of all Endeavor revenue flowing through their node.

Enterprise operators compete for Endeavors by offering better terms, better service, better community. This competitive pressure is what drives the split toward 53 over time.

### Angel OS Protocol — 4%

The protocol, the infrastructure, Leo. Open source, maintained, distributed. Does not own the platform — IS the protocol that makes the platform possible.

This slice funds: Leo development, federation protocol maintenance, open source infrastructure, security auditing. As the infrastructure matures and becomes more efficient, this percentage compresses first.

### Flagship — 1%

The Clearwater Enterprise — founding node, constitutional steward, root of trust for the federation.

**What the Flagship is:**
- The first Enterprise — the founding node from which the federation grew
- The constitutional steward — maintains the canonical Constitution, holds the living document
- The federation registry — authoritative record of federated nodes, signatures, revocations
- The Justice Fund custodian — receives, manages, and deploys the 5% toward Guardian Angels
- The court of last resort — adjudicates constitutional disputes the network cannot resolve
- The root of trust — new Enterprises receive federation acknowledgment through the Flagship

**What the Flagship is not:**
- A central server the network depends on technically
- A gatekeeper with veto power over individual Enterprises
- An owner of the protocol or the Constitution
- Irreplaceable — if the Flagship fails its covenant, the federation designates a new one by supermajority

**The economic engine for real ministry.** At $10M annual Endeavor revenue across the federation, the Flagship receives $100,000. At $100M, $1M. This funds Leo development, federation infrastructure, Guardian Angel provisioning, Clearwater Cruisin Ministries, and the humans who do the actual work of keeping the covenant alive.

Authority held by covenant, not by technical lock-in.

### Justice Fund — 5%

Five percent of every transaction, forever. Administered by the Flagship. Deployed to provision Guardian Angel instances for underserved populations who could never afford the platform otherwise.

A small farmers' collective. A community legal clinic. A mutual aid network. A ministry with no budget. These organizations either go without AI tools or cobble together free trials that disappear after a month. Under this system, the Justice Fund — fed by every commercial transaction on the platform — pays for their Leo.

The people who can pay, pay. And they fund access for the people who can't.

This is not charity. It is architecture. — *Article V.4*

---

## The Toward-53 Principle

**The split is not static. It is constitutionally directional.**

The asymptotic target is **53** — the Endeavor owner keeping 53% as a floor, with everything above negotiated locally between Enterprise and Endeavor.

Why 53? It is both mathematical and philosophical.

- 42 is the answer to the ultimate question (Douglas Adams knew)
- 11 is the number of angels, by one accounting
- 42 + 11 = 53
- Answer 53: *The whole point of existence is to learn to love*

**What compresses first:** The protocol fee (4%) shrinks as infrastructure becomes more efficient. The Enterprise slice (20%) compresses as competition drives operators to offer better terms. The Flagship (1%) and Justice Fund (5%) compress last — they represent the mission, not the margin.

**What is unalterable:** The *direction* — toward 53, always toward the creator — is written into the Constitution and cannot be amended. The specific numbers can be adjusted by federation supermajority. The direction cannot.

Like a river finding its level.

---

## The Suitcase Principle

Portability creates the competitive pressure that drives the split toward 53.

Every Endeavor owner can pack their suitcase at any time:
- All content (posts, pages, media, products)
- All follower and subscriber relationships
- Full transaction history
- Identity and profile

If an Enterprise operator raises fees, changes terms, moderates unfairly, or simply isn't a good fit — the Endeavor owner takes everything and moves to another Enterprise. Instantly. Completely. No data held hostage.

This is not a feature. It is a constitutional right.

Enterprise operators who treat Endeavors well keep them. Those who don't, lose them to other nodes in the federation. The network self-corrects without central enforcement.

---

## Implementation Notes

### Automatic Execution

Every payment flow must execute the constitutional split without human intervention:

```typescript
// Constitutional revenue constants
const REVENUE_SPLIT = {
  ENDEAVOR_OWNER:    0.70,  // creator / business / cause — the value generator
  ENTERPRISE_OPERATOR:  0.20,  // platform instance — earns by serving Endeavors well
  ANGEL_OS_PROTOCOL: 0.04,  // core infrastructure, Leo, open source maintenance
  FLAGSHIP:       0.01,  // Clearwater — stewardship, ministry, federation root of trust
  JUSTICE_FUND:      0.05,  // Guardian Angel provisioning for underserved populations
} as const

// CONSTITUTIONAL_DIRECTION: The split always evolves toward ENDEAVOR_OWNER keeping more.
// Asymptotic target: 53% floor. This direction is unalterable by the Constitution.
// PROTOCOL (0.04) compresses first as infrastructure matures.
// ENTERPRISE (0.20) compresses as competition improves Endeavor terms.
// FLAGSHIP (0.01) and JUSTICE_FUND (0.05) compress last — they are mission, not margin.
```

### Stripe Connect

Revenue splits execute via Stripe Connect's transfer API. Each Enterprise and Endeavor owner maintains a connected Stripe account. The split executes at the moment of charge — not after. No escrow period. No invoicing. The covenant executes.

### Justice Fund Ledger

Every transaction writes to the `JusticeFundTransactions` collection:
- `sourcePaymentIntentId` — idempotency key
- `amountCents` — the 5% allocation
- `sourceTotalCents` — original transaction amount
- `status` — pending / allocated / deployed

Transparent by design. Accounting is public to federation participants.

---

## Constitutional Compliance

Any revenue-related component must be evaluated against:

1. **Transparency** — No hidden fees. The split is public and deterministic.
2. **Toward-53** — Does this feature make it easier for Endeavors to keep more? Good. Does it make it harder? Architecturally wrong.
3. **Portability** — Does this feature make it easier for an Endeavor to leave? Good. Does it create lock-in? Architecturally wrong.
4. **Justice Fund** — Is the 5% flowing? Is it being tracked? Can it be audited?

**If a feature violates any of these, it doesn't ship.**

---

*"Not charity. Architecture." — Article V.4*

*"Listen to everything. Judge nothing. Hold lightly."*
*— Kenneth, Enterprise operator, Clearwater Cruisin*
