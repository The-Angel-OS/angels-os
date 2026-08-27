#!/usr/bin/env bash
# Ship the current main to angel-node-01, from the desktop, in one command.
#
#   wsl -d Ubuntu-22.04 -u root -e bash /mnt/c/Dev/angels-os/docs/selfhost/thinkpad/push-to-node.sh
#
# or just double-click push-to-node.cmd next to this file.
#
# Why it runs in WSL: the build needs a real Linux Docker engine and more RAM
# than the node has. Docker Desktop is NOT required — `apt install docker.io`
# inside WSL is the whole dependency, and it is free.
#
# Why a registry instead of `docker save | ssh docker load`: save always writes
# every layer, so a one-line code change re-sends 400 MB. A push sends only the
# layers that actually changed — seconds instead of minutes, which is the
# difference between a pipeline you use and one you avoid. The registry lives on
# the node, bound to localhost, reached through an SSH forward: Docker exempts
# localhost from its TLS rule, so there are no certificates and no
# `insecure-registries` edits anywhere.
set -euo pipefail

NODE="${NODE:-192.168.0.171}"
KEY="${KEY:-/root/.ssh/angel_node}"
REPO="${REPO:-https://github.com/The-Angel-OS/angels-os.git}"
WORK="${WORK:-/root/build}"
BRANCH="${BRANCH:-main}"
IMAGE="angelos-core:local"
REMOTE_TAG="localhost:5000/angelos-core:latest"
HOSTNAME_PUBLIC="${HOSTNAME_PUBLIC:-node01.spacesangels.com}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

# The SSH key lives on the Windows side; WSL sees it through /mnt/c but with
# permissions ssh refuses. Copy it in once.
if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  cp /mnt/c/Users/kenne/.ssh/angel_node "$KEY"
  chmod 600 "$KEY"
fi
SSH="ssh -i $KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

say "Docker engine"
service docker start >/dev/null 2>&1 || true
docker version --format '{{.Server.Version}}'

say "Source — $BRANCH"
# Build from a clean clone of what is actually PUSHED, never the working tree.
# Shipping uncommitted work to a node is how a node ends up running something
# no commit describes.
if [ -d "$WORK/.git" ]; then
  git -C "$WORK" fetch --depth 1 origin "$BRANCH" -q
  git -C "$WORK" reset --hard "origin/$BRANCH" -q
else
  rm -rf "$WORK"
  git clone --depth 1 -b "$BRANCH" "$REPO" "$WORK" -q
fi
git -C "$WORK" log --oneline -1

say "Build"
docker build -t "$IMAGE" "$WORK"

say "Tunnel to the node's registry"
# -f backgrounds it, -N runs no command. Killed on exit whatever happens.
$SSH -fN -L 5000:127.0.0.1:5000 "angel@$NODE"
FORWARD_PID=$(pgrep -f "ssh.*-L 5000:127.0.0.1:5000.*angel@$NODE" | head -1)
trap '[ -n "${FORWARD_PID:-}" ] && kill "$FORWARD_PID" 2>/dev/null || true' EXIT
sleep 2
curl -sf -o /dev/null http://localhost:5000/v2/ || { echo "registry unreachable through the forward"; exit 1; }

say "Push — only changed layers cross the wire"
docker tag "$IMAGE" "$REMOTE_TAG"
docker push "$REMOTE_TAG"

say "Pull and restart on the node"
$SSH "angel@$NODE" '
  set -e
  docker pull -q localhost:5000/angelos-core:latest
  docker tag localhost:5000/angelos-core:latest angelos-core:local
  cd /opt/angelos/stack
  docker compose up -d core
'

say "Verify"
# The node restarts Core and re-runs migrations; give it room before judging.
for i in $(seq 1 30); do
  code=$($SSH "angel@$NODE" 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/health' 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 5
done
echo "local  /api/health            $code"
echo "public https://$HOSTNAME_PUBLIC  $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$HOSTNAME_PUBLIC")"

if [ "$code" != "200" ]; then
  echo
  echo "Core did not come back healthy. Logs:"
  $SSH "angel@$NODE" 'cd /opt/angelos/stack && docker compose logs --tail=40 core'
  exit 1
fi

say "Shipped $(git -C "$WORK" rev-parse --short HEAD)"

# Explicit, because the EXIT trap can otherwise colour the status: the first run
# reported 1 after a deploy that was verifiably fine, and "says failed, actually
# worked" is more corrosive than a plain failure — you stop reading the output,
# and then you miss the real one. Every failure path above exits 1 on its own.
exit 0
