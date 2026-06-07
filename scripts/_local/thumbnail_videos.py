#!/usr/bin/env python3
"""
thumbnail_videos.py — generate a browse-friendly JPEG poster next to every video.

For each video in the target folder(s) it extracts a representative frame
(~15% into the clip, to skip black intros), fits it inside a square box while
preserving aspect ratio, and writes `<same-basename>.jpg` right beside the
source. Android TV file browsers (X-plore, Solid Explorer, VLC) surface that
sibling image as the file's preview, so you can see what to expect from the
couch with a Google TV remote.

Usage:
  python thumbnail_videos.py "E:\\DCIM\\Camera\\260530 Saturday ..."   # one folder
  python thumbnail_videos.py FOLDER [FOLDER ...] [--recursive] [--force]
                                    [--box 1280] [--pos 0.15]

Notes:
  - Skips a video if its .jpg already exists, unless --force.
  - Never overwrites a standalone photo: it only ever writes <videobase>.jpg.
  - Input-seek (`-ss` before `-i`) keeps it fast even on multi-GB files.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mpg", ".mpeg", ".3gp"}


def probe_duration(path: Path) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "json", str(path)],
            capture_output=True, text=True, timeout=60,
        )
        return float(json.loads(out.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def make_thumb(video: Path, box: int, pos: float, force: bool) -> str:
    out = video.with_suffix(".jpg")
    if out.exists() and not force:
        return "skip"

    duration = probe_duration(video)
    seek = max(1.0, duration * pos) if duration > 0 else 1.0

    vf = (f"scale=w={box}:h={box}:force_original_aspect_ratio=decrease:"
          f"force_divisible_by=2")
    cmd = [
        "ffmpeg", "-y", "-ss", f"{seek:.3f}", "-i", str(video),
        "-frames:v", "1", "-vf", vf, "-q:v", "2",
        str(out),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if res.returncode != 0 or not out.exists():
        # Fallback: some clips are shorter than the seek point — try frame 0.
        cmd2 = ["ffmpeg", "-y", "-i", str(video), "-frames:v", "1",
                "-vf", vf, "-q:v", "2", str(out)]
        res2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=300)
        if res2.returncode != 0 or not out.exists():
            sys.stderr.write(f"  FAILED {video.name}\n{res.stderr[-400:]}\n")
            return "fail"
    return "ok"


def collect_videos(folder: Path, recursive: bool):
    it = folder.rglob("*") if recursive else folder.glob("*")
    return sorted(p for p in it if p.is_file() and p.suffix.lower() in VIDEO_EXTS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folders", nargs="+")
    ap.add_argument("--recursive", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--box", type=int, default=1280, help="max thumbnail edge px")
    ap.add_argument("--pos", type=float, default=0.15, help="0..1 fraction into clip")
    args = ap.parse_args()

    totals = {"ok": 0, "skip": 0, "fail": 0}
    for f in args.folders:
        folder = Path(f)
        if not folder.is_dir():
            sys.stderr.write(f"Not a folder: {folder}\n")
            continue
        videos = collect_videos(folder, args.recursive)
        print(f"\n{folder}  ({len(videos)} videos)")
        for i, v in enumerate(videos, 1):
            status = make_thumb(v, args.box, args.pos, args.force)
            totals[status] += 1
            mark = {"ok": "[+]", "skip": "[=]", "fail": "[!]"}[status]
            print(f"  {mark} ({i}/{len(videos)}) {v.name}")

    print(f"\nDone. created={totals['ok']} skipped={totals['skip']} failed={totals['fail']}")


if __name__ == "__main__":
    main()
