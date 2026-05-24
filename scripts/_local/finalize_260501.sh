#!/usr/bin/env bash
# 260501 Solfin Quest — Stage 4 (music bed) + Stage 5 (final mux).
# Mirrors finalize_260423.sh structure.
set -euo pipefail

VID="/c/Users/kenne/AppData/Local/Temp/260501_work/260501_VID_unified.mp4"
BED="/c/Users/kenne/AppData/Local/Temp/music_bed_260501.m4a"
MUSIC_DIR="/e/DCIM/Videos/_Assets/Music"
DEST="/c/Users/kenne/Videos/Daily/Solfin Quest 4-30 thru 5-01 8K 260501.mp4"

TRACKS=(
  "Pissed the Dispensary Closed Early in the style of 8 Mile.mp3"
  "A song about Enterprise Dog Park.mp3"
  "Be careful what you wish for EDM1.mp3"
  "Be careful what you wish for EDM2.mp3"
  "Cruising with Max and Ty Cheesy Female Techno Version.mp3"
  "Cruising with Max and Ty FemEDM Pinellas sun reflects off chrome.mp3"
  "Cruising with Max and Ty FemEDM.mp3"
  "Cruising with Max and Ty.mp3"
  "Enterprise Dog Park (Circle of Life) (Friendly Version).mp3"
  "HERALD'S STAND.mp3"
  "How are you today_ Illenium Skrillex Version.mp3"
  "How are you today_.mp3"
  "Jurassic Dog Park (Circle of Life)(Buffet Style).mp3"
  "Jurassic Dog Park (Circle of Life).mp3"
  "Payload Spaces Theme - Flesh For Lulu meets Fallout Boy.mp3"
  "Payload Spaces Theme Offspring Style .mp3"
  "Payload Spaces Theme Song.mp3"
)

if [ ! -f "$VID" ]; then
  echo "[finalize] ERROR: unified video not found: $VID"
  echo "  Run dashcam_260501.sh first."
  exit 1
fi

# Probe video duration
VID_DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VID")
echo "[finalize] unified video duration: ${VID_DUR}s"

# ── Stage 4: build music bed ──────────────────────────────────────────────────
echo ""
echo "=== STAGE 4: music bed ==="

if [ -f "$BED" ]; then
  bed_dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$BED")
  if awk -v bd="$bed_dur" -v vd="$VID_DUR" 'BEGIN{exit !(bd >= vd)}'; then
    echo "  music bed already exists and covers video duration — skipping"
    SKIP_BED=1
  else
    echo "  music bed exists but too short (${bed_dur}s < ${VID_DUR}s) — rebuilding"
    SKIP_BED=0
  fi
else
  SKIP_BED=0
fi

if [ "$SKIP_BED" -eq 0 ]; then
  CONCAT_MUSIC="/c/Users/kenne/AppData/Local/Temp/music_concat_260501.txt"
  : > "$CONCAT_MUSIC"

  # Verify all tracks exist
  miss=0
  for t in "${TRACKS[@]}"; do
    if [ ! -f "$MUSIC_DIR/$t" ]; then
      echo "  !! MISSING track: $t"
      miss=$((miss+1))
    fi
  done
  [ $miss -gt 0 ] && { echo "[finalize] $miss music tracks missing — abort"; exit 1; }

  # Shuffle tracks, then loop until total >= video duration
  mapfile -t SHUFFLED < <(printf '%s\n' "${TRACKS[@]}" | shuf)

  total=0.0
  while awk -v t="$total" -v d="$VID_DUR" 'BEGIN{exit !(t < d)}'; do
    for t in "${SHUFFLED[@]}"; do
      full="$MUSIC_DIR/$t"
      win=$(echo "$full" | sed 's|^/e/|E:/|')
      echo "file '$win'" >> "$CONCAT_MUSIC"
      tdur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$full")
      total=$(awk -v a="$total" -v b="$tdur" 'BEGIN{printf "%.1f", a+b}')
      if awk -v t="$total" -v d="$VID_DUR" 'BEGIN{exit !(t >= d)}'; then
        break
      fi
    done
  done

  echo "  music bed concat list: $(wc -l < "$CONCAT_MUSIC") tracks → ${total}s"

  rm -f "$BED"
  ffmpeg -hide_banner -loglevel warning -y \
    -f concat -safe 0 -i "$CONCAT_MUSIC" \
    -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -movflags +faststart \
    "$BED"

  echo "  music bed → $BED"
fi

# ── Stage 5: final mux ───────────────────────────────────────────────────────
echo ""
echo "=== STAGE 5: final mux (30%/10% music envelope) ==="

mkdir -p "$(dirname "$DEST")"
rm -f "$DEST"

ffmpeg -hide_banner -loglevel warning -y \
  -i "$VID" -i "$BED" \
  -filter_complex "[1:a]volume='if(lt(t,60),0.30,0.10)':eval=frame[mus];[0:a][mus]amix=inputs=2:duration=first:normalize=0[aout]" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart \
  "$DEST"

# ── Verify ────────────────────────────────────────────────────────────────────
echo ""
echo "=== FINAL OUTPUT ==="
sz=$(stat -c%s "$DEST")
dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$DEST")
hh=$(awk -v d="$dur" 'BEGIN{printf "%d", d/3600}')
mm=$(awk -v d="$dur" 'BEGIN{printf "%d", (int(d)%3600)/60}')
ss=$(awk -v d="$dur" 'BEGIN{printf "%d", int(d)%60}')

printf "  file:     %s\n" "$DEST"
printf "  size:     %d MB (%.1f GB)\n" "$((sz/1024/1024))" "$(awk -v s="$sz" 'BEGIN{printf "%.1f", s/1024/1024/1024}')"
printf "  duration: %02d:%02d:%02d\n" "$hh" "$mm" "$ss"
echo ""
echo "Ready to upload."
