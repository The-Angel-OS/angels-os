# Angel OS Live Optimization Analysis

**Date:** February 26, 2026
**Status:** LIVE — optimizing for production quality
**Branch:** `claude/review-angel-os-vision-a9j3B`
**Audited by:** 3 parallel code audit agents + manual review of 30+ source files

---

## Executive Summary

Angel OS is live. The core user journey works: landing page → signup → login → dashboard → LEO chat → provisioning. This analysis identifies **what needs to be built or improved** across three priority areas the user flagged, plus a broader production optimization sweep.

**Priority 1 — Multi-file/image attachments:** Backend is complete; frontend needs 2 targeted changes.
**Priority 2 — LiveKit optimization:** Components exist but are MVP; needs device selector, session lifecycle events, and transcript capture.
**Priority 3 — Production hardening:** No CSP headers, no rate limiting, no error tracking. These are the things that cause 3am incidents.

---

## 1. Multi-File & Image Attachments in Messages

### Current State

| Layer | Status | Location |
|-------|--------|----------|
| Messages schema `attachments` array field | Working | `src/collections/Messages/index.ts:225` |
| `useChat.sendMessage()` accepts `File[]` | Working | `src/components/ChatControl/useChat.ts:599` |
| Upload flow (FormData → `/api/media`) | Working | `src/components/ChatControl/useChat.ts:627-647` |
| `chat-send` endpoint passes attachments | Working | `src/endpoints/chat-send.ts:114-118` |
| Auto-analyze media hook (OCR, vision) | Working | `src/collections/Messages/hooks/autoAnalyzeMedia.ts` |
| Image grid display + lightbox | Working | `src/components/ChatControl/MessageList.tsx:63-120` |
| Image preview thumbnails in input | Working | `src/components/ChatControl/MessageInput.tsx:77-99` |

### What's Broken

The file input only accepts images:

```html
<!-- src/components/ChatControl/MessageInput.tsx:106 -->
<input type="file" accept="image/*" multiple capture="environment" />
```

**Problem:** `accept="image/*"` blocks PDFs, documents, spreadsheets, text files — anything that isn't an image.

### What's Missing for Full File Support

| # | Change | File | Effort |
|---|--------|------|--------|
| 1 | **Widen `accept` attribute** — remove `image/*` restriction, accept common file types | `MessageInput.tsx:106` | 1 line |
| 2 | **File type preview** — thumbnail row currently uses `URL.createObjectURL()` with `<img>` for all files; non-image files need icon-based previews (PDF icon, doc icon, etc.) | `MessageInput.tsx:80-98` | ~30 lines |
| 3 | **File display in messages** — `MessageImages` component only renders `<img>` tags; needs a parallel `MessageAttachments` component for non-image files (download links, file type icons, file size) | `MessageList.tsx:63-120` | ~50 lines |
| 4 | **ChatMessage type** — add `attachments` field alongside `images` for non-image files | `types.ts:20-24` | ~8 lines |
| 5 | **Message parsing** — when loading messages from API, map `attachments` from the Messages schema to the ChatMessage type (currently only images are mapped) | `useChat.ts` (message mapping ~line 200) | ~15 lines |
| 6 | **File size validation** — prevent uploading files larger than the configured limit (currently no client-side check) | `MessageInput.tsx` | ~10 lines |
| 7 | **Drag-and-drop** — allow dropping files onto the chat area (currently only clipboard paste works for images, if at all) | `MessageInput.tsx` or parent | ~30 lines |

### Implementation Priority

**Quick win (30 min):** Items 1-2. Change `accept` to allow all common file types, add file-type-aware previews in the thumbnail row. This alone enables multi-file attachment.

**Full polish (2-3 hours):** Items 3-7. Non-image file display in messages, type mapping, file size validation, drag-and-drop.

---

## 2. LiveKit Optimization

### Current State

| Component | Status | Location |
|-----------|--------|----------|
| `LiveKitRoom` — video grid + controls | MVP working | `src/components/ChatControl/LiveKitRoom.tsx` |
| `LiveKitButton` — join/leave + embedded mode | MVP working | `src/components/ChatControl/LiveKitButton.tsx` |
| Token endpoint — JWT generation | Working | `src/endpoints/livekit-token.ts` |
| Room naming — `{tenant}-{space}-{channel}` | Working | `livekit-token.ts:70-74` |
| Membership verification | Working | `livekit-token.ts:80-107` |
| Three render modes (floating, fullscreen, embedded) | Working | `LiveKitRoom.tsx` |
| Screen sharing | Working (fullscreen only) | `LiveKitRoom.tsx:238` |

