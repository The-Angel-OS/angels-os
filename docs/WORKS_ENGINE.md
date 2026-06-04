# The Works Engine — Federated, Content-Addressed, Replicating Media Network

> **Canonical spec.** Supersedes the messages-primitive draft (which remains true
> for *authoring*; this spec adds *release + distribution*).
> Status: **committed direction** · Green-field (no adopters → no backward-compat tax).
> One line: *Audible's catalog × git's integrity × IPFS's addressing × the
> federation's signatures — presenting as a friendly shopping cart.*

---

## The thesis

A **Work** is any media (book, illustrated primer, audiobook, video, doc, quest).
It is **authored** mutably, **sealed** into an immutable signed release, **distributed**
by signed grant to portals, **replicated** there (sovereign, offline), and **read** by a
media-dispatching player. Each Angel OS node is simultaneously a **publisher** and a
**portal**. Works flow between nodes. No central catalog; each node holds its own.

**North star: sovereignty + offline.** Once a portal replicates a Work it needs nothing
from the origin — the origin can vanish and the Work survives. We chose **replicate**, not
reference, for exactly this reason.

---

## The lifecycle (the whole design in five verbs)

```
  AUTHOR        →   RELEASE          →   DISTRIBUTE      →   REPLICATE       →   READ
  messages/         signed,              signed grant        pull-by-hash,       any-media
  channels          content-addressed    to a portal         verify, store       player
  (mutable,         manifest + assets    (terms: free/paid)   (sovereign copy)
   Dexie, offline)  (immutable, versioned)
```

- **Author** — the workshop. Mutable blocks in the message/channel store (Notion-like,
  offline via Dexie). Like a git working tree.
- **Release (seal)** — freeze a version into a **content-addressed, Ed25519-signed
  manifest** referencing assets by hash. Immutable + verifiable. Like a git commit.
- **Distribute** — the origin issues a **signed grant** putting the Work on a portal.
- **Replicate** — the portal verifies the grant + manifest signature, pulls each asset by
  hash (from origin or any peer), verifies each hash. Now self-sufficient.
- **Read** — the player dispatches by media type (primer / audio / video / text / quest).

Mutable authoring ≠ immutable release is the keystone. It resolves the
file/static/messages debate: **messages are the workshop; signed content-addressed
manifests are the published book.** Both.

---

## Primitives

### 1. Content-Addressed Store (CAS)
Every asset is named by its **SHA-256 hash** (`cid`). Immutable, deduplicated,
integrity-checkable (the hash *is* the verification), cacheable anywhere.
- Dev: hash-named files under `public/library/cas/<cid>.<ext>`.
- Prod: Cloudflare R2 (object key = cid) + edge cache + local warm cache.
- IPFS's good idea without IPFS's operational baggage.

### 2. The Work = a signed manifest
```jsonc
{
  "slug": "wdeg",
  "title": "Where Did Everyone Go",
  "media": "primer",                 // primer | book | audio | video | doc | quest
  "origin": "<publisherPublicKeyHex>",   // the enterprise/DID that owns this Work
  "version": 1,
  "languages": [{ "code": "en", "name": "English", "rtl": false }, ...],
  "defaultLanguage": "en",
  "items": [
    { "order": 1, "imageCid": "<sha256>", "image": "/library/cas/<sha256>.webp",
      "audioCid": null, "textCids": { "en": "<sha256>", "es": "<sha256>" } }
  ],
  "manifestCid": "<sha256 of the canonical manifest, signature excluded>",
  "signerPublicKey": "<hex SPKI DER ed25519>",
  "signature": "<hex ed25519 over the canonical manifest>"
}
```
Mirrors `src/federation/protocol.ts` exactly (hex SPKI/PKCS8 DER, `crypto.sign(null,…)`)
so Library signatures are **federation-verifiable** with the existing `verifySignature`.
The manifest is itself content-addressed → its hash is the immutable version id.

