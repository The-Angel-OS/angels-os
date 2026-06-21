# Chat Attachments — Common File Types Roadmap

> Status: **planning** (discuss-don't-implement, authored 2026-06-21). Captures how the
> chat/media attachment pipeline should handle the full range of common file types —
> not just images. No code committed from this doc.

## Baseline — what already works (2026-06-21)

- **Upload + storage accept any type.** The `media` collection has no MIME restriction,
  so any file already uploads and stores via the `messages_attachments` path (the one
  fixed by the two-phase write, commit `78b6996` — see [[project_leo_empty_response]]).
- **Display degrades gracefully.** `ChatControl/useChat.ts` (`mapMessage`) and
  `applets/FilesBrowser.tsx` split image vs non-image: images render inline + open the
  lightbox; everything else gets a generic file card with filename + Open/Download.
- **Images are fully wired:** inline render, multi-image lightbox (`ImageLightbox.tsx`,
  centering fixed `5d78fca`), and LEO vision via `/api/leo/stream` image blocks.

So **custody (store + card + download) works today for every type.** The gaps are
**large-file upload**, **viewing**, and **LEO comprehension**.

## Retrieval / RAG — how it works TODAY (verified 2026-06-21)

NOT the Payload search plugin (not installed). It's a **custom MediaMeta RAG layer**:

1. **Ingest/analyze** — `autoAnalyzeMedia` → `buildMediaMeta` (`utilities/mediaAnalysis.ts`)
   creates a **`MediaMeta`** record per attachment: vision description, **OCR text**,
   entities (people/places/dates/orgs), summary, tags. PDFs = one record per page,
   linked by `documentGroup`.
2. **Index** — `MediaMeta/hooks/ragIndexHook.ts` fires on `status: complete`:
   concatenates the text, **chunks it ~500 tokens w/ 100 overlap** into `ragChunks`,
   sets `ragIndexed: true`.
3. **Retrieve** — LEO tool **`query_knowledge`** (`leo-data-tools.ts`) searches MediaMeta
   across vision/OCR/entities/tags. (This is what made a scanned **resume** searchable.)

**Key facts:**
- **Lexical, not semantic — NO embeddings / NO pgvector yet.** Retrieval is keyword/text
  matching. The scaffolding for vectors exists (`ragChunks`; the hook says
  `// Future: generate vector embeddings and store in pgvector column`) — just unwired.
  **Adding embeddings + pgvector is the single biggest RAG-quality upgrade and the
  groundwork is already laid.**
- **Tenant-gated by the COLLECTION** (MediaMeta is multi-tenant scoped; `query_knowledge`
  runs in tenant context) — not by a search plugin. Isolation is correct.
- **Payload search plugin** (`@payloadcms/plugin-search`) is complementary, for a
  *different* job: a flat lexical index powering **dashboard search bars** across
  products/posts/pages (tenant-gated). Worth adding for general search; NOT the RAG path.

## Decisions — RESOLVED 2026-06-21 (Ken)

- **Ship behind per-type feature flags, DISABLED BY DEFAULT** — build the pipeline in but
  off, enable per type as validated. **EXCEPTION: audio transcription = must-have, ship
  ENABLED.**
- **Audio is the priority feature.** Add an **audio-recorder button to BOTH Nimue and Core
  chat**, and bring **Nimue to full parity with Core** (Core already has per-message
  read-out-loud / TTS; Nimue needs read-out-loud AND record). Voice in → STT → text +
  LEO; text out → TTS read-aloud. This is the near-term build, not a someday item.
- **Comprehension vs custody scope:** STORE = zip, docx, pdf (**under a size cap — no
  giant PDFs**; primary function is utility, not archival). READ/EXTRACT (typical office +
  text) = **txt, md, csv, xls/xlsx, docx, pdf**.
- **PDF/extraction processing location:** the open question is *where extraction runs*
  (serverless is constrained). **Offload heavy/long processing to Merlin** — Merlin is the
  catch-all client/worker for Core; it can run demanding jobs (and the big TODO:
  **YouTube/Rumble account → posts sync**). Serverless does light/inline extraction; Merlin
  does the heavy lifting. PDF comprehension still prefers Claude **native document blocks**
  (no temp-storage/extraction needed) where size allows.
- **Office viewing:** maximize functionality **but YAGNI + apply Answer 53** (elegance) —
  don't build the heavyweight conversion/embedded-viewer stack until it earns its place;
  download-only + PDF-preview is the elegant default.
- **HEIC:** **convert on upload** — this IS the document-processing pipeline being extended
  (it was planned to cover exactly this case). HEIC→JPEG/WebP at ingest.
- **Per-attachment caps:** reasonable, **within Vercel limits**. **MUST meter everything**
  (bytes stored, pages/tokens processed, STT minutes, model spend) to refine billing and
  keep the platform sustainable — ties to the cost/telemetry rails ([[project_ai_provider_system]]).

## The three handling tiers

Every type sits in one of three tiers. The roadmap is about moving types up tiers.

| Tier | Meaning | Today |
|---|---|---|
| **Custody** | store + show a card + download | ✅ all types |
| **Display** | inline preview / player in chat + Files | ✅ images only |
| **Comprehension** | LEO actually *reads/understands* the content | ✅ images (vision) only |

## P0 — Large-file upload (gating prerequisite for everything)

Vercel serverless body cap is ~4.5 MB. Images squeak under it; real PDFs/PPTX/video do
not — this is the **same root** as the icon-sheet `No files were uploaded` error.

**Fix: direct-to-blob upload** — client requests a presigned Vercel Blob URL, uploads
straight to storage, then posts only the media reference (bypassing the serverless body
limit). Nothing else on this roadmap is reachable for non-trivial files until this
exists, and it **closes the icon-sheet bug for free.** Do this first regardless of type.

## Per-type matrix

### Images — `jpg png webp gif`
- Status: ✅ all tiers. **Gap:** **HEIC** (iPhone default) isn't browser-renderable —
  needs client- or server-side conversion to JPEG/WebP on upload, or it lands as a
  download-only card.

### PDF — `pdf`
- **Display:** browser-native or pdf.js inline preview (self-contained, private-safe).
- **Comprehension (recommended path):** Claude's **native PDF `document` content block**
  — the Anthropic API ingests a PDF directly (text + layout, ~32 MB / 100 pages), **no
  extraction library**. Cheapest, highest-fidelity route. Branch in `leo-stream`:
  `pdf → document block`.

### Office documents — `docx xlsx pptx`
- Browsers can't render these natively. **Display options:** download-only (v1, fine);
  embedded Office/Google viewer iframe (zero infra **but** requires the file be publicly
  fetchable by MS/Google → breaks tenant privacy unless proxied behind a short-lived
  signed URL); or server-side LibreOffice→PDF conversion (heavy, needs a worker — not
  serverless-friendly). **Rec:** download-only for Office, inline preview for PDF only.
- **Comprehension (extract → text block):**
  - `docx` → **mammoth** → text/markdown.
  - `xlsx` → **SheetJS** → CSV/markdown per sheet.
  - `pptx` → slide-text extractor → text.

### Plain text & data — `txt md csv json + code files (.ts .py .json …)`
- **Cheapest comprehension win.** Read as UTF-8 text, render in a code/markdown block in
  chat, and feed the raw text straight to LEO (no parsing libs, no vision). CSV doubles
  as a lightweight spreadsheet. Likely the **first** comprehension tier to ship.

### Audio — `mp3 wav m4a ogg`
- **Display:** inline `<audio>` player.
- **Comprehension:** speech-to-text (Whisper / provider STT) → transcript → text block.
  Ties directly into Nimue voice and [[project_nimue_lifelog_ingestion]].

### Video — `mp4 mov webm`
- **Display:** thumbnail + inline `<video>` player.
- **Comprehension (heavy, defer):** sample frames → vision, and/or extract audio →
  transcript. Largest cost/infra footprint — last priority.

### Archives & other — `zip` + unknown binaries
- Custody only: store + download. Optional: list ZIP contents. No comprehension. Generic
  card for anything unrecognized.

## LEO comprehension routing (the core new logic)

`/api/leo/stream` currently sends images as **vision** blocks. Comprehension generalizes
the attachment→model mapping by type:

```
image  → vision block            (today)
pdf    → Anthropic document block (native, no lib)
office → extract (mammoth/SheetJS/pptx) → text block
text   → raw text block          (trivial)
audio  → STT transcript → text block
video  → frames→vision + audio→transcript   (defer)
```

Extracted text/transcripts feed the existing `autoAnalyzeMedia → mediaAnalysis →
MediaMeta` pipeline (its docstring already anticipates "PDFs → MediaMeta") → **RAG**
knowledge base, and can be promoted into **Works** (the publishing layer) or a life-log
entry. A dropped PDF becoming searchable tenant knowledge is the payoff.

## Cross-cutting concerns

- **Cost rails.** Big PDFs / long transcripts = real tokens. The ai-gateway
  budget/tiering already exists ([[project_ai_provider_system]]); add per-attachment
  size/page caps and a "summarize-then-store" option for very large docs.
- **Privacy.** Tenant media is scoped; any *embedded third-party viewer* (MS/Google) must
  go through a signed-URL proxy, never a raw public link.
- **Safety.** Office files may carry macros — we store/extract, never execute. Consider a
  malware-scan hook before comprehension for untrusted tenants (out of scope v1).
- **Type detection.** Trust server-sniffed MIME, not the client extension; drives the
  card icon, the viewer choice, and the comprehension branch.

## Recommended phasing (revised per 2026-06-21 decisions)

Everything ships behind per-type feature flags **disabled by default**, EXCEPT audio
(ship enabled). Usage metering is built in from P0 (billing/sustainability).

- **P0** — direct-to-blob upload (unblocks all large files + fixes icon-sheet) · **usage
  metering hooks** (bytes/pages/tokens/STT-minutes/model-spend).
- **P1 — AUDIO (must-have, enabled):** audio-recorder button in **Nimue + Core** chat ·
  **Nimue↔Core voice parity** (per-message read-out-loud/TTS both sides) · STT transcript
  → text + LEO · inline `<audio>` player.
- **P2** — type-aware cards (icons + size) · PDF inline preview · **text/csv/md inline +
  LEO reads them** (cheapest comprehension).
- **P3** — PDF comprehension via Claude native document blocks · Office extractors
  (docx/xlsx/csv → text) → MediaMeta/RAG · **HEIC convert-on-upload** · heavy/long jobs
  **offloaded to Merlin**.
- **P4 — RAG upgrade:** wire **embeddings + pgvector** for semantic retrieval (scaffolding
  already exists in `ragChunks`) · optionally add Payload search plugin for dashboard search.
- **P5** — video (frames + transcript) · promote-attachment-to-Work / life-log ingestion ·
  Merlin YouTube/Rumble → posts sync.

## Open decisions — RESOLVED

See "Decisions — RESOLVED 2026-06-21" above. Summary: ship flag-gated/off (audio on);
store zip/docx/pdf-under-cap, read txt/md/csv/xls/docx/pdf; offload heavy processing to
Merlin; PDF via native document blocks; Office = YAGNI/Answer-53 (download + PDF preview);
HEIC convert-on-upload; meter everything within Vercel limits.
