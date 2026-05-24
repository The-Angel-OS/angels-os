#!/usr/bin/env bash
# Probe the curated 260501 clip list. Sort chronologically, dump a manifest TSV
# with the params that matter for stream-copy concat compatibility.
set -euo pipefail

SRC="/e/DCIM/Daily/260501"
OUT="/c/Users/kenne/AppData/Local/Temp/260501_manifest.tsv"

# User's curated 40-clip list (basenames only — sort handles ordering).
CLIPS=(
  20260430_120904.mp4
  20260501_064418.mp4
  20260501_064625.mp4
  20260501_083816.mp4
  20260501_085525.mp4
  20260501_085925.mp4
  20260501_091457.mp4
  20260501_093322.mp4
  20260501_093542.mp4
  20260501_093727.mp4
  20260501_101219.mp4
  20260501_101811.mp4
  20260501_105207.mp4
  20260501_105219.mp4
  20260501_105249.mp4
  20260501_105300.mp4
  20260501_105333.mp4
  20260501_114913.mp4
  20260501_115001.mp4
  20260501_115110.mp4
  20260501_115220.mp4
  20260501_115519.mp4
  20260501_115805.mp4
  20260501_120424.mp4
  20260501_120445.mp4
  20260501_121232~2.mp4
  20260501_121501.mp4
  20260501_121817.mp4
  20260501_122433.mp4
  20260501_122543.mp4
  20260501_122613.mp4
  20260501_122747.mp4
  20260501_125443.mp4
  20260501_130052.mp4
  20260501_130507.mp4
  20260501_142818.mp4
  20260501_142915.mp4
  20260501_142946.mp4
  20260501_143011.mp4
  20260501_143032.mp4
)

# Header
printf "seq\tfilename\tduration_s\twidth\theight\torient\tfps\tvcodec\tpix_fmt\tacodec\tasr\tachannels\tsize_mb\trotation\n" > "$OUT"

i=0
for f in "${CLIPS[@]}"; do
  i=$((i+1))
  path="$SRC/$f"
  if [ ! -f "$path" ]; then
    printf "%02d\t%s\tMISSING\n" "$i" "$f" >> "$OUT"
    echo "  !! MISSING: $f"
    continue
  fi

  # Probe video stream
  vline=$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt:stream_tags=rotate:stream_side_data=rotation \
    -of default=nw=1 "$path" 2>/dev/null)

  width=$(echo "$vline"  | awk -F= '/^width=/{print $2}')
  height=$(echo "$vline" | awk -F= '/^height=/{print $2}')
  rfr=$(echo "$vline"    | awk -F= '/^r_frame_rate=/{print $2}')
  vcodec=$(echo "$vline" | awk -F= '/^codec_name=/{print $2}')
  pixfmt=$(echo "$vline" | awk -F= '/^pix_fmt=/{print $2}')
  rot=$(echo "$vline"    | awk -F= '/rotation=|rotate=/{print $2}' | head -1)
  rot=${rot:-0}

  # fps as decimal
  fps=$(awk -v r="$rfr" 'BEGIN{ split(r,a,"/"); if (a[2]>0) printf "%.2f", a[1]/a[2]; else print r }')

  # Probe audio stream
  aline=$(ffprobe -v error -select_streams a:0 \
    -show_entries stream=codec_name,sample_rate,channels \
    -of default=nw=1 "$path" 2>/dev/null)
  acodec=$(echo "$aline"    | awk -F= '/^codec_name=/{print $2}')
  asr=$(echo "$aline"       | awk -F= '/^sample_rate=/{print $2}')
  achannels=$(echo "$aline" | awk -F= '/^channels=/{print $2}')

  # Duration (format-level)
  dur=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$path" 2>/dev/null)
  dur_int=$(awk -v d="$dur" 'BEGIN{printf "%.1f", d+0}')

  # Size MB
  sz=$(stat -c%s "$path")
  sz_mb=$((sz/1024/1024))

  # Orientation: portrait if (rot is ±90/270) OR height > width
  orient="landscape"
  if [ "$rot" = "90" ] || [ "$rot" = "-90" ] || [ "$rot" = "270" ]; then
    orient="portrait"
  elif [ -n "$width" ] && [ -n "$height" ] && [ "$height" -gt "$width" ]; then
    orient="portrait"
  fi

  printf "%02d\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" \
    "$i" "$f" "$dur_int" "$width" "$height" "$orient" "$fps" "$vcodec" "$pixfmt" "$acodec" "$asr" "$achannels" "$sz_mb" "$rot" >> "$OUT"
done

echo ""
echo "=== MANIFEST: $OUT ==="
column -t -s $'\t' "$OUT"

echo ""
echo "=== COMPATIBILITY SUMMARY ==="
echo "Unique resolutions:" ; awk -F'\t' 'NR>1{print $4"x"$5}' "$OUT" | sort -u
echo "Unique fps:        " ; awk -F'\t' 'NR>1{print $7}'        "$OUT" | sort -u
echo "Unique vcodecs:    " ; awk -F'\t' 'NR>1{print $8}'        "$OUT" | sort -u
echo "Unique pix_fmt:    " ; awk -F'\t' 'NR>1{print $9}'        "$OUT" | sort -u
echo "Unique acodecs:    " ; awk -F'\t' 'NR>1{print $10}'       "$OUT" | sort -u
echo "Unique asr:        " ; awk -F'\t' 'NR>1{print $11}'       "$OUT" | sort -u
echo "Unique channels:   " ; awk -F'\t' 'NR>1{print $12}'       "$OUT" | sort -u
echo "Orientations:      " ; awk -F'\t' 'NR>1{print $6}'        "$OUT" | sort | uniq -c

# Total runtime
total=$(awk -F'\t' 'NR>1{s+=$3} END{printf "%.0f", s}' "$OUT")
hh=$((total/3600)); mm=$(((total%3600)/60)); ss=$((total%60))
printf "\nTotal runtime: %d clips → %02d:%02d:%02d (%d sec)\n" $((i)) "$hh" "$mm" "$ss" "$total"
