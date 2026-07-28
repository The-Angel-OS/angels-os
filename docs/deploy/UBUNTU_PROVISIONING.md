# Provisioning the Ubuntu server

> Written 260728 for David Christenson's box, but nothing here is Kessela-specific.
> Follow it top to bottom. **Assume nothing** — every command is written out.
>
> Related: [`RUNBOOK_CONTINUITY.md`](../RUNBOOK_CONTINUITY.md) §2b (Cloudflare),
> [`../kessela/ACCOUNTS_SETUP.md`](../kessela/ACCOUNTS_SETUP.md) (what to buy).

---

## 0. What this box is, and what it isn't

**It IS:** the production node. Postgres, PgBouncer, Core, the heartbeat, Gotify,
Uptime Kuma, and the Cloudflare tunnel. Plus an always-on place to hand work to an
agent.

**It ISN'T your development machine.** A `docker compose --build` pegs the CPU for
two or three minutes. Do that on the box serving the client's site while the
client is looking at it, and they see a slow site or a container swapping under
them. Yesterday alone had eight rebuilds. Build on the laptop; deploy here.

**The single best reason to move:** `systemctl enable` makes the tunnel start
itself. On the laptop nothing does, so a reboot takes every site offline until a
human notices (RUNBOOK §2b). That gap closes the moment this box exists.

---

## 1. Order the machine

**IONOS Cloud VPS**, Ubuntu 24.04 LTS. Target ~$30/mo — 12 vCore / 24 GB / 640 GB
is the sweet spot. Below 8 GB RAM the Next.js build will OOM.

Note the **root password** and the **public IPv4** from the IONOS panel.

---

## 2. First login and lockdown

```bash
ssh root@<IP>
```

```bash
apt update && apt -y upgrade
adduser angel                 # set a real password
usermod -aG sudo angel
rsync --archive --chown=angel:angel ~/.ssh /home/angel   # carry your key over
```

Turn off password logins — this box will have a live database on it:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

⚠️ **Open a SECOND terminal and confirm `ssh angel@<IP>` works before closing
this one.** Getting the key wrong here locks you out of your own server.

Firewall — nothing but SSH is exposed, because the tunnel makes the machine
reachable without opening ports:

```bash
ufw allow OpenSSH && ufw --force enable && ufw status
```

---

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker angel
newgrp docker            # or log out and back in
docker run --rm hello-world
```

---

## 4. The code

```bash
sudo mkdir -p /srv && sudo chown angel:angel /srv
cd /srv
git clone https://github.com/The-Angel-OS/angels-os.git
mkdir -p /srv/stack /srv/services
```

Copy `docker-compose.yml`, `heartbeat.crontab` and `heartbeat.sh` from
`docs/deploy/` into `/srv/stack/`.

### ⚠️ Paths must be rewritten — the compose file is Windows-shaped

Every volume currently reads `C:/Dev/...`. On Linux:

| Windows | Linux |
|---|---|
| `C:/Dev/angels-os/.env.local` | `/srv/angels-os/.env.local` |
| `C:/Dev/datacenter/stack/heartbeat.crontab` | `/srv/stack/heartbeat.crontab` |
| `C:/Dev/datacenter/stack/heartbeat.sh` | `/srv/stack/heartbeat.sh` |
| `C:/Dev/datacenter/services/gotify` | `/srv/services/gotify` |
| `C:/Dev/datacenter/services/uptime-kuma` | `/srv/services/uptime-kuma` |

```bash
sed -i 's#C:/Dev/angels-os#/srv/angels-os#g; s#C:/Dev/datacenter/stack#/srv/stack#g; s#C:/Dev/datacenter/services#/srv/services#g' /srv/stack/docker-compose.yml
grep -n 'C:/' /srv/stack/docker-compose.yml    # must print nothing
chmod +x /srv/stack/heartbeat.sh
```

---

## 5. Secrets

`.env.local` is **the one file the container reads**. It is not in git and never
should be. Copy it from the laptop:

```bash
scp C:/Dev/angels-os/.env.local angel@<IP>:/srv/angels-os/.env.local
```

```bash
chmod 600 /srv/angels-os/.env.local
```

**Change on the server before starting anything:**

- `NEXT_PUBLIC_SERVER_URL` and `PAYLOAD_PUBLIC_SERVER_URL` → the real hostname.
  ⚠️ `NEXT_PUBLIC_*` is baked in at BUILD time — it must be right before you
  build, and changing it later needs a rebuild, not a restart.
- `DATABASE_URI` → points at the PgBouncer container.

---

## 6. Database

Fresh node:

```bash
cd /srv/stack
docker compose up -d postgres pgbouncer
docker compose exec postgres psql -U postgres -c "CREATE DATABASE angels;"
```

Migrating the existing one — dump on the laptop, restore here:

```bash
docker exec angelos-pg pg_dump -U postgres -Fc angels > angels.dump
scp angels.dump angel@<IP>:/srv/
```

```bash
docker cp /srv/angels.dump angelos-pg:/tmp/angels.dump
docker compose exec postgres pg_restore -U postgres -d angels --no-owner /tmp/angels.dump
```

Guard the failure that has taken this platform down before — an idle transaction
holding a lock until the connection pool starves:

```bash
docker compose exec postgres psql -U postgres -d angels -c \
  "ALTER DATABASE angels SET idle_in_transaction_session_timeout = '60s';"
