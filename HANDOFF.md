# Angel OS — Session Handoff: Sprint 13 Complete

**Date:** February 23, 2026
**Branch:** `main`
**Status:** TypeScript clean, build passing, 29 LEO tools, v0.13.0-dev
**Sprint:** Sprint 13 complete (Multi-Tenancy Hardening & Email Bridge) — Sprint 14 next
**Stack:** Payload 3.77.0 · Next.js 16.1.6 · React 19.2.1 · Claude Sonnet 4 · Turbopack

---

## What Was Done (Sprint 13)

### Sprint 13: Multi-Tenancy Hardening & Email Bridge

Six sealing phases + email infrastructure:

#### Phase 1: TenantChooser Port Preservation
- **File:** `src/app/[locale]/(dashboard)/dashboard/DashboardSidebar.tsx`
- `handleSwitch` now preserves `window.location.port` when switching tenant domains
- Also preserves locale prefix from `window.location.pathname`
- Production (443/80) → `port` is empty → no-op

#### Phase 2: Header/Footer Tenant Scoping
- **File:** `src/payload.config.ts`
- Changed `header: { isGlobal: true }` → `header: {}` and `footer: { isGlobal: true }` → `footer: {}`
- Multi-tenant plugin now adds `tenant` field to both collections
- `getTenantCachedDoc` already queries by tenant — no further changes needed
- Migration `20260223_013326` handles DB schema changes (drops UNIQUE, adds non-unique tenant index)

#### Phase 3: Tenant-Branded Home Page Fallback
- **New file:** `src/utilities/tenantHomeData.ts` — generates branded Lexical page from `tenant.branding`
- **Modified:** `src/app/[locale]/(app)/[slug]/page.tsx` — resolves tenant from `x-tenant-id` → uses `tenantHomeData()` → falls back to `homeStaticData()`
- **Modified:** `src/endpoints/seed/index.ts` — creates `home` page per use-case tenant

#### Phase 4: Dashboard Stats Tenant Scoping
- **File:** `src/app/[locale]/(dashboard)/dashboard/page.tsx`
- Added `import type { Where } from 'payload'`
- `tenantFilter: Where | undefined` — `undefined` for super-admins, `{ tenant: { equals: tenantId } }` for others
- "Active Tenants" card hidden for non-super-admins

#### Phase 5: Browser Tab Title + Favicon
- **Files:** `src/app/[locale]/(app)/layout.tsx` + `src/app/[locale]/(dashboard)/layout.tsx`
- Converted `export const metadata` → `export async function generateMetadata()`
- Reads `x-tenant-id` header → fetches `tenant.branding.siteName` → uses as title template
- Dynamic favicon: uses tenant logo URL when available

#### Phase 6: Footer Tenant Isolation
- **File:** `src/components/Footer/index.tsx`
- Angel OS community links (GitHub, Wiki, "Designed in Clearwater") only render for `tenant?.type === 'platform'` or when no tenant
- Sub-tenants see only their CMS-managed `navItems` + tenant logo

#### Phase 7: Cross-Subdomain Cookie Auth
- **File:** `src/collections/Users/index.ts`
- Added `cookies: { domain: process.env.COOKIE_DOMAIN, sameSite: 'Lax', secure: NODE_ENV === 'production' }`
- `.env.local`: `COOKIE_DOMAIN=.angelos.local`
- Production: `COOKIE_DOMAIN=.spacesangels.com` (set in Vercel env vars)
- **After server restart + re-login**, the `payload-token` cookie is shared across all `*.angelos.local` subdomains

#### Email Infrastructure (Sprint 13 Extension)

**Resend email adapter:**
- `pnpm add @payloadcms/email-resend`
- `src/payload.config.ts`: Resend adapter activated when `RESEND_API_KEY` is set
- Falls back to SMTP nodemailer if `SMTP_HOST` set, otherwise no adapter
- Sender: `SYSTEM_EMAIL_ADDRESS` / `SYSTEM_EMAIL_NAME` (env vars)

**IMAP email polling:**
- `pnpm add imapflow mailparser resend @types/mailparser`
- **New file:** `src/endpoints/email-poll.ts` — `GET /api/email/poll`
- Registered in `payload.config.ts`
- **New file:** `vercel.json` — Cron: `*/2 * * * *` → `/api/email/poll`
- Flow: IMAP connect → fetch UNSEEN → parse → create email-sourced DM channel (`email-{sender}`) → store message → LEO response → Resend reply → mark SEEN
- Protected by `CRON_SECRET` header (Vercel injects automatically in production)

**DNS (spacesangels.com):**
- `*.spacesangels.com` → Vercel ALIAS (wildcard already in place)
- MX: `mx00.ionos.com` + `mx01.ionos.com` (priority 10)
- SPF TXT: `v=spf1 include:mxfwd.ionos.com ~all`
- DKIM CNAMEs: `s1-ionos._domainkey`, `s2-ionos._domainkey`, `s42582890._domainkey`
- Autodiscover CNAME: `autodiscover` → `autodiscover.ionos.com`
- Resend outbound records: `send` subdomain TXT/CNAME (existing)
- Mailbox created: `hello@spacesangels.com` (IONOS Mail Basic)

**ESM/dotenv fix:**
- `src/utilities/ConversationEngine.ts` + `src/endpoints/leo-stream.ts`
- Replaced `import { parse as dotenvParse } from 'dotenv'` with inline `parseEnvFile()` function
- Dotenv 8.x doesn't have proper ESM exports for `moduleResolution: "bundler"`

