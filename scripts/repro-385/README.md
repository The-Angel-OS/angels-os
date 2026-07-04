# Repro #1 — capture the Payload 3.85.1 init stack (run on IONOS / Iam0-Administrator box)

**Goal:** make the 3.85.1 prod outage happen locally and read the exact init error that
Next 16 prod hides behind `Failed to handle /…`. Output is a precise table/column/enum name
→ the migration writes itself.

**Why this box:** it has pg access, the `angelsdev` scratch DB already created, and the
git history with both versions. Fully isolated — the script's hard guard can never touch
live `angels`.

## What it reproduces
Prod runs Payload with **push OFF**. The 3.85 code, started against the drifted 3.77 live
schema, throws at `getPayload()` init → every route 500s. We recreate that exact pairing:
a **3.77-shaped scratch DB** + **3.85 code with push off**.

## Steps

```bash
# from repo root, on a clean tree (commit/stash any work first)
git fetch --all --tags

# 1) Seed the scratch DB with the 3.77 schema (matches live `angels`)
git checkout v3.77-rollback        # the 3.77 anchor tag (or: git checkout 3047410)
pnpm install                       # switch deps to 3.77
npx tsx scripts/repro-385/repro-init.ts seed
#   -> creates DB `angelsdev2` if missing, pushes the 3.77 schema into it.
#   -> expect: "[seed] ✅ schema pushed to angelsdev2"

# 2) Probe with 3.85 code, push OFF (== prod conditions)
git checkout a864a9a               # 3.85.1 (PR #133 head). NOTE: this script file only
                                   # exists on main/now — re-copy it into the 3.85 tree,
                                   # OR cherry-pick this commit, OR keep it untracked:
                                   #   the script has no repo deps beyond `payload` + `pg`.
pnpm install                       # switch deps to 3.85.1
npx tsx scripts/repro-385/repro-init.ts probe
#   -> EXPECT IT TO THROW. The full stack prints to console AND
#      scripts/repro-385/init-error-probe.txt
```

> ⚠️ The script lives on `main` (3.77 now). When you `git checkout a864a9a`, this file
> won't be present in that tree. Easiest: **copy `scripts/repro-385/` aside before checkout**
> (e.g. `cp -r scripts/repro-385 /tmp/repro-385`) and run the probe from there, or just
> keep the two files untracked across the checkout. It imports only `payload`, `pg`,
> `dotenv` + `src/payload.config.ts`, all present in the 3.85 tree.

## Reading the result
- **`init-error-probe.txt` has a stack naming a column/table/enum** → that's the culprit.
  Write an idempotent migration for it (match the onInit self-heal pattern in
  `src/payload.config.ts` ~L823–1027), apply to `angels`, then re-attempt the 3.85 deploy
  via a **preview** first.
- **Probe initializes WITHOUT throwing** → the outage is NOT a pure init-validation throw.
  Re-confirm step 1 actually ran on 3.77 code and push was off in step 2. If it still
  won't reproduce, the failure is request-path (not init) — pivot to a preview deploy
  pointed at `angelsdev` and reproduce by hitting `/`.

## Cleanup
```bash
git checkout main && pnpm install          # back to the stable 3.77 main
# drop the scratch DB when done (psql/pg): DROP DATABASE angelsdev2;
```

## Env it needs (already on this box)
`DATABASE_URI` (or `DATABASE_URL`), `DATABASE_SSL=require`, `PAYLOAD_SECRET` — read from
`.env.local` then `.env`, same loader as `scripts/dev-with-env.mjs`. Override the scratch
name with `SCRATCH_DB=...` if `angelsdev2` collides.
