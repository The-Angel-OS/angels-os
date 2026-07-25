#!/bin/sh
# Fire one Angel OS cron endpoint. Called from heartbeat.crontab as `hit <path>`.
#
# busybox crond does NOT pass the daemon's environment to jobs (it sets only
# HOME/SHELL/PATH/USER), so CRON_SECRET can't be read from the environment here.
# The container's command writes it to /run/cron_secret at startup instead.
set -u

path="$1"
secret=$(cat /run/cron_secret 2>/dev/null || echo '')
stamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

if [ -z "$secret" ]; then
  echo "$stamp SKIP $path — no CRON_SECRET"
  exit 0
fi

# --spider would skip the work; these endpoints DO their job on GET, so fetch and
# discard. -T caps a hung request so a stuck endpoint can't pile up crond jobs.
if wget -q -O /dev/null -T 300 --header="Authorization: Bearer ${secret}" "http://core:3000${path}"; then
  echo "$stamp ok   $path"
else
  echo "$stamp FAIL $path (wget exit $?)"
fi
