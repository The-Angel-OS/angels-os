# 🏆 The Boss Level — Sprint 33.3: Google OAuth Multi-Tenancy Cookies Crumbling

## Context

This is a post-mortem and resolution prompt for the Google OAuth authentication
bug in Angel OS — a multi-tenant Payload CMS 3.x + Next.js 16 + PostgreSQL
platform deployed on Vercel. This consumed approximately **6 hours across 11–13
mini-sprints** before the root cause was identified.

## The Symptom

After a successful Google OAuth code exchange, the user was created/found
correctly in the database and a JWT was generated. However, `GET /api/users/me`
always returned `{ user: null }` — regardless of whether the token was delivered
via cookie or `Authorization: JWT <token>` header.

## The Stack

| Layer | Technology |
|-------|-----------|
| CMS | Payload CMS 3.x (uses `jose` library internally for JWT) |
| Frontend | Next.js 16 (App Router) |
| Database | PostgreSQL (Neon on Vercel) |
| Hosting | Vercel (Edge + Serverless) |
| Auth | Custom Google OAuth2 + Discord OAuth2 endpoints |
| Multi-tenancy | `@payloadcms/plugin-multi-tenant` with custom domains |

## The Auth Flow

```
User clicks "Sign in with Google"
  → GET /api/auth/google (init handler — redirects to Google consent)
  → Google callback with ?code=...
  → GET /api/auth/google/callback
      1. Exchange code for Google tokens
      2. Fetch Google profile (email, name, avatar)
      3. Find or create user in Payload
      4. Generate JWT signed with PAYLOAD_SECRET
      5. Redirect to /api/auth/complete?token=<jwt>&redirect=/dashboard
  → GET /api/auth/complete (standalone Next.js route handler)
      1. Verify JWT
      2. Return HTML page that sets cookie via multiple strategies
      3. Verify via /api/users/me
      4. Redirect to dashboard
```

## Why /api/auth/complete Exists

Payload's `handleEndpoints()` reconstructs a new Response object from the
handler's return value. **This reconstruction strips `Set-Cookie` headers** —
both raw `Set-Cookie` and `cookies()` from `next/headers` fail to persist.
The `/api/auth/complete` route is a standalone Next.js route handler outside
Payload's pipeline to avoid this.

---

## 🔴 The 11 Attempts (What Was Tried)

### Attempt #1 — Direct Set-Cookie in Payload handler
**File**: `src/endpoints/auth-google.ts`
**Approach**: Return `Response` with `Set-Cookie: payload-token=<jwt>` from the OAuth callback handler.
**Result**: ❌ Payload's `handleEndpoints()` strips Set-Cookie headers.
**Commit**: `c1c738d`

### Attempt #2 — `cookies()` from next/headers
**File**: `src/endpoints/auth-google.ts`
**Approach**: Use `cookies().set('payload-token', token, ...)` from `next/headers`.
**Result**: ❌ Same problem — Payload reconstructs the Response, cookies don't persist.
**Commit**: `21d7966`

### Attempt #3 — Bypass Payload handleEndpoints()
**File**: `src/endpoints/auth-google.ts`
**Approach**: Return a raw `Response` object to bypass Payload's response reconstruction.
**Result**: ❌ Payload still wraps it. Cookie not set.
**Commit**: `5c8dd00`

### Attempt #4 — Raw Set-Cookie + domain validation
**Approach**: Build Set-Cookie header manually with domain validation for multi-tenant support.
**Result**: ❌ Still stripped by Payload pipeline.
**Commit**: `3097f7c`

### Attempt #5 — NextResponse.redirect + cookies.set
**Approach**: Use `NextResponse.redirect()` with `.cookies.set()` for middleware compatibility.
**Result**: ❌ Redirect response still goes through Payload's pipeline.
**Commit**: `65a23f5`

### Attempt #6 — HTML page + meta refresh (200 instead of 302)
**Approach**: Return a 200 HTML page with `<meta http-equiv="refresh">` and Set-Cookie header, instead of a 302 redirect.
**Result**: ❌ Chrome never stored the cookie despite correct headers (confirmed by curl).
**Commit**: `9b453a0`

### Attempt #7 — Standalone /api/auth/complete route
**File**: `src/app/api/auth/complete/route.ts`
**Approach**: Move cookie setting to a standalone Next.js route handler entirely outside Payload.
**Result**: ❌ Set-Cookie headers present (confirmed by curl) but Chrome did not store them.
**Realization**: This isn't a Payload stripping problem anymore. Something in Vercel/Chrome is silently dropping cookies.

### Attempt #8 — Middleware bypass + cookie verification
**Approach**: Exclude `/api/auth/*` from Next.js middleware matcher. Add verification step.
**Result**: ❌ Same behavior. Cookies not stored.
**Commit**: `e71e669`

