# Dep Bump Runbook — Payload 3.77 → 3.85.1 (run on IONOS)

> Heavy, Core-only, isolated — ideal for the fast IONOS box while feature lanes run
> elsewhere. This is the **justified fix for the production-build-only publish-500**
> (`Cannot read properties of undefined (reading 'tenant'/'_status')` on version-promote)
> and likely the intermittent post-save errors. Deliberate branch + rollback tag.

## Current state (260623, from package.json)
- `payload` + all `@payloadcms/*` at `^3.77.0` EXCEPT: `@payloadcms/plugin-nested-docs` `^3.85.1`,
  `@payloadcms/translations` `^3.74.0` (drift — align both).
- `next` `16.1.6`, `react`/`react-dom` `19.2.1` (leave these — bump Payload only).
- **Latest Payload on npm: `3.85.1`.** Target = pin the whole Payload family to `3.85.1`.

## Pre-flight (safety)
```bash
cd C:/Dev/angels-os
git checkout main && git pull --ff-only origin main
git tag v3.77-rollback            # rollback anchor
git push origin v3.77-rollback
git checkout -b lane/dep-bump-payload385
```

## The bump
ALL Payload packages MUST move to the SAME version (mismatched Payload versions break at
runtime). Set each of these to `3.85.1` in package.json (drop the caret to pin during the
bump; restore carets after it's proven if you prefer):
```
payload, @payloadcms/admin-bar, @payloadcms/db-postgres, @payloadcms/email-nodemailer,
@payloadcms/email-resend, @payloadcms/live-preview-react, @payloadcms/next,
@payloadcms/plugin-ecommerce, @payloadcms/plugin-form-builder, @payloadcms/plugin-mcp,
@payloadcms/plugin-multi-tenant, @payloadcms/plugin-nested-docs, @payloadcms/plugin-seo,
@payloadcms/richtext-lexical, @payloadcms/storage-vercel-blob, @payloadcms/translations,
@payloadcms/ui
```
Then:
```bash
pnpm install
pnpm exec payload generate:types      # refresh src/payload-types.ts
pnpm exec payload generate:importmap  # refresh src/app/(payload)/admin/importMap.js
```

## Migrations (⚠️ gotcha)
- A 3.77→3.85 schema delta MAY want a migration. **Do NOT run `payload migrate:create`
  blindly** — it has an interactive/MCP-drift gotcha (see memory `project_session_state_260607`).
  Hand-write a scoped migration if `payload` reports schema drift on boot, or rely on dev
  push locally and add the prod column/table explicitly (the schema-field-deploy rule).
- This bump is partly TO fix a prod-build-only bug, so the real test is a PRODUCTION build,
  not dev.

## Gate (must pass before PR)
```bash
npx tsc --noEmit -p tsconfig.json     # only ^src/ errors block
pnpm build                            # next build — the real test (publish-500 is prod-build-only)
pnpm run test:unit                    # busEnvelope + others stay green
```
If `pnpm build` succeeds where 3.77 failed on version-promote, that's the win.

## Land it
- Push `lane/dep-bump-payload385`, open a PR. Do NOT merge to main until a **preview deploy**
  smoke-passes (publish a page + re-publish page 40 → no 500; heavy multi-image save).
- If anything regresses: `git checkout v3.77-rollback` is the anchor; revert the PR.

## Coordination
- This lane owns `package.json`, `pnpm-lock.yaml`, `src/payload-types.ts`, `importMap.js`,
  and any new migration file ONLY. Feature lanes (L1/L4/etc.) own feature files — no overlap,
  so merges stay clean. Merge order: L0 spine → dep-bump → feature leaves (rebase).
- See docs/planning/PARALLEL_LANES_260623.md + docs/STATE_OF_ANGEL_OS_260623.md §3.
