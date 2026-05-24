#!/usr/bin/env bash
# Batch concat all Movie_R trips from F:\CARDV
# Each trip split by 5-min gap in timestamps
set -euo pipefail

SCRIPT="scripts/_local/build_dashcam_concat.sh"
SRC="/f/CARDV/Movie_R"
DAILY="/c/Users/kenne/Videos/Daily"

# Trip definitions: START_FILE END_FILE OUTPUT_NAME
declare -a TRIPS=(
  "20260505081030|20260505091230|260505 Rear 0810-0912 Dashcam"
  "20260505101203|20260505131803|260505 Rear 1012-1318 Dashcam"
  "20260505135107|20260505142107|260505 Rear 1351-1421 Dashcam"
  "20260505181136|20260505205836|260505 Rear 1811-2058 Dashcam"
  "20260506095727|20260506123527|260506 Rear 0957-1235 Dashcam"
  "20260507070631|20260507081531|260507 Rear 0706-0815 Dashcam"
  "20260507094942|20260507110142|260507 Rear 0949-1101 Dashcam"
  "20260509114628|20260509153628|260509 Rear 1146-1536 Dashcam"
  "20260509160313|20260509171213|260509 Rear 1603-1712 Dashcam"
  "20260510133711|20260510144111|260510 Rear 1337-1441 Dashcam"
  "20260510165725|20260510175225|260510 Rear 1657-1752 Dashcam"
)

for trip in "${TRIPS[@]}"; do
  IFS='|' read -r start end name <<< "$trip"
  out="$DAILY/$name.mp4"

  if [ -f "$out" ]; then
    sz=$(stat -c%s "$out")
    if [ "$sz" -gt 1000000 ]; then
      echo "=== SKIP: $name (already exists, $(( sz/1024/1024 )) MB) ==="
      continue
    fi
  fi

  echo ""
  echo "=========================================="
  echo "=== $name ==="
  echo "=========================================="
  bash "$SCRIPT" "$SRC" "$out" "$start" "$end"
done

echo ""
echo "=== ALL MOVIE_R TRIPS COMPLETE ==="
