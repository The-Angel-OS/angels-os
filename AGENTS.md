# AGENTS.md — Stand up a federated Angel OS node

> **For AI coding agents (and the humans who run them).** Angel OS is designed to
> be self-replicated: a capable coding agent can clone this repo, set a handful of
> env vars, and bring up its own **Enterprise node** — a multi-tenant Payload CMS
> (3.77) + Next.js 16 + Postgres platform with an embedded AI guardian (Leo). This
> file is the authoritative, no-guessing runbook. If a step here drifts from the
> code, the code wins — fix this file.

Angel OS is **three bodies, one brain**: **Core** (this repo — the web platform),
**Merlin** (an optional long-lived compute/worker node), **Nimue** (the Android
guardian client). You only need **Core** to be a node. Merlin and Nimue are
optional and connect to a running Core.

---

## The model — one primitive, three scopes (read this first)

**Tenant** is the universal primitive. Every Circle, Business, Guardian Angel, and
Personal Portal *is* a tenant — essentially identical, differing only by flavor.
There is one provisioning engine, one permission spine, one teleport primitive. The
terms below name roles/scopes of that one primitive (plus the container it lives in),
not different machinery. Use them consistently in code, copy, and UI. If a string
uses one to mean another, that is drift — fix it toward this table.

| Term | What it means | Is it a tenant? |
|------|---------------|-----------------|
| **Enterprise** = **Diocese** = **Platform** | The **root configuration for the federation** — the node/platform itself. Everything connects through each Enterprise's **AI (system) bus**. Whoever stood up this node, holds the storage/DB/AI accounts, runs it. The thing tenants live *inside*. | **No.** Never a tenant type. At most a *toggle* marking the root portal — the `Platform` singleton tenant IS that root. |
| **Tenant** | The universal primitive — a superset of essentially-identical Circles, Businesses, Guardian Angels, and Personal Portals. What you provision and scope data by. | — (it is the primitive) |
| **Endeavor** | A **tenant you organize around** — a Circle, a Business, a creator channel, a cause, anything. Has its own identity, Guardian Angel, and revenue. | Yes — an Endeavor *is* a tenant. |
| **Circle** | A **family Endeavor** — the same tenant primitive at personal/kin scope. "Part and parcel" with Endeavor, not a separate concept. | Yes — a tenant. |

Consequences worth internalizing:
- "Create an Endeavor" and "Create a Circle" are the same act at different scopes —
  one provisioning path, tenant-flavored.
- **Enterprise** never means "a business" and is never a tenant *type*. When you see
  "set up your Enterprise" in onboarding copy that means "provision your first
  Endeavor," that's the drift Ken flagged — reword it. The only legitimate
  Enterprise-as-toggle is the root-portal marker (the `Platform` tenant).
- **Diocese** is the federation/trust word for the same root; keep it where the
  federation/economy context calls for it, but know it == Enterprise == Platform.
- Structural identifiers (collection slugs, field names, TS unions, package names)
  are **not** part of this pass — renaming a slug is a migration. This pass is
  vocabulary and surfaces, not schema. (The `Tenants.type` select is label-only
  cleanup: values `platform`/`tenant`/`ministry` stay; only display strings change.)

---

## 0. Prerequisites

- **Node** `^18.20.2 || >=20.9.0`
- **pnpm** (this repo is pnpm-only; the lockfile is frozen in CI — never hand-edit
  a dependency version without running `pnpm install --lockfile-only` after, or
  the deploy fails `ERR_PNPM_OUTDATED_LOCKFILE`)
- **PostgreSQL** database you can reach (Neon, Supabase, RDS, local — anything with
  a connection string). A connection pooler (PgBouncer) is fine and recommended
  for serverless.

---

## 1. The minimum env (this is the whole hard requirement)

Copy `.env.example` → `.env` (the dev runner `scripts/dev-with-env.mjs` reads `.env`;
Next.js reads `.env.local` — for local dev set both, or just `.env`). The **only two
truly required** values to boot:

```bash
DATABASE_URI=postgresql://user:pass@host:5432/dbname
PAYLOAD_SECRET=$(openssl rand -hex 32)         # any long random string
PAYLOAD_CONFIG_PATH=src/payload.config.ts
NEXT_PUBLIC_SERVER_URL=https://your-node-domain     # http://localhost:3000 for local
PAYLOAD_PUBLIC_SERVER_URL=https://your-node-domain
```

### Pick a media store (one of)

