#!/usr/bin/env bash
# 260503 Daily Rollup — landscape clips only, stream-copy concat.
# All landscape clips are identical format (8K HEVC 30fps) so concat demuxer
# does a clean stitch with zero re-encode.
set -euo pipefail

SRC="/e/DCIM/Daily/260503"
WORK="/c/Users/kenne/AppData/Local/Temp/260503_work"
OUT="/c/Users/kenne/Videos/Daily/Daily Rollup 5-03 8K 260503.mp4"
LIST="$WORK/concat_260503.txt"

# Time-sorted clip list (24 source clips)
CLIPS=(
  20260503_081630.mp4
  20260503_081802.mp4
  20260503_081845.mp4
  20260503_104323.mp4
  20260503_104342.mp4
  20260503_104408.mp4
  20260503_104455.mp4
  20260503_110333.mp4
  20260503_110552.mp4
  20260503_111425.mp4
  20260503_111508.mp4
  20260503_111738.mp4
  20260503_112228.mp4
  20260503_112639.mp4
  20260503_113755.mp4
  20260503_120201.mp4
  20260503_120426.mp4
  20260503_124248.mp4
  20260503_124355.mp4
  20260503_125004.mp4
  20260503_125021.mp4
  20260503_132234.mp4
  20260503_132645.mp4
  20260503_145810.mp4
)

is_portrait() {
  local path="$1"
  local rot
  rot=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream_tags=rotate:stream_side_data=rotation \
    -of default=nw=1 "$path" 2>/dev/null | awk -F= '/rotation=|rotate=/{print $2}' | head -1)
  rot=${rot:-0}
  [ "$rot" = "90" ] || [ "$rot" = "-90" ] || [ "$rot" = "270" ]
}

mkdir -p "$WORK"
: > "$LIST"

echo "=== FILTERING LANDSCAPE CLIPS ==="
kept=0
skipped=0
for f in "${CLIPS[@]}"; do
  in="$SRC/$f"
  if [ ! -f "$in" ]; then
    echo "  !! MISSING: $f"
    continue
  fi
  if is_portrait "$in"; then
    echo "  skip (portrait): $f"
    skipped=$((skipped+1))
  else
    echo "  keep (landscape): $f"
    echo "file 'E:/DCIM/Daily/260503/$f'" >> "$LIST"
    kept=$((kept+1))
  fi
done

echo ""
echo "  kept: $kept landscape | skipped: $skipped portrait"
echo ""

if [ "$kept" -lt 1 ]; then
  echo "!! No landscape clips found — abort"
  exit 1
fi

echo "=== STREAM-COPY CONCAT ($kept clips) → $OUT ==="
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"
ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart \
  "$OUT" 2>"$WORK/ffmpeg.log"

sz=$(stat -c%s "$OUT")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
hh=$(awk -v d="$dur" 'BEGIN{printf "%d", d/3600}')
mm=$(awk -v d="$dur" 'BEGIN{printf "%d", (int(d)%3600)/60}')
ss=$(awk -v d="$dur" 'BEGIN{printf "%d", int(d)%60}')

echo ""
echo "=== DONE ==="
printf "  file:     %s\n" "$OUT"
printf "  size:     %d MB (%.1f GB)\n" "$((sz/1024/1024))" "$(awk -v s="$sz" 'BEGIN{printf "%.1f", s/1024/1024/1024}')"
printf "  duration: %02d:%02d:%02d\n" "$hh" "$mm" "$ss"
printf "  clips:    %d landscape\n" "$kept"
