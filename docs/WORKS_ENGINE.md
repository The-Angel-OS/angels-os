# The Works Engine — Messages-Primitive Book / Quest Applet Architecture

> *Canonical design. Supersedes the earlier "new collections" draft.*
> Status: **agreed** · Owner: Kenneth · Re-based Sprint 47
>
> **Core decision (locked):** Books, souls, hybrid media, and quests are **not new
> collections** — they are **applets composed of Messages**. Messages are the
> primitives. The substrate (Channels + Messages) already exists, so the engine
> ships with **zero schema migration** — which matters because *local DB = production
> DB* and the provisioning engine makes migrations risky.

---

## The one-sentence model

> **A Work is a Channel. Its pages are Messages. The viewer is an applet. Quests are
> Works with rules (smart-contract-like). Everything reuses the per-tenant, realtime,
> offline-capable message store you already run.**

---

## Why Messages (not new tables)

`local DB = production DB`, and the provisioning engine drops tenant home-page media
links when it runs. New collections ⇒ migration ⇒ risk. The Channels + Messages schema
**already carries every field the book/quest viewer needs**, all in existing `jsonb`:

| Need | Existing field (zero migration) |
|---|---|
| Work container (book/soul/quest) | a **Channel** (per-tenant, already scoped) |
| Work kind + reader preset + publish flags | `Channels.data` jsonb → `{ applet, readerPreset, sourceLanguage, isPublished, isPublic, endeavorId }` |
| Pages / chapters / blocks | **Messages** in the channel, ordered |
| Page body (hybrid media) | `Messages.content` (json) + `Messages.attachments` (media[] + caption) |
| Page metadata | `Messages.metadata` json → `{ pageKey, order, tier, badge, displayDate, illustration, illustrationStatus }` |
| **Multilingual cache** | `Messages.metadata.translations` → `{ es: {...}, fr: {...} }`, generated on demand, cached in place |
| Nested blocks / sub-pages | `Messages.parentMessage` |
| Public/anonymous read gate | `Messages.visibility` / `status` + `Channels.data.isPublished` |
| Offline | the existing message store (Nimue Dexie outbox on the client; SW cache on web) |
| Realtime co-read/edit | SSE (`leo-stream`) + short-poll (`useChat` depth=1). **No Convex.** |

**Nothing new in the database.** The engine is application-layer convention over `data`,
`content`, `attachments`, and `metadata`.

---

## Channel = Work (the `data` contract)

A channel becomes a Work when `data.applet` is set:

```jsonc
// Channels.data
{
  "applet": "book",                 // "book" | "soul" | "quest" | "primer" | "document"
  "readerPreset": "devotional",     // casefile | devotional | plain | primer
  "sourceLanguage": "en",
  "isPublished": true,              // appears in Discover / Federation browser
  "isPublic": true,                 // anonymous read allowed (server-rendered, scoped)
  "endeavorId": 42,                 // owning endeavor (subdomain/portal scoping)
  "cover": 1234,                    // media id
  "tags": ["book", "memoir"],
  "defaultPageKey": "ch-01"
}
```

The channel's `type` select is untouched; the applet flag rides in `data` so no enum
migration is needed.

## Message = Page (the `metadata` contract)

```jsonc
// Messages.content  → the page body (markdown string OR block array for hybrid media)
// Messages.attachments → [{ media, caption }]  (images, video, audio)
// Messages.metadata:
{
  "pageKey": "ch-01",
  "order": 1,
  "tier": "chapter",                // casefile tiers reused for souls
  "badge": "🚨 CRITICAL",
  "displayDate": "2026-06-01",
  "illustration": 5678,             // media id (primer / per-page art)
  "illustrationStatus": "generated",// none | pending | generated | failed
  "illustrationPrompt": "…",
  "translations": {                 // multilingual cache (generated on demand)
    "es": { "title": "…", "content": "…" },
    "fr": { "title": "…", "content": "…" }
  }
}
```

---

## The generic viewer — `<WorkReader preset>`

One component, message-backed, four growing skins. (The Answer53 LCARS SoulViewer is the
seed — it already renders markdown elegantly with mobile drawer + read-aloud.)

