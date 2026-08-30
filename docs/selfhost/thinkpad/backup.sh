#!/usr/bin/env bash
# Nightly logical backup. Keeps 14 days locally, and pushes each one offsite to R2.
#
# ⚠️ This script used to write 20-byte files and say nothing. `pg_dump | gzip >
# OUT` creates OUT before pg_dump runs, so when the container did not exist the
# redirect still produced a valid, EMPTY gzip — and cron swallowed the error.
# Two nights of "backups" were 20 bytes each and nothing noticed (260825,
# 260826). A backup that cannot fail loudly is not a backup.
set -euo pipefail

cd /opt/angelos
mkdir -p backups

# R2 credentials for the offsite push at the end.
#
# READ, never `source`. .env.local is a compose env file (`format: raw`), not a
# shell script — unquoted values contain `$`, `#` and spaces, and sourcing it
# aborted this script before it took a single backup. A parse error in a sourced
# file kills the shell no matter what `|| true` you hang off the end.
r2() { sed -n "s/^$1=//p" .env.local 2>/dev/null | tail -1 | tr -d ''; }
R2_BUCKET="$(r2 R2_BUCKET)"
R2_ENDPOINT="$(r2 R2_ENDPOINT)"
R2_ACCESS_KEY_ID="$(r2 R2_ACCESS_KEY_ID)"
R2_SECRET_ACCESS_KEY="$(r2 R2_SECRET_ACCESS_KEY)"
OUT="backups/angels-$(date +%Y%m%d-%H%M%S).sql.gz"
LOG="backups/backup.log"
CONTAINER="${PGCONTAINER:-angelos-pg}"

fail() {
  echo "$(date -Is) backup FAILED: $*" | tee -a "$LOG" >&2
  rm -f "$OUT"   # never leave a file that looks like a backup and is not one
  exit 1
}

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true \
  || fail "container $CONTAINER is not running"

# Write to a temp name first so a half-written dump can never be mistaken for a
# finished one by the retention sweep below.
TMP="$OUT.partial"
if ! docker exec "$CONTAINER" pg_dump -U "${PGUSER:-postgres}" angels 2>>"$LOG" | gzip > "$TMP"; then
  rm -f "$TMP"
  fail "pg_dump returned non-zero (see $LOG)"
fi

SIZE=$(stat -c%s "$TMP")
# An empty gzip is 20 bytes. A real dump of this database is megabytes. Anything
# under 100 KB means the dump did not happen, whatever the exit codes claimed.
if [ "$SIZE" -lt 102400 ]; then
  rm -f "$TMP"
  fail "dump was only $SIZE bytes — that is an empty archive, not a backup"
fi

# Prove it is readable before calling it done. A corrupt archive discovered
# during a restore is discovered at the worst possible moment.
gzip -t "$TMP" || { rm -f "$TMP"; fail "archive failed its integrity check"; }

mv "$TMP" "$OUT"
find backups -name 'angels-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok $OUT $(du -h "$OUT" | cut -f1)" | tee -a "$LOG"

# ── Offsite ────────────────────────────────────────────────────────────────
# Every copy above lives on the same laptop as the database it protects. That
# is a backup of the data, not of the machine: one dead SSD, one theft, one
# spilled coffee and production and all five restore points go together.
#
# R2 already holds this platform's media and is already credentialed here, so
# offsite costs one upload and no new account. Sent with curl's built-in SigV4
# rather than rclone or awscli — no new package on the box for one PUT.
#
# Non-fatal on purpose: a local backup that exists is worth more than a script
# that aborts because the network was down. It logs loudly and moves on.
if [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ]; then
  KEY="backups/$(basename "$OUT")"
  if curl -fsS --max-time 600        --aws-sigv4 "aws:amz:auto:s3"        --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY"        --upload-file "$OUT"        "${R2_ENDPOINT%/}/$R2_BUCKET/$KEY" >/dev/null; then
    echo "$(date -Is) offsite ok $KEY" | tee -a "$LOG"
  else
    echo "$(date -Is) OFFSITE FAILED $KEY — local copy is still good" | tee -a "$LOG"
  fi
else
  echo "$(date -Is) OFFSITE SKIPPED — no R2 credentials in env" | tee -a "$LOG"
fi
