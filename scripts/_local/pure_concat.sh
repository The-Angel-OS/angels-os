#!/usr/bin/env bash
# Pure stream-copy concat. No re-encoding. No remux. No intermediaries.
# Usage: bash pure_concat.sh <OUT_FILE> <file1> <file2> ...
#   OR:  bash pure_concat.sh <OUT_FILE> --dir <DIR> [START_PREFIX] [END_PREFIX]
set -euo pipefail

OUT="$1"; shift

LIST=$(mktemp /c/Users/kenne/AppData/Local/Temp/pure_concat_XXXXX.txt)

if [ "${1:-}" = "--dir" ]; then
  DIR="$2"; START="${3:-}"; END="${4:-}"
  for f in "$DIR"/*.MP4 "$DIR"/*.mp4; do
    [ -f "$f" ] || continue
    bn=$(basename "$f")
    [ -n "$START" ] && [[ "$bn" < "$START" ]] && continue
    if [ -n "$END" ]; then
      [[ "$bn" == "$END" ]] && { echo "file '$f'" >> "$LIST"; break; }
      [[ ! "$bn" == "$END"* ]] && [[ "$bn" > "$END" ]] && break
    fi
    # Convert MSYS paths to Windows paths for ffmpeg concat demuxer
    win=$(echo "$f" | sed 's|^/\([a-zA-Z]\)/|\U\1:/|')
    echo "file '$win'" >> "$LIST"
  done
else
  for f in "$@"; do
    win=$(echo "$f" | sed 's|^/\([a-zA-Z]\)/|\U\1:/|')
    echo "file '$win'" >> "$LIST"
  done
fi

count=$(wc -l < "$LIST")
echo "=== $count clips → $(basename "$OUT") ==="

ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart "$OUT"

sz=$(stat -c%s "$OUT")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
printf "DONE: %d MB, %s\n" "$((sz/1024/1024))" \
  "$(awk -v d="$dur" 'BEGIN{h=int(d/3600);m=int((d%3600)/60);s=int(d)%60;printf "%02d:%02d:%02d",h,m,s}')"
rm -f "$LIST"
