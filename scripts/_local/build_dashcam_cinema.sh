#!/usr/bin/env bash
# build_dashcam_cinema.sh — Cinematic dashcam compositor
#
# MODES:
#   alternate   10s front road / 50s cabin per matched pair (default)
#   pip-cabin   cabin full frame + road inset top-right
#   pip-road    road full frame (downscaled) + cabin inset top-right
#
# USAGE:
#   ./build_dashcam_cinema.sh [DATE_PREFIX] [MODE]
#   ./build_dashcam_cinema.sh 20260520          → alternate mode
#   ./build_dashcam_cinema.sh 20260522 pip-cabin → PIP cabin-main
#   ./build_dashcam_cinema.sh all               → all days, alternate mode
#   ./build_dashcam_cinema.sh all pip-cabin
#
# OUTPUT: C:\Users\kenne\Videos\Daily\YYMMDD Dashcam Cinema [mode].mp4
#
# REQUIRES: ffmpeg with hevc_nvenc (NVIDIA GPU)

set -euo pipefail

FRONT_DIR="/f/CARDV/Movie_F"
REAR_DIR="/f/CARDV/Movie_R"
OUT_DIR="/c/Users/kenne/Videos/Daily"
WORK_DIR="/c/Users/kenne/AppData/Local/Temp/dashcam_cinema"
ENCODER="hevc_nvenc"
CQ=22
PRESET="p5"

DATE_ARG="${1:-all}"
MODE="${2:-alternate}"

# ─── helpers ────────────────────────────────────────────────────────────────

win_path() { echo "$1" | sed 's|^/\([a-zA-Z]\)/|\U\1:/|'; }

skip_if_exists() {
  local f="$1"
  if [ -f "$f" ]; then
    sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
    if [ "$sz" -gt 1048576 ]; then
      echo "  SKIP (exists, $(( sz/1024/1024 ))MB): $(basename "$f")"
      return 0
    fi
  fi
  return 1
}

hms() {
  awk -v d="$1" 'BEGIN{h=int(d/3600);m=int((d%3600)/60);s=int(d)%60;printf "%02d:%02d:%02d",h,m,s}'
}

nvenc_args() { echo "-c:v $ENCODER -preset $PRESET -rc vbr -cq $CQ -c:a copy"; }

# ─── find matched pairs for a given date prefix ─────────────────────────────

