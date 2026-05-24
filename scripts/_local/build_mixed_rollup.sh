#!/usr/bin/env bash
# Mixed portrait/landscape rollup with blurred-self backdrop for portrait clips
# Portrait clips: extract own frame, scale+blur to 7680x4320, overlay sharp portrait centered
# Landscape clips: stream copy (already 8K30 HEVC)
set -euo pipefail

SRC="E:/DCIM/Camera/260427 - Dunedin Marina"
SEG="/c/Users/kenne/Videos/Daily/_segments_260427"
OUT="/c/Users/kenne/Videos/Daily/260427 8K Dunedin Marina Rollup.mp4"
MANIFEST="$SEG/manifest.txt"
CONCAT="$SEG/concat.txt"

> "$CONCAT"
i=0

while IFS='|' read -r type file; do
  i=$((i + 1))
  seg=$(printf "$SEG/seg_%03d.mp4" "$i")
  base=$(basename "$file" .mp4)

  if [ -f "$seg" ]; then
    sz=$(stat -c%s "$seg")
    if [ "$sz" -gt 1000000 ]; then
      echo "[$i] SKIP $base (exists, $((sz/1024/1024)) MB)"
      win=$(echo "$seg" | sed 's|^/\([a-zA-Z]\)/|\U\1:/|')
      echo "file '$win'" >> "$CONCAT"
      continue
    fi
  fi

  src="$SRC/$file"

  if [ "$type" = "L" ]; then
    echo "[$i] LANDSCAPE (copy): $base"
    ffmpeg -hide_banner -loglevel warning -y \
      -i "$src" \
      -c copy \
      -video_track_timescale 30000 \
      -movflags +faststart \
      "$seg"
  else
    echo "[$i] PORTRAIT (blur-self): $base"
    ffmpeg -hide_banner -loglevel warning -y \
      -display_rotation 0 -noautorotate -i "$src" \
      -filter_complex "
        [0:v]transpose=1,setpts=PTS-STARTPTS,split=2[rot1][rot2];
        [rot1]scale=7680:4320:force_original_aspect_ratio=increase,crop=7680:4320,gblur=sigma=50[bg];
        [rot2]scale=-2:4320[fg];
        [bg][fg]overlay=(W-w)/2:(H-h)/2
      " \
      -c:v hevc_nvenc -preset p7 -tune hq -rc vbr -cq 19 \
      -r 30 \
      -c:a aac -b:a 256k \
      -video_track_timescale 30000 \
      -movflags +faststart \
      "$seg"
  fi

  win=$(echo "$seg" | sed 's|^/\([a-zA-Z]\)/|\U\1:/|')
  echo "file '$win'" >> "$CONCAT"
done < "$MANIFEST"

echo ""
echo "=== All $i segments ready. Concatenating... ==="
count=$(wc -l < "$CONCAT")
echo "Concat list: $count entries"

ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$CONCAT" \
  -c copy -movflags +faststart "$OUT"

sz=$(stat -c%s "$OUT")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
hms=$(awk -v d="$dur" 'BEGIN{h=int(d/3600);m=int((d%3600)/60);s=int(d)%60;printf "%02d:%02d:%02d",h,m,s}')
printf "\nDONE: %d MB, %s\n" "$((sz/1024/1024))" "$hms"