### Installed packages

```
@livekit/components-react    — React component library
@livekit/components-styles   — Default theme
livekit-client               — Browser SDK
livekit-server-sdk           — Server-side token generation
```

### What's Missing

#### A. Device Selector Controls

**Current:** No device selection UI. Users get the system default mic/camera with no way to switch. The `ControlBar` from `@livekit/components-react` provides mute/unmute but no device picker.

**Needed:**

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **MediaDeviceMenu** — camera/mic/speaker picker dropdown | Import `MediaDeviceMenu` from `@livekit/components-react` and render it in the room header bar or as a dropdown attached to the mic/camera buttons |
| 2 | **Pre-join device check** — preview camera/mic before joining | Import `PreJoin` from `@livekit/components-react` to show a pre-join screen with device preview, name input, and ready button |
| 3 | **Settings gear button** — persistent access to device settings during call | Custom button in the header bar that opens a `MediaDeviceMenu` panel |
| 4 | **Audio output selector** — speaker/headphone picker | `MediaDeviceMenu` supports `kind="audiooutput"` — render it near the audio controls |

**LiveKit React SDK already provides these components.** The work is mostly wiring them into the existing `LiveKitRoom.tsx` layout.

#### B. Session Lifecycle Events (Enter/Leave Messages)

**Current:** No messages are posted when a user joins or leaves a voice channel. The `handleJoin` and `handleLeave` callbacks only update local React state.

**Needed:**

| # | Event | Implementation |
|---|-------|----------------|
| 1 | **"Entered channel" message** — posted to the channel when a user joins voice | In `LiveKitButton.handleJoin()` after successful token fetch, call `POST /api/chat/send` with `messageType: 'system'` and content like `"🎙 {userName} joined voice"` |
| 2 | **"Left channel" message** — posted when a user leaves | In `LiveKitButton.handleLeave()` or `LiveKitRoom.handleDisconnect()`, call the same endpoint with `"🎙 {userName} left voice"` |
| 3 | **Server-side webhook** — LiveKit sends room events (participant_joined, participant_left, room_finished) to a webhook endpoint | Create `src/endpoints/livekit-webhook.ts` that receives LiveKit webhook events and creates system messages. This is more reliable than client-side because it handles browser crashes, network drops, etc. |
| 4 | **Room duration tracking** — record start/end times for billing/analytics | Store in a `CallSessions` collection or in the channel metadata |

**Recommended approach:** Server-side webhook (item 3) is the right solution. Client-side messages (items 1-2) are simpler but unreliable — if the user closes their browser, no "left" message gets posted.

#### C. Call Transcription

**Current:** No transcription. LiveKit supports real-time transcription via their Agents framework (STT → text).

**Needed:**

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | **LiveKit Egress** — record audio from the room | Configure LiveKit server to run Egress on room start. Audio gets saved to S3/Vercel Blob. Requires LiveKit Cloud or self-hosted with Egress service. |
| 2 | **LiveKit STT Agent** — real-time speech-to-text | Deploy a LiveKit Agent (Python) that joins the room, runs Deepgram/Whisper STT, and publishes transcription data events. The client subscribes to these events. |
| 3 | **Transcript collection** — store transcripts | Create `src/collections/CallTranscripts/index.ts` with fields: `room`, `channel`, `space`, `tenant`, `participants`, `transcript` (array of `{speaker, text, timestamp}`), `startedAt`, `endedAt`, `duration`. |
| 4 | **Transcript UI** — display transcripts | Add a "Transcript" tab or expand the call summary message to include the transcript text. |
| 5 | **Post-call summary** — when room ends, post the transcript as a message | The LiveKit webhook handler (from 2B.3) creates a summary message with the transcript when `room_finished` fires. |

**This is the biggest lift.** Real-time STT requires a LiveKit Agent deployment (separate service). Post-hoc transcription (recording → Whisper) is simpler but not real-time.

**Recommended phased approach:**
- **Phase 1:** Record audio via LiveKit Egress → store in Blob Storage
- **Phase 2:** Post-hoc transcription via Whisper API → store in CallTranscripts collection → post summary message to channel
- **Phase 3:** Real-time STT via LiveKit Agent (Deepgram) → live captions in the room UI

