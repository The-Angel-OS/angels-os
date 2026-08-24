#!/usr/bin/env bash
# Angel OS node — post-install bootstrap. Run ONCE, over SSH, after the
# autoinstall reboots:
#
#   ssh angel@angel-node-01.local 'bash -s' < bootstrap.sh
#
# Idempotent: safe to re-run. It installs Docker, gives the box swap, lays out
# the stack directory, and stops. It deliberately does NOT fetch secrets or
# start anything — see the checklist it prints at the end.
set -euo pipefail

say() { printf '\n\033[1;36m── %s\033[0m\n' "$*"; }

# ── Docker, from Docker's own repo ───────────────────────────────────────────
# Not `apt install docker.io`: that package lags and has no compose v2 plugin,
# and `docker compose` (not `docker-compose`) is what the stack file expects.
if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker"
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
else
  say "Docker already present — skipping"
fi

# ── Swap ─────────────────────────────────────────────────────────────────────
# 8 GB is enough to RUN this stack but leaves no cushion for a bad moment.
# Swap does not make the box fast; it makes the difference between a stall and
# the OOM killer taking Postgres out mid-write.
# Match ANY existing swap, not just a file we happened to name /swapfile.
# Ubuntu 26.04 ships its own 4G /swap.img, so checking for our own name gave the
# box 8G of swap on an 8G machine — 4G of SSD spent on a cushion never used twice.
if [ -z "$(swapon --show --noheadings)" ]; then
  say "Creating 4G swapfile"
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
else
  say "Swap already present — skipping"
fi
# Prefer RAM heavily — swap is the safety net, not the working set. Set this
# regardless of who created the swap.
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-angel-swappiness.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/99-angel-swappiness.conf

# ── Is this thing a spinning disk? ───────────────────────────────────────────
# The one spec that can disqualify the machine. Postgres on 5400 rpm is misery
# no amount of RAM fixes, and you want to know now rather than in week two.
say "Disk check"
lsblk -d -o NAME,ROTA,SIZE,MODEL | awk 'NR==1 || $2==0 || $2==1'
if lsblk -d -o ROTA,NAME | awk 'NR>1 && $1==1 {found=1} END{exit !found}'; then
  printf '\n\033[1;33m⚠  A ROTATIONAL (spinning) disk is present. If root is on it,\n'
  printf '   stop and fit an SSD before trusting this node with Postgres.\033[0m\n'
fi

# ── Layout ───────────────────────────────────────────────────────────────────
say "Creating /opt/angelos"
sudo mkdir -p /opt/angelos/{stack,backups}
sudo chown -R "$USER":"$USER" /opt/angelos

# ── Nightly backup ───────────────────────────────────────────────────────────
# The whole database is ~86 MB. There is no excuse for not having this on day
# one, and every hour you delay is an hour of unbacked-up production.
say "Installing nightly pg_dump"
cat > /opt/angelos/backup.sh <<'BACKUP'
#!/usr/bin/env bash
# Nightly logical backup. Keeps 14 days locally; push to R2 separately.
set -euo pipefail
cd /opt/angelos
OUT="backups/angels-$(date +%Y%m%d-%H%M%S).sql.gz"
docker exec angelos-pg pg_dump -U "${PGUSER:-postgres}" angels | gzip > "$OUT"
find backups -name 'angels-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok $OUT $(du -h "$OUT" | cut -f1)"
BACKUP
chmod +x /opt/angelos/backup.sh
# `crontab -l` exits non-zero for a user with no crontab yet, and under `set -e`
# that killed the whole subshell pipeline SILENTLY — the script reported success
# and installed nothing. Build it in a group with an explicit `|| true`, then
# verify the result rather than trusting it.
{ crontab -l 2>/dev/null | grep -v '/opt/angelos/backup.sh' || true
  echo '17 3 * * * /opt/angelos/backup.sh >> /opt/angelos/backups/backup.log 2>&1'
} | crontab -
crontab -l | grep -q backup.sh || { echo "cron install FAILED" >&2; exit 1; }

say "Done. What is NOT done:"
cat <<'NEXT'

  1. Log out and back in — your shell does not have the `docker` group yet.

  2. Copy the stack in:
       scp docker-compose.yml angel@angel-node-01:/opt/angelos/stack/
       scp .env.local        angel@angel-node-01:/opt/angelos/stack/

     ⚠️ The compose file from C:\Dev\datacenter\stack BUILDS Core from source.
        Change that service to `image:` pointing at a registry tag. This box
        must never run `next build` — 8 GB will not survive it, and that single
        failure is what makes people wrongly conclude the hardware is too small.

  3. Restore a database dump (Railway is the source of truth today):
       pg_dump "$DATABASE_PUBLIC_URL" | gzip > angels.sql.gz     # on the desktop
       scp angels.sql.gz angel@angel-node-01:/opt/angelos/
       gunzip -c angels.sql.gz | docker exec -i angelos-pg psql -U postgres angels

  4. Cloudflare Tunnel, so this box is reachable without opening a router port.
     Config lives at C:\Dev\datacenter\stack\cloudflared-config.yml.

  5. Give it a DHCP reservation on the router. A node that changes IP after a
     power cut is a node you go find with a monitor and a keyboard.

  6. Run it as a SECOND node for two weeks before it carries anything real.
     Twenty-two live portals is not a cutover you do on a good feeling.

NEXT
