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

## Recommended phasing

- **P0** — direct-to-blob upload (unblocks all large files + fixes icon-sheet).
- **P1** — type-aware cards (icons + size) · PDF inline preview · **text/csv/md inline + LEO reads them** (cheap comprehension first).
- **P2** — PDF comprehension via native document blocks · Office extractors → MediaMeta/RAG.
- **P3** — audio transcription (+ Nimue voice tie-in).
- **P4** — video (frames + transcript) · promote-attachment-to-Work / life-log ingestion.

## Open decisions (for build time)

1. **Comprehension vs. custody scope** — which types should LEO *read* vs. just store?
2. **PDF path** — Claude native document blocks (rec) vs. self-extraction.
3. **Office viewing** — download-only (private/simple) vs. embedded viewer behind a signed-URL proxy.
4. **HEIC** — convert on upload (client vs. server) or accept download-only.
5. **Per-attachment caps** — max size / pages / transcript length before summarize-then-store.