---

## 3. Production Optimization

### 3A. Security (CRITICAL for live system)

| # | Severity | Issue | Current State | Fix |
|---|----------|-------|---------------|-----|
| 1 | **P0** | **PAYLOAD_SECRET falls back to empty string** | `payload.config.ts:649` — `secret: process.env.PAYLOAD_SECRET \|\| ''`. If env var is missing, all JWT tokens are signed with empty key → anyone can forge admin tokens. | Throw at startup if PAYLOAD_SECRET is unset or < 32 chars. Never fall back to `''`. |
| 2 | **P0** | **Hardcoded encryption salt** | `src/utilities/encryption.ts:13` — `crypto.scryptSync(secret, 'salt', 32)`. Literal `'salt'` weakens derived key. | Use per-deployment random salt from env var. |
| 3 | **P0** | **In-memory rate limiting on serverless** | `src/utilities/apiRateLimiter.ts` uses `Map` store. On Vercel each cold start gets a fresh Map → rate limiting is non-functional. Expensive LLM endpoints are unprotected. | Use Vercel KV / Upstash Redis for durable rate limiting. |
| 4 | **P0** | **No CSP headers** | `vercel.json` sets X-Frame-Options, HSTS, etc. but no Content-Security-Policy. XSS could steal Stripe payment data. | Add CSP header (report-only mode first), restrict script-src, connect-src, frame-src. |
| 5 | **P0** | **Comments endpoint unprotected** | `/api/comments/add` — no auth, no rate limiting, no CAPTCHA. Anyone can spam unlimited comments. | Add rate limiting by IP and reCAPTCHA verification. |
| 6 | **P1** | **Open redirect in `?redirect=`** | Login pages accept arbitrary `redirect` parameter | Validate that redirect URL starts with `/` (same-origin only). |
| 7 | **P1** | **Federation ping unauthenticated** | `federation-ping.ts` — signature verification is non-fatal. Anyone can register entries. | Require valid Ed25519 signatures in production. |
| 8 | **P1** | **Most endpoints lack rate limiting** | Only 4 of ~50 endpoints have rate limiting (leo_chat, leo_stream, spaces_create, stripe_connect_onboard) | Apply rate limiting to all state-mutating endpoints. |
| 9 | **P1** | **No email verification on signup** | Users can create accounts with any email | Add email verification flow. |
| 10 | **P1** | **14-day token expiration** | `Users/index.ts:29` — `tokenExpiration: 1209600` (14 days). Compromised token = 2-week window. | Consider 24-48 hours with refresh token rotation. |
| 11 | **P2** | **`overrideAccess: true` everywhere** | 125+ instances in LEO tools and system endpoints | Audit each. Many are correct but some may bypass tenant isolation. |

### 3B. Performance

| # | Severity | Issue | Current State | Fix |
|---|----------|-------|---------------|-----|
| 1 | **P1** | **Missing DB indexes on Messages** | Zero explicit indexes on `space`, `channel`, `messageType`, `createdAt` — all queried on every chat load. Full table scans as volume grows. | Add `index: true` to hot fields. |
| 2 | **P1** | **N+1 query in Messages access control** | Every message read triggers a separate membership lookup query | Cache memberships per-request or per-session. |
| 3 | **P2** | **Dashboard layout 5+ sequential DB queries** | `layout.tsx` runs auth → tenant → spaces → memberships → DM space → setup check sequentially | Parallelize independent queries with `Promise.all()`. |
| 4 | **P2** | **No ISR/SSG for public pages** | Home, posts, events are fully SSR (headers() makes them dynamic) | Add `revalidate` for static-friendly pages. Separate draft mode logic. |
| 5 | **P2** | **DB pool size 3 on Vercel** | `payload.config.ts:168` — `max: 3` connections per serverless function. Under concurrent load with multiple instances, connection exhaustion is likely. | Use connection pooler (Neon pgBouncer) or increase to 5 with idle timeout. |
| 6 | **P2** | **Sequential file uploads** | `useChat.ts:629` — files uploaded one-at-a-time in a for loop | Upload in parallel with `Promise.all()`. |
| 7 | **P3** | **Large client-side deps** | `recharts` (~400KB), `livekit-client` (~200KB) — if not dynamically imported, they bloat initial bundle | Dynamic imports for heavy components. |

