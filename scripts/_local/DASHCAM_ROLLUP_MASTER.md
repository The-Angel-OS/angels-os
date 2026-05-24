# Dashcam Mass Rollup Master Plan
## Generated 2026-05-10 | 299 GB free on C:

All outputs: `C:\Users\kenne\Videos\Daily\`
Method: Pure stream-copy concat (most common denominator, no re-encoding)
Audio: Resample 16kHz mono → 48kHz stereo AAC (dashcam only, required for playback)

---

## BATCH 1: Small/Medium jobs (do first, free up source dirs)

| # | Source | Output Name | Clips | Size | Est Output |
|---|---|---|---|---|---|
| 1 | 260421G (5 specific files) | `260421 Evening S23 Rollup.mp4` | 5 | 13.5 GB | ~13.5 GB |
| 2 | 260419B (E:\DCIM) | `260419 Rear 2036-2119 Dashcam.mp4` | 44 | 9.8 GB | ~9.8 GB |
| 3 | 260421A (C:\Videos\Daily) | `260421 Front 0906-1130 Dashcam.mp4` | 145 | 34.2 GB | ~34 GB |
| 4 | 260421B (C:\Videos\Daily) | `260421 Front 1714-2106 Dashcam.mp4` | 233 | 53.3 GB | ~53 GB |

## BATCH 2: F:\CARDV\Movie_R (11 trips, ~82 GB total)

| # | Date | Time Range | Output Name | Clips | Size |
|---|---|---|---|---|---|
| 5 | 260505 | 08:10-09:12 | `260505 Rear 0810-0912 Dashcam.mp4` | 63 | 4.4 GB |
| 6 | 260505 | 10:12-13:18 | `260505 Rear 1012-1318 Dashcam.mp4` | 186 | 13 GB |
| 7 | 260505 | 13:51-14:21 | `260505 Rear 1351-1421 Dashcam.mp4` | 31 | 2.1 GB |
| 8 | 260505 | 18:11-20:58 | `260505 Rear 1811-2058 Dashcam.mp4` | 165 | 11.6 GB |
| 9 | 260506 | 09:57-12:35 | `260506 Rear 0957-1235 Dashcam.mp4` | 158 | 11.1 GB |
| 10 | 260507 | 07:06-08:15 | `260507 Rear 0706-0815 Dashcam.mp4` | 70 | 4.9 GB |
| 11 | 260507 | 09:49-11:01 | `260507 Rear 0949-1101 Dashcam.mp4` | 73 | 5.1 GB |
| 12 | 260509 | 11:46-15:36 | `260509 Rear 1146-1536 Dashcam.mp4` | 230 | 16.2 GB |
| 13 | 260509 | 16:03-17:12 | `260509 Rear 1603-1712 Dashcam.mp4` | 70 | 4.9 GB |
| 14 | 260510 | 13:37-14:41 | `260510 Rear 1337-1441 Dashcam.mp4` | 65 | 4.6 GB |
| 15 | 260510 | 16:57-17:52 | `260510 Rear 1657-1752 Dashcam.mp4` | 56 | 3.9 GB |

## BATCH 3: F:\CARDV\Movie_F (13 trips, ~238 GB total — CYCLE through, delete after verify)

| # | Date | Time Range | Output Name | Clips | Size |
|---|---|---|---|---|---|
| 16 | 260401 | 16:10-20:29 | `260401 Front 1610-2029 Dashcam.mp4` | 260 | 58.5 GB |
| 17 | 260504 | 12:42-13:16 | `260504 Front 1242-1316 Dashcam.mp4` | 35 | 5.2 GB |
| 18 | 260505 | 08:10-09:12 | `260505 Front 0810-0912 Dashcam.mp4` | 63 | 9.5 GB |
| 19 | 260505 | 10:12-13:18 | `260505 Front 1012-1318 Dashcam.mp4` | 186 | 27.8 GB |
| 20 | 260505 | 13:51-14:21 | `260505 Front 1351-1421 Dashcam.mp4` | 31 | 4.5 GB |
| 21 | 260505 | 18:11-20:58 | `260505 Front 1811-2058 Dashcam.mp4` | 165 | 24.8 GB |
| 22 | 260506 | 09:57-12:35 | `260506 Front 0957-1235 Dashcam.mp4` | 158 | 23.7 GB |
| 23 | 260507 | 07:06-08:15 | `260507 Front 0706-0815 Dashcam.mp4` | 70 | 10.5 GB |
| 24 | 260507 | 09:49-11:01 | `260507 Front 0949-1101 Dashcam.mp4` | 73 | 10.9 GB |
| 25 | 260509 | 11:46-15:36 | `260509 Front 1146-1536 Dashcam.mp4` | 230 | 34.6 GB |
| 26 | 260509 | 16:03-17:12 | `260509 Front 1603-1712 Dashcam.mp4` | 70 | 10.5 GB |
| 27 | 260510 | 13:37-14:41 | `260510 Front 1337-1441 Dashcam.mp4` | 65 | 9.8 GB |
| 28 | 260510 | 16:57-25:52 | `260510 Front 1657-1752 Dashcam.mp4` | 56 | 8.4 GB |

## BATCH 4: E:\DCIM dashcam subdirs

| # | Source | Output Name | Clips | Size |
|---|---|---|---|---|
| 29-32 | 260505/Movie_F (4 trips from 260401) | `260401 Front HHMM-HHMM Dashcam.mp4` × 4 | 151 | 34 GB |
| 33-39 | 260503/Movie_F (7 trips spanning 260501+260503) | Various | 351 | 79.6 GB |

## NOTES
- 260505/Movie_F clips are ALL from 260401 (filenames start 20260401) — duplicate of CARDV Movie_F Trip 1 subset
- 260503/Movie_F clips span 260501 and 260503 — separate from CARDV
- Dashcam audio (16kHz mono) MUST be resampled for playback — this is the one "re-encode" needed
- After each batch: verify duration, then delete source clips to free space for next batch
