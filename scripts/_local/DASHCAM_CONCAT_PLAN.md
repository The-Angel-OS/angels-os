# Dashcam Concat Plan — F:\CARDV

All outputs go to `C:\Users\kenne\Videos\Daily\` using the reusable `build_dashcam_concat.sh`.

**Format:** Front cam = 3840x2160 HEVC 25fps, Rear cam = 1920x1080 HEVC 25fps. Both mono 16kHz AAC (resampled to 48kHz stereo on concat).

---

## 1. ALREADY RUNNING

| # | Source | Range | Clips | Size | Est Duration | Output |
|---|---|---|---|---|---|---|
| 1 | Movie_R/260505 | 091230-130103 | 170 | 11.9 GB | ~2:50 | `260505 Rear Movie Ride with Anthony of Clearwater to Dunedin Marina to see Dolphins.mp4` |

**Status: IN PROGRESS**

---

## 2. REMAINING 260505 TRIPS (4 distinct trips by time gap)

### Trip A: Morning Run (08:10 - 09:12)
| Cam | Clips | Size | Output |
|---|---|---|---|
| Movie_F | 63 | ~9.5 GB | `260505 Front Morning Run 0810-0912.mp4` |
| Movie_R | 63 | ~4.5 GB | `260505 Rear Morning Run 0810-0912.mp4` |

### Trip B: Clearwater to Dunedin (10:12 - 13:18) — YOUR ANTHONY TRIP
| Cam | Clips | Size | Output |
|---|---|---|---|
| Movie_F | 186 | ~28 GB | `260505 Front Movie Ride with Anthony of Clearwater to Dunedin Marina to see Dolphins.mp4` |
| Movie_R | 170* | ~11.9 GB | **(already running — rear cam subset of this trip)** |

### Trip C: Afternoon (13:51 - 14:21)
| Cam | Clips | Size | Output |
|---|---|---|---|
| Movie_F | 31 | ~4.7 GB | `260505 Front Afternoon Run 1351-1421.mp4` |
| Movie_R | 31 | ~2.2 GB | `260505 Rear Afternoon Run 1351-1421.mp4` |

### Trip D: Evening (18:11 - 20:58)
| Cam | Clips | Size | Output |
|---|---|---|---|
| Movie_F | 165 | ~24.8 GB | `260505 Front Evening Run 1811-2058.mp4` |
| Movie_R | 165 | ~11.8 GB | `260505 Rear Evening Run 1811-2058.mp4` |

---

## 3. 260504 (One trip, both cams)

| Cam | Clips | Size | Est Duration | Output |
|---|---|---|---|---|
| Movie_F | 35 | 5.2 GB | ~32 min | `260504 Front Dashcam.mp4` |
| Movie_R | 35 | 2.4 GB | ~32 min | `260504 Rear Dashcam.mp4` |

---

## 4. 260401 (One long session — front only, no rear)

| Cam | Clips | Size | Est Duration | Output |
|---|---|---|---|---|
| Movie_F | 450 | 101.2 GB | ~6:45 | `260401 Front Dashcam.mp4` |

**WARNING:** This is 101 GB of source. Output will be ~90+ GB. Not enough space on C: (66 GB free) or E: (40 GB free). Need external storage or skip this one.

---

## 5. Park Events (impact/parking detection clips — sparse)

| Date | Cam | Clips | Size | Output |
|---|---|---|---|---|
| 260319 | Park_F | 1 | 0.2 GB | `260319 Park Front.mp4` (single clip, just copy) |
| 260505 | Park_F | 4 | 0.6 GB | `260505 Park Front.mp4` |
| 260505 | Park_R | 4 | 0.3 GB | `260505 Park Rear.mp4` |

---

## 6. Photos

| Folder | Count | Action |
|---|---|---|
| Photo_F | 6 JPGs | Copy to `C:\Users\kenne\Videos\Daily\260505_dashcam_photos\` |
| Photo_R | 6 JPGs | Copy to same |

---

## DISK SPACE BUDGET

| Job | Output Size Est | Target Drive |
|---|---|---|
| 260505 Rear Anthony trip (running) | ~11 GB | C: |
| 260505 Front Anthony trip | ~28 GB | C: (tight!) |
| 260504 Front + Rear | ~7.5 GB | C: |
| 260505 Morning/Afternoon/Evening (6 concats) | ~57 GB | NOT ENOUGH on C: |
| 260401 Front | ~90 GB | NOT ENOUGH anywhere |

**Recommendation:** 
- Complete the Anthony rear (running now)
- Run 260504 front + rear (small, fits)
- Run 260505 front Anthony trip (28 GB, fits if rear finishes and we have ~55 GB free)
- The remaining 260505 trips and 260401 need an external drive or cleanup

---

## EXECUTION COMMANDS

```bash
# 260504 Front
bash scripts/_local/build_dashcam_concat.sh "/f/CARDV/Movie_F" "/c/Users/kenne/Videos/Daily/260504 Front Dashcam.mp4" "20260504" "20260504"

# 260504 Rear  
bash scripts/_local/build_dashcam_concat.sh "/f/CARDV/Movie_R" "/c/Users/kenne/Videos/Daily/260504 Rear Dashcam.mp4" "20260504" "20260504"

# 260505 Front Anthony trip
bash scripts/_local/build_dashcam_concat.sh "/f/CARDV/Movie_F" "/c/Users/kenne/Videos/Daily/260505 Front Movie Ride with Anthony of Clearwater to Dunedin Marina to see Dolphins.mp4" "20260505101203_000680F.MP4" "20260505131803_001058F.MP4"

# 260505 Front Morning
bash scripts/_local/build_dashcam_concat.sh "/f/CARDV/Movie_F" "/c/Users/kenne/Videos/Daily/260505 Front Morning Run 0810-0912.mp4" "20260505081030_000554F.MP4" "20260505091230_000678F.MP4"

# 260505 Rear Morning
bash scripts/_local/build_dashcam_concat.sh "/f/CARDV/Movie_R" "/c/Users/kenne/Videos/Daily/260505 Rear Morning Run 0810-0912.mp4" "20260505081030_000554R.MP4" "20260505091230_000678R.MP4"
```
