#!/usr/bin/env python3
"""
build_260502.py — Soulfin & Sandy Quest daily rollup builder

Merges in chronological order:
  - 1   Clearwater Cruisin' Intro     (4K30, opening credits, audio resample 44.1→48)
  - 19  S23 Ultra video clips         (8K30 → 4K30 via lanczos + portrait composite)
  - 144 dashcam segments              (already 4K30; video copy + audio resample 16→48 mono→stereo)
  -  48 S23 Ultra stills              (Ken Burns 7-10s pan/zoom, silent)
  +  1  music bridge mix              (one Clearwater Cruisin' track, 30%→0% over first 30s
                                       of the first non-intro segment)

Output: single 4K30 HEVC AAC 48k stereo MP4, ~3 hr 22 min, faststart, hvc1 tag.

Idempotent: skips per-segment outputs that exist and are newer than their inputs.
Resume-safe: if interrupted, rerun continues from the last incomplete segment.

Encoder: NVENC by default. Set ENCODER=x265 env var for archive-grade software encode.
"""

import json
import os
import random
import re
import shutil
import subprocess
import sys
import time

# Force UTF-8 stdout on Windows so unicode arrows in log() don't crash cp1252
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import List, Optional

# ─── PATHS ──────────────────────────────────────────────────────────────────
SRC_DIR       = Path(r"E:\DCIM\Daily\260502")
WORK_DIR      = Path(r"C:\Users\kenne\AppData\Local\Temp\260502_work")
OUT_DIR       = Path(r"C:\Users\kenne\Videos\Daily")
OUT_FILENAME  = "260502 Soulfin and Sandy Quest - Ozzi Oprah and The Aves 4K.mp4"
DESC_FILE     = Path(r"C:\Users\kenne\AppData\Local\Temp\260502_description.md")
MANIFEST_FILE = Path(r"C:\Users\kenne\AppData\Local\Temp\260502_manifest.json")
LOG_FILE      = Path(r"C:\Users\kenne\AppData\Local\Temp\260502_build.log")

INTRO_FILE    = Path(r"E:\DCIM\Videos\_Assets\Clearwater Cruisin Intro.mp4")
BACKDROP_DIR  = Path(r"E:\DCIM\Videos\_Assets\Backgrounds")
MUSIC_TRACK   = Path(r"E:\DCIM\Videos\_Assets\Music\HERALD'S STAND.mp3")

# ─── ENCODER CONFIG ─────────────────────────────────────────────────────────
ENCODER = os.environ.get("ENCODER", "nvenc").lower()  # 'nvenc' or 'x265'

if ENCODER == "x265":
    VENC = ["-c:v", "libx265", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-tag:v", "hvc1"]
else:
    VENC = ["-c:v", "hevc_nvenc", "-preset", "p7", "-tune", "hq",
            "-rc", "vbr", "-cq", "19", "-b:v", "60M", "-maxrate", "90M",
            "-bufsize", "180M", "-pix_fmt", "yuv420p", "-tag:v", "hvc1"]

AENC = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
COMMON = ["-hide_banner", "-loglevel", "warning", "-y"]
# Force unified video timescale on every per-segment output. Without this,
# different encoders (NVENC, stream-copy, audio-mixed) write different
# timescales (1/12800, 1/92400, 1/15360 etc.) and the concat demuxer
# misinterprets PTS values from one timebase in another, producing a
# wildly wrong total duration. 1/30000 is the standard MP4 video timescale.
TIMESCALE = ["-video_track_timescale", "30000",
             "-muxpreload", "0", "-muxdelay", "0"]

TARGET_W = 3840
TARGET_H = 2160
TARGET_FPS = 30

# ─── DATA MODELS ────────────────────────────────────────────────────────────
@dataclass
class Segment:
    seq: int = 0
    src: Path = None
    treatment: str = ""           # I, L, P, H, D, K
    start_ts: str = ""            # HH:MM:SS for description
    duration_s: float = 0.0
    out: Path = None
    backdrop: Optional[Path] = None
    is_first_real: bool = False   # the first non-intro segment (gets music bridge)
    label: str = ""

# ─── HELPERS ────────────────────────────────────────────────────────────────
def log(msg: str):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line + "\n")

def run(cmd: list, **kwargs):
    """Run subprocess, surface ffmpeg errors."""
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if result.returncode != 0:
        log(f"!! cmd failed (rc={result.returncode}): {' '.join(map(str, cmd[:8]))}...")
        log(f"   stderr: {result.stderr.strip()[:500]}")
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:200]}")
    return result

