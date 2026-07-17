# Deploying Angel OS Core to Railway (off Vercel)

Kills the Vercel (~$30/mo) + IONOS (~$80/mo) recurring spend for a single small
Railway bill. Core runs as a Docker container (see `Dockerfile`) + Railway managed
Postgres. **Merlin stays a local node** (IAM0 / VMC) — it's the residential body,
not part of this move. Media stays on **Cloudflare R2** (container is stateless).

## 0. Prereqs
- Railway account + `railway` CLI (`npm i -g @railway/cli`), or the dashboard.
- The current production DB connection string (to dump from) and R2 creds.
- Cloudflare in front of the domains (TLS/CDN/DDoS) — you already use CF.

## 1. Create the Railway project (2 services)
1. **New Project → Deploy from GitHub repo** (`The-Angel-OS/angels-os`). Railway
   detects `railway.json` → builds the `Dockerfile`. Health check is `/api/health`.
2. **Add a Postgres** service (New → Database → PostgreSQL). It exposes
   `DATABASE_URL` on the Postgres service.

## 2. Environment variables (on the Core service)
Map Railway's Postgres var to what Payload expects, then set the rest.

**Required:**
- `DATABASE_URI` = `${{Postgres.DATABASE_URL}}`  ← Railway variable reference
- `PAYLOAD_SECRET` = (copy the existing prod secret — must match so sessions/JWTs survive)
- `NEXT_PUBLIC_SERVER_URL` = `https://www.spacesangels.com` (final domain)
- `PAYLOAD_PUBLIC_SERVER_URL` = same
- `COOKIE_DOMAIN` = `.spacesangels.com` (cross-subdomain SSO)
- `ENCRYPTION_SECRET`, `ENCRYPTION_SALT` = (copy from prod — required to read encrypted fields)
- `CRON_SECRET` = (copy from prod — node key + cron auth)

**Media (R2 — copy all from prod):** `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`.

**Payments:** `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, **`STRIPE_WEBHOOKS_SIGNING_SECRET`** (the one
the earn loop needs — see the monetization notes; re-point the Stripe webhook to the
new URL after cutover).

**AI / Leo (copy whichever are set):** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `AI_GATEWAY_API_KEY`,
`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`.

**Email (OTP + invites):** `RESEND_API_KEY` (or `SMTP_*` + `SYSTEM_EMAIL_*`).

**Auth / misc:** `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`,
`PREVIEW_SECRET`, `GOOGLE_RECAPTCHA_SECRET`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
Sentry/LiveKit/Vapi/Discord vars as used. `NEXT_PUBLIC_*` must be set at BUILD time —
Railway injects service vars into the build, so set them before the first deploy.

> Drop `BLOB_READ_WRITE_TOKEN` (Vercel Blob — retired, on R2 now) and anything
> Vercel-specific.

## 3. Migrate the database
The schema is code (`src/migrations/`) and auto-applies on boot (`pnpm run migrate`
in the container CMD). You only need to move the DATA.

```bash
# Dump the current prod DB (roles + owners stripped for a clean restore)
pg_dump --no-owner --no-privileges --format=custom "$OLD_DATABASE_URI" -f angelos.dump

# Restore into the Railway Postgres (get its URL from the Postgres service → Connect)
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "$RAILWAY_DATABASE_URL" angelos.dump
```
On first Core boot, `payload migrate` runs — a no-op if the dump already carries the
latest schema, or it fast-forwards. Verify: `GET /api/health` → 200.

(Merlin's `pg_dump`/`pg_restore` backup engine can also produce/consume the dump.)

## 4. Domains + Cloudflare
- Railway gives the service a `*.up.railway.app` URL. Add your custom domains
  (`spacesangels.com`, `www`, `*.spacesangels.com`) on the Core service.
- Point Cloudflare DNS at Railway's target (CNAME), proxied (orange cloud) for
  TLS/CDN/DDoS. Wildcard `*.spacesangels.com` for tenant subdomains.

## 5. Parallel-run → cutover → cleanup (reversible)
1. Deploy to Railway; test on the `*.up.railway.app` URL (admin loads, a login,
   a storefront, an image from R2, a Leo chat).
2. Put a **staging** subdomain on Railway via Cloudflare; soak-test.
3. **Cut over**: switch the production DNS records to Railway. Vercel stays up as an
   instant rollback (flip DNS back) until you're confident.
4. **Re-point the Stripe webhook** to `https://www.spacesangels.com/api/stripe/webhooks`
   (same URL, now served by Railway) and confirm `STRIPE_WEBHOOKS_SIGNING_SECRET` matches.
5. Once stable for a few days: **delete the Vercel project(s)** and **cancel IONOS**.
   That's the ~$110/mo gone.

## 6. Then unpark Payload 3.85
The 3.85 upgrade (PR #133) only 500'd on Vercel's runtime. On Railway's plain Node
container it should build/run — do it as a separate, isolated deploy after the move
is stable.

## Notes
- The container is stateless (media on R2). No Railway volume needed.
- `next build` runs with placeholder `PAYLOAD_SECRET`/`DATABASE_URI` (build doesn't
  query the DB); the real values are runtime env. If a future build genuinely needs
  DB access, reference `${{Postgres.DATABASE_URL}}` in the build too.
- Both `angels-os` and `angels-os-kendev` deploy `main` today; on Railway, decide
  whether kendev is a second service or is retired into the single consolidated node.