### Attempt #9 — Raw Response + diagnostic test cookie
**Approach**: Set both the JWT cookie and a simple test cookie. Check if ANY cookie sticks.
**Result**: ❌ Neither cookie stored. But curl showed correct Set-Cookie headers.
**Commit**: `1693459`

### Attempt #10 — Fetch-based cookie delivery
**File**: `src/app/api/auth/set-cookie/route.ts` (NEW)
**Approach**: Return HTML page with NO Set-Cookie headers. Client-side JS calls `POST /api/auth/set-cookie` via `fetch()` with the token. The response sets the cookie. Different browser cookie processing path than page-load responses.
**Result**: ❌ fetch() response Set-Cookie was received but /api/users/me still returned null.
**Commit**: `8ed45f8`

### Attempt #11 — document.cookie (bypass ALL server-side processing)
**File**: `src/app/api/auth/complete/route.ts` (rewritten)
**Approach**: The nuclear option. No server-side Set-Cookie at all. Client-side JS sets cookie directly via `document.cookie = 'payload-token=<jwt>; path=/; ...'`. Also tries fetch-based backup. Then verifies with `/api/users/me`. If cookie fails, tries `Authorization: JWT <token>` header to confirm JWT validity.
**Result**: ❌ `document.cookie` successfully showed the cookie in JS. fetch to `/api/users/me` returned `user: null`. Authorization header also returned `user: null`.
**Commit**: `6aed975`

**The diagnostic output from Attempt #11:**
```json
{
  "step": "jwt_invalid",
  "approach": "attempt_11_document_cookie",
  "meStatus": 200,
  "authHeaderStatus": 200,
  "authHeaderResponse": "{\"user\":null,\"message\":\"Account\"}",
  "log": [
    "A1: document.cookie set (no domain, host-only)",
    "A2: document.cookie set (domain=.spacesangels.com)",
    "A3: document.cookie visible = true",
    "B1: fetch /api/auth/set-cookie = 200",
    "C1: /api/users/me status = 200",
    "C2: user = null",
    "D1: Authorization header status = 200",
    "D2: user = null"
  ]
}
```

**This was the breakthrough diagnostic.** The cookie was stored successfully
(A3 confirms it). The Set-Cookie endpoint returned 200. But `/api/users/me`
returned `null` even when the token was passed directly via Authorization header.

**The cookie mechanism was never the problem.**

---

## 🟢 The Root Cause (Attempt #12 — found, not coded as an "attempt")

### Library Mismatch: `jsonwebtoken` vs `jose`

**Payload CMS 3.x** uses the `jose` library internally for ALL JWT operations:

```typescript
// node_modules/payload/dist/auth/jwt.js (SIGNING)
import { SignJWT } from 'jose'
const secretKey = new TextEncoder().encode(secret)
const token = await new SignJWT(claims)
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuedAt(issuedAt)
  .setExpirationTime(exp)
  .sign(secretKey)

// node_modules/payload/dist/auth/strategies/jwt.js (VERIFICATION)
import { jwtVerify } from 'jose'
const secretKey = new TextEncoder().encode(payload.secret)
const { payload: decoded } = await jwtVerify(token, secretKey)
// then: payload.findByID({ id: decoded.id, collection: decoded.collection })
```

**Our OAuth handlers** used the `jsonwebtoken` library:

```typescript
// src/endpoints/auth-google.ts (BROKEN)
import jwt from 'jsonwebtoken'
const payloadToken = jwt.sign(
  { id: user.id, email: user.email, collection: 'users' },
  process.env.PAYLOAD_SECRET!,
  { expiresIn: '14d' },
)
```

### Why They're Incompatible

Both libraries implement HS256 (HMAC-SHA256) but encode the secret key
differently:

| Library | Secret Encoding | Method |
|---------|----------------|--------|
| `jose` | `new TextEncoder().encode(secret)` | Raw UTF-8 bytes |
| `jsonwebtoken` | String passed directly | Internal encoding differs |

**Same secret string → different HMAC key bytes → different signatures.**

A JWT signed by `jsonwebtoken` is a structurally valid JWT that `jsonwebtoken`
can verify, but `jose` **cannot** verify it because the signature doesn't match.

### Why It Was Silent

Payload's JWT verification wraps `jwtVerify` in a try/catch that silently
swallows errors:

```typescript
// node_modules/payload/dist/auth/strategies/jwt.js
try {
  const { payload: decodedPayload } = await jwtVerify(token, secretKey)
  // find user...
} catch (ignore) {
  return { user: null }  // ← SILENT FAILURE
}
```

No error logged. No stack trace. Just `{ user: null }`.

