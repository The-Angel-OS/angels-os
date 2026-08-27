#!/usr/bin/env bash
# angel-node-01 heartbeat — register this box with Core so it shows up in
# /dashboard/telemetry next to Merlin.
#
# ponytail: no agent, no daemon. /node-ops/register is idempotent and refreshes
# lastSeen, so a systemd timer posting a JSON blob IS the telemetry client.
# Metrics come from /proc and df — no dependencies beyond curl.
set -euo pipefail

CORE="${CORE:-http://127.0.0.1:3001}"
ENDEAVOR="${ENDEAVOR:-platform}"
KEY="${CRON_SECRET:?CRON_SECRET must be set}"

read -r _ u n s idle rest < /proc/stat
busy_now=$((u + n + s)); total_now=$((busy_now + idle))
prev="/var/tmp/angel-hb.prev"
if [ -f "$prev" ]; then read -r busy_prev total_prev < "$prev"; else busy_prev=0; total_prev=0; fi
echo "$busy_now $total_now" > "$prev"
dt=$((total_now - total_prev))
cpu_pct=0
[ "$dt" -gt 0 ] && cpu_pct=$(( (busy_now - busy_prev) * 100 / dt ))

mem_total=$(awk '/MemTotal/{print $2}' /proc/meminfo)
mem_avail=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
mem_pct=$(( (mem_total - mem_avail) * 100 / mem_total ))
disk_pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')
up_days=$(awk '{printf "%.1f", $1/86400}' /proc/uptime)
containers=$(docker ps --format '{{.Names}}:{{.State}}' 2>/dev/null | paste -sd, - || echo 'docker unavailable')
tunnel=$(systemctl is-active cloudflared 2>/dev/null || echo unknown)

curl -sS -X POST "$CORE/api/node-ops/register" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $KEY" \
  -d "{\"endeavor\":\"$ENDEAVOR\",\"node\":{
        \"hostname\":\"$(hostname)\",
        \"label\":\"angel-node-01 (T440s)\",
        \"role\":\"primary\",
        \"url\":\"https://node01.spacesangels.com\",
        \"stats\":{
          \"cpu_pct\":$cpu_pct,
          \"mem_used_pct\":$mem_pct,
          \"disk_used_pct\":$disk_pct,
          \"uptime_days\":$up_days,
          \"tunnel\":\"$tunnel\",
          \"containers\":\"$containers\"
        }}}" -o /dev/null -w '%{http_code}\n'
