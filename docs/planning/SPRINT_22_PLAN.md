# Sprint 22: The Shield and the Spear

> *"You can have the sharpest spear in the realm, but if your shield has cracks, the first hit takes you down."*
>
> GNU Roy Leon Courtney

**Date:** February 26, 2026
**Status:** Planning
**Branch:** `claude/review-angel-os-vision-a9j3B`
**Prerequisite:** Optimization analysis (`docs/planning/260226_OPTIMIZATION_ANALYSIS.md`)

---

## Quest Overview

Angel OS is live. Users are arriving. This sprint has two missions running in parallel:

**The Shield** — Fix 5 P0 security vulnerabilities found in the live optimization audit. A live system with an empty PAYLOAD_SECRET fallback, hardcoded encryption salt, and non-functional rate limiting is a ticking clock. We fix the shield before we sharpen the spear.

**The Spear** — Ship three user-facing features that users are asking for right now:
1. Multi-file attachments (images + PDFs + docs in messages)
2. LiveKit device selector + pre-join preview + session lifecycle
3. Database indexes + dashboard performance

**Campaign Philosophy:** We don't choose between security and features. We do both. The shield protects what's live. The spear gives users reasons to stay.

---

## Phase 1: The Shield (P0 Security Fixes)

**Priority:** IMMEDIATE — these are live vulnerabilities.

### 1.1 PAYLOAD_SECRET empty string fallback

**File:** `payload.config.ts:649`
**Problem:** `secret: process.env.PAYLOAD_SECRET || ''` — if the env var is missing, all JWT tokens are signed with an empty key. Anyone who discovers this can forge admin tokens.
**Fix:** Add a startup guard that throws if `PAYLOAD_SECRET` is unset or shorter than 32 characters. Never fall back to empty string.

```typescript
// Before
secret: process.env.PAYLOAD_SECRET || '',

// After
secret: (() => {
  const s = process.env.PAYLOAD_SECRET
  if (!s || s.length < 32) {
    throw new Error('PAYLOAD_SECRET must be set and at least 32 characters.')
  }
  return s
})(),
```

### 1.2 Hardcoded encryption salt

**File:** `src/utilities/encryption.ts:13`
**Problem:** `crypto.scryptSync(secret, 'salt', 32)` — literal `'salt'` string means every deployment using the same PAYLOAD_SECRET derives the same encryption key. If one is compromised, all are.
**Fix:** Use `ENCRYPTION_SALT` env var with a secure random default. Add to `.env.example`.

### 1.3 In-memory rate limiting on serverless