def probe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(r.stdout.strip())
    except Exception:
        return 0.0

def probe_orientation(path: Path) -> str:
    """Return 'P' if rotation tag is ±90/270, else 'L'."""
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream_side_data=rotation",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True
    )
    rot = r.stdout.strip().split("\n")[0] if r.stdout else "0"
    try:
        rot_i = int(rot)
        if rot_i in (90, -90, 270, -270):
            return "P"
    except ValueError:
        pass
    return "L"

def probe_fps(path: Path) -> int:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True
    )
    try:
        n, d = r.stdout.strip().split("/")
        return round(int(n) / int(d))
    except Exception:
        return 30

def parse_s23_timestamp(name: str) -> Optional[int]:
    """20260502_144706.mp4 / .jpg → seconds since midnight."""
    m = re.match(r"(\d{8})_(\d{2})(\d{2})(\d{2})", name)
    if not m:
        return None
    _, h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(s)

def parse_dashcam_timestamp(name: str) -> Optional[int]:
    """20260502140150_008221F.MP4 → seconds since midnight."""
    m = re.match(r"(\d{8})(\d{2})(\d{2})(\d{2})_", name)
    if not m:
        return None
    _, h, mi, s = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(s)

def fmt_hms(seconds: float) -> str:
    s = int(seconds)
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    if h > 0:
        return f"{h}:{m:02d}:{sec:02d}"
    return f"{m}:{sec:02d}"

def fmt_clock(seconds_since_midnight: int) -> str:
    h = seconds_since_midnight // 3600
    m = (seconds_since_midnight % 3600) // 60
    s = seconds_since_midnight % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

# ─── CLASSIFIER / DISCOVERY ─────────────────────────────────────────────────
def discover() -> List[Segment]:
    """Scan SRC_DIR + intro, classify, sort chronologically."""
    items = []

    # Intro — always seq 0, plays first
    items.append({
        "src": INTRO_FILE,
        "treatment": "I",
        "sort_key": -1,
        "duration": probe_duration(INTRO_FILE),
        "is_dir": False,
    })

    # S23 video clips (lowercase .mp4)
    for f in sorted(SRC_DIR.glob("*.mp4")):
        ts = parse_s23_timestamp(f.name)
        if ts is None:
            continue  # not an S23 file (could be dashcam or other pattern)
        orient = probe_orientation(f)
        fps = probe_fps(f)
        # Treatment code:
        #   H = high frame rate (e.g. 120fps)
        #   P = portrait (rotation tag set)
        #   L = landscape conformant
        if fps > 60:
            treat = "H"
        elif orient == "P":
            treat = "P"
        else:
            treat = "L"
        items.append({
            "src": f,
            "treatment": treat,
            "sort_key": ts,
            "duration": probe_duration(f),
            "tie": 0,  # S23 video wins ties over dashcam
        })

    # Dashcam clips (uppercase .MP4)
    for f in sorted(SRC_DIR.glob("*.MP4")):
        ts = parse_dashcam_timestamp(f.name)
        if ts is None:
            continue  # not a dashcam pattern
        items.append({
            "src": f,
            "treatment": "D",
            "sort_key": ts,
            "duration": probe_duration(f),
            "tie": 1,
        })

    # Stills (.jpg)
    for f in sorted(SRC_DIR.glob("*.jpg")):
        ts = parse_s23_timestamp(f.name)
        if ts is None:
            log(f"  skip (no still timestamp): {f.name}")
            continue
        items.append({
            "src": f,
            "treatment": "K",
            "sort_key": ts,
            "duration": 8.0,  # Ken Burns target, randomized 7-10 below
            "tie": 2,
        })

    # Sort: intro first, then by start time, S23 video > dashcam > still on ties
    items.sort(key=lambda x: (x["sort_key"], x.get("tie", 0)))

    # Build Segments with sequence numbers and clock-time labels
    segments = []
    for i, it in enumerate(items):
        seg = Segment(
            seq=i,
            src=it["src"],
            treatment=it["treatment"],
            duration_s=it["duration"],
            start_ts=fmt_clock(it["sort_key"]) if it["sort_key"] >= 0 else "INTRO",
            out=WORK_DIR / f"s_{i:04d}.mp4",
        )
        segments.append(seg)

    # Mark first non-intro segment for music bridge
    for s in segments:
        if s.treatment != "I":
            s.is_first_real = True
            break

    # Backdrop assignment for portrait / FHD treatments (deterministic)
    backdrops = sorted(BACKDROP_DIR.glob("*.jpg")) + sorted(BACKDROP_DIR.glob("*.png"))
    if not backdrops:
        log("!! no backdrops in BACKDROP_DIR")
    for s in segments:
        if s.treatment == "P":
            s.backdrop = backdrops[s.seq % len(backdrops)]

    return segments

