#!/usr/bin/env bash
# Stage 2: stream-copy concat (safe now — all clips have identical params),
# then mux with the music bed at 30%/10% envelope.
set -euo pipefail

LIST="C:/Users/kenne/AppData/Local/Temp/concat_260423_final.txt"
BED="C:/Users/kenne/AppData/Local/Temp/music_bed_260423.m4a"
VID="C:/Users/kenne/AppData/Local/Temp/260423G_VID_unified.mp4"
DEST="C:/Users/kenne/Videos/Daily/260423 Dunedin Boat Club Evening Dolphin Quest Vid.mp4"

echo "[finalize] verifying all 45 unified clips exist..."
miss=0
while read line; do
  p=$(echo "$line" | sed -E "s/^file '(.+)'\$/\1/" | sed 's|^C:|/c|')
  if [ ! -f "$p" ]; then echo "MISSING: $p"; miss=$((miss+1)); fi
done < "$LIST"
[ $miss -gt 0 ] && { echo "[finalize] $miss clips missing — abort"; exit 1; }

echo "[finalize] stream-copy concat → $VID"
rm -f "$VID"
ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart \
  "$VID"

echo "[finalize] muxing music bed (30% first 60s, 10% after) → $DEST"
rm -f "$DEST"
ffmpeg -hide_banner -loglevel warning -y \
  -i "$VID" -i "$BED" \
  -filter_complex "[1:a]volume='if(lt(t,60),0.30,0.10)':eval=frame[mus];[0:a][mus]amix=inputs=2:duration=first:normalize=0[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart \
  "$DEST"

sz=$(stat -c%s "$DEST")
echo "[finalize] DONE → $DEST ($((sz/1024/1024/1024)) GB)"
