#!/usr/bin/env bash
# 201220 Bed Bug Heat Treatment Lauren Visit
# Mixed sources: h264/vp9, 30/120fps, 48k/44k audio.
# Normalize oddballs then stream-copy concat.
set -euo pipefail

SRC="E:/DCIM/Camera/201220 - Bed Bug Heat Treatment Lauren Visit"
WORK="/c/Users/kenne/AppData/Local/Temp/201220_work"
OUT="/c/Users/kenne/Videos/Daily/Bed Bug Heat Treatment Lauren Visit 201220.mp4"
LIST="$WORK/concat.txt"

mkdir -p "$WORK"
: > "$LIST"

# Majority format: h264 1920x1080 30fps yuv420p, aac 48000 stereo, rotation=-90
# Oddballs that need re-encode:
#   20201220_054715.mp4 — vp9 1080x1920 (native portrait, no rotation), 44100hz
#   20201220_080058.mp4 — h264 120fps
#   20201220_090855.mp4 — vp9 1080x1920 (native portrait, no rotation), 44100hz, 30000/1001fps

normalize() {
  # Re-encode to match majority: h264 1920x1080 stored landscape with rotate=-90, 30fps, aac 48k
  # VP9 clips are 1080x1920 native portrait — transpose to 1920x1080 then tag rotate=-90
  local in="$1" out="$2" reason="$3"
  echo "  re-encode ($reason): $(basename "$in")"
  ffmpeg -hide_banner -loglevel warning -y \
    -i "$in" \
    -c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p \
    -vf "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" \
    -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -movflags +faststart \
    "$out" 2>>"$WORK/ffmpeg.log"
}

CLIPS=(
  20201219_142635.mp4
  20201219_143514.mp4
  20201219_143620.mp4
  20201219_151712.mp4
  20201219_152142.mp4
  20201220_054715.mp4
  20201220_055241.mp4
  20201220_080058.mp4
  20201220_080346.mp4
  20201220_081808.mp4
  20201220_090855.mp4
  20201221_072042.mp4
)

echo "=== NORMALIZE ODDBALLS ==="
for f in "${CLIPS[@]}"; do
  case "$f" in
    20201220_054715.mp4)
      normalize "$SRC/$f" "$WORK/$f" "vp9+44k→h264+48k"
      echo "file 'C:/Users/kenne/AppData/Local/Temp/201220_work/$f'" >> "$LIST"
      ;;
    20201220_080058.mp4)
      normalize "$SRC/$f" "$WORK/$f" "120fps→30fps"
      echo "file 'C:/Users/kenne/AppData/Local/Temp/201220_work/$f'" >> "$LIST"
      ;;
    20201220_090855.mp4)
      normalize "$SRC/$f" "$WORK/$f" "vp9+44k→h264+48k"
      echo "file 'C:/Users/kenne/AppData/Local/Temp/201220_work/$f'" >> "$LIST"
      ;;
    *)
      echo "  stream-copy: $f"
      echo "file '$SRC/$f'" >> "$LIST"
      ;;
  esac
done

echo ""
echo "=== STREAM-COPY CONCAT (12 clips) ==="
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"
ffmpeg -hide_banner -loglevel warning -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart \
  "$OUT" 2>>"$WORK/ffmpeg.log"

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
printf "  clips:    12\n"