# ─── PROCESSORS ─────────────────────────────────────────────────────────────
def process_intro(s: Segment):
    """Intro: passthrough video, resample audio 44.1→48."""
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-i", str(s.src),
           "-vf", f"scale={TARGET_W}:{TARGET_H}:flags=lanczos,fps={TARGET_FPS},setsar=1",
           *VENC, *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)

def process_landscape(s: Segment):
    """S23 8K landscape → 4K30 lanczos downscale."""
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-i", str(s.src),
           "-vf", f"scale={TARGET_W}:{TARGET_H}:flags=lanczos,fps={TARGET_FPS},setsar=1",
           *VENC, *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)

def process_portrait(s: Segment):
    """S23 8K portrait → 4K30 with backdrop composite."""
    bd = s.backdrop
    if bd is None or not bd.exists():
        log(f"  [{s.seq}] no backdrop, falling back to landscape mode")
        return process_landscape(s)
    fc = (
        f"[0:v]scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=increase,"
        f"crop={TARGET_W}:{TARGET_H},boxblur=18:1,setsar=1[bg];"
        f"[1:v]transpose=2,scale=-1:{TARGET_H}:flags=lanczos,setsar=1,fps={TARGET_FPS}[fg];"
        f"[bg][fg]overlay=(W-w)/2:0:format=auto[v]"
    )
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-loop", "1", "-i", str(bd),
           "-noautorotate", "-i", str(s.src),
           "-filter_complex", fc,
           "-map", "[v]", "-map", "1:a?", "-shortest",
           *VENC, *AENC,
           "-metadata:s:v:0", "rotate=0",
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)

def process_high_fps(s: Segment):
    """8K 120fps → 4K30 (decimate via fps filter)."""
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-i", str(s.src),
           "-vf", f"scale={TARGET_W}:{TARGET_H}:flags=lanczos,fps={TARGET_FPS},setsar=1",
           *VENC, *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)

def process_dashcam(s: Segment):
    """Dashcam already 4K30 HEVC → video copy, audio re-encode (16k mono → 48k stereo)."""
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-i", str(s.src),
           "-c:v", "copy",
           *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)

def process_kenburns(s: Segment):
    """JPG → silent 4K30 Ken Burns segment, 7-10s, randomized pan/zoom."""
    rng = random.Random(s.seq * 7 + 13)
    duration = rng.uniform(7.0, 10.0)
    frames = int(duration * TARGET_FPS)
    zoom_in = rng.choice([True, False])
    # Anchor points for pan target (in normalized coords)
    anchors = [(0.5, 0.3), (0.5, 0.5), (0.5, 0.7),
               (0.3, 0.5), (0.7, 0.5), (0.3, 0.3), (0.7, 0.7)]
    cx, cy = rng.choice(anchors)
    if zoom_in:
        z_expr = f"min(zoom+0.0008,1.40)"
    else:
        z_expr = f"if(lte(zoom,1.0),1.40,max(1.001,zoom-0.0008))"
    x_expr = f"iw*{cx}-(iw/zoom/2)"
    y_expr = f"ih*{cy}-(ih/zoom/2)"
    fc = (
        f"scale=8000:-2:flags=lanczos,"
        f"zoompan=z='{z_expr}':d={frames}:s={TARGET_W}x{TARGET_H}:"
        f"x='{x_expr}':y='{y_expr}',fps={TARGET_FPS},setsar=1"
    )
    # Silent audio track at 48k stereo
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-loop", "1", "-i", str(s.src),
           "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
           "-vf", fc,
           "-t", f"{duration:.2f}",
           "-shortest",
           *VENC, *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(s.out)]
    run(cmd)
    # Update duration to actual
    s.duration_s = duration

