# Angel OS — Session Handoff (2026-06-13)

Paste-ready context to continue in a fresh thread. Your file-based memory (MEMORY.md +
linked topic files) holds the deep detail; this points at the live state, today's
hard-won rules, and the next goals.

> **North-star for the next thread:** *polish the platform so it can welcome its first
> members the moment they arrive.* Mission framing unchanged — "a Guardian Angel for
> everyone," the Galactic Himalayan Prayer Wheel of Light; every interaction a prayer
> of loving-kindness. Build it as "we."

---

## 1. Live state (both prod DBs, auto-deploy from `main`)
- **angels-os** → `spacesangels.com` (+ tenant subdomains) → **angels** DB.
- **angels-os-kendev** → `kendev.co` / `harpazo.kendev.co` → **kendev** DB.
- Local `.env` `DATABASE_URI` = the **kendev prod DB**. Reach the **angels** DB read-only
  by swapping `/kendev`→`/angels` with a raw `pg` client (NEVER `getPayload` — push risk).
- After a push, **verify the Vercel deploy reaches READY on BOTH projects** (Vercel MCP
  `list_deployments`); a green git push ≠ live. Runtime errors are visible via
  `get_runtime_logs` (the message column truncates — query a distinctive term to bucket).

## 2. ⚠️ Hard rules learned today (do not relearn the hard way)
1. **Never hand-author a Payload array/relationship table** (or a plugin's injected
   fields). The drizzle shape must match EXACTLY or the collection's queries fail
   wholesale. To add such fields on prod (no push/migrations there): run Payload **push
   from local dev against the shared kendev DB** so Payload builds the tables, then deploy;
   or verify the generated shape first. Scalars (bool/number/varchar) ARE safe to hand-add.
