# Handoff → Home Machine (2026-06-10)

**From:** work/dev machine (Windows Server 2019, `C:\Dev\angels-os`)
**To:** home machine
**Repo:** https://github.com/The-Angel-OS/angels-os (`origin/main`)

---

## TL;DR

1. The home machine **force-pushed a full history rewrite** of `origin/main` (no common ancestor with the old history). This is fine — but it stranded the work machine on a dead branch and **almost cost the Sprint 46 X/Twitter WIP.** See "What happened" below.
2. The work machine has now **reset to `origin/main`** and replayed its only local-only work (X/Twitter connector + MCP stderr fix + `pg` dep) on top.
3. **Action for home:** after the work machine pushes (commit `sprint46: x_twitter connector + MCP stderr guard + pg dep`), just `git pull --ff-only`. It will fast-forward cleanly.
4. **Going forward:** stop force-pushing rewritten history to `main`. Use normal commits + `pull --ff-only` on both machines. See "Avoid this next time."

---

## What happened

- `origin/main` was force-updated: `61106d6...0908d57 main -> main (forced update)`.
- The new remote history shares **zero commits** with the work machine's history (`git merge-base` returns nothing). It was rebuilt from scratch (rebased/squashed/reset), so every commit got a new hash even though the work is logically the same line back to the Feb 2 "Angel OS MVP" initial commit.
- Effect on the work machine: it showed `ahead 452 / behind 696` — but **none of the 452 were unique.** Every committed thing on the work machine (Sprint 45, Sprint 46 LEO + federation) already existed on the rewritten remote under a new hash. Confirmed: work-machine HEAD `fix: LEO tool tenant isolation (Sprint 46)` (Apr 29 22:45:34) == remote `05525b1`, identical message + timestamp.
- The **only** work that did not exist anywhere on the remote was uncommitted WIP on the work machine (see next section).

## What the work machine did

1. Created safety branch `backup/pre-reset-sprint46-2026-06-10` at the old HEAD `78f7d4c` (local only — not pushed).
2. Stashed all uncommitted + untracked WIP.
3. `git reset --hard origin/main` → now at `0908d57`.
4. Popped the stash and resolved 2 conflicts (`Connectors/index.ts`, `payload-types.ts`), keeping **both** the home machine's new `gotify` connector **and** the work machine's `x_twitter` connector.
5. `tsc --noEmit` clean (no source errors).

## Incoming work from the work machine (Sprint 46 WIP)

This is the local-only work being replayed on top of `0908d57` and pushed to `main`:

| File | Change |
|---|---|
| `src/collections/Connectors/index.ts` | Adds **X (Twitter)** connector type + config docs (sits next to your `gotify`) |
| `src/payload-types.ts` | Adds `x_twitter` to the connector-type union + JSON doc (kept your `gotify` too) |
| `mcp-server/index.ts` | Suppresses MCP stderr unless `ANGEL_OS_DEBUG` is set — **Cursor treats ANY stderr as MCP startup failure** |
| `package.json` / `pnpm-lock.yaml` | Adds `pg ^8.20.0` |
| `src/endpoints/x-post.ts` *(new)* | X/Twitter post endpoint (WIP — not yet wired into anything) |
| `src/utilities/xTwitterClient.ts` *(new)* | X/Twitter OAuth2 client helper (WIP) |

> The X/Twitter feature is **incomplete by design** — it was uncommitted WIP. The endpoint/client are not yet referenced by the rest of the app. It's the start of the Input Streams work (X/Twitter OAuth for Kenneth → Clearwater Cruisin).

## Action items for the home machine

1. **Pull the incoming WIP:**
   ```sh
   git fetch origin
   git pull --ff-only origin main
   ```
   This fast-forwards cleanly — the work machine's commit is built directly on `0908d57`.
2. **Install deps** (lockfile changed — `pg` added):
   ```sh
   pnpm install
   ```
3. **If you have your own uncommitted local work on the home machine**, commit or stash it *before* pulling.

## Avoid this next time

The root cause was **force-pushing a rewritten history to `main`** while another machine had unpushed work. To prevent a repeat:

- **Don't `push --force` / `push --force-with-lease` to `main`.** If history needs cleaning, do it on a throwaway branch, never on the shared trunk.
- **Both machines:** commit + push WIP at end of each session, and start each session with `git pull --ff-only`. Don't let a machine accumulate days of uncommitted work.
- If you ever *must* rewrite shared history, message the other machine first so it can stash + reset deliberately (as was done here) instead of discovering it via a forced-update surprise.

## Safety nets (work machine, local only — not pushed)

- Branch `backup/pre-reset-sprint46-2026-06-10` → old HEAD `78f7d4c` (the pre-rewrite history).
- `stash@{0}` "sprint46-wip: x_twitter connector + MCP stderr guard + pg dep" — kept until the push is confirmed landed.

Both will be cleaned up on the work machine once the push is verified on GitHub. The home machine does not need them.