### Why It Took 11 Attempts to Find

1. **Red herring**: The first 2 attempts failed due to Payload stripping Set-Cookie headers — a REAL bug that needed solving. This set the mental model that cookies were the problem.
2. **Curl worked**: Set-Cookie headers were always correct when tested with curl. This reinforced the "cookie delivery" theory.
3. **Browser-specific**: The behavior looked like a Chrome/Vercel edge case with cookie storage.
4. **Silent failure**: Payload returns `{ user: null }` with a 200 status — not 401, not an error. There's no signal that the JWT signature is the issue.
5. **Authorization header**: It wasn't until Attempt #11's diagnostic tried `Authorization: JWT <token>` that we realized even direct header-based auth returned `null`. This eliminated cookies entirely as the cause.
6. **Same secret**: Both libraries used `process.env.PAYLOAD_SECRET` — the same string. The difference is invisible unless you know to look at byte-level encoding.

---

## ✅ The Fix

**Commit**: `62e2cb5`

Replace `jsonwebtoken` with `jose` in all 5 auth files:

### Signing (auth-google.ts, auth-discord.ts)

```typescript
// BEFORE (broken)
import jwt from 'jsonwebtoken'
const payloadToken = jwt.sign(
  { id: user.id, email: user.email, collection: 'users' },
  process.env.PAYLOAD_SECRET!,
  { expiresIn: '14d' },
)

// AFTER (correct)
import { SignJWT } from 'jose'
const secretKey = new TextEncoder().encode(process.env.PAYLOAD_SECRET!)
const issuedAt = Math.floor(Date.now() / 1000)
const expiration = issuedAt + 14 * 24 * 60 * 60 // 14 days
const payloadToken = await new SignJWT({ id: user.id, email: user.email, collection: 'users' })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuedAt(issuedAt)
  .setExpirationTime(expiration)
  .sign(secretKey)
```

### Verification (auth-complete, set-cookie, token-relay)

```typescript
// BEFORE (broken — could verify jsonwebtoken's own tokens, but not Payload's)
import jwt from 'jsonwebtoken'
jwt.verify(token, secret)

// AFTER (correct — consistent with Payload's internal verification)
import { jwtVerify } from 'jose'
const secretKey = new TextEncoder().encode(secret)
await jwtVerify(token, secretKey)
```

### Dependency Changes

```diff
- "jsonwebtoken": "9.0.1"
- "@types/jsonwebtoken": "^9.0.7"
+ "jose": "6.1.3"
```

`jose` was already a transitive dependency (via Payload) but needed to be
installed as a direct dependency for pnpm's strict module resolution.

---

## Files Changed

| File | Change |
|------|--------|
| `src/endpoints/auth-google.ts` | `jwt.sign()` → `new SignJWT().sign()` |
| `src/endpoints/auth-discord.ts` | `jwt.sign()` → `new SignJWT().sign()` |
| `src/app/api/auth/complete/route.ts` | `jwt.verify()` → `jwtVerify()` |
| `src/app/api/auth/set-cookie/route.ts` | `jwt.verify()` → `jwtVerify()` |
| `src/endpoints/auth-token-relay.ts` | `jwt.verify()` → `jwtVerify()` |
| `package.json` | Remove jsonwebtoken, add jose |
| `pnpm-lock.yaml` | Updated lockfile |

---

## Lessons Learned

1. **When a framework uses a specific JWT library internally, your custom code
   MUST use the same library.** Payload CMS 3.x migrated from `jsonwebtoken`
   to `jose` — any custom auth code must follow.

2. **Silent catch blocks are debugging nightmares.** Payload's
   `catch (ignore) { return { user: null } }` made this invisible. If it had
   logged `console.error('JWT verification failed', err)`, this would have been
   found in 5 minutes.

3. **The Authorization header diagnostic was the key.** Attempts #1-#10 all
   assumed cookies were the problem. Attempt #11's dual verification (cookie +
   header) proved the JWT itself was invalid, not the delivery mechanism.

4. **Don't trust that two HMAC libraries produce identical output for the same
   secret string.** The secret encoding matters. Always check if the framework
   exposes its signing function or if you should match its exact library.

5. **Red herrings compound.** The first real bug (Payload stripping Set-Cookie)
   created a false narrative that persisted through 9 more attempts.

---

## Remaining Cleanup (Optional)

The `/api/auth/complete` route still contains the elaborate Attempt #11
diagnostic page with dual verification, error states, and troubleshooting
steps. Now that the JWT is valid, this can be simplified to a minimal cookie
setter + redirect. The diagnostic infrastructure is valuable for debugging but
unnecessary for production.

---

*Sprint 33.3 — The Transporter Room is now operational. 🖖*
