#!/usr/bin/env python3
"""
add_music_260611.py — lay a looping music bed under each 260611 segment.

Video is stream-copied (untouched); the dashcam's raw engine audio is replaced
by the road-trip playlist looped to the clip length, with a 4s fade-out. Each
segment rotates the playlist start so consecutive uploads open on a different
track. Output → C:\\Users\\kenne\\Videos\\Daily\\260611\\music\\ (originals kept).
"""
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SEG_DIR = Path(r"C:\Users\kenne\Videos\Daily\260611")
OUT_DIR = SEG_DIR / "music"
MUSIC = Path(r"E:\DCIM\Videos\_Assets\Music")

PLAYLIST = [
    "Skyline Pulse.mp3",
    "A happy song about Enterprise Dog Park.mp3",
    "A song about Enterprise Dog Park Pt A.mp3",
    "A song about Enterprise Dog Park.mp3",
    "Be careful what you wish for EDM1.mp3",
    "Be careful what you wish for EDM2.mp3",
    "Cruising with Max and Ty Cheesy Female Techno Version.mp3",
    "Cruising with Max and Ty FemEDM Pinellas sun reflects off chrome.mp3",
    "Cruising with Max and Ty Ultra Friendly Nice Edition.mp3",
    "Cruising with Max and Ty.mp3",
    "Enterprise Dog Park (Circle of Life) (Friendly Version).mp3",
    "How are you today_ Illenium Skrillex Version.mp3",
    "How are you today_.mp3",
    "Jurassic Dog Park (Circle of Life)(Buffet Style).mp3",
    "Jurassic Dog Park (Circle of Life).mp3",
    "Payload Spaces Theme - Flesh For Lulu meets Fallout Boy.mp3",
    "Payload Spaces Theme Offspring Style .mp3",
    "Payload Spaces Theme Song.mp3",
    "Pissed the Dispensary Closed Early in the style of 8 Mile.mp3",
]


def probe_dur(p: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(p)],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except Exception:
        return 0.0


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [t for t in PLAYLIST if not (MUSIC / t).exists()]
    if missing:
        print("!! missing tracks:", missing)
        sys.exit(1)

    segs = sorted(SEG_DIR.glob("260611_*.mp4"))
    if not segs:
        print(f"!! no segments in {SEG_DIR}")
        sys.exit(1)

    for i, seg in enumerate(segs):
        out = OUT_DIR / seg.name
        if out.exists():
            print(f"  [{i+1}] {seg.name}: exists, skip")
            continue
        dur = probe_dur(seg)
        fade_st = max(0.0, dur - 4.0)

        # Rotate the playlist so each segment opens on a different track.
        rot = PLAYLIST[i % len(PLAYLIST):] + PLAYLIST[: i % len(PLAYLIST)]
        listf = OUT_DIR / f".pl_{i}.txt"
        listf.write_text(
            "".join(f"file '{(MUSIC / t).as_posix()}'\n" for t in rot), encoding="utf-8"
        )

        print(f"  [{i+1}] {seg.name}  ({dur/60:.1f} min)  bed opens: {rot[0]}")
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "warning", "-y",
            "-i", str(seg),
            "-stream_loop", "-1", "-f", "concat", "-safe", "0", "-i", str(listf),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-af", f"afade=t=out:st={fade_st:.1f}:d=4",
            "-shortest", "-movflags", "+faststart",
            str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        listf.unlink(missing_ok=True)
        if r.returncode != 0:
            print(f"      !! ffmpeg failed: {r.stderr.strip()[:300]}")
        else:
            mb = out.stat().st_size / 1024 / 1024
            print(f"      done -> {mb:.0f} MB")

    print(f"\nMusic versions in: {OUT_DIR}")


if __name__ == "__main__":
    main()
