# Runbook — OpenCode (mimo v2.5) doing the lifting

> Audience: a coding agent with a small/cheap model. Written to be followed
> literally. If a step here disagrees with the code, the code wins — fix this file.
>
> Companion docs: [AGENTS.md](../AGENTS.md) (stand up a node),
> [KESSELA_CONFORMANCE.md](KESSELA_CONFORMANCE.md) (the current work queue),
> [FOOTGUNS.md](FOOTGUNS.md), [GLOBAL_PUNCH_LIST.md](GLOBAL_PUNCH_LIST.md).

## 0. Rules that override everything

1. **LIVE is Railway.** `*.spacesangels.com` is served by Railway. The local
   Postgres copy is **stale** — never do data work against it and call it done.
   Verify the target before writing: `curl -sI https://<host>` → `Server: railway-hikari`.
2. **Never `DELETE` a Payload row directly** for spaces/tenants. Deletes orphan
   (every FK into `spaces` is `ON DELETE SET NULL`). Use the `-ops` endpoints below.
3. **Everything you write must be idempotent** — find-or-update, never blind insert.
   You will run it twice. So will someone else.
4. **Ask before publishing medical/legal claims.** Kessela drafts make medical
   claims; mirroring an existing site is allowed, inventing copy is not.
5. **Never hardcode a future date. Never `limit: 0`-and-hope** (`limit: 0` means
   unlimited; for counts use `payload.count()`).
6. Test gate is `pnpm test:unit` only. A red run means your diff.

## 1. The two ways to do work

| | Use it for | Auth |
|---|---|---|
| **A. HTTP `-ops` endpoint** | provisioning, deprovisioning, membership, anything with a blast radius | `super_admin` session **or** `?key=$CRON_SECRET` |
| **B. `pnpm payload run <script>`** | content shaping — nav, blocks, page layout, copy | boots Payload against `DATABASE_URI` |

Prefer **A**. Reach for **B** only when no endpoint exists. If you write a script
that you'd want to run again on another tenant, say so at the end of your report —
that's a missing endpoint.

### A. Endpoint call shape

```bash
curl -s -X POST "$NODE/api/provision-ops/portal?key=$CRON_SECRET" -H 'content-type: application/json' -d '{"name":"Acme","slug":"acme","domain":"acme.spacesangels.com"}'
```

`$NODE` = `https://<tenant>.spacesangels.com` (live) — set it once, never inline a
guessed host.

### B. Script shape (copy this skeleton exactly)

```ts
/**
 * One sentence: what and why.
 * Run: pnpm payload run src/scripts/_local/<name>.ts
 * Idempotent — re-running updates in place.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 30
const payload = await getPayload({ config })   // top-level await — REQUIRED
```

**`payload run` does not await a floating `main()`.** Top-level await or the
script silently no-ops. Put scripts in `src/scripts/_local/`. Use
`./_updatePageLayout` for block edits rather than hand-rolling layout arrays.

## 2. Provisioning

| Task | Call |
|---|---|
| New portal/tenant (tenant + endeavor + nav + pages + admin) | `POST /api/provision-ops/portal` |
| Diagnose who owns header/settings/pages for a tenant | `GET /api/provision-ops/tenant-doctor?tenant=<id>` |
| Create a space | `POST /api/space-ops/create` |
| Add default channels to a space | `POST /api/space-ops/provision-channels` |
| Invite a member | `POST /api/space-ops/invite` (resend: `/invite/resend`) |
| Add / remove members | `POST /api/space-ops/members/add` · `/members/remove` |
| Set any image field (logo, cover, meta.image) | `POST /api/provision-ops/set-media` |

Provisioning is find-or-create. Running it again on an existing slug is safe and is
the correct way to repair a half-provisioned tenant.

**After provisioning, always:** `GET /api/provision-ops/tenant-doctor` and paste the
result into your report. Do not declare success from a 200 alone.

## 3. Deprovisioning

There is no "delete a tenant" button and you must not invent one.

- **Space:** `GET /api/space-ops/delete?spaceId=33&reassignTo=47` returns **the plan
  and changes nothing**. Read it. Then `POST /api/space-ops/delete` with the same
  arguments to execute. Channels move to the destination; same-slug channels
  **merge**. Destination must be the same tenant. The **AI Bus space can never be
  deleted**. Requires tenant_admin on that tenant — a space_admin is not enough.
- **Messages key on channel SLUG *and* `channelRef`** — a merge has to rewrite both.
- **Tenant:** do not. Unpublish/depublish pages, remove memberships, and report to
  Ken. A tenant delete is a human decision.
- **Media is shared** across a teleport/clone — deleting the row can break another
  tenant's page. Leave media alone unless told otherwise.

## 4. Content conformance work (the Kessela pattern)

The recurring job: an existing WordPress site is the reference, our tenant is the
mirror, and the words are migrated but the **structure** isn't — 229 generic
`content` blocks doing what typed blocks (`faq`, `cta`, `three_item_grid`,
`media_text`, `trust_row`) should do.

Loop, one section per run:

1. Read the reference section. Copy the wording **verbatim**. Do not normalise
   inconsistencies (Kessela says both "Kessela Physique" and "Kessela Elite
   Core-Contouring Belt" — mirror both, flag it, don't fix it).
2. Find the typed block. It usually already exists elsewhere in the tenant —
   `faq` and `cta` were already on `buy-kessela-now` before they were on home.
3. Write one idempotent `_local` script using `_updatePageLayout`.
4. `pnpm payload run` it against **live**.
5. `curl -s https://<host>/<path> | grep -o '<the new headline>'` — prove it rendered.
6. Commit. One section, one commit.

Current queue: [KESSELA_CONFORMANCE.md § Suggested order](KESSELA_CONFORMANCE.md).

## 5. Before you say you're done

```bash
pnpm test:unit
```

Then, in your report, in this order:
- The exact commands you ran.
- The verification output (curl / tenant-doctor), pasted, not summarised.
- What you **didn't** do and why.
- Anything you had to do by curl that should have been a LEO tool or an endpoint.

Never report success for a step you didn't verify. "It returned 200" is not
verification; "the page HTML contains the new headline" is.

## 6. Escalate to a human, don't guess

- Publishing draft pages that make medical, legal, or financial claims.
- Deleting a tenant, media, or any row without an `-ops` endpoint.
- A schema change (new collection/field/enum) — the prod column must exist
  **before** the deploy. That is a migration, not a script.
- Anything touching Stripe, auth, or `.env` on live.