```

---

## 7. Build and start

```bash
cd /srv/stack
docker compose up -d --build core
docker compose up -d heartbeat gotify uptime-kuma
docker ps
```

⚠️ **`docker compose up --build` exits 0 even when the BUILD FAILED** — the old
container keeps serving and everything looks healthy. Always confirm the age in
`docker ps` is in **seconds**. This has caught us more than once.

Migrations run automatically on container boot.

---

## 8. Cloudflare tunnel — and the reason this box exists

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cf.deb
sudo dpkg -i /tmp/cf.deb
sudo mkdir -p /etc/cloudflared
```

Copy `config.yml` and the credentials JSON from
`C:\Users\kenne\.cloudflared\` into `/etc/cloudflared/`, then fix the paths inside
`config.yml` (`credentials-file:` and the `service:` ports).

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
systemctl status cloudflared
```

**`systemctl enable` is the whole point.** A reboot now brings the sites back
without a human.

⚠️ **Never run the same tunnel ID in two places.** Cloudflare load-balances across
them and requests land on whichever host answers — including the one without the
current database. **Stop the laptop's tunnel before starting this one.**

⚠️ Ingress order matters: specific hostnames ABOVE the wildcards, or `merlin.*`
gets swallowed. That has broken twice (RUNBOOK §2b).

---

## 9. Backups — the thing nobody does until they need it

The database must not live only on the box that might die.

```bash
sudo tee /usr/local/bin/angel-backup >/dev/null <<'SH'
#!/bin/bash
set -euo pipefail
OUT=/srv/backups/$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"
docker exec angelos-pg pg_dump -U postgres -Fc angels > "$OUT/angels.dump"
tar czf "$OUT/services.tgz" -C /srv services
find /srv/backups -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
SH
sudo chmod +x /usr/local/bin/angel-backup
```

```bash
sudo crontab -e
# 0 3 * * * /usr/local/bin/angel-backup
```

**Then push it off the box** — R2 with `rclone`, or scp to the laptop. A backup
sitting on the machine it is backing up is not a backup. This is the single
cheapest insurance in the whole stack.

---

## 10. Claude Code — the always-on agent

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs tmux
sudo npm i -g @anthropic-ai/claude-code pnpm
claude --version
```

First run prints a URL — open it on your laptop, sign in, paste the code back.
One time only.

**Always run it inside tmux**, or a dropped SSH connection kills a job mid-flight:

```bash
tmux new -s angel      # start
claude
# detach: Ctrl-b then d
tmux attach -t angel   # come back later, from anywhere
```

Headless, for scripted or scheduled work:

```bash
claude -p "check the heartbeat ran and report anything that failed"
```

### What to actually use it for

Long jobs you do not want tied to a laptop being awake: log triage, migrations,
backup verification, the nightly self-heal. **Not** interactive development —
that competes for CPU with the site the client is looking at.

---

## 11. Editing from anywhere, without moving your workflow

**VS Code Remote-SSH** is the right answer: local editor, remote files, no
workflow change and no second machine to maintain. `code-server` in a browser is
the fallback if you need it from a device without VS Code.

Neither makes this a dev box — they let you *fix* things here, which is different
from *building* here.

---

## 12. Done when all of these are true

```bash
docker ps                                   # 6 containers, core age in SECONDS
systemctl is-enabled cloudflared            # enabled
curl -s -o /dev/null -w '%{http_code}\n' https://spacesangels.com    # 200
curl -s -o /dev/null -w '%{http_code}\n' https://kessela.spacesangels.com/buy-kessela-now  # 200
sudo /usr/local/bin/angel-backup && ls -la /srv/backups              # a dump exists
```

**Then reboot it.** `sudo reboot`, wait two minutes, and curl again. If the sites
come back with nobody touching anything, the main thing this box was bought for
is working.

---

## 13. Afterwards

- **Stop the laptop's tunnel** — two tunnels, one ID, unpredictable routing.
- **Point Uptime Kuma at the laptop**, not just at itself.
- **Keep one external monitor** (UptimeRobot free tier) aimed at this server.
  Kuma cannot report its own death, and neither can this box.
