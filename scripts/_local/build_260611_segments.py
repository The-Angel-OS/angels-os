#!/usr/bin/env python3
"""
build_260611_segments.py — per-leg dashcam segments for consecutive uploads.

Dashcam-only. Each Google-Maps-Timeline driving leg becomes ONE stream-copy
segment (lossless concat of the Movie_F 1-min clips whose recording window
overlaps the leg). No re-encode — clips are already 4K30 HEVC from one camera,
so a demuxer concat with -c copy is exact and fast.

Day was 08:52 → 16:07 (home). Two real recording gaps (09:58→10:34, 14:55→15:49)
bracket the long stops; legs 6/7 below are inferred from those run boundaries
since the Timeline tail hadn't synced — adjust their windows if needed.

Idempotent: skips a segment whose output already exists.
"""
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SRC_DIR = Path(r"F:\CARDV\Movie_F")
OUT_DIR = Path(r"C:\Users\kenne\Videos\Daily\260611")
DATE = "20260611"
CLIP_LEN_S = 60  # dashcam segments are 1 minute

# (seq, label, HH:MM start, HH:MM end, inferred?)
LEGS = [
    (1, "Home to Clearwater Health Department", "08:54", "09:12", False),
    (2, "Clearwater Health Department to Edgewater Park Dunedin", "10:32", "10:48", False),
    (3, "Edgewater Park to Bay Pines VA Medical Center", "11:21", "12:03", False),
    (4, "Bay Pines VA to War Veterans Memorial Park", "13:07", "13:22", False),
    (5, "War Veterans Memorial Park to Circle K Pinellas Park", "13:44", "14:12", False),
    (6, "Circle K to Pinellas County Clerk", "14:15", "14:55", True),   # inferred: gas-end to recording gap
    (7, "Pinellas County Clerk to Home", "15:49", "16:08", True),       # inferred: final recording run
]


def parse_clip_time(name: str):
    m = re.match(r"^(\d{8})(\d{2})(\d{2})(\d{2})_", name)
    if not m or m.group(1) != DATE:
        return None
    _, h, mi, s = m.groups()
    return datetime.strptime(f"{DATE}{h}{mi}{s}", "%Y%m%d%H%M%S")


def hm(t: str) -> datetime:
    return datetime.strptime(f"{DATE}{t}", "%Y%m%d%H:%M")


def main():
    if not SRC_DIR.exists():
        print(f"!! source not found: {SRC_DIR}")
        sys.exit(1)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    clips = []
    for f in SRC_DIR.glob("*.MP4"):
        t = parse_clip_time(f.name)
        if t:
            clips.append((t, f))
    clips.sort(key=lambda x: x[0])
    print(f"{len(clips)} Movie_F clips for {DATE} "
          f"({clips[0][0]:%H:%M:%S} -> {clips[-1][0]:%H:%M:%S})\n")

    for seq, label, start, end, inferred in LEGS:
        ws, we = hm(start), hm(end)
        # clip overlaps [ws, we) if clip_start < we and clip_end > ws
        chosen = [f for (t, f) in clips if t < we and (t + timedelta(seconds=CLIP_LEN_S)) > ws]
        tag = " (inferred window)" if inferred else ""
        if not chosen:
            print(f"  [{seq}] {label}: NO CLIPS in {start}-{end}{tag}")
            continue

        slug = re.sub(r"[^A-Za-z0-9]+", "_", label).strip("_")
        out = OUT_DIR / f"{DATE[2:]}_{seq}_{slug}.mp4"
        if out.exists():
            print(f"  [{seq}] {label}: exists, skip ({out.name})")
            continue

        list_file = OUT_DIR / f".concat_{seq}.txt"
        list_file.write_text(
            "".join(f"file '{c.as_posix()}'\n" for c in chosen), encoding="utf-8"
        )
        print(f"  [{seq}] {label}{tag}: {len(chosen)} clips "
              f"({chosen[0].name} .. {chosen[-1].name}) -> {out.name}")
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
            "-f", "concat", "-safe", "0", "-i", str(list_file),
            "-c", "copy", "-movflags", "+faststart", str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        list_file.unlink(missing_ok=True)
        if r.returncode != 0:
            print(f"      !! ffmpeg failed: {r.stderr.strip()[:300]}")
        else:
            mb = out.stat().st_size / 1024 / 1024
            print(f"      done -> {mb:.0f} MB")

    print(f"\nSegments in: {OUT_DIR}")


if __name__ == "__main__":
    main()
