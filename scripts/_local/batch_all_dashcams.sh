#!/usr/bin/env bash
# Batch pure stream-copy concat for all dashcam rollups
# Zero re-encoding. Like with like. Just stitching.
set -euo pipefail

P="scripts/_local/pure_concat.sh"
D="/c/Users/kenne/Videos/Daily"

skip_if_exists() {
  if [ -f "$1" ]; then
    sz=$(stat -c%s "$1")
    if [ "$sz" -gt 10000000 ]; then
      echo "SKIP: $(basename "$1") ($(( sz/1024/1024 )) MB)"
      return 0
    fi
  fi
  return 1
}

echo "============================================"
echo "=== BATCH 1: Simple directory concats ==="
echo "============================================"

# 260419B
OUT="$D/260419 Rear 2036-2119 Dashcam.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/e/DCIM/Daily/260419B"

# 260421A
OUT="$D/260421 Front 0906-1130 Dashcam.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/c/Users/kenne/Videos/Daily/260421A"

# 260421B
OUT="$D/260421 Front 1714-2106 Dashcam.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/c/Users/kenne/Videos/Daily/260421B"

echo ""
echo "============================================"
echo "=== BATCH 2: F:\CARDV\Movie_R (11 trips) ==="
echo "============================================"

MR="/f/CARDV/Movie_R"
# Trip boundaries by start prefix
declare -a MR_TRIPS=(
  "20260505081|20260505091|260505 Rear 0810-0912 Dashcam"
  "20260505101|20260505131|260505 Rear 1012-1318 Dashcam"
  "20260505135|20260505142|260505 Rear 1351-1421 Dashcam"
  "20260505181|20260505205|260505 Rear 1811-2058 Dashcam"
  "20260506|20260506|260506 Rear 0957-1235 Dashcam"
  "20260507070|20260507081|260507 Rear 0706-0815 Dashcam"
  "20260507094|20260507110|260507 Rear 0949-1101 Dashcam"
  "20260509114|20260509153|260509 Rear 1146-1536 Dashcam"
  "20260509160|20260509171|260509 Rear 1603-1712 Dashcam"
  "20260510133|20260510144|260510 Rear 1337-1441 Dashcam"
  "20260510165|20260510175|260510 Rear 1657-1752 Dashcam"
)

for trip in "${MR_TRIPS[@]}"; do
  IFS='|' read -r start end name <<< "$trip"
  OUT="$D/$name.mp4"
  skip_if_exists "$OUT" && continue
  bash "$P" "$OUT" --dir "$MR" "$start" "$end"
done

echo ""
echo "============================================"
echo "=== BATCH 3: F:\CARDV\Movie_F (13 trips) ==="
echo "============================================"

MF="/f/CARDV/Movie_F"
declare -a MF_TRIPS=(
  "20260401161|20260401202|260401 Front 1610-2029 Dashcam"
  "20260504|20260504|260504 Front 1242-1316 Dashcam"
  "20260505081|20260505091|260505 Front 0810-0912 Dashcam"
  "20260505101|20260505131|260505 Front 1012-1318 Dashcam"
  "20260505135|20260505142|260505 Front 1351-1421 Dashcam"
  "20260505181|20260505205|260505 Front 1811-2058 Dashcam"
  "20260506|20260506|260506 Front 0957-1235 Dashcam"
  "20260507070|20260507081|260507 Front 0706-0815 Dashcam"
  "20260507094|20260507110|260507 Front 0949-1101 Dashcam"
  "20260509114|20260509153|260509 Front 1146-1536 Dashcam"
  "20260509160|20260509171|260509 Front 1603-1712 Dashcam"
  "20260510133|20260510144|260510 Front 1337-1441 Dashcam"
  "20260510165|20260510175|260510 Front 1657-1752 Dashcam"
)

for trip in "${MF_TRIPS[@]}"; do
  IFS='|' read -r start end name <<< "$trip"
  OUT="$D/$name.mp4"
  skip_if_exists "$OUT" && continue
  bash "$P" "$OUT" --dir "$MF" "$start" "$end"
done

echo ""
echo "============================================"
echo "=== BATCH 4: E:\DCIM dashcam subdirs ==="
echo "============================================"

# 260505/Movie_F (all 260401 clips)
OUT="$D/260401 Front 1256-1609 Dashcam DCIM.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/e/DCIM/Daily/260505/Movie_F"

# 260503/Movie_F (spans 260501 + 260503, split by date)
OUT="$D/260501 Front 1403-1454 Dashcam.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/e/DCIM/Daily/260503/Movie_F" "20260501" "20260501"

OUT="$D/260503 Front 0955-2123 Dashcam.mp4"
skip_if_exists "$OUT" || bash "$P" "$OUT" --dir "/e/DCIM/Daily/260503/Movie_F" "20260503" "20260503"

echo ""
echo "============================================"
echo "=== ALL DASHCAM ROLLUPS COMPLETE ==="
echo "============================================"
echo ""
echo "Verify outputs, then delete source directories to free space."
