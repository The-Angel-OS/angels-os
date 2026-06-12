# Angel Chain — Technical Appendix (Phase 3)

Maps the concrete chain mechanics in **Bambara, Allen et al., _Blockchain: A
Practical Guide to Developing Business, Law, and Technology Solutions_ (McGraw-Hill,
2018)** onto Angel OS Phase 3. The book is deliberately a *business/law/tech* guide —
strong on **permissioned/consortium chains (Hyperledger, Corda), Solidity smart
contracts, DAO legal liability, and Merkle/consensus**; light on token standards
(no ERC-20). That emphasis is exactly what Phase 3 needs.

Phase 1 (shipped, `src/utilities/tokenLedger.ts`) already gives us the **data
properties** of a chain — append-only, hash-linked, deterministic balances. This
appendix is about the **consensus + contract + legal** layer that turns that ledger
into a real Angel Chain. See [ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md](ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md).

---

## 1. Chain type → **permissioned consortium**, not public PoW

> *"Consortium — consensus is controlled by a preselected set of nodes and rules
> for achieving consensus."* (Bambara, on consortium blockchains)

This **is** Delegated Proof of Human Worth. The Diocese (Enterprise) is the
consortium member; the **21 elected Guardian-Angel validators** are the preselected
node set. Angel Chain is a permissioned consortium chain (Hyperledger Fabric / Corda
class), **not** a public Bitcoin/Ethereum-style open-membership chain.

Why this and not the alternatives:

| Book mechanism | Why we reject / adopt |
|---|---|
| **Proof of Work** — *"the winner broadcasts the proof of work… 51% of nodes agree"* | Reject. Energy waste; security ∝ hashpower = plutocracy. |
| **Proof of Stake** — *"influence in the consensus process is proportional to the quantity of economic resources that entity can bring to bear"* | **Reject as the core mechanism** — this is precisely the value we invert. Worth ≠ wealth. |
| **Consortium consensus** — preselected validators | **Adopt** as Delegated Proof of Human Worth: validators are *elected on karma + community trust*, not bought. Influence ∝ verified human contribution. |

The book names the deployable stacks: **Hyperledger Fabric, Quorum, Corda**, plus the
tooling **Cello / Composer / Explorer**. Fabric chaincode is the leading candidate for
the float-backed issuance contract (below).

## 2. Block structure → extend the Phase-1 hash chain with a Merkle root

> *"…applying a cryptographic function (SHA-256) twice… Block Merkle root (64 bytes),
> Block timestamp, Nonce… Transaction counter… Transaction list."* (Bambara, block header)

Phase 1 hash-links **individual** ledger entries. Phase 3 batches entries into
**blocks**: each block carries a **Merkle root** over its `TokenLedger` entries +
the previous block hash + the validator quorum's signatures. The migration is
additive — `verifyChain()` already proves per-entry integrity; a block layer wraps it.
No PoW nonce/mining: a block is final when ≥⅔ of the 21 validators sign (BFT-style,
as in Fabric/Corda), giving the doc's **5-minute block time** for human verification
without burning energy.

## 3. Smart contracts → the issuance + conversion rules

> Ch. 6 *"Fast-Track Application Tutorial… Introducing Solidity… Solidity Functions"*
> (413 "smart contract" / 175 "Solidity" references)

Two contract surfaces, both enforcing rules the Phase-1/2 code does in app logic:

1. **AT issuance contract** — mints AT to a recipient **only by debiting the Diocese
   float** (the `buildTransfer` invariant, on-chain). Guarantees issuance is always
   backed; no validator can mint unbacked AT.
2. **Conversion contract** — AT → external value, gated by policy (rate limit, KYC
   tier, Justice-Fund/float reserve check). **KC has no conversion contract at all** —
   non-convertibility is structural, not a setting.

**Recommendation:** run these as **Fabric chaincode on the permissioned chain**
(Diocese-controlled, private), with an *optional* public ERC-20-style bridge only at
the convertibility edge later — matching the book's *"privately administered smart
contracts on public blockchains"* hybrid. Keep the core private; expose only the bridge.

## 4. DAO + legal → the convertibility/regulatory gate

> *"Decentralized Autonomous Organizations… DAO and Jurisdiction… DAO Service-Level
> Liability… DAO Liability for Contract Breach"* (Bambara, Ch. on DAO law)

This is the chapter that matters most for **going live with cash-out**, and it
validates our locked decisions:

- **Governance = a DAO.** The [federated governance](../architecture/) quorum that
  votes monetary policy ("extreme pipe dream vote") is a DAO in the book's sense —
  and the book is explicit that DAOs carry **jurisdictional + service-level
  liability**. So monetary-policy votes need a constitutional wrapper, not just code.
- **The convertibility edge is the regulated edge.** AT → USD cash-out is money
  movement → money-transmitter / e-money licensing exposure. The book's legal framing
  is why we **keep KC structurally non-cashable** (no contract, §3) and **gate AT
  cash-out** (KYC tier / Guardian-Angel approval) until the licensing step is taken.
  Rewards economy first is a *legal* posture, not only a product one.
- **Custody.** The book's *"Autopsy of a Wallet Bug"* → key-management is where chains
  fail. Phase 3 starts **custodial** (Diocese holds keys for its members' wallets,
  like a bank holds deposits) before any self-custody option — consistent with
  "the Diocese is its own bank."

---

## Phasing (book chapter → our slice)

| Book material | Angel OS |
|---|---|
| Consortium consensus, Hyperledger/Corda | Phase 3: Delegated Proof of Human Worth, 21 elected validators |
| Merkle block header, SHA-256 | Phase 3: block layer over the Phase-1 hash-linked `tokenLedger` |
| Solidity / chaincode, smart contracts | Phase 3: issuance (float-backed) + conversion contracts as Fabric chaincode |
| DAO jurisdiction & liability | Gates Phase 2→cash-out: KC non-cashable, AT cash-out KYC-gated, custodial keys |

**Net:** none of this blocks slices 1–3 (wallet + ledger collections, quest-payout
credit, internal balances). The chain is a *substrate swap* under a ledger whose
semantics are already correct — the book confirms the consortium + Merkle + chaincode
path, and its DAO-legal chapters are the real-world rails for the convertibility step.
