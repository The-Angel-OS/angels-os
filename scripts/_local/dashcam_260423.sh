#!/usr/bin/env bash
# Roll up F:\ dashcam clips by drive (gap > 5 min = new drive).
# All clips are 4K HEVC 30fps from same camera → stream-copy concat is safe.
set -euo pipefail

SRC="/f/CARDV/Movie_F"
OUT="/c/Users/kenne/Videos/Daily"
TMP="/c/Users/kenne/AppData/Local/Temp"
START="20260423112933_000861F.MP4"

mkdir -p "$OUT"

run_drive() {
  local label="$1" first="$2" last="$3" outname="$4"
  local list="$TMP/dashcam_${label}.txt"
  local dest="$OUT/${outname}"

  echo ""
  echo "=== $label: $first → $last ==="
  : > "$list"
  local n=0
  for f in "$SRC"/*.MP4; do
    bn=$(basename "$f")
    [[ "$bn" < "$first" ]] && continue
    [[ "$bn" > "$last" ]] && continue
    # Use Windows-style path so MSYS doesn't prepend CWD when ffmpeg parses it
    win=$(echo "$f" | sed 's|^/f/|F:/|')
    echo "file '$win'" >> "$list"
    n=$((n+1))
  done
  echo "  $n files → $dest"

  rm -f "$dest"
  ffmpeg -hide_banner -loglevel warning -y \
    -f concat -safe 0 -i "$list" \
    -c copy -movflags +faststart \
    "$dest"

  sz=$(stat -c%s "$dest")
  echo "  DONE: $((sz/1024/1024/1024)) GB"
}

run_drive "drive1" "20260423112933_000861F.MP4" "20260423140233_999999F.MP4" "260423 Dashcam Drive 1 (1129-1402).mp4"
run_drive "drive2" "20260423151341_000000F.MP4" "20260423212723_001390F.MP4" "260423 Dashcam Drive 2 (1513-2128).mp4"

echo ""
echo "=== ALL DRIVES DONE ==="
ls -lh "$OUT"/260423\ Dashcam*.mp4