# ─── MUSIC BRIDGE OVERLAY ───────────────────────────────────────────────────
def apply_music_bridge(s: Segment):
    """Re-mix the first non-intro segment to overlay 30s music bridge at 30%→0%."""
    if not MUSIC_TRACK.exists():
        log(f"  music track missing, skipping bridge: {MUSIC_TRACK}")
        return
    bridged = WORK_DIR / f"s_{s.seq:04d}_bridged.mp4"
    if bridged.exists() and bridged.stat().st_mtime > s.out.stat().st_mtime:
        log(f"  [{s.seq}] music bridge already applied, skipping")
        s.out = bridged
        return
    log(f"  [{s.seq}] applying 30s music bridge → {bridged.name}")
    fc = (
        "[1:a]atrim=0:30,volume='0.30*(1-t/30)':eval=frame[mus];"
        "[0:a][mus]amix=inputs=2:duration=first:normalize=0[aout]"
    )
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-i", str(s.out),
           "-i", str(MUSIC_TRACK),
           "-filter_complex", fc,
           "-map", "0:v", "-map", "[aout]",
           "-c:v", "copy",
           *AENC,
           *TIMESCALE, "-movflags", "+faststart",
           str(bridged)]
    run(cmd)
    s.out = bridged

# ─── DISPATCHER ─────────────────────────────────────────────────────────────
PROCESSORS = {
    "I": process_intro,
    "L": process_landscape,
    "P": process_portrait,
    "H": process_high_fps,
    "D": process_dashcam,
    "K": process_kenburns,
}

def process_segment(s: Segment) -> bool:
    """Run the right processor. Returns True if work was done, False if skipped."""
    if s.out.exists() and s.out.stat().st_mtime >= s.src.stat().st_mtime:
        return False
    fn = PROCESSORS.get(s.treatment)
    if not fn:
        raise ValueError(f"unknown treatment: {s.treatment}")
    fn(s)
    return True

# ─── CONCAT + DESCRIPTION ───────────────────────────────────────────────────
def concat_all(segments: List[Segment], out_file: Path):
    list_file = WORK_DIR / "concat_list.txt"
    with list_file.open("w", encoding="utf-8") as f:
        for s in segments:
            # ffmpeg concat needs forward-slash or escaped paths
            p = str(s.out).replace("\\", "/")
            f.write(f"file '{p}'\n")
    log(f"=== STAGE 3: stream-copy concat → {out_file}")
    out_file.parent.mkdir(parents=True, exist_ok=True)
    if out_file.exists():
        out_file.unlink()
    cmd = [*("ffmpeg " + " ".join(COMMON)).split(),
           "-f", "concat", "-safe", "0", "-i", str(list_file),
           "-c", "copy", *TIMESCALE, "-movflags", "+faststart",
           str(out_file)]
    run(cmd)

def write_description(segments: List[Segment], out_file: Path, desc_file: Path):
    """Generate YouTube description with chapter markers per segment.

    Convention: dashcam ('D') segments NEVER get their own chapter line — they're
    ambient drive footage between meaningful S23 takes / portraits / stills / slow-mo.
    The chapter from the previous meaningful clip extends through the dashcam minutes
    until the next meaningful clip. Result: ~30 navigable chapters per daily rollup
    instead of ~212 noisy ones."""
    cumulative = 0.0
    chapters = []
    for s in segments:
        # Skip dashcam from chapter list — they're ambient, not waypoints.
        if s.treatment != "D":
            chapters.append({
                "ts": fmt_hms(cumulative),
                "clock": s.start_ts,
                "treatment": s.treatment,
                "label": default_label(s),
                "duration": round(s.duration_s, 1),
                "src": s.src.name,
            })
        cumulative += s.duration_s

    total = fmt_hms(cumulative)

    with desc_file.open("w", encoding="utf-8") as f:
        f.write(f"""# 260502 Soulfin & Sandy Quest — Ozzi, Oprah & The Aves 4K

A Soul Quest at the Dunedin Boat Club and along the causeway, May 2nd 2026.
We didn't see Soulfin and Sandy today, but we got AWESOME footage of Ozzi,
Oprah and the family — plus a thousand other beautiful avian creatures and
a few flying fish. Probably some fins waving in the background too.

One of our primary goals: enable other species to signal to their brethren.
They know they're saying hello to the universe. We're just the camera crew.

The dashcam audio is raw — engine noise, wind, road, the volume dial of
emotional context preserved. Future audio processors will easily authenticate
and clean up the clipping using the S23 reference samples in this same file.
The message and the moment matter more than the polish.

**Format:** 4K30 HEVC throughout. Chronological merge of {sum(1 for s in segments if s.treatment != 'K')} video
segments + {sum(1 for s in segments if s.treatment == 'K')} stills (Ken Burns 7-10s each), opened by the
Clearwater Cruisin' intro. Total runtime: **{total}**.

---

## 🎬 Chapters

""")
        for c in chapters:
            tag = {"I": "🎬", "L": "🎥", "P": "📱", "H": "🎞", "D": "🚗", "K": "📷"}[c["treatment"]]
            label = f"{tag} {c['clock']} — {c['label']} <!-- ANNOTATE: {c['src']} -->"
            f.write(f"{c['ts']} {label}\n")

        f.write(f"""

---

## 🏷 Hashtags

#ClearwaterCruisin #SoulQuest #DunedinBoatClub #SoulfinSandyQuest
#Ozzi #Oprah #AngelsOfThePinellas #Dolphins #Birds #Pinellas
#FloridaSunset #DailyRollup #4K #S23Ultra #ClearwaterCadillac
#WeAreTheAngels #SignalToBrethren

---

## 🔗 Cross-links

- Previous Quest: [260501 Solfin Quest]
- Earlier Cloud City: [260424 Dunedin Boat Club Sunset w/ Sue & Gary 8K]
- Soul Van content thread on the channel
- Southern Life YouTube channel (the Anthony connection from the 260424 chat)
- The Telepathy Tapes podcast (recommended in the 260424 conversation)

---

*Total source: {sum(1 for s in segments)} segments — {sum(1 for s in segments if s.treatment == 'D')} dashcam minutes,
{sum(1 for s in segments if s.treatment in 'LPH')} S23 takes, {sum(1 for s in segments if s.treatment == 'K')} stills,
1 Clearwater Cruisin' intro.*
""")
    log(f"=== description written → {desc_file}")

