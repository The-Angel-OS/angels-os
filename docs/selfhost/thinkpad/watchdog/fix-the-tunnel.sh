#!/bin/bash
# Fix the tunnel — the button Ken presses when the sites are down.
#
# Restarts the things that break, in the order they depend on each other, and
# says in plain words whether it worked. No flags, no arguments, no decisions to
# make at midnight.
#
# The check that matters is the LAST one: a request from outside. Everything on
# this box can look healthy while Cloudflare serves 1033 to the world — that is
# the whole reason this script exists rather than "just restart cloudflared".
#
# ponytail: no diagnosis, no branching on what is wrong. Restarting cloudflared
# fixes every occurrence so far, and a script that guesses is a script that
# guesses wrong at 1am. It restarts, then it tells you the truth.
set -uo pipefail

GREEN=$'\e[32m'; RED=$'\e[31m'; DIM=$'\e[2m'; BOLD=$'\e[1m'; OFF=$'\e[0m'
say() { printf '%s\n' "$*"; }

say "${BOLD}Fixing the tunnel${OFF}"
say "${DIM}angel-node-01 · $(date '+%a %d %b %Y, %H:%M')${OFF}"
say ""

say "1. Restarting cloudflared…"
sudo systemctl restart cloudflared
sleep 8

# A healthy tunnel registers four connections (connIndex 0-3). One or none is
# what a dead tunnel looks like while systemd still reports "active" — this is
# the tell, so it is worth printing.
conns=$(sudo journalctl -u cloudflared --since "1 min ago" --no-pager 2>/dev/null \
        | grep -c "Registered tunnel connection" || true)
say "   ${DIM}${conns} of 4 edge connections registered${OFF}"

say ""
say "2. Checking the website is up (this takes a few seconds)…"
code=000
for _ in 1 2 3 4 5 6; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
         https://www.spacesangels.com/ || echo 000)
  [ "$code" = "200" ] && break
  sleep 5
done

say ""
if [ "$code" = "200" ]; then
  say "${GREEN}${BOLD}The sites are back up.${OFF}"
  say "${DIM}www.spacesangels.com answered 200. Nothing else to do.${OFF}"
else
  say "${RED}${BOLD}Still down — cloudflared was not the problem.${OFF}"
  say "${DIM}www.spacesangels.com answered ${code}.${OFF}"
  say ""
  say "Try, in this order:"
  say "  ${BOLD}sudo docker restart angelos-core${OFF}   ${DIM}(the app itself)${OFF}"
  say "  ${BOLD}ping -c3 1.1.1.1${OFF}                   ${DIM}(is the internet there at all?)${OFF}"
  say ""
  say "If ping fails it is the house connection, not this machine, and nothing"
  say "here will fix it. Restart the router and run this again."
fi

say ""
read -rp "Press Enter to close… "
