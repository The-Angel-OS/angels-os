# Federation: Unified People Directory + Cross-Node DM (Design)

**Status:** Design / not yet built. Companion to the local People manager (shipped)
and the Discovery banner (shipped). This is the **mesh tier** — it spans the two
(soon N) Enterprises, each with its **own database**.

> Vocabulary (locked): **Enterprise** = a federated node / Diocese (own DB +
> domain: spacesangels, KenDev). **Endeavor** = a ministry/work hosted within an
> Enterprise. **Network** = the federation of Enterprises. People and Endeavors
> live *in* an Enterprise; the network *aggregates* them.

## The core constraint
There is **no shared database**. "One unified list across both platforms" is
therefore **cross-node aggregation, not one table**. Two facts make it tractable:
1. **Stable identity** — everyone signs in with Google, so a person's identity
   (Google `sub` / email) is the same on every node even though their `users` row
   is duplicated per node DB. **Key on email / a derived `federatedPersonId`,
   never on row id.**
2. **An existing transport** — `FederationPeers` (the node registry),
   `federation-heartbeat` (liveness + capacity), `federation-message` (node→node
   relay), and `federation-discover` already exist. We extend, not invent.

## 1. Unified People Directory

### Model
- Each Enterprise exposes a **directory endpoint** (`GET /api/federation/directory`)
  returning a **privacy-filtered** projection of its people:
  `{ federatedPersonId, displayName, avatarUrl?, endeavors: [{name, slug, role}],
  enterprise: {name, domain}, contactable: bool }`.
  - `federatedPersonId` = a stable hash of the verified email (so the same person
    on two nodes collapses to one row) — NOT the raw email (privacy).
  - **Consent gate:** a person is only listed if they've opted into the directory
    (a `users.directoryVisible` flag, default off, surfaced in Account → Profile).
    Showcase/root members can default-on per Enterprise policy.
- A **unified view** (People manager "Network" tab + Discovery) aggregates the
  local directory + each active peer's directory (from `FederationPeers`), and
  **dedupes by `federatedPersonId`**, merging the `endeavors`/`enterprise` arrays
  so one person shows their presence across the network.

### Caching / cost
- Peer directories are pulled on the federation heartbeat cadence and cached
  (like capacity snapshots), not fetched per page view. Stale-tolerant.

### Why not sync rows?
Copying users between DBs creates split-brain identity + GDPR headaches.
Aggregate-and-dedupe keeps each Enterprise sovereign over its own user rows and
makes "leave the network" a clean local delete.

## 2. Cross-Node DM (federation-wide chat) + LiveKit

### Model
- The unit is a **DM channel** (already our primitive). A *cross-node* DM is a
  channel whose participants span Enterprises.
- **Addressing:** participants are addressed as `federatedPersonId@enterpriseDomain`.
  The originating node creates the local DM channel + a local "shadow" participant
  for the remote person, and relays each message via `federation-message` to the
  peer, which mirrors it into the corresponding DM channel on its side (a shadow
  channel keyed by the conversation's `federationThreadId`).
- **Delivery:** at-least-once via the relay + idempotency on a
  `metadata.federationMessageId` (same dedupe pattern as gotify-poll). A message
  that fails to relay is queued + retried on the next heartbeat (the "token-poor
  node dispatches to a peer" pattern generalized to chat).
- **Realtime (voice/video):** LiveKit is a hosted substrate, so it already works
  across nodes. A cross-node call = a LiveKit room whose name encodes the
  `federationThreadId`; both nodes mint tokens for their own participant against
  the same room. No media crosses our servers.

### Consent / safety
- "Contact anyone securely" is gated by `contactable` (directory consent) + a
  first-message **request/accept** handshake (so the network isn't a cold-DM
  spam vector — the same noise-budget concern as the Gotify flap-storm).

## 3. Discovery cross-node aggregation
- Discovery currently lists **local** `networkVisible` endeavors (that's why each
  node shows a different count). Extend it to merge each active peer's
  `federation-discover` payload (endeavors + the home-page banner we just wired),
  deduped by `federationId`. Then "Explore the Federation" truly shows the whole
  network, and the header's Endeavor count becomes network-wide (the Enterprise
  count already is).

## Phasing
1. **Directory endpoint + consent flag** (per Enterprise) — local, additive.
2. **People manager "Network" tab** — aggregate local + peers, dedupe by
   `federatedPersonId`.
3. **Discovery cross-node aggregation** (reuses the same peer-pull plumbing).
4. **Cross-node DM relay** (federation-message + shadow channels + idempotency).
5. **LiveKit cross-node rooms** (token minting per node on a shared room name).
6. **Request/accept handshake + rate limits** (anti-spam).

## Decisions (resolved 2026-06-07)

- **Admission/trust is an ENTERPRISE property, not an Endeavor one.** applicant /
  probation / active / vouched / full describe the *Enterprise* (Diocese); an
  Endeavor **inherits** its Enterprise's standing and must never display its own
  admission badge. (Bug fixed: KenDev.Co — the Enterprise's root presence — was
  showing "Applicant" on a Discovery *endeavor* card.) Discovery cards now show
  only the positive established states as a presence signal; applicants appear
  cleanly. The deeper re-grain (move `ministryStatus` off `endeavors` onto
  `FederationPeers`/Enterprise, endeavors inherit) is the canonical fix — this
  display change is the interim.

- **`federatedPersonId` (best practice):** normalize the verified email
  (trim + lowercase; for gmail.com/googlemail.com strip dots and the `+tag` in
  the local-part — Google treats them as one mailbox; do NOT dot-strip other
  providers), then `HMAC-SHA256(normalizedEmail, NETWORK_SALT)` → hex. The salt is
  a **network-wide shared secret published to member Enterprises** (not public),
  so the same person hashes identically on every node (enables dedupe) while the
  directory never exposes raw emails and the ids aren't rainbow-table-reversible.
  Salt rotation = a versioned salt (`v1:<hash>`) so a future rotation can be rolled
  forward without breaking existing matches.

- **Directory/Discovery default visibility:** reuse the existing pattern —
  visible **when configured** (the `federation.networkVisible` flag we already
  have for endeavors; an equivalent `directoryVisible` for people) **plus an admin
  override**. Root/showcase Enterprise = on by default.

- **Trust gating = inclusive by default.** Show applicant/probation Enterprises in
  the unified directory from the start (anyone motivated enough to stand up an
  instance is acting in good faith); make **hiding/suspension a reactive network
  governance function** triggered on bad action — not an upfront gate.

## Still open
- **Message-relay durability.** Recommendation: ship **best-effort + idempotency**
  (`metadata.federationMessageId` dedupe, heartbeat retry) first; upgrade to a
  **durable outbox** (persisted unsent queue with backoff) if/when we see real
  drop rates. Start simple, instrument, harden.

Related: [[../architecture/AUTH_CONTEXT_REFACTOR.md]] (PortalContext scopes the
*local* People view), the Diocese/federation trust model, and the governance
voter model (the unified directory IS the electorate).