### 3C. Reliability

| # | Severity | Issue | Current State | Fix |
|---|----------|-------|---------------|-----|
| 1 | **P1** | **No error tracking (Sentry)** | `global-error.tsx` mentions Sentry but SDK is **not installed**. No `@sentry/nextjs` in package.json. All production errors are lost. | Install `@sentry/nextjs`, configure source maps. |
| 2 | **P1** | **No health check endpoint** | No `/api/health` for uptime monitoring or load balancers | Create lightweight endpoint checking DB connectivity. |
| 3 | **P2** | **No React error boundary** | No `ErrorBoundary` in dashboard layout → errors cause white screen | Add boundaries at layout and page level. |
| 4 | **P2** | **Email poll blocks on LLM** | `email-poll.ts` processes up to 10 emails per poll, calling LLM inline for each. 10 × 5s = 50s → near Vercel function timeout. | Queue LLM responses async or add per-email timeout. |
| 5 | **P2** | **leo-stream reads .env files at runtime** | `leo-stream.ts:72-101` — fallback reads `.env.local` from filesystem. Fragile on serverless. | Remove file-reading fallback, rely solely on env vars. |
| 6 | **P3** | **Unstructured logging** | All `console.log`/`console.error` with ad-hoc prefixes. No correlation IDs. | Add structured JSON logger for production. |
| 7 | **P3** | **No retry logic for external calls** | Federation client defaults to 0 retries. No retry on Stripe, Resend, or LLM calls. | Add retry with exponential backoff for transient failures. |

### 3D. User Experience

| # | Issue | Current State | Fix |
|---|-------|---------------|-----|
| 1 | **No loading skeletons on dashboard** | Dashboard stat cards flash-in on load | Add skeleton placeholders. |
| 2 | **No "empty state" for new users** | New user with 0 spaces sees empty channel list | Add onboarding guidance. |
| 3 | **"Join with Video" button is cosmetic** | `LiveKitButton.tsx:119-126` — both buttons call same `handleJoin`. No camera-on behavior. | Add `videoEnabled` parameter and auto-enable camera on "Join with Video". |
| 4 | **No pre-join device preview** | Users go directly into room with no camera/mic test | Add `PreJoin` component from `@livekit/components-react`. |

---

## 4. Prioritized Roadmap

### Sprint A: P0 Security Fixes (IMMEDIATE — 1 day)

- [ ] Fix PAYLOAD_SECRET empty string fallback → throw at startup if unset/short
- [ ] Fix hardcoded encryption salt → use env var for salt
- [ ] Replace in-memory rate limiting with durable store (Vercel KV / Upstash)
- [ ] Add CSP headers (Content-Security-Policy-Report-Only first)
- [ ] Protect comments endpoint (rate limit + reCAPTCHA)
- [ ] Install `@sentry/nextjs` and connect error tracking
- [ ] Add `/api/health` endpoint

### Sprint B: File Attachments (1-2 days)

- [ ] Widen `accept` attribute in `MessageInput.tsx` to allow all common file types
- [ ] Add file-type-aware previews (icon for PDF/doc, thumbnail for images)
- [ ] Add `attachments` field to `ChatMessage` type
- [ ] Map attachments from API response in `useChat.ts`
- [ ] Add non-image file display in `MessageList.tsx` (download link + file icon)
- [ ] Add file size validation (client-side check before upload)
- [ ] Add drag-and-drop support for files
- [ ] Parallelize file uploads (currently sequential)

### Sprint C: LiveKit Device Selector + Session Events (2-3 days)

- [ ] Add `PreJoin` component for device preview before joining
- [ ] Add `MediaDeviceMenu` for camera/mic/speaker selection during call
- [ ] Add settings gear button to room header bar
- [ ] Fix "Join with Video" button to actually enable camera
- [ ] Post "joined voice" / "left voice" system messages to channel
- [ ] Create `src/endpoints/livekit-webhook.ts` for server-side room events
- [ ] Track call duration (start/end times) in channel metadata or new collection

### Sprint D: LiveKit Transcription (3-5 days)

- [ ] Configure LiveKit Egress for audio recording
- [ ] Create `CallTranscripts` collection
- [ ] Post-hoc transcription via Whisper API
- [ ] Post call summary + transcript as message when room ends
- [ ] (Stretch) Real-time STT via LiveKit Agent

