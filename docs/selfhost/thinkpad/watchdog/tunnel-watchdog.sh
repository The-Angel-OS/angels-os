#!/bin/bash
# Restart cloudflared when the EDGE says the tunnel is gone.
#
# systemd's Restart=on-failure cannot help here: cloudflared does not fail. It
# loses its QUIC connections to a network blip, logs "Registered tunnel
# connection" on a retry, and then sits there while Cloudflare serves 1033 to
# every hostname. `systemctl is-active` says "active" the entire time. Twice now
# (260827, 260830) the box was healthy, the app was healthy, and the site was
# down — the only thing that knew was a request from outside.
#
# So the check is a request from outside. Two consecutive failures before acting,
# because one timeout is the internet, not an outage.
#
# ponytail: no metrics endpoint, no connection counting. cloudflared's own /ready
# reported healthy through the 260830 outage — the process's opinion of itself is
# precisely the thing that cannot be trusted here. One curl is the ground truth.
set -uo pipefail

URL="https://node01.spacesangels.com/api/health"
STATE=/run/tunnel-watchdog.fails

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL" || echo 000)
if [ "$code" = "200" ]; then
  rm -f "$STATE"
  exit 0
fi

fails=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$STATE"
logger -t tunnel-watchdog "health check returned $code (failure $fails)"

if [ "$fails" -ge 2 ]; then
  logger -t tunnel-watchdog "restarting cloudflared after $fails consecutive failures"
  systemctl restart cloudflared
  rm -f "$STATE"
fi
