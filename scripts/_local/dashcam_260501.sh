#!/usr/bin/env bash
# 260501 Solfin Quest — Stage 2 (per-clip normalize) + Stage 3 (concat).
# Reads the manifest from probe_260501.sh and produces 260501_VID_unified.mp4.
#
# Treatments:
#   L  = landscape 8K HEVC 30fps (conformant)             → remux only
#   P  = portrait  8K HEVC 30fps + rotation=-90           → composite onto sunset backdrop
#   F  = FHD/60/h264 (clip 26 ~2 muted)                   → NVENC upscale to 8K30 HEVC
#   H  = 8K HEVC 120fps (slow-mo finale, real-time intent) → fps=30 decimate + NVENC re-encode
set -euo pipefail

SRC="/e/DCIM/Daily/260501"
WORK="/c/Users/kenne/AppData/Local/Temp/260501_work"
OUT="$WORK/260501_VID_unified.mp4"
LIST="$WORK/concat_260501.txt"
BACKDROP_DIR="${BACKDROP_DIR:-/e/DCIM/Videos/_Assets/Backgrounds}"
# Pool of backdrops — every .jpg in BACKDROP_DIR. Randomly assigned per portrait clip,
# seeded by clip sequence number so reruns are stable but visually varied.
mapfile -t BACKDROPS < <(find "$BACKDROP_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort)
BACKDROP_COUNT=${#BACKDROPS[@]}

pick_backdrop() {
  # Deterministic pick: hash(seq) % count. Same seq → same backdrop on rerun.
  local seq="$1"
  local idx=$(( 10#$seq % BACKDROP_COUNT ))
  printf '%s' "${BACKDROPS[$idx]}"
}

mkdir -p "$WORK"

# Build sheet — order is the final video order (chronological)
# Format: SEQ TREATMENT FILENAME
read -r -d '' BUILD <<'EOF' || true
01 P 20260430_120904.mp4
02 P 20260501_064418.mp4
03 L 20260501_064625.mp4
04 L 20260501_083816.mp4
05 L 20260501_085525.mp4
06 L 20260501_085925.mp4
07 L 20260501_091457.mp4
08 L 20260501_093322.mp4
09 L 20260501_093542.mp4
10 L 20260501_093727.mp4
11 L 20260501_101219.mp4
12 P 20260501_101811.mp4
13 P 20260501_105207.mp4
14 P 20260501_105219.mp4
15 P 20260501_105249.mp4
16 P 20260501_105300.mp4
17 P 20260501_105333.mp4
18 L 20260501_114913.mp4
19 L 20260501_115001.mp4
20 L 20260501_115110.mp4
21 L 20260501_115220.mp4
22 L 20260501_115519.mp4
23 L 20260501_115805.mp4
24 P 20260501_120424.mp4
25 L 20260501_120445.mp4
26 F 20260501_121232~2.mp4
27 P 20260501_121501.mp4
28 P 20260501_121817.mp4
29 P 20260501_122433.mp4
30 P 20260501_122543.mp4
31 P 20260501_122613.mp4
32 P 20260501_122747.mp4
33 P 20260501_125443.mp4
34 P 20260501_130052.mp4
35 L 20260501_130507.mp4
36 H 20260501_142818.mp4
37 H 20260501_142915.mp4
38 H 20260501_142946.mp4
39 H 20260501_143011.mp4
40 H 20260501_143032.mp4
EOF

# Common NVENC encoder params for any re-encode
NVENC_V=(
  -c:v hevc_nvenc -preset p7 -tune hq -rc vbr
  -cq 19 -b:v 80M -maxrate 120M -bufsize 240M
  -pix_fmt yuv420p -movflags +faststart
)
NVENC_A=( -c:a aac -b:a 192k -ar 48000 -ac 2 )

verify_backdrops() {
  if [ "$BACKDROP_COUNT" -lt 1 ]; then
    echo "!! No backdrops found in $BACKDROP_DIR"; exit 1
  fi
  echo "  backdrop pool ($BACKDROP_COUNT images):"
  for b in "${BACKDROPS[@]}"; do echo "    - $(basename "$b")"; done
}

process_landscape() {
  # Stream-copy remux into MP4 with faststart. No re-encode.
  local in="$1" out="$2"
  ffmpeg -hide_banner -loglevel warning -y \
    -i "$in" -c copy -movflags +faststart "$out"
}

process_portrait() {
  # Decode WITHOUT autorotate, then transpose=2 (90° CCW) to get true portrait
  # pixels. Composite onto blurred backdrop scaled to 8K. Center at full 4320 height.
  local in="$1" out="$2" backdrop="$3"
  ffmpeg -hide_banner -loglevel warning -y \
    -loop 1 -i "$backdrop" \
    -noautorotate -i "$in" \
    -filter_complex "
      [0:v]scale=7680:4320:force_original_aspect_ratio=increase,crop=7680:4320,boxblur=24:1,setsar=1[bg];
      [1:v]transpose=2,scale=-1:4320:flags=lanczos,setsar=1[fg];
      [bg][fg]overlay=(W-w)/2:0:format=auto[v]
    " \
    -map "[v]" -map 1:a? \
    -shortest \
    "${NVENC_V[@]}" "${NVENC_A[@]}" \
    -metadata:s:v:0 rotate=0 \
    "$out"
}

process_fhd_upscale() {
  # FHD/60/h264 portrait → composite onto backdrop just like the 8K portrait clips.
  # Drop to 30fps and upscale to fit 4320 height; backdrop fills the rest.
  local in="$1" out="$2" backdrop="$3"
  ffmpeg -hide_banner -loglevel warning -y \
    -loop 1 -i "$backdrop" \
    -noautorotate -i "$in" \
    -filter_complex "
      [0:v]scale=7680:4320:force_original_aspect_ratio=increase,crop=7680:4320,boxblur=24:1,setsar=1[bg];
      [1:v]transpose=2,scale=-1:4320:flags=lanczos,setsar=1,fps=30[fg];
      [bg][fg]overlay=(W-w)/2:0:format=auto[v]
    " \
    -map "[v]" -map 1:a? \
    -shortest \
    "${NVENC_V[@]}" "${NVENC_A[@]}" \
    -metadata:s:v:0 rotate=0 \
    "$out"
}

process_high_fps() {
  # 8K HEVC 120fps → real-time playback at 30fps. fps=30 decimates 4:1.
  # Audio passes through (already real-time).
  local in="$1" out="$2"
  ffmpeg -hide_banner -loglevel warning -y \
    -i "$in" \
    -vf "fps=30,setsar=1" \
    "${NVENC_V[@]}" "${NVENC_A[@]}" \
    "$out"
}

verify_backdrops

echo ""
echo "=== STAGE 2: per-clip normalize → $WORK ==="
: > "$LIST"

while IFS= read -r line; do
  [ -z "$line" ] && continue
  set -- $line
  seq="$1" treat="$2" file="$3"
  in="$SRC/$file"
  out="$WORK/u_${seq}.mp4"

  if [ ! -f "$in" ]; then
    echo "  [$seq] !! MISSING: $file"; continue
  fi

  # Skip if already done (idempotent)
  if [ -f "$out" ] && [ "$out" -nt "$in" ]; then
    echo "  [$seq] skip $treat $file (already built)"
  else
    case "$treat" in
      L) echo "  [$seq] $treat $file → $(basename "$out")"
         process_landscape "$in" "$out" ;;
      P) bd=$(pick_backdrop "$seq")
         echo "  [$seq] $treat $file → $(basename "$out")  bg: $(basename "$bd")"
         process_portrait  "$in" "$out" "$bd" ;;
      F) bd=$(pick_backdrop "$seq")
         echo "  [$seq] $treat $file → $(basename "$out")  bg: $(basename "$bd")"
         process_fhd_upscale "$in" "$out" "$bd" ;;
      H) echo "  [$seq] $treat $file → $(basename "$out")"
         process_high_fps  "$in" "$out" ;;
      *) echo "  [$seq] !! unknown treatment: $treat"; exit 1 ;;
    esac
  fi

  win=$(echo "$out" | sed 's|^/c/|C:/|')
  echo "file '$win'" >> "$LIST"
done <<< "$BUILD"

echo ""
echo "=== STAGE 3: stream-copy concat → $OUT ==="
rm -f "$OUT"
ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart \
  "$OUT"

sz=$(stat -c%s "$OUT")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
hh=$(awk -v d="$dur" 'BEGIN{printf "%d", d/3600}')
mm=$(awk -v d="$dur" 'BEGIN{printf "%d", (int(d)%3600)/60}')
ss=$(awk -v d="$dur" 'BEGIN{printf "%d", int(d)%60}')

echo ""
echo "=== UNIFIED VIDEO READY ==="
printf "  file:     %s\n" "$OUT"
printf "  size:     %d MB (%d GB)\n" "$((sz/1024/1024))" "$((sz/1024/1024/1024))"
printf "  duration: %02d:%02d:%02d\n" "$hh" "$mm" "$ss"
echo ""
echo "Next: bash scripts/_local/finalize_260501.sh"
