# Handoff — 260719 (self-host configs + session work)

> Written for the next thread. The pain this session was **env/container config confusion** — this doc kills that ambiguity. Everything is committed to `main`.

## The three bodies (one brain)
- **Core** `C:\Dev\angels-os` — the Payload/Next app (this repo). Runs two ways: **(a) Vercel** (spacesangels.com / kendev.co) and **(b) self-host Docker** = **payloadnuke.com**. Same source, different env + DB.
- **Merlin** `C:\Dev\merlin` — Windows-service node (residential-IP proxy, search, camera). **TABLED** until local models; provider order still supports it.
- **Nimue** `C:\Dev\nimue` — Android client.
- They share a portable `leoBrain.ts`. Federation = cross-**Enterprise**; we are ONE Enterprise → federation is FLAGGED OFF (`FEATURES.federation`, `src/config/features.ts`). Enterprise = the node/operator; **Endeavors = the tenants/portals** (clearwater-cruisin, wheredideveryonego, …).

## ⭐ Self-host container — how config actually works (the thing that bit us)
**Stack lives in `C:\Dev\datacenter\stack\docker-compose.yml`.** Two containers: `angelos-core` (the app, port 3000) + `angelos-pg` (postgres:17, port 5432, db `angels`).

- **Source & Dockerfile:** `C:\Dev\angels-os\` (`Dockerfile` = multi-stage: install → `next build` → boot runs `payload migrate` then `next start`).
- **The ONE env file the container loads:** **`C:\Dev\angels-os\.env.local`** (compose `env_file:` points ONLY here now — `.env` was consolidated away and removed). `.env.example` is the canonical key checklist.
- **Compose `environment:` block OVERRIDES the file** for: `DATABASE_URI` (→ local `postgres:5432/angels`, so the file's DATABASE_URI is IGNORED by the container), `NODE_ENV`, `PORT`, `NEXT_PUBLIC_SERVER_URL`, `COOKIE_DOMAIN`, `DEFAULT_TENANT_SLUG`.
- **`C:\Dev\datacenter\stack\.env`** holds ONLY `PGUSER`/`PGPASS` for compose interpolation — NOT app keys. (This is the file Ken kept mistaking for the app env.)
- **Backups:** `C:\Dev\_tmp\.env.consolidate.bak` + `.env.local.consolidate.bak` (the safety net — DON'T delete yet).

### Two kinds of env var (memorize this)
| Kind | Read when | To apply a change (from `C:\Dev\datacenter\stack`) |
|---|---|---|
| Server secrets (`STRIPE_SECRET_KEY`, `GOOGLE_AI_API_KEY`, DB…) | **runtime** | `docker compose up -d --force-recreate core` (~15s, NO rebuild) |
| `NEXT_PUBLIC_*` (client publishable key, feature flags) | **BUILD** (baked into client bundle) | `docker compose up -d --build core` (~3 min) |
- Verify: `curl localhost:3000/api/health` → 200. Logs: `docker logs -f angelos-core`.
- **RuntimeConfig provider** (`src/providers/RuntimeConfig.tsx`) exists so client Stripe/etc. read `NEXT_PUBLIC_*` from **server runtime** (fixes the self-host "not configured" bug). Rule: **no `'use client'` module-scope `process.env.NEXT_PUBLIC_*` reads** — add to RuntimeConfig.

### Postgres notes
- Container DB = `angelos-pg` → `docker exec -i angelos-pg psql -U postgres -d angels`. Password `K3nD3v!host`.
- IONOS `74.208.87.243:6432/angels` = a DIFFERENT DB (spacesangels/Vercel side; pgbouncer needs `ssl` + simple-query protocol).
- **Sequence drift** after restores: `GET /api/provision-ops/db-repair-sequences`.

## AI / Gemini (resolved this session)
- Gemini runs on the **paid `kendevco` key** (`GOOGLE_AI_API_KEY` ends `…aQtQ`). The old `…c1S4` was the free AngelClaw key (pro 404s/429s on free).
- **Quirk:** on the paid project the *versioned* flash id `gemini-2.5-flash` 404s — use **`gemini-flash-latest`** (already set in `GOOGLE_TIER_MAP`, `src/utilities/ai-gateway.ts`). Pro = `gemini-2.5-pro` (works).
- Provider order default: `ollama, google, groq, nvidia, gateway, openrouter`. Gateway 429 now fails over (fixed `failoverOnRateLimit`). Vision-aware failover still TODO.

## Shipped this session (all live on payloadnuke)
Checkout 500 (transactions_items id reuse) · hold-expiry + deposit→confirm booking · booking provider resolution · NEXT_PUBLIC key class (checkout/booking/donation via RuntimeConfig) · GoogleReviews block (Places API) · domain-alias routing footgun (4 resolvers) · kendev peer severed · `/products`→`/shop` · LEO gateway→OpenRouter failover · media-id vision fix · localPickup enabled · Stripe restored · order-history status enum fix · federation gated out of status · reuse-image picker fix · **`create_event` LEO tool**.

## ON DECK (in order)
1. **Fire-sale checkout verification** — drive it in-browser to the Stripe step (don't complete a live charge). localPickup + Stripe both live.
2. **Booking Steps 3–5** — owner confirm/decline of no-deposit requests + `confirm_booking`/`decline_booking` LEO tools; calendar day-items link to detail + list-view filter; **team availability** (multi-provider).
3. **LEO anti-hallucination** — `check_enterprise_health` returns prose LEO embellished (fabricated "Federation ACTIVE / constitution signed"). Make it return structured facts. (Was mid-edit.)
4. **WDEG portal fetch errors** — `wheredideveryonego.payloadnuke.com` dashboard RSC/`/api/messages` fetch failures (space 32). Separate tenant-resolution/tunnel investigation.
5. **`.env` rename** (cosmetic) — if Ken wants the loaded file named `.env`: `cp .env.local .env` + point compose `env_file` at `.env`.
6. GoogleReviews Slice 2 (gallery) + `/book/[serviceId]` service pages + `?service=` deep-link preselect (for the Craigslist ads). Craigslist "lean links" fallback ad ready to generate.

## Durable gotchas (hard-won)
- **Relationship ids as `Number()`** — multi-tenant `filterOptions` compares in JS; a string id fails `"invalid: <Field>"`. Bit us on transactions_items, page-comment `space`, media, event `host`/`coverImage`.
- **`payload.count()`** for counts, never `find({limit:0}).totalDocs` (limit:0 = UNLIMITED).
- **New block/collection** needs its tables via migration first (container runs `migrate`, not push). Hand-write scoped migrations to dodge unrelated `payload_mcp_*` drift; apply directly with `docker exec -i angelos-pg psql`.
- **Hand-rebuilding `.env.local` drops vars silently** — diff against `.env.example`.
