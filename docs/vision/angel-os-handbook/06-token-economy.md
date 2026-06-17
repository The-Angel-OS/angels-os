# The Token Economy

Angel OS lets people be **paid for the work they do** — in tokens that are backed and accountable, on a ledger built with the data properties of a blockchain (so the chain underneath can be swapped in later without a rewrite).

## Three kinds of token

- **Angel Tokens (AT)** — real, backed, convertible value. Earned for quest payouts and services; redeemable.
- **Karma Coins (KC)** — the social/reputation layer: tips, thanks, standing. Ungated and freely given — but **never directly cashable**. This separation is deliberate: it keeps money and social esteem from collapsing into a single score.
- **Legacy Tokens (LT)** — long-term governance weight.

## The Diocese is its own bank

Each Enterprise holds a **float** — a local treasury — that *backs* the Angel Tokens it issues. Double-entry accounting guarantees issuance never exceeds the float, so tokens are always covered. The **Justice Fund** is the central reserve. Monetary policy — issuance, conversion, rates — is **governance-votable**, not hard-coded by a developer.

## The ledger

Token movements live on a **hash-linked, append-only ledger**: each entry hashes the previous one, so any tampering or reordering is detectable. Balances aren't stored as a mutable number you have to trust — they're a deterministic *replay* of the ledger. The chain can be verified end to end.

## Proof of Human Worth

How does a token payout get authorized? Through a **Quest**. Someone does real, verifiable work — and the evidence (often geo-tagged, reviewed by a human) is the proof. Approving that evidence is what releases the payout from the float to the worker's wallet.

This is **Delegated Proof of Human Worth**: value enters the economy because a *person did something real and good*, witnessed and confirmed — not because a machine solved a hash. The ledger's job is to remember it honestly.

## Why it's built this way

Six guardrails keep reputation from ever becoming a social credit system: karma is additive-only, it's about opportunity not dignity, it's federated (no central score), money and social standing are kept separate, the whole thing is inspectable and forgiving, and a human stays in the loop. The economy is meant to reward contribution and lift people — never to rank, gate, or punish them.
