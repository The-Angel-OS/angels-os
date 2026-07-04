# Session Summary — Chat File Upload Bug + LEO Loop Issue (Jul 1, 2026)

## Error #1: Nimue Upload Fails ("No files were uploaded")
Nimue Capacitor app → `POST /api/media` → 400 `"No files were uploaded"`
- Full error: `Upload 400 [tenant=5 size=211448]: No files were uploaded`
- Source: Nimue `src/lib/media.ts:74`

## Root Cause: THREE independent bugs in Payload 3.77.0's multipart pipeline

All three must be fixed for uploads to work without `Content-Length` header (common in Capacitor WebView, iOS WebView, and certain proxies):

### Bug 1 — `addDataAndFileToRequest.js` Missing `hasBodyStream` fallback
- Original: `bodyByteSize && contentType?.includes('multipart/')`
- When `Content-Length` is absent, `bodyByteSize = 0` → multipart block skipped entirely → `generateFileData` throws `MissingFile`
- **Fix**: Added `hasBodyStream = req.body !== null` + `(bodyByteSize || hasBodyStream)`

### Bug 2 — `isEligibleRequest.js` Broken `hasBody()` check
- Original: Only checks `Content-Length` and `Transfer-Encoding` headers
- Even when Bug 1 is fixed (multipart block entered), `processMultipartFormdata` calls `isEligibleRequest` which has its own `hasBody()` check
- If `hasBody()` returns false, `processMultipartFormdata` returns APIError (500)
- **Fix**: Added `|| req.body !== null` to `hasBody()` return

### Bug 3 — `isEligibleRequest.js` Broken content-type regex
- Original: `/multipart\/['"()+-_]+(?:; ?['"()+-_]*)+$/i`
- Char class `['"()+-_]` does NOT include letters → `multipart/form-data` never matches
- **Fix**: Changed to `/multipart\/[-a-zA-Z0-9]+(?:; ?[-a-zA-Z0-9=._]+)+$/i`

## Timeline Context
- User reports this error was **introduced by today's push** — uploads previously worked
- All commits/uncommitted changes reviewed; **none directly alter upload request construction** or server request handling
- Most likely theory: deployment environment change (Vercel config, edge proxy, Capacitor platform version) caused Content-Length to stop being forwarded. The 3.85.1→3.77.0 revert may have changed build artifacts or edge settings.
- Alternative: the new `apiInterceptor.ts` error escalation now surfaces failures that were previously silent

## Applied Fixes (patches/payload@3.77.0.patch)
All 3 bugs patched in node_modules + patch file. Run `pnpm install` to re-apply:
1. `addDataAndFileToRequest.js`: `hasBodyStream` + `(bodyByteSize || hasBodyStream)` + backported `req.files`/array-safe `req.file` from 3.85.1
2. `isEligibleRequest.js`: `hasBody()` now checks `req.body !== null`
3. `isEligibleRequest.js`: Regex accepts `multipart/form-data; boundary=...`

## Error #2: Core Image Posted — No LEO Response (Separate)
- Image uploaded successfully from Core (carousel showed it)
- But LEO didn't auto-respond (conversation loop didn't activate)
- Follow-up query to LEO got 429 "Quota Exceeded" from Gemini vision API
- This is NOT related to the Payload upload bugs. Likely: AI dispatch pipeline (page channel → AI Bus → LEO → Gemini) hit a quota or dispatch issue.

## Uncommitted Changes (Both Repos)
- **Core**: Error logging additions (`logError`/`logClientError`) across endpoints + collections; `events.ts` refactored to `@angel-os/brain`; `nodeDispatchHandler` endpoint
- **Nimue**: `events.ts` refactored to `@angel-os/brain`; speech recognition error handling; new SQLite/Drizzle dependencies; Android manifest changes
