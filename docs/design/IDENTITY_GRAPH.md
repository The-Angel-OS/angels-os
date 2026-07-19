# Identity Graph — design & migration plan

> 260719 — the keystone schema. Locked decisions (Ken 260718): a Person is keyed on a **platform-native id**, with **email AND phone as co-equal anchors**; many external credentials link to one Person; **verified email/phone is the merge key**; **link only after a confirm**. OIDC is the one protocol. Build only after Ken signs off — this touches auth.

## What exists today (grounded)

- **`users`** is the Payload auth collection (email + password + apex cookie). One Google `sub` per user, found-or-created **by email**.
- **`federatedIdentityId`** (`src/utilities/federatedIdentity.ts`) — a deterministic **hash of the normalized email**, exposed as a **virtual** field (computed on read, never stored). Low coupling: referenced only in `Users`, `payload-types`, and the util. It's the current "same person across nodes" claim.
- **OIDC plumbing** (`auth-federated.ts`) — `jose` `jwtVerify` + `createRemoteJWKSet` against Google's JWKS; requires `email_verified`. `resolveUserFromGoogleClaims` (`googleIdentity.ts`) find-or-creates by email+sub. `auth-google.ts` already has a "must be authenticated to link a social provider" branch.

## Gap vs. the locked model

1. **Native id, not email-derived.** `federatedIdentityId` is *solely* email-derived, so a **phone-only** person (a Craigslist vendor with no email) can't get a stable identity, and email can't be a *co-equal* anchor (it's THE key). Need a stored native id with email+phone hung off it.
2. **No phone anchor** — no `phone`/`phoneVerified`.
3. **One credential per user** — no way to attach many (Google + Apple + phone → one Person).
4. **No confirm-on-link flow.**

## Target schema (additive-first)

Keep `users` as the **Person** (it owns the Payload session) — do NOT split into a separate `people` collection (that's a bigger, riskier refactor for no near-term gain). Extend it:

**On `users` (additive, nullable):**
- `personId: text` (indexed, unique) — the **stored platform-native id**. Generated once at create (UUID). This becomes the stable identity; `federatedIdentityId` stays as a *virtual compatibility alias* during transition (still email-derived) so nothing cross-node breaks mid-migration.
- `phone: text` (indexed) + `phoneVerified: checkbox` — the phone **anchor**.
- (email + emailVerified already effectively exist via auth.)

**New collection `identities` (the credential edges):**
- `person → users` (required, indexed)
- `provider: select` — `google | apple | microsoft | linkedin | email | phone`
- `subject: text` (indexed) — the provider `sub`/`oid`/id (or the email/phone for those provider types)
- `verifiedEmail: text` · `verifiedPhone: text` — what the provider asserted (the merge inputs)
- `status: select` — `active | pending_confirm`
- `linkedAt: date`
- **Uniqueness:** one `(provider, subject)` → one identity row (a credential belongs to exactly one Person).

## Resolution / merge algorithm (link-on-confirm)

On any OIDC/phone login, after verifying the token/OTP → `{provider, subject, verifiedEmail?, verifiedPhone?}`:

1. **Known credential** → `identities.findOne({provider, subject})`. If found + `active` → log in as that Person. Done. (No merge, no confirm — it's a return visit.)
2. **New credential, matches an anchor** → look for a Person whose verified email == `verifiedEmail` OR verified phone == `verifiedPhone`. If exactly one:
   - Create the identity row as **`pending_confirm`** and require a **confirm step** (email/SMS the matched anchor, or an in-session "link these accounts?" if already logged in) → on confirm, flip to `active`. **Never auto-merge** on a provider-asserted email.
3. **New credential, no match** → create a **new Person** (`users` row + `personId`) with the asserted email/phone as anchors, and an `active` identity row. (This is the phone-only-vendor path: a Person with a phone anchor and no email.)
4. **Claim tie-in** — an unclaimed endeavor seeded from a listing carries a target email/phone. When a login resolves (steps 2–3) to that anchor, the coupling step (own the endeavor) fires. This is why the graph is the funnel's keystone.

## Migration plan (staged, reversible where possible)

1. **Additive migration** — add `person_id`, `phone`, `phone_verified` columns to `users`; create the `identities` table (+ locked-docs rel). Nullable, no behavior change. Run `db-repair-locks` after.
2. **Backfill (idempotent script/op, not a data-destructive migration):**
   - Every existing user without `personId` → generate one (UUID).
   - Seed an `identities` row `provider:'email', subject:<email>, verifiedEmail:<email>, status:'active'` for each user with an email.
   - For users with a stored Google linkage → seed `provider:'google'` identity from it (if we have the `sub`; else it self-heals on next Google login via step 1 of the algorithm).
3. **Cutover** — point resolution at `identities` (the algorithm above). Keep `federatedIdentityId` virtual alias live until every node is migrated, then retire.
4. **Generalize OIDC** — extract the Google JWKS verify into a provider-agnostic `verifyOidcToken(provider, token)` (per-provider issuer + JWKS URL + client id); add Apple (email relay, name-on-first-consent, `form_post`), Microsoft, LinkedIn as config. Phone → SMS-OTP verify path feeding the same algorithm.

## Cost / security notes
- OIDC verify = free (JWKS). No Auth0/Clerk. SMS-OTP metered → phone anchor used at claim/verify only.
- Link-on-confirm is the security spine: a provider asserting `victim@x.com` must not silently absorb that Person. Confirm via the anchor's own channel.
- `email_verified === false` already rejected; keep that. Apple relay emails: treat the relay address as the anchor (stable per app).

## Build order (after sign-off)
1. Additive schema + migration (`identities` + user anchor fields). 2. Backfill op. 3. Resolution algorithm + confirm flow (reuse `resolveUserFromGoogleClaims` as the template). 4. `verifyOidcToken` generalization + Apple/MS/LinkedIn. 5. SMS-OTP anchor. 6. Wire the claim/coupling step.

**Open question for Ken:** confirm step for a *logged-out* new-credential-matches-anchor case — email/SMS a magic link to the anchor (async, secure) vs. show "an account exists — sign in with your original method to link" (sync, friction)? I lean magic-link-to-anchor (works for phone-only vendors too).