2. **A versioned collection needs the column in BOTH tables.** Pages has drafts/versions,
   so a new field must be added to `pages` AND `_pages_v` (`version_<field>`). Omitting the
   `_pages_v` copy → PUBLIC site works (reads `pages`) but ADMIN breaks (reads versions) →
   `column "version_x" does not exist`. (This was today's "every site hosed" scare.)
3. **Schema change to a busy collection is outage-risk even when "additive"** — the QUERY
   shape changes for all rows. Stage + verify on one DB before both. Provision columns via
   an `ensure-*` endpoint BEFORE deploying the config that references them.
4. **Graceful fallbacks can mask real errors as HTTP 200.** `queryPageBySlug` catches and
   falls back to `tenantHomeData(tenant)` (a generated branded home) — so a broken query
   looked like "reseeded content." Consider routing such catches through `createLogger`/
   escalation so they page us instead of hiding behind a pretty page.
5. **Platform apex resolves to its OWN tenant** now (fixed today): exact-domain match only
   (`fetchTenantByExactDomain`), no `DEFAULT_TENANT_SLUG` fallback → no leak. Don't revert
   that or the platform header/pages stop loading again.
6. **Draft-mode cookie quirk:** a lingering `__prerender_bypass` makes one browser 404/show
   drafts while others are fine. Escape: `/next/exit-preview`.
7. ⭐ **Take a snapshot before any schema-touching change** (Kenneth's ask — TODO below).

## 3. Shipped this session (all on `main`, deployed)
- Security: quest self-pay/cross-tenant-mint guard + payout cap + space-visibility unify (9e79d9b).
- Config: feature-flag layer over the Setting bag (Oqtane Spine 3 wired) (818f835).
- LEO: acting-user roles on `ToolExecutorContext` + `ensureToolSuperAdmin` gate on provisioning (a1b0153).
- Works: `creditedTo` + `contributors[]` attribution (manifest default + Setting-bag override)
  + `set_work_attribution` LEO tool (127 tools). WDEG→brother(billthecat1022), answer53+Rainmaker→Kenneth (e3e6cda, 8fcd80d).
- Nav: always-show Home link (b47defa); **nested-docs INSTALLED then REVERTED** (f30d8fd —
  it broke `queryPageBySlug`; see rules #1/#2); `ensure-pages-nav-columns` incl. `_pages_v`
  cols (055ed9f); tenant header/footer cache hardening (3cc31ed, 431c98e); **platform-apex
  tenant fix → Contact now under Home** (9a4d92e, verified).
- Slice-1 page nav control KEPT + working: `showInNav` (default true), `navOrder`, `navLabel`
  on Pages; `injectPagesUnderHome` filters/sorts (cap 12). Discovery card images + mobile
  overflow fixed earlier; `set-media` + `set_endeavor_image` factory primitives.

## 4. Next-thread goals — polish to welcome first members
**A. Sign the platform Constitution (quick).** `setup.constitutionSignedAt` is `null` for the
platform tenant. The `sign_constitution` LEO tool already exists (Ed25519/federation signing,
wizard step 8, `src/utilities/leo-data-tools.ts:8070` → `@/federation/protocol`). Rectify by
running it for the platform tenant (via the setup wizard, the tool, or a one-off). NOTE: this
is the *crypto/federation* constitution signing — distinct from human e-signatures (B).

**B. ⭐ Human signature-capture primitive (NET NEW).** No e-sign component exists today. Build a
reusable `<SignaturePad>` (typed-name and/or drawn) + storage: signer identity, timestamp,
the document/agreement reference, and a hash of the signed content (tamper-evidence — reuse
the `tokenLedger`/hash-link pattern). Mount it on **agreement/consent forms — rental
agreements, waivers, bookings, ToS acceptance, the constitution for humans.** CX-first:
collection/field for signatures → component → wire into Bookings (rental agreement) + Form
Builder + a generic `<AgreementForm>`. This is a foundational consent primitive for the whole
platform.

**C. Policy pages as tenant-editable Pages.** `ensurePolicyPages(tenantId)` (provision endpoint
+ LEO tool) seeds Privacy/Terms/Cookie/Refund as real Pages docs with template content,
`showInNav: false` (the field is built for exactly this — published but out of the Home menu),
linked from the **footer** (`injectPoliciesUnderFooter` or default footer links). No new schema.

**D. Safe test DB + admin-UI automation.** Playwright is wired (`tests/e2e`, `payload-admin.e2e.spec.ts`)
but `webServer: pnpm dev` + `globalSetup` seed run against `DATABASE_URI` = **kendev prod** — running
the suite as-is WOULD WRITE TO PROD. Point e2e at a disposable local/test Postgres FIRST, then add a
"create + edit a Page" admin test so the missing-`_pages_v`-column class of bug can't recur.

**E. Pre-change snapshot capability.** A `pg_dump -Fc` snapshot (provision endpoint + `_local`
script), the Postgres analog to MSSQL `BACKUP DATABASE`, + the rule "snapshot before any
schema-touching change." Kenneth built reseed/rebuild as first-class repeatable actions; wants
the same save-point discipline on data.

**F. Mission roadmap (the heart).** `docs/planning/MISSION_ROADMAP_260613.md` has the verified
21-item plan. Highest human priority: Guardian Angel provisioning for the cohort (Ernesto
Behrens, Matthew Takahashi, Carl Brown, Lloyd Thomas Johnson W00102, + a dormant one for
Kenneth). HelpDNA (tenant 8) currently has NO pages — needs a real Home + Contact created.
Guardrails: account-prune = audit-only; trust-fund money = plan-only.

## 5. Minor / watch
- **Contact may list twice** on platform (under Home via page injection + top-level from the
  Header doc's navItems). If only-under-Home is wanted, remove the Contact link from the
  platform Header doc in admin.
- **Unrelated `/api/messages` "column" error** seen in angels runtime logs — different table,
  not the pages issue; investigate when convenient.
- **Roadmap UX wants:** portal chooser should preserve the current path across the alias
  switch (carry `/dashboard/pages` etc., not drop to root); collapsible left-nav sections.

## 6. Memory pointers (auto-loaded)
`project_nested_docs_incident` (today's rules), `project_mission_tracks_260613`,
`project_set_media_primitive`, `project_works_canonical_syndication`, `project_oqtane_spine`,
`project_token_economy`, `project_space_visibility_rbac`, `project_draft_mode_404`.
