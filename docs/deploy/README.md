# Self-host stack — reference copies

The live files run from **`C:\Dev\datacenter\stack`**, which is **not a git
repository**. Everything the local stack depends on therefore existed on exactly
one disk, with no history and no backup. These are reference copies so the node
can be rebuilt from the repo alone.

> They are **copies, not the source of truth**. Edit the live files in the stack
> directory, then re-copy here. If the two ever disagree, the stack directory is
> what is actually running.

| file | what it does |
|---|---|
| `docker-compose.yml` | the whole stack — `postgres` 17, `pgbouncer` (transaction mode), `core`, `heartbeat`. Project name `angelos`. |
| `heartbeat.crontab` | the 8 scheduled jobs that used to run as Vercel Cron. **`angels-os/vercel.json` is the schedule of record** — change both. |
| `heartbeat.sh` | `hit <path>` — one wget per job with `Authorization: Bearer $CRON_SECRET`. |
| `cloudflared-config.yml` | **the ingress map** — which hostname goes to which local port. Lives at `~/.cloudflared/config.yml`, which is on one disk and in no repo. Specific hostnames MUST sit above the wildcards. |
| `tunnel.cmd` / `run-tunnel.cmd` | cloudflared with a crash-restart loop. Config: `~/.cloudflared/config.yml`, one tunnel split by hostname. |
| `register-tunnel-task.ps1` | registers the tunnel as a scheduled task (needs elevation). |
| `rebuild.cmd` | rebuild + redeploy `core`. |

## Bring it up

```bash
cd C:/Dev/datacenter/stack
docker compose up -d
```

## Things that will bite you

- **`C:\Dev\angels-os\.env.local` is the ONE env file the container reads.** The
  compose `environment:` block overrides it for `DATABASE_URI`, `NODE_ENV`,
  `PORT`, `NEXT_PUBLIC_SERVER_URL`, `COOKIE_DOMAIN`, `DEFAULT_TENANT_SLUG`.
  `stack/.env` holds only `PGUSER`/`PGPASS` for compose interpolation — not app keys.
- **`NEXT_PUBLIC_*` is baked at BUILD time.** Changing one needs
  `docker compose up -d --build core`, not `--force-recreate`.
- **Core is on host `:3001`**, container `:3000`. Merlin owns host `:3000`. Do not
  re-add a 3000 mapping.
- **The heartbeat is the platform's pulse.** Without it there is no inbound email,
  no connector health, no nightly `verify-onboarding` (the self-heal for partial
  provisions) and no log consolidation. `docker logs angelos-heartbeat` to check.
