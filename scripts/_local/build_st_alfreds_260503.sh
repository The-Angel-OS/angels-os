#!/usr/bin/env bash
# St. Alfred's Service Portrait — 260503 Sunday
# Holy Eucharist Rite 2 + Casavant Op. 3951 III/33 organ
# Interspersed with Max + Mika in the Soul Van
#
# Pattern: S1 D1 S2 D2 S3 D3 S4 D4 S5 S6 S7 D5 S8
# Output:  4K30 HEVC AAC 48k stereo
set -euo pipefail

SRC="/e/DCIM/Daily/260503"
WORK="/c/Users/kenne/AppData/Local/Temp/260503_stalfreds_work"
OUT="/c/Users/kenne/Videos/Daily/260503 St Alfreds Service Portrait (with Max and Mika in the Soul Van) 4K.mp4"
DESC="/c/Users/kenne/AppData/Local/Temp/260503_stalfreds_description.md"
BACKDROP_DIR="/e/DCIM/Videos/_Assets/Backgrounds"

mkdir -p "$WORK"

# Backdrop pool (deterministic per-clip pick by sequence)
mapfile -t BACKDROPS < <(find "$BACKDROP_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | sort)
BACKDROP_COUNT=${#BACKDROPS[@]}

# NVENC params — same as build_260502.py
NVENC_V=( -c:v hevc_nvenc -preset p7 -tune hq -rc vbr
          -cq 19 -b:v 60M -maxrate 90M -bufsize 180M
          -pix_fmt yuv420p -tag:v hvc1 )
AENC=( -c:a aac -b:a 192k -ar 48000 -ac 2 )
TS=( -video_track_timescale 30000 -muxpreload 0 -muxdelay 0 )
COMMON=( -hide_banner -loglevel warning -y )

# Build sheet — order is the final video order
# Format: SEQ TYPE FILENAME    (S = service landscape, D = dog portrait)
read -r -d '' BUILD <<'EOF' || true
01 S 20260503_110333.mp4
02 D 20260503_104323.mp4
03 S 20260503_110552.mp4
04 D 20260503_104342.mp4
05 S 20260503_111425.mp4
06 D 20260503_104408.mp4
07 S 20260503_111508.mp4
08 D 20260503_104455.mp4
09 S 20260503_111738.mp4
10 S 20260503_112228.mp4
11 S 20260503_112639.mp4
12 D 20260503_120201.mp4
13 S 20260503_120426.mp4
EOF

process_landscape() {
  local in="$1" out="$2"
  ffmpeg "${COMMON[@]}" \
    -i "$in" \
    -vf "scale=3840:2160:flags=lanczos,fps=30,setsar=1" \
    "${NVENC_V[@]}" "${AENC[@]}" "${TS[@]}" \
    -movflags +faststart \
    "$out"
}

process_portrait() {
  local in="$1" out="$2" backdrop="$3"
  ffmpeg "${COMMON[@]}" \
    -loop 1 -i "$backdrop" \
    -i "$in" \
    -filter_complex "
      [0:v]scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,boxblur=18:1,setsar=1[bg];
      [1:v]scale=-1:2160:flags=lanczos,setsar=1,fps=30[fg];
      [bg][fg]overlay=(W-w)/2:0:format=auto[v]
    " \
    -map "[v]" -map 1:a? -shortest \
    "${NVENC_V[@]}" "${AENC[@]}" "${TS[@]}" \
    -metadata:s:v:0 rotate=0 \
    -movflags +faststart \
    "$out"
}

echo "=== STAGE 1: per-clip normalize ==="
LIST="$WORK/concat_list.txt"
: > "$LIST"

while IFS= read -r line; do
  [[ -z "${line// /}" ]] && continue
  read -r seq type file <<< "$line"
  [[ -z "$file" ]] && continue
  in="$SRC/$file"
  out="$WORK/s_${seq}.mp4"

  if [ ! -f "$in" ]; then echo "  [$seq] !! MISSING: $file"; continue; fi

  if [ -f "$out" ] && [ "$out" -nt "$in" ]; then
    echo "  [$seq] $type $file (cached)"
  else
    case "$type" in
      S) echo "  [$seq] S $file → 4K landscape downscale"
         process_landscape "$in" "$out" ;;
      D) bd_idx=$(( 10#$seq % BACKDROP_COUNT ))
         bd="${BACKDROPS[$bd_idx]}"
         echo "  [$seq] D $file → 4K portrait+backdrop ($(basename "$bd"))"
         process_portrait "$in" "$out" "$bd" ;;
    esac
  fi
  win=$(echo "$out" | sed 's|^/c/|C:/|')
  echo "file '$win'" >> "$LIST"
done <<< "$BUILD"

echo ""
echo "=== STAGE 2: stream-copy concat ==="
rm -f "$OUT"
mkdir -p "$(dirname "$OUT")"
ffmpeg "${COMMON[@]}" \
  -f concat -safe 0 -i "$LIST" \
  -c copy -video_track_timescale 30000 -movflags +faststart \
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

# Generate description
cat > "$DESC" <<'DESCEOF'
# 260503 St. Alfred's Service Portrait
## Holy Eucharist Rite 2 with Choir — Palm Harbor, FL
### (with Max & Mika holding the Soul Van during worship)

Sunday, May 3, 2026. **St. Alfred's Episcopal Church**, Palm Harbor, Florida.
The very best pipe organ currently in existence — a **2023 Casavant Frères
Op. 3951 III/33** — and arguably the very finest liturgy I have sat under
in this part of the universe.

Front left row, center right, in front and earnestly participating —
because the goal is always to transmit to everyone, everywhere, and
everywhen, in this realm and every other. Amen.

**Interspersed throughout:** Max the Shih Tzu and Mika holding the Soul Van
in the parking lot during the service. They were already in their own kind
of communion. The cuts back-and-forth are intentional — the worship was
happening simultaneously inside the sanctuary AND in the van where Max was
licking Mika contentedly. The brethren are everywhere. The signal is in
both rooms at once.

**Note for next time:** I missed the narthex fresco of the Cosmic Jesus
throwing signs on the way out. Kicking myself. The artwork and murals at
St. Alfred's are synchronistically spectacular and warrant a dedicated
visit with proper lighting and time. **Returning soon.**

---

## 🎬 Chapters

0:00 🎬 Service entry
0:16 🐕 Max & Mika in the Soul Van — quick contented moment
0:29 ⛪ Liturgy of the Word + Hymns (Casavant Op. 3951 in full voice)
8:36 🐕 Max & Mika — a longer breath
8:58 ⛪ Service continues
9:36 🐕 Max & Mika — full canine contemplation
10:19 ⛪ Service moment
11:13 🐕 Max & Mika — quick coda
11:22 ⛪ Sermon section (Rev. Agostino Rivolta, Preacher)
15:34 ⛪ Holy Eucharist (Rev. Larry D. Hooper, Celebrant)
19:40 ⛪ Sortie — Noel Rawsthorne (the way out)

---

## 👥 Clergy & Music

- **The Rev. Peter A. Lane** — Rector
- **The Rev. Larry D. Hooper** — Celebrant
- **The Rev. Agostino Rivolta** — Preacher
- **Kevin V. Johnson, AAGO** — Organist and Choirmaster
- **Organ:** 2023 Casavant Frères Op. 3951 III/33

## 🎼 Music
- *Aria* — Alfred Fedak
- *God's Paschal Lamb is Sacrificed for Us* — Carl Daw / Charles Stanford
- *Psalm 31 (The Hymn Tune Psalter)* — Carl Daw / Kevin Hackett
- *Come, My Way, My Truth, My Life* — Eugene Butler
- *Walk Humbly with Your God* — Robert Powell
- *Sanctus S125* — Richard Proulx
- *Be Known to Us, Lord Jesus* — Gary James
- *Sortie* — Noel Rawsthorne

---

## 🔗 Links

- **Official livestream of the full service:** https://www.youtube.com/watch?v=5fhahoMbzKs
- St. Alfred's Episcopal Church, Palm Harbor: https://www.youtube.com/@StAlfredsPalmHarbor
- The Episcopal Diocese of Southwest Florida

---

## 🏷 Hashtags

#StAlfreds #PalmHarbor #EpiscopalChurch #HolyEucharist #CasavantFrères
#PipeOrgan #SacredMusic #ClearwaterCruisin #SoulVan #SoulQuest
#MaxAndMika #ShihTzu #Florida #Pinellas #Worship #Liturgy
#TheBrethren #SignalInBothRooms

---

*Posted as part of the daily Soul Quest archive — Clearwater Cruisin' channel.
Every byte a love letter to the future. Station.* 🌅
DESCEOF

echo ""
echo "  description: $DESC"
echo ""
echo "Soli Deo Gloria. Station."
