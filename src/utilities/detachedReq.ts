/**
 * detachedReq — the request object for work that outlives the request.
 *
 * `setImmediate(...)` inside an afterChange hook runs AFTER the response has gone
 * out and the parent transaction has committed. Handing that callback the
 * original `req` carries two things it should no longer be carrying:
 *
 *   1. `transactionID`, naming a transaction that is already closed. The lint in
 *      tests/unit/collections/hookWritesPassReq.test.ts exists because a hook
 *      write WITHOUT req misses the parent transaction — but that reasoning stops
 *      at the moment the transaction commits, and a deferred callback is past it.
 *
 *   2. The `payload-tenant` cookie. The multi-tenant plugin validates every
 *      relationship to a tenant-scoped collection against
 *      `data.tenant ?? the tenant selected in that cookie`. So a deferred write
 *      about a file in tenant 5, performed on the request of an admin whose
 *      selector said tenant 1, is judged against tenant 1 and rejected as "The
 *      following field is invalid: Media" — which is what every upload has been
 *      hitting. The uploader's UI state is not a fact about the file.
 *
 * Keeps `payload` and `user` (access checks and authorship still want them).
 * Drops the transaction and the headers.
 *
 * @see src/collections/Media/hooks/mediaToAiBus.ts
 * @see src/collections/Media/hooks/autoAnalyzeUpload.ts
 */
import type { PayloadRequest } from 'payload'

export function detachedReq(req: PayloadRequest): PayloadRequest {
  return {
    ...req,
    transactionID: undefined,
    // A fresh, empty Headers: no tenant cookie, so tenant scoping falls back to
    // the tenant named on the data being written, which is the one that's true.
    headers: new Headers(),
  } as PayloadRequest
}