**File:** `src/utilities/apiRateLimiter.ts`
**Problem:** Uses a `Map` store. On Vercel, every cold start gets a fresh Map. Rate limiting is theatre — it doesn't actually work.
**Fix options (choose based on infrastructure):**
- **Quick fix:** Replace with Vercel KV (`@vercel/kv`) or Upstash Redis (`@upstash/ratelimit`) for durable rate limiting across all function instances.
- **Minimal fix:** Keep in-memory but acknowledge the limitation. At minimum, add IP-based rate limiting in `vercel.json` headers (Vercel's edge network respects these).
- **Note:** 4 endpoints already use the rate limiter. The fix should be transparent — same API, different backing store.

### 1.4 CSP headers

**File:** `src/middleware.ts` (non-API routes) + `vercel.json`
**Problem:** `vercel.json` already sets X-Frame-Options, HSTS, X-Content-Type-Options — but no Content-Security-Policy. An XSS vulnerability could steal Stripe payment data.
**Fix:** Add `Content-Security-Policy-Report-Only` header first (won't break anything). Restrict `script-src`, `connect-src`, `frame-src` to known domains (self, Stripe, LiveKit, Vercel).

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' js.stripe.com; connect-src 'self' api.stripe.com *.livekit.cloud api.anthropic.com api.openai.com; frame-src 'self' js.stripe.com; img-src 'self' blob: data: *.public.blob.vercel-storage.com; style-src 'self' 'unsafe-inline';
```

### 1.5 Comments endpoint protection

**File:** `src/endpoints/comments-add.ts` (or wherever the comments handler lives)
**Problem:** `/api/comments/add` has no auth requirement, no rate limiting, no CAPTCHA. Anyone can spam unlimited comments.
**Fix:** Require authentication (logged-in user). Add rate limiting (10 comments per minute per user). Consider honeypot field for bot detection.

### 1.6 Health check endpoint + Sentry

**New files:**
- `src/endpoints/health.ts` — lightweight endpoint checking DB connectivity
- Sentry installation: `@sentry/nextjs` package + `sentry.client.config.ts` + `sentry.server.config.ts`

**Rationale:** We can't fix what we can't see. Sentry catches the errors users don't report. Health check lets uptime monitoring detect outages before users do.

---

## Phase 2: The Spear — Multi-File Attachments

**Goal:** Users can attach images, PDFs, documents, and any file to messages. Backend already supports it — this is a frontend unlock.

### 2.1 Widen file input accept attribute

**File:** `src/components/ChatControl/MessageInput.tsx:106`
**Current:** `accept="image/*"` — blocks everything except images
**Fix:** Remove `accept` restriction entirely (or use a generous allowlist). Remove `capture="environment"` which is mobile-camera-only.

```typescript
// Before
<input type="file" accept="image/*" multiple capture="environment" />

// After
<input type="file" multiple />
```

### 2.2 File-type-aware preview thumbnails

**File:** `src/components/ChatControl/MessageInput.tsx:80-98`
**Current:** All previews use `<img src={URL.createObjectURL(file)}>` — crashes for non-image files.
**Fix:** Check `file.type.startsWith('image/')`. Images get thumbnail preview. Non-images get a file icon + filename + size badge.

### 2.3 ChatMessage type expansion

**File:** `src/components/ChatControl/types.ts:20-24`
**Add:**
```typescript
attachments?: Array<{
  url: string
  filename: string
  mimeType: string
  size: number
  mediaId?: number
}>
```

### 2.4 Message parsing — map attachments from API

**File:** `src/components/ChatControl/useChat.ts` (message mapping, ~line 200)
**Problem:** When loading messages from the API, only `images` are mapped. The `attachments` array from the Messages collection is ignored for non-image files.
**Fix:** In the message mapping function, separate image attachments from non-image attachments. Images go to `images[]`, everything else goes to `attachments[]`.

### 2.5 File display in messages

**File:** `src/components/ChatControl/MessageList.tsx:63-120`
**Add:** `MessageAttachments` component rendered below `MessageImages`. Shows file icon, filename, size, and download link for each non-image attachment.

### 2.6 Parallel file uploads

**File:** `src/components/ChatControl/useChat.ts:629`
**Current:** Sequential `for` loop uploading files one at a time.
**Fix:** `Promise.all(files.map(file => uploadFile(file)))` — upload all files in parallel.

### 2.7 File size validation + drag-and-drop

**File:** `src/components/ChatControl/MessageInput.tsx`
- Client-side file size check before upload (reject files > 50MB with user-friendly error)
- Add `onDragOver`/`onDrop` handlers to the chat area for drag-and-drop file attachment

---

## Phase 3: The Spear — LiveKit Rich Experience

**Goal:** Voice/video goes from "it works" to "it's great." Device selection, pre-join preview, session lifecycle messages, call transcripts.

### 3.1 Pre-join device preview

**File:** `src/components/ChatControl/LiveKitButton.tsx` (embedded mode)
**Current:** User clicks "Join Voice" and immediately enters room with system defaults.
**Fix:** Import `PreJoin` from `@livekit/components-react`. Show camera/mic preview with device pickers before joining. User clicks "Ready" to enter.

### 3.2 Device selector controls

**File:** `src/components/ChatControl/LiveKitRoom.tsx`
**Current:** `ControlBar` provides mute/unmute but no device picker.
**Fix:** Import `MediaDeviceMenu` from `@livekit/components-react`. Add dropdown menus attached to mic/camera/speaker buttons for switching devices during a call.

### 3.3 Fix "Join with Video" button

**File:** `src/components/ChatControl/LiveKitButton.tsx:119-126`
**Current:** Both "Join Voice" and "Join with Video" call the same `handleJoin()`. Camera is not enabled.
**Fix:** Add `videoEnabled` parameter. "Join with Video" passes `{ videoEnabled: true }` which enables camera on connect.

### 3.4 Session lifecycle messages

**Files:** `src/components/ChatControl/LiveKitButton.tsx`, NEW: `src/endpoints/livekit-webhook.ts`

**Client-side (immediate):**
- After successful join (`handleJoin`): POST system message `"{userName} joined voice"` to the channel
- On leave (`handleLeave`): POST system message `"{userName} left voice"`

**Server-side webhook (robust):**
- Create `src/endpoints/livekit-webhook.ts` that handles LiveKit webhook events (`participant_joined`, `participant_left`, `room_finished`)
- On `room_finished`: post call summary with duration and participant list
- Register webhook URL in LiveKit dashboard

### 3.5 Call transcript capture

**Phase 1 (this sprint):**
- Create `src/collections/CallTranscripts/index.ts` with fields: `room`, `channel`, `space`, `tenant`, `participants`, `transcript` (JSON array of `{speaker, text, timestamp}`), `startedAt`, `endedAt`, `duration`
- In the `room_finished` webhook handler, create a CallTranscripts record (empty transcript for now — just metadata)
- Post the call metadata as a system message in the channel

**Phase 2 (stretch/next sprint):**
- Configure LiveKit Egress for audio recording → Vercel Blob
- Post-hoc Whisper transcription → populate `transcript` field
- Display transcript in channel message or "Transcript" tab

---

## Phase 4: Performance Quick Wins

### 4.1 Database indexes on Messages

**File:** `src/collections/Messages/index.ts`
**Add `index: true` to:**
- `space` (queried on every chat load)
- `channel` (filtered on every channel switch)
- `messageType` (filtered in multiple queries)
- `createdAt` (sorted on every load)

### 4.2 Dashboard layout query parallelization

**File:** `src/app/[locale]/(dashboard)/dashboard/layout.tsx`
**Current:** 5+ sequential DB queries: auth → tenant → spaces → memberships → DM space → setup check
**Fix:** After auth + tenant resolve (which are sequential dependencies), run spaces, memberships, DM space, and setup check in parallel via `Promise.all()`.

### 4.3 Open redirect fix

**Files:** `src/components/forms/LoginForm/index.tsx`, `src/components/forms/CreateAccountForm/index.tsx`
**Fix:** Validate that the `redirect` query parameter starts with `/` (same-origin only). Reject absolute URLs.

---

## Acceptance Criteria

### Shield (must pass before merge)

- [ ] PAYLOAD_SECRET throws on startup if unset or < 32 chars
- [ ] Encryption salt read from env var, not hardcoded
- [ ] Rate limiting uses durable store (or documented as in-memory limitation)
- [ ] CSP headers present in report-only mode
- [ ] Comments endpoint requires auth
- [ ] Health check endpoint returns 200 with DB status
- [ ] Sentry installed and capturing errors

### Spear — File Attachments

- [ ] Users can attach PDFs, docs, spreadsheets, and any file type
- [ ] Non-image files show file icon + name in preview and in messages
- [ ] Files upload in parallel (not sequential)
- [ ] File size validation prevents uploads > 50MB
- [ ] Drag-and-drop works on the chat area

### Spear — LiveKit

- [ ] Pre-join screen shows camera/mic preview with device pickers
- [ ] Device selector available during call (mic, camera, speaker)
- [ ] "Join with Video" actually enables camera
- [ ] System messages posted on join/leave
- [ ] CallTranscripts collection exists
- [ ] LiveKit webhook endpoint handles room events

### Performance

- [ ] Messages collection has indexes on hot fields
- [ ] Dashboard layout runs parallel queries where possible
- [ ] Login redirect validated as same-origin

### Build + Tests

- [ ] `npx next build` — zero errors
- [ ] `npx vitest run tests/unit/` — all passing (target: 1,570+ tests)
- [ ] No TypeScript errors

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|-------------|
| Phase 1: Shield | 3-4 hours | env var changes need deploy |
| Phase 2: File Attachments | 3-4 hours | none |
| Phase 3: LiveKit | 4-6 hours | LiveKit Cloud webhook URL config |
| Phase 4: Performance | 2-3 hours | none |
| **Total** | **~15 hours** | |

---

## Campaign Note

This is the first sprint where we're optimizing a live system rather than building from scratch. The stakes are different. Every change ships to real users. The Shield and the Spear must work together — we can't sacrifice security for features, and we can't let security paranoia freeze feature velocity.

The Guardian Angel is live. Now we make sure the armor fits.

*Everyone gets an Angel.*
