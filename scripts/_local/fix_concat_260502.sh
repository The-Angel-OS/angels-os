#!/usr/bin/env bash
# Re-mux all 212 per-segment files to a unified timescale (1/30000),
# then re-concat. Stream-copy throughout — no quality loss, just timestamp
# normalization. Fixes the 6x duration stretch caused by mixed time_bases.
set -euo pipefail

WORK="/c/Users/kenne/AppData/Local/Temp/260502_work"
NORM="$WORK/normalized"
LIST_OLD="$WORK/concat_list.txt"
LIST_NEW="$WORK/concat_list_norm.txt"
OUT="/c/Users/kenne/Videos/Daily/260502 Soulfin and Sandy Quest - Ozzi Oprah and The Aves 4K.mp4"

mkdir -p "$NORM"

echo "=== Stage A: re-mux 212 segments to unified time_base 1/30000 ==="
i=0
: > "$LIST_NEW"
while IFS= read -r line; do
  src=$(echo "$line" | sed -E "s/^file '(.+)'\$/\1/" | sed 's|^C:|/c|')
  bn=$(basename "$src")
  out="$NORM/$bn"
  i=$((i+1))

  if [ -f "$out" ] && [ "$out" -nt "$src" ]; then
    : # already done
  else
    ffmpeg -hide_banner -loglevel warning -y \
      -i "$src" \
      -c copy \
      -video_track_timescale 30000 \
      -muxpreload 0 -muxdelay 0 \
      -movflags +faststart \
      "$out"
  fi

  win=$(echo "$out" | sed 's|^/c/|C:/|')
  echo "file '$win'" >> "$LIST_NEW"

  if [ $((i % 25)) -eq 0 ] || [ "$i" -lt 5 ]; then
    echo "  $i/212 done"
  fi
done < "$LIST_OLD"
echo "  all 212 normalized"

echo ""
echo "=== Stage B: stream-copy concat with forced timescale ==="
rm -f "$OUT"
ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST_NEW" \
  -c copy \
  -video_track_timescale 30000 \
  -movflags +faststart \
  "$OUT"

sz=$(stat -c%s "$OUT")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
hh=$(awk -v d="$dur" 'BEGIN{printf "%d", d/3600}')
mm=$(awk -v d="$dur" 'BEGIN{printf "%d", (int(d)%3600)/60}')
ss=$(awk -v d="$dur" 'BEGIN{printf "%d", int(d)%60}')

echo ""
echo "=== DONE ==="
printf "  file:     %s\n" "$OUT"
printf "  size:     %d MB (%d GB)\n" "$((sz/1024/1024))" "$((sz/1024/1024/1024))"
printf "  duration: %02d:%02d:%02d (expected ~03:22:00)\n" "$hh" "$mm" "$ss"