- **Vercel Blob** (default, simplest): `BLOB_READ_WRITE_TOKEN=...`
- **Cloudflare R2** (zero egress — recommended at scale): set ALL FIVE
  `R2_BUCKET`, `R2_ENDPOINT` (`https://<account-id>.r2.cloudflarestorage.com`),
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` (`https://<pub>.r2.dev`
  or a custom domain). Media flips to R2 automatically when all five are present
  (`src/utilities/mediaStorage.ts`). Add your R2 public host to
  `next.config.js` `images.remotePatterns` (a `**.r2.dev` entry is already there).

### Give Leo a brain (needed for the AI guardian; a node boots without it, degraded)

At least one of: `ANTHROPIC_API_KEY` (Leo's default), `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`OPENROUTER_API_KEY` (image gen + multi-model), `GROQ_API_KEY`. The provider registry
is first-available-wins; a local Ollama also works (config-free intelligence).

### Email (needed for passwordless OTP login + invitations; optional otherwise)

`RESEND_API_KEY`, **or** the `SMTP_*` block. Without either, OTP still generates but
only logs the code (dev).

Everything else in `.env.example` (Stripe, LiveKit, Deepgram, ElevenLabs, Vapi,
Google/GitHub/Discord OAuth, Sentry, GA) is **optional** — enable a capability by
adding its keys, skip it otherwise.

---

## 2. Bring it up

```bash
pnpm install
pnpm build          # runs `payload migrate` (applies the schema) then `next build`
pnpm start          # serve the production build   (or: `pnpm dev` for local dev)
```

- `pnpm build` **migrates the database first** — a fresh Postgres becomes a full
  Angel OS schema. (Schema-before-deploy is a hard rule here: a new collection/field
  needs its migration before it can be used in prod.)
- **First admin:** visit `/admin`. With no users yet, Payload shows a create-first-user
  form → that user is your platform super-admin (`archangel`).
- **Health:** `GET /api/health` and load `/admin`. `POST /api/auth/system-token`
  (with `secretHash = sha256(PAYLOAD_SECRET).slice(0,32)`) mints a super-admin token
  for scripted ops.

### Or deploy to Vercel (recommended)

Import the repo, set the same env vars in the Vercel project (Production), deploy.
The build command already runs `payload migrate`. Point your domain at it; set
`COOKIE_DOMAIN=.yourdomain.com` for subdomain SSO across tenants.

---

## 3. Provision your first Endeavor (tenant)

Once Core is up and you've signed in as admin, create your first tenant/business
(an "Endeavor") at **`/dashboard/admin/provision`** — the fast ProvisionWizard
(identity → type → branding → Angel → launch). This is the single canonical
"create a new endeavor" surface. New personal users are also auto-provisioned a
guardian-angel portal on first sign-in.

> Note: there used to be three overlapping setup surfaces; as of 260714 there's one
> CREATE path (ProvisionWizard) and ongoing config lives in Settings. If you're an
> agent extending onboarding, keep it to those two — don't reintroduce a wizard.

---

## 4. Join the federation

**Today:** federation is behind a feature flag (`src/config/features.ts` →
`NEXT_PUBLIC_FEATURE_FEDERATION`), OFF by default (toggle-not-delete). Flip it on to
surface the federation UI on a node. The consolidation doctrine keeps
`spacesangels.com` as the primary production node; other nodes are testbeds/peers.

**Roadmap (not yet a one-call handshake):** a `POST /api/federation/join` endpoint
that registers a node with a peer and exchanges catalog/identity is the next
primitive. Until it lands, "joining" = enabling the flag + peering config. If you're
the agent building this, that endpoint is the highest-leverage next step — see
`docs/` federation notes and the `project_federation_*` design.

---

## 5. What good looks like (verify)

- `/admin` loads, first user created, you can log in.
- `/dashboard` renders for that user.
- Upload an image in a chat or the media library → it stores (Blob or R2) and
  renders. On R2, new media URLs are `*.r2.dev` and serve directly (zero egress).
- Ask Leo something in a channel → a reply streams (confirms an AI key works).
- OTP: `POST /api/auth/request-otp {email}` → a code emails (or logs in dev).

---

## 6. The other two bodies (optional)

- **Merlin** (`github.com/The-Angel-OS/merlin`, or `C:\Dev\merlin`): a long-lived
  Windows/Node worker — reverse tunnel + distributed compute + ffmpeg (video
  transcode). Connects to a running Core over the AI-bus. Not required for a node.
- **Nimue** (`github.com/The-Angel-OS/nimue`): the Android guardian client
  (Capacitor). Points at a Core host, signs in via Google OAuth or email-OTP.

---

**Design contract for agents extending this platform:** prefer config-free
inference over new settings ("if a feature requires config, it isn't done"); every
capability should be a **Leo tool first, UI button second**; new collections/fields
need a migration before use; verify the deploy is actually READY (a green push ≠
live). Keep this file current — it's the front door for the next agent that
replicates the node.