build_day() {
  local DATE="$1"
  local MODE="$2"
  local YYMM="${DATE:2:6}"
  local OUT_LABEL
  case "$MODE" in
    alternate)  OUT_LABEL="Alternate" ;;
    pip-cabin)  OUT_LABEL="PIP-Cabin" ;;
    pip-road)   OUT_LABEL="PIP-Road" ;;
  esac

  local FINAL_OUT="$OUT_DIR/${YYMM} Dashcam Cinema [${OUT_LABEL}].mp4"
  local WIN_OUT
  WIN_OUT=$(win_path "$FINAL_OUT")

  if skip_if_exists "$FINAL_OUT"; then return 0; fi

  local DAY_WORK="$WORK_DIR/${DATE}_${MODE}"
  mkdir -p "$DAY_WORK"

  echo ""
  echo "════════════════════════════════════════════"
  echo "  DATE: $DATE  MODE: $MODE"
  echo "════════════════════════════════════════════"

  # Build sorted list of front clips for this day
  local FRONT_CLIPS=()
  while IFS= read -r f; do
    FRONT_CLIPS+=("$f")
  done < <(ls "$FRONT_DIR"/${DATE}*F.MP4 2>/dev/null | sort)

  if [ ${#FRONT_CLIPS[@]} -eq 0 ]; then
    echo "  No front clips found for $DATE — skipping"
    return 0
  fi

  echo "  Front clips: ${#FRONT_CLIPS[@]}"

  local SEG_LIST="$DAY_WORK/segments.txt"
  > "$SEG_LIST"
  local seg_idx=0
  local skipped=0
  local processed=0

  for FRONT in "${FRONT_CLIPS[@]}"; do
    local TS
    TS=$(basename "$FRONT" | cut -c1-14)  # YYYYMMDDHHMMSS
    # Find matching rear clip (same timestamp, ends in R.MP4)
    local REAR
    REAR=$(ls "$REAR_DIR"/${TS}*R.MP4 2>/dev/null | head -1 || true)

    local SEG_OUT="$DAY_WORK/seg_$(printf '%05d' $seg_idx).mp4"
    local WIN_FRONT WIN_REAR WIN_SEG
    WIN_FRONT=$(win_path "$FRONT")
    WIN_SEG=$(win_path "$SEG_OUT")

    if skip_if_exists "$SEG_OUT"; then
      echo "  file '$WIN_SEG'" >> "$SEG_LIST"
      (( seg_idx++ )) || true
      (( skipped++ )) || true
      continue
    fi

    if [ -n "$REAR" ] && [ -f "$REAR" ]; then
      WIN_REAR=$(win_path "$REAR")

      case "$MODE" in
        alternate)
          # 10s front road (downscaled to 1080p) + 50s cabin (native 1080p)
          # Normalize to 1080p so stream-copy concat works cleanly
          local SEGA="$DAY_WORK/seg_$(printf '%05d' $seg_idx)a.mp4"
          local SEGB="$DAY_WORK/seg_$(printf '%05d' $seg_idx)b.mp4"
          local WIN_SEGA WIN_SEGB WIN_SUBLIST
          WIN_SEGA=$(win_path "$SEGA")
          WIN_SEGB=$(win_path "$SEGB")

          # 10s from front — scale 4K→1080p
          ffmpeg -hide_banner -loglevel error -y \
            -ss 0 -t 10 -i "$WIN_FRONT" \
            -vf "scale=1920:1080:flags=lanczos" \
            $(nvenc_args) \
            -video_track_timescale 30000 "$WIN_SEGA"

          # 50s from rear — native 1080p, no scaling
          ffmpeg -hide_banner -loglevel error -y \
            -ss 0 -t 50 -i "$WIN_REAR" \
            $(nvenc_args) \
            -video_track_timescale 30000 "$WIN_SEGB"

          # Concat the two sub-segments into one segment
          local SUBLIST
          SUBLIST=$(mktemp "$WORK_DIR/sub_XXXXX.txt")
          echo "file '$WIN_SEGA'" > "$SUBLIST"
          echo "file '$WIN_SEGB'" >> "$SUBLIST"
          WIN_SUBLIST=$(win_path "$SUBLIST")

          ffmpeg -hide_banner -loglevel error -y \
            -f concat -safe 0 -i "$WIN_SUBLIST" \
            -c copy -video_track_timescale 30000 "$WIN_SEG"
          rm -f "$SUBLIST" "$SEGA" "$SEGB"
          ;;

        pip-cabin)
          # Cabin (rear 1080p) as main, road inset 480x270 top-right corner
          ffmpeg -hide_banner -loglevel error -y \
            -i "$WIN_REAR" -i "$WIN_FRONT" \
            -filter_complex \
              "[1:v]scale=480:270[pip];[0:v][pip]overlay=W-w-16:16[out]" \
            -map "[out]" -map 0:a \
            $(nvenc_args) \
            -video_track_timescale 30000 "$WIN_SEG"
          ;;

        pip-road)
          # Road (front 4K→1080p) as main, cabin inset 384x216 top-right
          ffmpeg -hide_banner -loglevel error -y \
            -i "$WIN_FRONT" -i "$WIN_REAR" \
            -filter_complex \
              "[0:v]scale=1920:1080[main];[1:v]scale=384:216[pip];[main][pip]overlay=W-w-16:16[out]" \
            -map "[out]" -map 0:a \
            $(nvenc_args) \
            -video_track_timescale 30000 "$WIN_SEG"
          ;;
      esac
    else
      # No matching rear — for alternate mode, downscale front to 1080p to match;
      # for pip modes, just stream-copy the front as-is (full road clip)
      if [ "$MODE" = "alternate" ]; then
        ffmpeg -hide_banner -loglevel error -y \
          -i "$WIN_FRONT" \
          -vf "scale=1920:1080:flags=lanczos" \
          $(nvenc_args) \
          -video_track_timescale 30000 "$WIN_SEG"
      else
        ffmpeg -hide_banner -loglevel error -y \
          -i "$WIN_FRONT" \
          -c copy -video_track_timescale 30000 "$WIN_SEG"
      fi
    fi

    echo "  file '$WIN_SEG'" >> "$SEG_LIST"
    (( seg_idx++ )) || true
    (( processed++ )) || true
    printf "  [%d/%d] %s\r" "$seg_idx" "${#FRONT_CLIPS[@]}" "$(basename "$FRONT")"
  done

  echo ""
  echo "  Segments: $processed built, $skipped cached"
  echo "  Concatenating → $(basename "$FINAL_OUT") ..."

  local WIN_LIST
  WIN_LIST=$(win_path "$SEG_LIST")

  ffmpeg -hide_banner -loglevel warning -y \
    -f concat -safe 0 -i "$WIN_LIST" \
    -c copy -movflags +faststart "$WIN_OUT"

  local sz
  sz=$(stat -c%s "$FINAL_OUT")
  local dur
  dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$FINAL_OUT")
  printf "  DONE: %d MB, %s\n" "$((sz/1024/1024))" "$(hms "$dur")"
}

# ─── main ───────────────────────────────────────────────────────────────────

mkdir -p "$WORK_DIR" "$OUT_DIR"

if [ "$DATE_ARG" = "all" ]; then
  # Discover all unique dates from front cam
  DAYS=()
  while IFS= read -r day; do
    DAYS+=("$day")
  done < <(ls "$FRONT_DIR"/ | cut -c1-8 | sort -u)

  echo "Days found: ${DAYS[*]}"
  for DAY in "${DAYS[@]}"; do
    build_day "$DAY" "$MODE"
  done
else
  build_day "$DATE_ARG" "$MODE"
fi

echo ""
echo "All done. Output in: $OUT_DIR"
