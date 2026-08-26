#!/usr/bin/env bash
# Nightly logical backup. Keeps 14 days locally; push to R2 separately.
#
# ⚠️ This script used to write 20-byte files and say nothing. `pg_dump | gzip >
# OUT` creates OUT before pg_dump runs, so when the container did not exist the
# redirect still produced a valid, EMPTY gzip — and cron swallowed the error.
# Two nights of "backups" were 20 bytes each and nothing noticed (260825,
# 260826). A backup that cannot fail loudly is not a backup.
set -euo pipefail

cd /opt/angelos
mkdir -p backups
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