### 3. Distribution = a signed grant
```jsonc
{
  "workCid": "<manifestCid>",
  "origin": "<publisherPublicKey>",
  "grantee": "<portalPublicKey | tenantSlug>",
  "terms": { "kind": "free" | "paid", "price": null, "currency": null },
  "issuedAt": "ISO", "expiresAt": "ISO | null",
  "signature": "<origin signature over the grant>"
}
```
A portal verifies the grant signature against the **origin's known key** (the federation
handshake — task #5 — is the load-bearing wall: no verified identity, no trustable
distribution), then replicates. **Revocation** = origin publishes a signed revocation or
the grant expires; replicated copies honor it (stop serving, optionally purge).

### 4. Replication = pull-by-cid
On accepting a grant: fetch manifest (verify sig + hash) → for each `*Cid` not already in
CAS, pull (origin or peer) and verify the hash → store. Idempotent, resumable, offline
thereafter.

### 5. The Library = the grants a node holds
`owned (origin = self) ∪ granted`. The list renders this catalog, **tenant-scoped** with a
never-empty filter (the Sprint-44 `buildTenantFilter` discipline; a `worksFilterNeverLeaks`
test guards it). A Work not visible to the current tenant → **404** (no existence leak).

---

## Any-media player

`WorkPlayer` dispatches by `manifest.media`:
- `primer` / `book` → page-flip image+text reader (built ✅)
- `audio` → audiobook player (items = tracks; the literal Audible case)
- `video` → video player
- `doc` → long-form reader
- `quest` → interactive / smart-contract-like (state + rules)

One player, many media. The manifest already carries ordered items with image+text;
adding an `audioCid`/`videoCid` per item is the only schema step.

---

## Commerce: the Battle Computer is a Shopping Cart

A Work is just another thing a sovereign node **owns and distributes** — next to Products
and Services. So a grant's `terms` can be **paid**, and **UltimateFairSplit becomes the
royalty engine**: the publisher is paid when their title sells/streams across the network —
Audible's economics, *federated*, with fair-split instead of a gatekeeper's 70/30. The
shopping cart and the library are the same node; a book is a product that happens to be
readable.

---

## Security & invariants

- **Provenance** — every release + grant is Ed25519-signed; consumers verify against the
  origin's federation key. Spoofing "official WDEG" is cryptographically prevented.
- **Integrity** — content addressing means a tampered or corrupted asset fails its hash.
- **Privacy boundary (state it loudly)** — file/static/CAS assets are public-by-nature
  (anyone with the cid can fetch). Scoping hides a Work from a *listing*, not from a URL.
  **Anything that must be genuinely private must be message-backed** (DB access control).
  Static/CAS = *published*; messages = *private*.
- **Never leak** — the Library listing must never fall through to a global/empty filter;
  mirror `buildTenantFilter` and test it.
- **No secret in git** — private signing keys live encrypted in the tenant (keyStore.ts) or
  gitignored locally; only public keys + signatures are committed.

---

## Build path (each slice ships; every cycle moves toward this)

1. **Content-address + sign the manifest** ← *slice #1, in progress.* Assets → CAS by
   hash; manifest signed (federation format); self-verify. Pure assets+JSON, zero DB.
2. **Replicate flow** — export a signed work *bundle* (manifest + assets), import into
   another node, verify sig + hashes, list it. Prove sovereignty on one machine.
3. **Grants + revocation** — signed distribution record; honor revocation. (Needs #5 keys.)
4. **Any-media** — `audioCid`/`videoCid` items + `WorkPlayer` dispatch (audiobooks).
5. **Commercial terms** — grant terms → UltimateFairSplit → royalties.
6. **Authoring → seal** — message/channel workshop sealing into a release (the loop closes).

Green-field assumption: while solo, no reference/streaming fallback, no migration baggage —
build the optimal replicating design directly.

---

*Author in the workshop. Seal a commit of media. Sign it. Hand it across the federation by
grant. Each node keeps its own sovereign copy. Read anything. Get paid fairly. And it still
looks like a friendly shopping cart.*