**Migration state resolved:**
- `payload_migrations` table populated with all 11 migration names
- `payload migrate` returns "Done." cleanly
- Latest migration: `20260223_013326` (includes header/footer tenant column + many new tables)

---

## Environment Variables (Updated)

| Variable | Purpose | Where |
|----------|---------|-------|
| `DATABASE_URI` | PostgreSQL | `.env.local`, Vercel |
| `PAYLOAD_SECRET` | Payload JWT | `.env.local`, Vercel |
| `ANTHROPIC_API_KEY` | Claude (LEO) | `.env.local`, Vercel |
| `RESEND_API_KEY` | Transactional email | `.env.local`, Vercel |
| `SYSTEM_EMAIL_ADDRESS` | `hello@spacesangels.com` | `.env.local`, Vercel |
| `SYSTEM_EMAIL_PASSWORD` | IONOS mailbox password | `.env.local`, Vercel |
| `SYSTEM_EMAIL_NAME` | `Angel OS` | `.env.local`, Vercel |
| `CRON_SECRET` | Vercel Cron auth | Vercel only (generate random) |
| `COOKIE_DOMAIN` | `.angelos.local` (dev) / `.spacesangels.com` (prod) | `.env.local`, Vercel |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | `.env.local`, Vercel |

---

## Files Changed (Sprint 13)

| File | Action |
|------|--------|
| `src/app/[locale]/(dashboard)/dashboard/DashboardSidebar.tsx` | FIX port + locale in handleSwitch |
| `src/payload.config.ts` | header/footer isGlobal removed; Resend adapter; email-poll registered |
| `src/utilities/tenantHomeData.ts` | NEW — branded home page generator |
| `src/app/[locale]/(app)/[slug]/page.tsx` | FIX — tenant-aware home fallback |
| `src/endpoints/seed/index.ts` | ADD — home page per use-case tenant |
| `src/app/[locale]/(dashboard)/dashboard/page.tsx` | FIX — tenant-scoped stats (Where type) |
| `src/app/[locale]/(app)/layout.tsx` | FIX — generateMetadata() with tenant title |
| `src/app/[locale]/(dashboard)/layout.tsx` | FIX — generateMetadata() with tenant title |
| `src/components/Footer/index.tsx` | FIX — conditional platform links |
| `src/collections/Users/index.ts` | ADD — cookies.domain for cross-subdomain auth |
| `src/utilities/ConversationEngine.ts` | FIX — inline parseEnvFile (remove dotenv import) |
| `src/endpoints/leo-stream.ts` | FIX — inline parseEnvFile (remove dotenv import) |
| `src/endpoints/email-poll.ts` | NEW — IMAP email poll endpoint |
| `vercel.json` | NEW — Vercel Cron config |
| `src/migrations/20260223_013326.ts` | NEW — delta migration (header/footer tenant + new tables) |
| `.env.local` | ADD COOKIE_DOMAIN, SYSTEM_EMAIL_*, RESEND_API_KEY |
| `README.md` | Updated to v0.13.0-dev |
| `HANDOFF.md` | This file |

---

## Current State / What Needs Testing

### Critical paths to verify:
1. **Tenant chooser** — switch from `angelos.local:3000` → `celersoft.angelos.local:3000` → should load correctly with `:3000` preserved
2. **Cross-subdomain auth** — log in at `angelos.local:3000`, navigate to `celersoft.angelos.local:3000/dashboard` → should stay logged in (requires restart + re-login after `COOKIE_DOMAIN` change)
3. **Per-tenant home** — visit `celersoft.angelos.local:3000/` → should show Celersoft branding, not "Everyone Gets an Angel"
4. **Browser tab title** — `celersoft.angelos.local:3000/dashboard` → tab should say "Celersoft" not "Angel OS"
5. **Footer** — sub-tenant pages should NOT show GitHub/Wiki links
6. **Email poll** — `GET /api/email/poll` with `Authorization: Bearer {CRON_SECRET}` → should connect IMAP, return `{ processed: N }`

### To add CRON_SECRET:
```bash
# Generate a random secret
openssl rand -hex 32
# Add to Vercel project environment variables as CRON_SECRET
```

### Re-seed after Phase 2 (header/footer):
```bash
pnpm payload seed  # or however seed is invoked
```

---

## Next Sprint (Sprint 14)

**Priority: End-to-end smoke test on spacesangels.com**

1. Deploy to Vercel with new env vars (RESEND_API_KEY, SYSTEM_EMAIL_*, CRON_SECRET, COOKIE_DOMAIN)
2. Verify tenant subdomains: `celersoft.spacesangels.com`, `lucas-productions.spacesangels.com`, etc.
3. Verify email polling via Vercel Cron (check function logs)
4. WhatsApp Business API bridge (Twilio/Meta webhook → bridge-inbound)
5. Stripe Connect vendor onboarding flow (issue #86)
6. Voice mode in chat UI (Web Speech API)

---

## GitHub Issues Status

| Issue | Status | Notes |
|-------|--------|-------|
| #85 Sprint 12: Integration Bridges | Partially done | Email bridge live; WhatsApp/SMS/Google Chat still pending |
| #86 Vendor Onboarding: Stripe Connect | Open | Sprint 14 |
| #78 Dashboard: Tenant Selector | Open | TenantChooser fixed in Sprint 13 |
| #73 Seed Overhaul | Open | Per-tenant home/header/footer now seeded |
| #75 Spaces redesign | Open | Sprint 14 |
