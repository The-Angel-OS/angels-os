#!/usr/bin/env python3
"""
build_260612_segments.py — per-leg dashcam segments, new naming convention.

Same engine as build_260611_segments.py (Google-Maps-Timeline driving leg →
ONE lossless stream-copy concat of the overlapping Movie_F 1-min clips), but the
output filename follows Kenneth's convention:

    YYMMDD HHMM-HHMM Dashcam <route label>.mp4
    e.g. 260612 1901-1912 Dashcam Frontage US 19 to Enterprise Dog Park.mp4

The cam recorded CONTINUOUSLY 19:03->21:33 (no gaps — it ran through both parking
stops), so legs are cut purely by the Timeline windows, not by recording gaps.

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
OUT_DIR = Path(r"C:\Users\kenne\Videos\Daily\260612")
DATE = "20260612"
CLIP_LEN_S = 60  # dashcam segments are 1 minute

# (label/route, HH:MM start, HH:MM end) — windows from the Google Timeline itinerary.
# Drives = the moving legs; parked stretches = the park-cam / sunset-cam captures
# (4K is FOR these). All footage is in Movie_F (the cam recorded continuously).
LEGS = [
    ("Frontage US 19 to Enterprise Dog Park", "19:01", "19:12"),
    ("Enterprise Dog Park", "19:12", "19:47"),                      # parked — dog park
    ("Enterprise Dog Park to Dunedin Boat Club", "19:47", "20:07"),
    ("Dunedin Boat Club Marina Sunset", "20:07", "20:46"),          # parked — THE sunset
    ("Enterprise Frontage Main St Edgewater Ft Harrison 60 E Mandalay U-Turn at Hogan's Hangout return",
     "20:46", "21:33"),
]

# Characters Windows forbids in a filename (apostrophes + spaces are fine).
FORBIDDEN = r'[\\/:*?"<>|]'


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

    for label, start, end in LEGS:
        ws, we = hm(start), hm(end)
        # clip overlaps [ws, we) if clip_start < we and clip_end > ws
        chosen = [f for (t, f) in clips if t < we and (t + timedelta(seconds=CLIP_LEN_S)) > ws]
        if not chosen:
            print(f"  {start}-{end} {label}: NO CLIPS")
            continue

        safe_label = re.sub(FORBIDDEN, "", label).strip()
        span = f"{start.replace(':', '')}-{end.replace(':', '')}"
        out = OUT_DIR / f"{DATE[2:]} {span} Dashcam {safe_label}.mp4"
        if out.exists():
            print(f"  {span} {label}: exists, skip ({out.name})")
            continue

        list_file = OUT_DIR / f".concat_{span}.txt"
        list_file.write_text(
            "".join(f"file '{c.as_posix()}'\n" for c in chosen), encoding="utf-8"
        )
        print(f"  {span} {label}: {len(chosen)} clips "
              f"({chosen[0].name} .. {chosen[-1].name})\n      -> {out.name}")
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