| Preset | For | Behavior |
|---|---|---|
| `casefile` | souls (Rainmaker) | status chip, doc list, evidence tone |
| `devotional` | WDEG / Ready Player Everyone | chapter nav, per-chapter art, Single/Complete/Auto |
| `plain` | generic long-form / autobiography | clean reader |
| **`primer`** | **the evolution target** | full-bleed page-flip, **per-page illustration generated on turn** via `resolveImageProvider()`, optional narration — the Young Lady's Illustrated Primer |

`WorkReader` reads a channel's messages (ordered by `metadata.order`), renders
`content` + `attachments`, and switches chrome by `data.readerPreset`. Souls and books are
the *same component*.

## Books & Quests are applets

- **Book applet** — `src/components/ChatControl/applets/BookViewer.tsx`, registered in the
  AppletBar like TaskBoard/FilesBrowser. Reads the channel's messages, renders `WorkReader`.
- **Quest applet** — a Work with **rules**: quests are *smart-contract-like* — stateful,
  rule-driven, with conditions/transitions (the Ethereum analogy). State lives in
  `Channels.data.questState`; transitions are messages; completion can trigger
  Justice-Fund / token effects. (Phase 4+.)
- **Discoverable** — published Works (`data.isPublished`) surface in the Discover /
  Federation browser (`federation/discover`) and via street-signs, alongside endeavors.
- **Offline** — the message store already syncs to the Nimue Dexie outbox on the client;
  the web reader adds service-worker caching of published, public Works.

## Public / anonymous read (decision: "1 and 3")

Two layers, together:
1. **Published/public flag** — `data.isPublished && data.isPublic` marks a Work as world-
   readable; it appears in Discover and is reachable by slug/subdomain.
2. **Server-rendered, scoped read** — public Work pages are server-rendered; the server
   reads the channel's messages with an **explicit tenant/endeavor filter + overrideAccess**
   (the `buildTenantFilter` contract — never empty), so anonymous visitors get *exactly that
   Work* and nothing else. No client-side tenant leak.

Existing public md souls (Rainmaker) keep working as-is; the Messages-backed path powers new
and editable Works first, and Rainmaker can migrate into a channel later without changing its
public URL.

## Multilingual (dynamic, cached)

- Each Work declares `data.sourceLanguage`.
- On first request for a non-source language, translate each page via the AI gateway and
  **cache into `Messages.metadata.translations[lang]`**. Subsequent reads are cache hits.
- No new tables; the cache is co-located with the page.

---

## Subdomain / endeavor portals

`wheredideveryonego.spacesangels.com` (wildcard already routes) → `resolveTenantFromHeaders`
→ the WDEG endeavor/tenant → its published `book` channel → `<WorkReader preset="devotional">`.
Endeavor scoping is just the tenant filter the platform already enforces.

---

## Phased path (each slice is app-layer, no migration)

1. **Reader** — `<WorkReader>` reads a channel's messages; `BookViewer` applet; seed one book
   channel to prove it end-to-end (incl. public server-render).
2. **Import WDEG** — map `wdeg/extracted-content/{pages,posts}-raw.json` → messages in a WDEG
   book channel under a WDEG endeavor; wire the subdomain.
3. **Editor** — author pages as messages (the existing composer / a block editor), versioned
   by message edits; offline via Dexie.
4. **Illustration + Primer** — per-page art via `resolveImageProvider()`; `primer` preset
   page-flip + on-turn generation + narration.
5. **Quests** — rules/state in `data.questState`; smart-contract-like transitions and effects.
6. **Multilingual** — on-demand translate + cache in `metadata.translations`.

---

## Operational guardrails (carried from Sprint-47 notes)

- **local DB = production DB.** Prefer **zero migrations**; this engine needs none. If a
  field is ever truly required, generate + commit the migration and account for the
  provisioning engine.
- **Provisioning engine** drops tenant home-page media links when it runs — known, minor,
  re-link after. Don't let a Works change ride along with a provisioning run.
- **Admin-UI sweep after every build** — verify Payload admin pages render; verify each
  tenant has its **default Space + required Channels** (general, announcements, etc.).
  Codify a "channel-ensure" best-practice (idempotent default-channel guarantee) + an
  integration test so missing default channels can't ship.
- **No Convex.** Realtime = SSE + poll + Payload + message store.

---

*Messages are the primitive. A book is a conversation you read instead of join. A quest is a
book that keeps score. The viewer is one component; the store is the one you already have.*