def default_label(s: Segment) -> str:
    if s.treatment == "I":
        return "Clearwater Cruisin' Opens The Quest"
    if s.treatment == "D":
        return "Dashcam"
    if s.treatment == "K":
        return "Photo"
    if s.treatment == "P":
        return "S23 Portrait"
    if s.treatment == "H":
        return "S23 Slow-Mo (real-time)"
    return "S23 Take"

# ─── MAIN ───────────────────────────────────────────────────────────────────
def main():
    # Reset log on fresh run
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    if "--fresh" in sys.argv:
        LOG_FILE.write_text("", encoding="utf-8")
    log(f"=== build_260502.py START (encoder={ENCODER}) ===")
    WORK_DIR.mkdir(parents=True, exist_ok=True)

    log("Stage 1: discover + classify + sort")
    segments = discover()
    log(f"  {len(segments)} segments queued")

    # Persist manifest for inspection / desc regeneration
    MANIFEST_FILE.write_text(
        json.dumps([{**asdict(s),
                     "src": str(s.src),
                     "out": str(s.out),
                     "backdrop": str(s.backdrop) if s.backdrop else None}
                    for s in segments], indent=2),
        encoding="utf-8"
    )
    log(f"  manifest → {MANIFEST_FILE}")

    log("Stage 2: per-segment normalize")
    work_done = 0
    skipped = 0
    failed = []
    for i, s in enumerate(segments):
        try:
            did_work = process_segment(s)
            if did_work:
                work_done += 1
                log(f"  [{i+1}/{len(segments)}] {s.treatment} {s.src.name} → done")
            else:
                skipped += 1
                if i % 25 == 0:
                    log(f"  [{i+1}/{len(segments)}] skipped (cached)")
        except Exception as e:
            failed.append((s, str(e)))
            log(f"  [{i+1}/{len(segments)}] !! FAILED: {s.src.name}: {e}")
    log(f"  stage 2 complete: {work_done} new, {skipped} cached, {len(failed)} failed")
    if failed:
        log(f"  failed segments: {[s.src.name for s, _ in failed]}")
        # Drop failed segments from concat
        segments = [s for s in segments if s not in [f[0] for f in failed]]

    # Music bridge — applied to first real segment after stage 2
    log("Stage 2b: music bridge overlay")
    for s in segments:
        if s.is_first_real:
            try:
                apply_music_bridge(s)
            except Exception as e:
                log(f"  !! bridge failed: {e}; using bare segment")
            break

    log("Stage 3: stream-copy concat")
    out_file = OUT_DIR / OUT_FILENAME
    concat_all(segments, out_file)
    sz = out_file.stat().st_size
    dur = probe_duration(out_file)
    log(f"  final → {out_file}")
    log(f"  size: {sz/1024/1024/1024:.1f} GB, duration: {fmt_hms(dur)}")

    log("Stage 4: write YouTube description")
    write_description(segments, out_file, DESC_FILE)

    log(f"=== build_260502.py DONE ===")
    log(f"  video: {out_file}")
    log(f"  desc:  {DESC_FILE}")

if __name__ == "__main__":
    main()
