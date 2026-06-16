# Works as JSON — the three-layer model

Status: design accepted 2026-06-16 (Kenneth). Supersedes the collection-only
migration sketch. Implemented incrementally behind the existing reader so nothing
working is disturbed.

## The keystone

A Work is a **self-contained JSON document** — a manifest plus ordered chapters,
with **media referenced by absolute URL, never embedded**. That JSON is the unit
that travels the federation (it rides the message-routing system as a payload and
is a gossip-able catalog item). How any one node *stores* the Work, and *where*
its media bytes live, are decoupled implementation details behind that contract.

This separates three layers we had been conflating:

| Layer | What | Scope |
|---|---|---|
| **Interchange** | the Work as **Work JSON v1** — manifest + ordered chapters, media by URL, content-addressed by checksum | federation-wide, canonical |
| **Storage-of-record** | how a node materializes it — files (today), DB rows, or messages | per-node, swappable behind the contract |
| **Media** | bytes at a URL on whatever provider that node binds | per-endeavor adapter |

## Why media-by-reference (the "thousands of configs" point)

Across the federation, every endeavor may bind a different store — Vercel Blob,
S3, R2, IONOS, NAS, local disk. A Work JSON never embeds bytes; it carries
**absolute URLs**. A consumer never needs to understand another node's storage
provider — it only fetches a URL. Storage becomes a single per-node adapter (we
already have exactly one: the `media` collection's `vercelBlobStorage` binding),
and Works are ignorant of it.

Corollary: the canonical/interchange JSON uses **absolute** URLs. Relative paths
are meaningless once the JSON leaves its origin. (The in-node reader may still use
relative + client-side `absUrl()`, but the portable form absolutizes.)

## Work JSON v1

```jsonc
{
  "version": "work.v1",
  "slug": "answer53",
  "type": "document",            // "document" | "book"
  "title": "...",
  "subtitle": "...",
  "description": "...",
  "tags": ["..."],
  "status": "...", "statusColor": "...",
  "canonical": { "origin": "https://...", "creditedTo": "...", "contributors": ["..."] },
  "owner": "platform",           // owning endeavor (tenant slug) — editable home
  "checksum": "sha256:...",      // content address — see below
  "chapters": [                  // document: docs; book: pages (ordered)
    {
      "order": 0,
      "slug": "about-the-work",
      "title": "About the Work",
      "tier": "index",           // document only
      "body": "# markdown ...",  // document chapters
      "media": [                 // book pages / inline media, by ABSOLUTE url
        { "url": "https://.../file.jpg", "mime": "image/jpeg", "caption": "..." }
      ]
    }
  ]
}
```

### Checksum = content address, storage-independent

The checksum is computed over a **normalized content payload that EXCLUDES
absolute URLs** (slug, type, and ordered chapters with order/title/slug/tier/body
+ media captions/mime) — so the same authored Work yields the same checksum
regardless of which node serves it or where its media lives. This is the handle
the catalog gossip rides (heartbeat → `/federation/item/:checksum` lazy fetch);
it gives dedupe + integrity + addressing. (Per-media-byte integrity, if wanted,
is a later per-item hash, not the Work address.)

## Propagation, subscription, and the reference-vs-mirror fork

A Work propagates as a message-routing payload + a gossip catalog item — the same
rail as everything else. Subscription = a subscriber endeavor receives the Work
JSON. Two media modes, both supported with **no schema change** (URLs are URLs):

- **Reference (default):** keep the origin's URLs. Zero extra storage; canonical
  authority stays home (rel=canonical unchanged); depends on origin uptime + CORS.
- **Mirror (opt-in):** fetch each media URL, store in the subscriber's own
  provider, rewrite the URLs in its JSON copy. Resilient, survives origin going
  dark — and is **identical to the Audible-style offline download** (a device/node
  mirroring media into its local adapter). Costs the subscriber storage.

Decision: reference-by-default; mirror is an opt-in pass that shares the offline-
download code path. One mechanism, two payoffs.

## Migration phasing (non-destructive throughout)

The reader (Nimue + web) consumes Work JSON v1 regardless of source, so the source
swaps underneath without touching the reader. File-based souls remain the fallback
until each Work is verified in its new home.

- **Phase 0 (this commit):** formalize Work JSON v1 on `works-ops/get` —
  absolute media URLs + `version` + content `checksum`. Pure addition; the
  current reader keeps working (client `absUrl()` is idempotent on absolute URLs).
- **Phase 1:** slim `works` catalog collection (+ migration + `db-repair-locks` —
  the schema-rollout discipline) holding manifest/canonical/owner/subscribers and
  a pointer to its storage-of-record. No behavior change.
- **Phase 2:** materialize **document** Works as messages (one chapter = one
  message; `metadata.order`; `messageType: 'work_chapter'`; comments via
  `parentMessage`). `works-ops` assembles JSON from messages, file-fallback for
  the unmigrated. Verify Answer 53 first.
- **Phase 3:** remaining document Works; per-section comments light up.
- **Phase 4:** books/translations (WDEG: 26 pages × 17 langs) — decide
  per-language-channel vs. keep-on-manifest-reader. Migrate when resolved.
- **Phase 5:** subscription = channel replication/mirror; retire `subscriptions.ts`,
  `docs/vision`, and (eventually) `public/library`.

## Invariants

- The reader only ever speaks Work JSON v1. Never reaches into storage directly.
- Media is never embedded; always an absolute URL.
- Checksum is storage/origin-independent (content address).
- Nothing working is removed until its replacement is verified live on both nodes.