### Sprint E: Performance + Reliability (2-3 days)

- [ ] Add `index: true` to Messages hot fields (space, channel, messageType)
- [ ] Cache space memberships per-request (fix N+1 on Messages reads)
- [ ] Parallelize dashboard layout DB queries
- [ ] Fix open redirect vulnerability in `?redirect=`
- [ ] Add React error boundaries at layout/page level
- [ ] Reduce token expiration from 14 days to 48 hours
- [ ] Add structured JSON logging
- [ ] Dynamic imports for heavy client-side dependencies (recharts, livekit-client)

---

## 5. File-by-File Change Map

### Multi-file Attachments

| File | Changes |
|------|---------|
| `src/components/ChatControl/MessageInput.tsx:106` | Change `accept="image/*"` to `accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.json"` or remove `accept` entirely |
| `src/components/ChatControl/MessageInput.tsx:80-98` | Add file-type detection: if `file.type.startsWith('image/')` render thumbnail, else render file icon + name |
| `src/components/ChatControl/types.ts:20-24` | Add `attachments?: Array<{ url: string; filename: string; mimeType: string; size: number; mediaId?: number }>` |
| `src/components/ChatControl/useChat.ts:~200` | When mapping API messages to ChatMessage, populate `attachments` from the message's `attachments` array |
| `src/components/ChatControl/MessageList.tsx:63-120` | Add `MessageAttachments` component below `MessageImages` for non-image files |

### LiveKit Optimization

| File | Changes |
|------|---------|
| `src/components/ChatControl/LiveKitRoom.tsx` | Import `MediaDeviceMenu`, `PreJoin` from `@livekit/components-react`. Add device selector UI. |
| `src/components/ChatControl/LiveKitButton.tsx:61-66` | After successful join, post system message to channel via `/api/chat/send` |
| `src/components/ChatControl/LiveKitButton.tsx:69-72` | On leave, post "left voice" system message |
| NEW: `src/endpoints/livekit-webhook.ts` | LiveKit webhook handler for room events (join/leave/finish) |
| NEW: `src/collections/CallTranscripts/index.ts` | Collection for storing call transcripts |

### Production Hardening

| File | Changes |
|------|---------|
| `src/middleware.ts:40-41` | Add CSP headers for non-API routes |
| NEW: `src/endpoints/health.ts` | Health check endpoint |
| `src/app/[locale]/(dashboard)/dashboard/layout.tsx` | Parallelize DB queries, add error boundary wrapper |
| `src/components/forms/LoginForm/index.tsx` | Validate `redirect` parameter is same-origin |
| `src/components/forms/CreateAccountForm/index.tsx` | Same redirect validation |

---

## 6. Key Metrics

| Metric | Current |
|--------|---------|
| Tests | 1,570 passing (36 files) |
| LEO Tools | 77 |
| Endpoints | 49 |
| Collections | 34 |
| Channel Types | 14 |
| LiveKit Components | 3 (LiveKitRoom, LiveKitButton, LiveKitButton.stories) |
| LiveKit Packages | 4 (@livekit/components-react 2.9.20, @livekit/components-styles 1.2.0, livekit-client 2.17.2, livekit-server-sdk 2.15.0) |
| `overrideAccess: true` instances | ~125 |
| CSP Headers | None |
| Rate Limiting | 4 of ~50 endpoints (in-memory only — non-functional on serverless) |
| Error Tracking | None (Sentry mentioned but not installed) |
| Email Verification | None |
| DB Indexes on Messages | None (0 explicit indexes on hot fields) |
| Auth Token Expiration | 14 days |
| DB Pool Size (Vercel) | 3 connections per function |
| File Upload | Images only (`accept="image/*"`) |
| LiveKit Device Selector | None |
| LiveKit Session Messages | None (no join/leave events posted) |
| LiveKit Transcription | None |
| LiveKit Webhook Endpoint | None |

### P0 Issues Count: 5

1. PAYLOAD_SECRET empty fallback
2. Hardcoded encryption salt
3. In-memory rate limiting on serverless
4. No CSP headers
5. Comments endpoint unprotected

---

*Generated from comprehensive code audit by 3 parallel agents + manual review of 30+ source files across chat system, LiveKit integration, auth flow, email templates, middleware, Next.js configuration, database access patterns, and security headers.*
