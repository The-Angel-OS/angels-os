#!/usr/bin/env bash
# Put angel-node-01 on the internet without touching the router.
#
# A Cloudflare tunnel dials OUT to Cloudflare's edge and holds the connection
# open, so there is no port to forward, no static IP to keep, and no router
# admin to have. The box can move from Wi-Fi to ethernet, get a new DHCP lease,
# or be carried to another building, and the hostname keeps resolving — the
# tunnel re-dials and the edge routes to whichever connection is live.
#
# Run AFTER `cloudflared tunnel login` has written ~/.cloudflared/cert.pem.
#
#   bash tunnel-setup.sh node01.spacesangels.com
#
# Idempotent: re-running with the same name reuses the existing tunnel.
set -euo pipefail

HOSTNAME_ARG="${1:-node01.spacesangels.com}"
TUNNEL_NAME="${TUNNEL_NAME:-angel-node-01}"
LOCAL_PORT="${LOCAL_PORT:-3001}"

if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "No ~/.cloudflared/cert.pem — run 'cloudflared tunnel login' first." >&2
  exit 1
fi

# ── The tunnel ───────────────────────────────────────────────────────────────
# A tunnel is an identity, not a machine. Two hosts running the SAME tunnel id
# both register with the edge and traffic is split between them at random —
# which, with two different databases behind them, is a bad afternoon. This node
# gets its own.
if cloudflared tunnel list --output json | grep -q "\"name\":\"$TUNNEL_NAME\""; then
  echo "Tunnel '$TUNNEL_NAME' already exists — reusing."
else
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel list --output json \
  | python3 -c "import sys,json;print(next(t['id'] for t in json.load(sys.stdin) if t['name']=='$TUNNEL_NAME'))")"
echo "Tunnel id: $TUNNEL_ID"

# ── Ingress ──────────────────────────────────────────────────────────────────
# ORDER MATTERS: specific hostnames above any wildcard, or the wildcard swallows
# them. The catch-all 404 at the bottom is required — without it cloudflared
# refuses to start.
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml >/dev/null <<YAML
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json

# Survive a laptop that sleeps its Wi-Fi or changes network: re-dial rather than
# sit on a dead connection.
protocol: quic
retries: 10
grace-period: 30s

ingress:
  - hostname: $HOSTNAME_ARG
    service: http://127.0.0.1:$LOCAL_PORT
    originRequest:
      # Core resolves the portal from the Host header, so it must arrive intact.
      httpHostHeader: $HOSTNAME_ARG
      connectTimeout: 30s
  - service: http_status:404
YAML

sudo cp "$HOME/.cloudflared/$TUNNEL_ID.json" "/etc/cloudflared/$TUNNEL_ID.json"
sudo chmod 600 "/etc/cloudflared/$TUNNEL_ID.json"

# ── DNS ──────────────────────────────────────────────────────────────────────
# Creates the proxied CNAME <hostname> → <tunnel>.cfargotunnel.com. Only works
# for a zone the login cert covers.
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME_ARG" || \
  echo "DNS route exists already, or the cert does not cover that zone — check the dashboard."

# ── The service ──────────────────────────────────────────────────────────────
# systemd, so it starts at boot before anyone logs in and restarts on its own.
sudo cloudflared service install || true
sudo systemctl enable --now cloudflared
sleep 5
sudo systemctl --no-pager --lines=15 status cloudflared || true

echo
echo "Tunnel up. Once the stack is listening on 127.0.0.1:$LOCAL_PORT:"
echo "  https://$HOSTNAME_ARG"
