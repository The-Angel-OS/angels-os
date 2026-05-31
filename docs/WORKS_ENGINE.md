# The Works Engine — Unified Document / Book / Soul Architecture

> *Design doc — convergence of SoulViewer + WDEG book viewer + Notion-clone applet + the
> "Young Lady's Illustrated Primer" page-flip vision into one extensible engine.*
> Status: **proposed** · Owner: Kenneth · Drafted Sprint 47

---

## The insight

SoulViewer, the WDEG book viewer, the Notion-clone applet, and the illustrated page-flip
are **not four features — they are one engine wearing four skins.** Each is a *versioned,
illustratable **Work*** with:

- **one editor** — Notion-style block editing, writing through the Dexie outbox (no Convex)
- **one reader** — the WDEG reader UX (Single / Complete / Auto modes, per-page
  illustration, i18n, print/PDF)
- **native versioning** — every save is an immutable version (Payload `versions` + drafts)
- **per-page illustration** — an image slot per page, fillable by the AI image pipeline
  (`resolveImageProvider()` in `ai-gateway.ts`, already shipped Sprint 44)

A "soul" is a Work of `type: 'soul'`. A book is `type: 'book'`. The Primer is `type:
'primer'` with auto-flip + on-demand generation. Same data, same editor, same reader —
different presets.

## Why this is mostly already built

| Capability the vision needs | What already exists |
|---|---|
| Store **every version** | Payload `versions: { drafts: true }` — proven on `Pages` & `Posts` |
| Block content + offline edits | Dexie outbox / sync layer (Nimue) — "blocks = Payload content + same Dexie layer" |
| Realtime without Convex | SSE (`leo-stream`) + short-poll (`useChat` depth=1) + Payload + Dexie |
| Per-page image generation | `resolveImageProvider()` — auto/OpenAI/Google/OpenRouter/Cloudflare |
| Elegant motion reader | framer-motion already heavy in `(dashboard)/dashboard/learn` |
| Multi-author / multi-tenant | multiTenantPlugin + Endeavors + membership tiers |

The work is **integration and abstraction**, not green-field.

## Data model

```
Works (collection, versions: { drafts: true })
  title, slug, type ('book'|'soul'|'autobiography'|'primer'|'manifest'),
  author (relationTo users), tenant, status, statusColor, tags[],
  cover (relationTo media), description,
  readerPreset ('casefile'|'devotional'|'primer'|'plain'),
  pages: relationship → WorkPages (ordered)   // or blocks field for simple works

WorkPages (collection, versions: { drafts: true })
  work (relationTo works), order, title,
  blocks[]  // Notion-style: paragraph, heading, image, quote, embed, callout, code…
  illustration (relationTo media),
  illustrationPrompt, illustrationProvider, illustrationStatus
```

Versioning is the collection's job, not ours. "Flip back through every version" = Payload's
version history UI + a reader affordance that reads `_status` / version timeline.

## The three shared pieces

1. **`<WorkReader work={...} preset={...} />`** — extracted from the WDEG/elegant-learn
   reader. Renders any Work. SoulViewer becomes `<WorkReader preset="casefile" />`; the
   book viewer is `<WorkReader preset="devotional" />`. Single/Complete/Auto modes,
   per-page illustration, i18n, print/PDF.
2. **`<WorkEditor />`** — the Notion-clone block editor (Spaces applet). Writes blocks to
   `WorkPages` via the Dexie outbox → Payload. Same sync layer Nimue uses; building one
   powers both.
3. **Illustration service** — `generatePageIllustration(pageId)` calls
   `resolveImageProvider()`, stores the result as Media, links it to the page. Manual
   button first; Auto/Primer mode generates on page-turn.

## Reader presets

| Preset | For | Behavior |
|---|---|---|
| `casefile` | souls (Rainmaker) | status chip, doc list, evidence tone |
| `devotional` | WDEG / Ready Player Everyone | chapter nav, per-chapter art, Single/Complete/Auto |
| `primer` | illustrated adaptive book | full-bleed page-flip, on-demand illustration, narration |
| `plain` | generic docs / autobiography | clean long-form reader |

## Phased path

**Phase 1 — Foundation (recommended first slice).**
Create `Works` + `WorkPages` collections with versioning. Migrate the Rainmaker soul out of
the hardcoded `src/souls/*` registry into `Works`. Refactor `SoulViewer.tsx` into the
generic `<WorkReader preset="casefile">` (read-only). *Outcome: SoulViewer is extensible and
versioned; new souls/books are data, not code; the `/learn` IA problem dissolves because the
Soul Viewer is now just one Work among many.*

**Phase 2 — Editor.** Notion-clone block editor as a Spaces applet, writing to `WorkPages`
through the Dexie outbox. Off Convex. Authors create/edit Works in-app.

**Phase 3 — Illustration.** Per-page illustration slot + "Illustrate this page" button →
`resolveImageProvider()` → persisted Media. Provider selectable per tenant (Sprint 44 config).

**Phase 4 — The Primer.** `primer` reader preset: full-bleed page-flip (framer-motion),
on-demand illustration generated as you turn, optional narration (Vapi/TTS), adaptive
sequencing. The "Young Lady's Illustrated Primer" realized.

## How this resolves the open /learn question

Once souls are Works, `/learn` IA is trivial:
- public `/learn` → elegant framer-motion onboarding (restored from `/dashboard/learn`)
- `/learn/works` (or `/library`) → list of public Works, including souls
- `/learn/works/[slug]` → `<WorkReader>` for any Work (Rainmaker souls included)

Single reader, single list, no special-casing. The Rainmaker case files keep their deep
links and tone (`casefile` preset) without owning the front door.

## Non-negotiables (carried from prior decisions)

- **No Convex.** Realtime = SSE + poll + Payload + Dexie; held sockets only behind an
  optional Liveblocks/Ably interface if true multiplayer cursors are needed.
- **Reuse the WDEG reader template** — do not rebuild reading UX from scratch.
- **Anonymous-first → identity-opt-in.** Reading is open; membership/paywall layers on top
  (radical hospitality: the door opens first).
- **Constitutional compliance** on every Work surface.

---

*The book viewer is the publishing platform. The Works engine is the book viewer generalized
to everything a community wants to author, version, illustrate, and read together.*
