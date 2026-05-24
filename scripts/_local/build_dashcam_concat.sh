#!/usr/bin/env bash
# Universal dashcam folder concat script.
# Stream-copies all .MP4 files in a source folder (sorted by name) into one output.
# Audio resampled to 48kHz stereo AAC for downstream compatibility.
# Timescale unified to 30000 to avoid concat PTS issues.
#
# Usage: bash build_dashcam_concat.sh <SRC_DIR> <OUT_FILE> [START_FILE] [END_FILE]
#   SRC_DIR   = folder of .MP4 dashcam clips
#   OUT_FILE  = output path
#   START_FILE = optional start filename (inclusive)
#   END_FILE   = optional end filename (inclusive)
set -euo pipefail

SRC="${1:?Usage: $0 <SRC_DIR> <OUT_FILE> [START] [END]}"
OUT="${2:?Usage: $0 <SRC_DIR> <OUT_FILE> [START] [END]}"
START="${3:-}"
END="${4:-}"
WORK="/c/Users/kenne/AppData/Local/Temp/dashcam_concat_work"

mkdir -p "$WORK"

COMMON=( -hide_banner -loglevel warning -y )

# Build file list
# START/END can be full filenames or date prefixes (e.g. "20260504").
# All files whose basename is >= START (alpha sort) and <= END~ are included.
echo "=== Scanning $SRC ==="
LIST="$WORK/concat_list_$(date +%s).txt"
: > "$LIST"
count=0

for f in "$SRC"/*.MP4; do
  bn=$(basename "$f")

  # Skip files before START (prefix or full-name comparison)
  if [ -n "$START" ] && [[ "$bn" < "$START" ]]; then
    continue
  fi

  # Stop after END: if END is a prefix, skip files that sort after the prefix range
  if [ -n "$END" ]; then
    if [[ "$bn" == "$END" ]]; then
      # Exact match — include and stop
      win=$(echo "$f" | sed 's|^/\([a-z]\)/|\U\1:/|; s|^/\([A-Z]\)/|\1:/|')
      echo "file '$win'" >> "$LIST"
      count=$((count + 1))
      break
    elif [[ ! "$bn" == "$END"* ]] && [[ "$bn" > "$END" ]]; then
      # Past the END range — stop
      break
    fi
  fi

  win=$(echo "$f" | sed 's|^/\([a-z]\)/|\U\1:/|; s|^/\([A-Z]\)/|\1:/|')
  echo "file '$win'" >> "$LIST"
  count=$((count + 1))
done

echo "  $count clips queued"

if [ "$count" -eq 0 ]; then
  echo "!! No clips found. Check paths."
  exit 1
fi

# Probe first clip for format info
first_clip=$(head -1 "$LIST" | sed "s/^file '//;s/'$//" | sed 's|^C:|/c|; s|^F:|/f|; s|^E:|/e|')
echo "  Probing: $(basename "$first_clip")"

width=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=nw=1:nk=1 "$first_clip")
height=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$first_clip")
fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$first_clip")
asr=$(ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=nw=1:nk=1 "$first_clip" 2>/dev/null || echo "0")
ach=$(ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=nw=1:nk=1 "$first_clip" 2>/dev/null || echo "0")

echo "  Video: ${width}x${height} @ ${fps}"
echo "  Audio: ${asr}Hz ${ach}ch"

# Determine if audio needs normalization
NEEDS_AUDIO_FIX=false
if [ "$asr" != "48000" ] || [ "$ach" != "2" ]; then
  NEEDS_AUDIO_FIX=true
  echo "  Audio needs resample: ${asr}Hz/${ach}ch -> 48000Hz/2ch"
fi

if [ "$NEEDS_AUDIO_FIX" = "true" ]; then
  # Must re-encode audio per-clip, then concat
  echo ""
  echo "=== STAGE 1: Normalize audio per-clip ==="
  NORM_LIST="$WORK/concat_norm_$(date +%s).txt"
  : > "$NORM_LIST"
  i=0

  while IFS= read -r line; do
    src=$(echo "$line" | sed -E "s/^file '(.+)'\$/\1/" | sed 's|^C:|/c|; s|^F:|/f|; s|^E:|/e|')
    bn=$(basename "$src")
    norm_out="$WORK/n_${bn}"
    i=$((i + 1))

    if [ -f "$norm_out" ] && [ "$norm_out" -nt "$src" ]; then
      : # cached
    else
      ffmpeg "${COMMON[@]}" \
        -i "$src" \
        -c:v copy \
        -c:a aac -b:a 128k -ar 48000 -ac 2 \
        -video_track_timescale 30000 -muxpreload 0 -muxdelay 0 \
        -movflags +faststart \
        "$norm_out"
    fi

    win_norm=$(echo "$norm_out" | sed 's|^/c/|C:/|; s|^/f/|F:/|; s|^/e/|E:/|')
    echo "file '$win_norm'" >> "$NORM_LIST"

    if [ $((i % 25)) -eq 0 ] || [ "$i" -le 3 ]; then
      echo "  $i/$count normalized"
    fi
  done < "$LIST"
  echo "  all $count clips normalized"
  FINAL_LIST="$NORM_LIST"
else
  # Stream-copy concat directly — just unify timescale
  echo ""
  echo "=== STAGE 1: Timescale normalization ==="
  NORM_LIST="$WORK/concat_norm_$(date +%s).txt"
  : > "$NORM_LIST"
  i=0

  while IFS= read -r line; do
    src=$(echo "$line" | sed -E "s/^file '(.+)'\$/\1/" | sed 's|^C:|/c|; s|^F:|/f|; s|^E:|/e|')
    bn=$(basename "$src")
    norm_out="$WORK/ts_${bn}"
    i=$((i + 1))

    if [ -f "$norm_out" ] && [ "$norm_out" -nt "$src" ]; then
      :
    else
      ffmpeg "${COMMON[@]}" \
        -i "$src" \
        -c copy \
        -video_track_timescale 30000 -muxpreload 0 -muxdelay 0 \
        -movflags +faststart \
        "$norm_out"
    fi

    win_norm=$(echo "$norm_out" | sed 's|^/c/|C:/|; s|^/f/|F:/|; s|^/e/|E:/|')
    echo "file '$win_norm'" >> "$NORM_LIST"

    if [ $((i % 25)) -eq 0 ] || [ "$i" -le 3 ]; then
      echo "  $i/$count done"
    fi
  done < "$LIST"
  echo "  all $count clips ready"
  FINAL_LIST="$NORM_LIST"
fi

echo ""
echo "=== STAGE 2: Stream-copy concat ==="
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
ffmpeg "${COMMON[@]}" \
  -f concat -safe 0 -i "$FINAL_LIST" \
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
printf "  size:     %d MB (%.1f GB)\n" "$((sz/1024/1024))" "$(awk -v s="$sz" 'BEGIN{printf "%.2f", s/1073741824}')"
printf "  duration: %02d:%02d:%02d\n" "$hh" "$mm" "$ss"
echo ""
echo "STATION!"
