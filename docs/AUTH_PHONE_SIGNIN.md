# Sign-in by Text (Phone OTP) — how a phone number maps to a user

**Shipped 260722.** One field, one contract: `users.phone` (E.164, indexed) is the
identity anchor. A texted code signs you into **the one account that carries the
number the code was sent to.**

## The flow
1. Login page → **"Continue with a code (text or email)"** → one input, email *or*
   mobile (branches on `@`).
2. Phone → `POST /api/auth/request-otp {phone}` → **Twilio Verify** texts a
   6-digit code (Verify generates/checks its own codes — nothing stored on our
   side; no from-number, no A2P 10DLC campaign needed).
3. `POST /api/auth/verify-otp {phone, code}` → Verify approves → we look up
   `users where phone equals <E.164>` → mint the same apex-scoped HttpOnly
   session cookie as password/Google login.

## The mapping rules
- **One number ↔ one account.** `phone` is a single field; lookup takes the
  first match. **Never put the same number on two users** — sign-in would land
  in whichever matched first. (Email codes, Google, and password remain
  available for accounts without a phone.)
- **Existing users only.** An unknown phone gets the same generic failure as a
  wrong code — no account creation from a bare number, and no oracle revealing
  which numbers have accounts.
- **Normalization is symmetric.** Login normalizes what the visitor types to
  E.164 (`727 256 4413` → `+17272564413`); the collection normalizes on save
  the same way, so any format entered in admin or the account page still
  matches. Bare 10-digit numbers assume `+1`.

## Where the number gets set
- **Admin (you, for others):** Payload Admin → Users → *the user* → **Phone**.
  This is how to seed David C / Dave A once you have their numbers.
- **Self-service:** Dashboard → Account (`/dashboard/account`) → **Mobile
  Number** — users add or change their own later.
- (Voice-lead phones live on **Contacts**, not Users — a captured lead's number
  does NOT grant login; only a number placed on a User record does.)

## Twilio specifics
- Service: "Angel OS" Verify service (`TWILIO_VERIFY_SERVICE_SID`); texts read
  *"Your Angel OS verification code is: …"*.
- Per-portal branding (*"Your NeuroCare Pro verification code…"*) is coded and
  activates automatically if Twilio approves `CustomFriendlyName` on the account
  (error 60204 currently → we auto-degrade to the service name).
- Raw outbound SMS (lead alerts, follow-ups) is separate: needs the 10DLC
  campaign + a real Twilio number (`resolveSmsSender` env fallback is ready).
