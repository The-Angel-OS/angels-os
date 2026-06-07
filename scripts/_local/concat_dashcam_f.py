#!/usr/bin/env python3
"""
Concatenate F: dashcam (Movie_F, front) drive sessions losslessly into the
Daily folder on C:, matching the existing naming convention:
    YYMMDD Front HHMM-HHMM Dashcam.mp4   (+ a .md sidecar)

- A "drive session" = a run of clips with < GAP_SECONDS between consecutive
  clip start times (a larger gap = engine off → new session).
- Lossless stream copy (-c copy) + the mandatory dashcam TIMESCALE fix
  (source time_base is 1/92400; without -video_track_timescale 30000 the
  concat demuxer stretches duration ~6x).
- SPACE GUARD: never let C: free space drop below FLOOR_GB. Sessions that
  would breach it are SKIPPED and reported (re-run after freeing space —
  existing outputs are skipped, so it's idempotent).
"""
import re
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

SRC = Path(r"F:\CARDV\Movie_F")
OUT = Path(r"C:\Users\kenne\Videos\Daily")
GAP_SECONDS = 300            # > 5 min between clip starts = new drive session
FLOOR_GB = 45.0             # never let the output drive free space drop below this
TIMESCALE = ["-video_track_timescale", "30000", "-muxpreload", "0", "-muxdelay", "0"]
NAME_RE = re.compile(r"^(\d{8})(\d{6})_\d+F\.MP4$", re.IGNORECASE)


def p(*a):
    print(*a, flush=True)


def free_gb() -> float:
    return shutil.disk_usage(OUT).free / (1024 ** 3)


def load_clips():
    out = []
    for f in SRC.iterdir():
        m = NAME_RE.match(f.name)
        if not m:
            continue
        dt = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
        out.append((dt, f))
    out.sort(key=lambda x: x[0])
    return out


def group_sessions(clips):
    groups, cur = [], []
    for dt, f in clips:
        if cur and (dt - cur[-1][0]).total_seconds() > GAP_SECONDS:
            groups.append(cur)
            cur = []
        cur.append((dt, f))
    if cur:
        groups.append(cur)
    return groups


def size_gb(sess) -> float:
    return sum(f.stat().st_size for _, f in sess) / (1024 ** 3)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    clips = load_clips()
    p(f"[concat] {len(clips)} front clips on F:")
    sessions = group_sessions(clips)
    p(f"[concat] grouped into {len(sessions)} drive session(s)")
    p(f"[concat] C: free = {free_gb():.0f} GB (floor {FLOOR_GB:.0f} GB)\n")

    done, skipped, failed = [], [], []
    for s in sessions:
        start = s[0][0]
        end = s[-1][0] + timedelta(seconds=60)  # last clip start + ~1 min
        yy = start.strftime("%y%m%d")
        name = f"{yy} Front {start.strftime('%H%M')}-{end.strftime('%H%M')} Dashcam.mp4"
        outp = OUT / name
        sz = size_gb(s)

        if outp.exists():
            p(f"[skip] exists: {name}")
            continue

        fg = free_gb()
        if fg - sz < FLOOR_GB:
            p(f"[SKIP-SPACE] {name} (~{sz:.1f} GB) — only {fg:.0f} GB free; floor {FLOOR_GB:.0f} GB")
            skipped.append((name, sz))
            continue

        listp = OUT / f".concat_{yy}_{start.strftime('%H%M')}.txt"
        with open(listp, "w", encoding="utf-8") as fh:
            for _, f in s:
                fh.write(f"file '{str(f).replace(chr(92), '/')}'\n")

        p(f"[concat] {name} — {len(s)} clips, ~{sz:.1f} GB ({fg:.0f} GB free) ...")
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-f", "concat", "-safe", "0", "-i", str(listp),
               "-c", "copy", *TIMESCALE, "-movflags", "+faststart", str(outp)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        listp.unlink(missing_ok=True)

        if r.returncode != 0 or not outp.exists():
            p(f"[FAIL] {name}\n{(r.stderr or '')[-800:]}")
            if outp.exists():
                outp.unlink(missing_ok=True)
            failed.append(name)
            continue

        with open(outp.with_suffix(".md"), "w", encoding="utf-8") as fh:
            fh.write(f"# {name}\n\n")
            fh.write("- Source: F:/CARDV/Movie_F dashcam (front)\n")
            fh.write(f"- Session: {start:%Y-%m-%d %H:%M} – {end:%H:%M}  ({len(s)} clips)\n")
            fh.write("- Lossless concat (HEVC 4K30, -c copy + timescale fix)\n")

        done.append((name, sz))
        p(f"[ok] {name}  ({free_gb():.0f} GB free remaining)")

    p("\n=== SUMMARY ===")
    p(f"done: {len(done)} session(s), {sum(x[1] for x in done):.1f} GB")
    for n, sz in done:
        p(f"  + {n}  ({sz:.1f} GB)")
    if skipped:
        p(f"skipped for space: {len(skipped)} session(s), ~{sum(x[1] for x in skipped):.1f} GB")
        for n, sz in skipped:
            p(f"  - {n}  (~{sz:.1f} GB)")
    if failed:
        p(f"FAILED: {len(failed)}")
        for n in failed:
            p(f"  x {n}")
    p(f"C: free now: {free_gb():.0f} GB")


if __name__ == "__main__":
    main()
