# Karma Principles — Reputation Without a Social Credit System

**Status:** Governing constraints (pinned 2026-06-14). The user-facing reputation
feature does **not** exist yet — these guardrails are written *before* it, on purpose.
Any future karma/reputation/standing surface MUST pass all six. The proposed
Constitution clause at the bottom is for adoption via governance (not yet ratified).

---

## Why this doc exists

Angel OS has the raw materials of a reputation system — Karma Coins (KC), the
hash-linked token ledger, per-quest ratings, and an org-level trust model. The line
between *"a record of good done"* and *"a social credit system that leashes people"*
is thin, and it is crossed by feature decisions, not by intent. Chinese-style social
credit didn't set out to be dystopian either; it became so through four specific
moves. This doc names those moves and forbids them.

**The distinction in one sentence:** karma is a *key that opens doors*, never a *lock
that closes them on essentials* — a hand that vouches *for* you, never a net that
catches you.

---

## The six guardrails (hard constraints)

### 1. Additive, never punitive
Karma only ever goes **up**, and only for good freely done. There is **no negative
axis** — no demerits, no burn-as-punishment, no score that subtracts rights.
- *Failure mode it prevents:* the punishment ledger (blacklists, penalties) that turns
  a reputation system into an instrument of control.
- *Code constraint:* KC has no debit-as-penalty path. A KC `debit` may exist only for a
  voluntary *spend/tip the holder initiated*, never an authority-imposed deduction.

### 2. Gates opportunities, never dignity
Karma may unlock **opportunities** — a quest, a trusted role, the right to vouch, a
discount. It must **never** gate basic access, money, personhood, safety, or
participation. Sanctuary parking is the test: trust vouches *for* you to get in; it
never bars you for a low score.
- *Failure mode it prevents:* score-gated existence (can't travel/rent/bank because
  your number is low).
- *Code constraint:* no permission check may *deny* a baseline capability on the basis
  of a karma/reputation value. Karma may only *grant additional* capabilities.

### 3. Federated, never centralized
No single authority owns "your score." Each Diocese (Enterprise) is its own trust
domain and bank. Standing travels between domains only by **consent-based vouching**,
never by a central registry aggregating everything about a person.
- *Failure mode it prevents:* the single state ledger — one canonical, inescapable
  record everyone is judged against.
- *Code constraint:* there is no global per-user reputation table. Trust is per-Diocese;
  portability is an explicit, revocable vouch the person can see.

### 4. Money and social are separated — structurally
The three-token split is load-bearing: **KC (social standing) can never convert to
money, and can never freeze, gate, or seize funds (AT).** Governance weight (LT) is
earned, not bought, so reputation cannot be purchased and money cannot buy standing.
- *Failure mode it prevents:* the worst SCS fusion — turning your social score into
  financial control.
- *Code constraint:* no exchange path KC↔AT. No AT operation may take a KC balance as
  an input or gate.

### 5. Transparent, owned, portable, and forgiving
The ledger is append-only and inspectable; a person can always read their own record.
No secret algorithm. Rooted in the Constitution's faith stance (grace, redemption):
because there is no punitive axis (Guardrail 1), there is **nothing to be permanently
marked with** — there is no black mark to be stuck under.
- *Failure mode it prevents:* the opaque score and the permanent record with no path to
  redemption.
- *Code constraint:* a user can fetch their full karma history; standing data is
  exportable; no field encodes an irreversible penalty.

### 6. Human-in-the-loop
Standing changes from real judgment (a person reviewing quest evidence), not from an
algorithm scoring people in the dark. Automated *credit* for verified work is fine;
automated *judgment of a person* is not.
- *Failure mode it prevents:* algorithmic social sorting with no accountable human.
- *Code constraint:* any reputation-affecting *judgment* (not a mechanical payout)
  routes through a human approver with an audit trail.

---

## Where the danger actually lives

The dystopia is built the day someone does any of these. Treat each as a tripwire:
1. Rolls KC + ratings into **one visible "score."**
2. Lets that score **gate a non-luxury.**
3. Adds a **negative axis** (demerits/penalties).
4. Lets **one node own the canonical copy** of everyone's standing.

If a proposed feature does any of the four, it is rejected by this doc.

---

## Current state (grounded, 2026-06-14)

What exists (the substrate, deliberately *not* a score):
- **Three separated currencies**, hash-linked append-only double-entry ledger —
  `src/utilities/tokenLedger.ts`. AT (real/backed/convertible), KC (social,
  non-convertible), LT (governance, earned-not-bought).
- **Wallets** balance cache (`src/collections/Wallets`), **TokenLedger**
  (`src/collections/TokenLedger`, admin-read, append-only).
- **Earning path:** Quest → evidence (geo/photo = proof-of-human-worth) → human review
  → approval → `src/utilities/creditQuestPayout.ts` credits **AT**. Per-participation
  1–5 rating stored on `QuestParticipations` (not aggregated onto the user).
- **Org-level trust only:** `trustLevel` / `ministryStatus` / `vouchesReceived` on
  `FederationPeers` (Enterprise/Diocese), 90-day probation, 2-vouch threshold.

What does NOT exist (and must only ever be built within the six guardrails):
- No aggregated user karma **score**; KC is a *balance*, not a *rating*.
- No user-level vouches, probation, or trust tiers.
- No karma-gated permission anywhere.
- No user-facing reputation display.

We are at the fork *before* the feature — which is the only safe place to write the
rules. See [[project_token_economy]], [[project_quests_economic_type]],
[[project_constitution_faith_stance]], [[project_federation_diocese_model]].

---

## Proposed Constitution clause (for governance adoption — NOT yet ratified)

> **Article — On Standing and Karma.** A person's standing within the federation is a
> record of good freely done, never a leash. (1) Karma is additive only; no authority
> may impose a penalty against a person's standing. (2) Standing may grant
> opportunities; it may never deny anyone basic access, dignity, safety, the use of
> their own funds, or participation. (3) No central registry shall own a person's
> standing; trust is held per-Diocese and travels only by the person's consented,
> revocable vouch. (4) Social standing (Karma Coin) shall never convert to, gate, or
> seize money. (5) Every person may inspect and carry their own record; because there
> is no penalty, there is no permanent mark — grace is structural. (6) Judgments of a
> person are made by accountable people, not by opaque algorithms.

Adopt via the federated-governance process (constitution changes are a votable
subject — see [[project_federated_governance]]), which bumps the constitution version
carried in the heartbeat. Do **not** edit the live constitution unilaterally.

---

## Checklist for any future reputation feature

Before merging anything that touches karma/reputation/standing, confirm:
- [ ] No negative/penalty axis introduced (G1)
- [ ] Does not gate any baseline capability; only grants extras (G2)
- [ ] No global per-user reputation store; per-Diocese + consented vouch (G3)
- [ ] No KC↔AT path; no AT op gated by KC (G4)
- [ ] User can read + export their full record; no irreversible field (G5)
- [ ] Any person-judgment has a human approver + audit trail (G6)
