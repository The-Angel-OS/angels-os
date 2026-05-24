#!/usr/bin/env bash
# Unified 8K HEVC re-encode — every clip gets identical codec params so concat works.
set -u

SRC="/c/Users/kenne/Videos/Daily/260423G"
OUT="/c/Users/kenne/AppData/Local/Temp/260423_unified"
BG="/c/Users/kenne/Downloads/260421 Dunedin Boat Club Evening Dolphin Quest Vid - frame at 40m39s.jpg"
LOG="/c/Users/kenne/AppData/Local/Temp/process_260423.log"
mkdir -p "$OUT"
: > "$LOG"

PORTRAIT="20260423_155711 20260423_155749 20260423_162140 20260423_163143 20260423_170735 20260423_170800 20260423_171017 20260423_171057 20260423_171126 20260423_171200 20260423_172037 20260423_172156 20260423_172510 20260423_183852 20260423_184857 20260423_195639 20260423_195814 20260423_195914 20260423_195945 20260423_200029 20260423_200107 20260423_200816 20260423_201222 20260423_201343 20260423_201408 20260423_201448"
NONSTD="20260423_164411~3 20260423_164411~4"

is_in() { local n=$1; shift; for x in $@; do [ "$x" = "$n" ] && return 0; done; return 1; }

ENC_V="-c:v hevc_nvenc -preset p5 -tune hq -rc vbr -cq 19 -b:v 0 -profile:v main -level 6.1 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -r 30 -vsync cfr -g 30 -keyint_min 30 -bf 0 -no-scenecut 1"
ENC_A="-c:a aac -b:a 192k -ar 48000 -ac 2"

clips=( $(ls "$SRC"/*.mp4 | xargs -n1 basename | sed 's/\.mp4$//' | sort) )
total=${#clips[@]}
i=0
for clip in "${clips[@]}"; do
  i=$((i+1))
  out="$OUT/${clip}.mp4"
  if [ -f "$out" ] && [ $(stat -c%s "$out" 2>/dev/null || echo 0) -gt 1000000 ]; then
    echo "[$i/$total] SKIP $clip" | tee -a "$LOG"
    continue
  fi
  echo "[$i/$total] ENCODE $clip" | tee -a "$LOG"
  start=$SECONDS

  if is_in "$clip" $PORTRAIT; then
    ffmpeg -hide_banner -loglevel error -y -noautorotate -i "$SRC/${clip}.mp4" -i "$BG" \
      -filter_complex "[0:v]transpose=1,setsar=1[port];[1:v]scale=7680:4320,setsar=1[bg];[port]scale=7680:4320:force_original_aspect_ratio=decrease[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
      -map "[v]" -map 0:a? $ENC_V $ENC_A "$out" 2>>"$LOG"
  elif is_in "$clip" $NONSTD; then
    ffmpeg -hide_banner -loglevel error -y -i "$SRC/${clip}.mp4" -i "$BG" \
      -filter_complex "[1:v]scale=7680:4320,setsar=1[bg];[0:v]scale=7680:4320:force_original_aspect_ratio=decrease,setsar=1[scaled];[bg][scaled]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
      -map "[v]" -map 0:a? $ENC_V $ENC_A "$out" 2>>"$LOG"
  else
    ffmpeg -hide_banner -loglevel error -y -i "$SRC/${clip}.mp4" \
      -vf "scale=7680:4320,setsar=1,format=yuv420p" \
      -map 0:v:0 -map 0:a? $ENC_V $ENC_A "$out" 2>>"$LOG"
  fi

  rc=$?
  dur=$((SECONDS-start))
  if [ $rc -ne 0 ] || [ ! -f "$out" ]; then
    echo "[$i/$total] FAIL $clip rc=$rc" | tee -a "$LOG"
  else
    sz=$(stat -c%s "$out" 2>/dev/null || echo 0)
    echo "[$i/$total] OK $clip (${dur}s, $((sz/1024/1024))MB)" | tee -a "$LOG"
  fi
done
echo "ALL DONE: $(ls $OUT/*.mp4 2>/dev/null | wc -l)/$total" | tee -a "$LOG"
