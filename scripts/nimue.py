#!/usr/bin/env python3
"""
Nimue — Clearwater Cruisin Daily Rollup Pipeline
============================================================
Ingest a folder of phone/dashcam clips into a single daily
rollup video with music bed, normalized orientation, and
highest-common-denominator resolution.

Usage:
    python nimue.py ingest <folder> [options]
    python nimue.py ingest 260423G --music-bed --output "C:/Users/kenne/Videos/Daily"
    python nimue.py ingest 260423G --name "260423 Dunedin Boat Club Evening Dolphin Quest Vid"
    python nimue.py probe <folder>          # just probe, no encode
    python nimue.py music-bed               # just build music bed

Configuration is in nimue_config.json (auto-created on first run).
"""

import argparse
import json
import math
import os
import random
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path


# ── Default config (auto-written to nimue_config.json) ──────────────────────

DEFAULT_CONFIG = {
    "music_dir": "E:/DCIM/Videos/_Assets/Music",
    "background_frames_dir": "C:/Users/kenne/Downloads",
    "background_frames_glob": "260421 Dunedin Boat Club Evening Dolphin Quest Vid - frame at*.jpg",
    "output_dir": "C:/Users/kenne/Videos/Daily",
    "temp_dir": "C:/Users/kenne/AppData/Local/Temp/nimue",
    "music_volume_intro": 0.30,      # first 60s
    "music_volume_main": 0.10,       # remainder
    "music_intro_duration": 60,
    "audio_bitrate": "192k",
    "nvenc_cq": 19,
    "nvenc_preset": "p5",
    "loud_audio_threshold_db": -15,  # clips louder than this get music muted
    "video_extensions": [".mp4", ".mov", ".mkv", ".MP4", ".MOV"],
    # Curated Clearwater Cruisin Soul Soundtrack — exact filenames in music_dir.
    # build_music_bed() will use this whitelist if non-empty; else falls back to
    # every *.mp3 in music_dir. Order = preferred play order.
    "music_playlist": [
        "Pissed the Dispensary Closed Early in the style of 8 Mile.mp3",
        "A song about Enterprise Dog Park.mp3",
        "Be careful what you wish for EDM1.mp3",
        "Be careful what you wish for EDM2.mp3",
        "Cruising with Max and Ty Cheesy Female Techno Version.mp3",
        "Cruising with Max and Ty FemEDM Pinellas sun reflects off chrome.mp3",
        "Cruising with Max and Ty FemEDM.mp3",
        "Cruising with Max and Ty.mp3",
        "Enterprise Dog Park (Circle of Life) (Friendly Version).mp3",
        "HERALD'S STAND.mp3",
        "How are you today_ Illenium Skrillex Version.mp3",
        "How are you today_.mp3",
        "Jurassic Dog Park (Circle of Life)(Buffet Style).mp3",
        "Jurassic Dog Park (Circle of Life).mp3",
        "Payload Spaces Theme - Flesh For Lulu meets Fallout Boy.mp3",
        "Payload Spaces Theme Offspring Style .mp3",
        "Payload Spaces Theme Song.mp3",
    ],
}

CONFIG_PATH = Path(__file__).parent / "nimue_config.json"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            cfg = {**DEFAULT_CONFIG, **json.load(f)}
    else:
        cfg = DEFAULT_CONFIG.copy()
        with open(CONFIG_PATH, "w") as f:
            json.dump(cfg, f, indent=2)
        print(f"[nimue] Config written to {CONFIG_PATH} — edit paths as needed.")
    return cfg


# ── ffprobe helpers ──────────────────────────────────────────────────────────

def run(cmd: list, capture=True) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, capture_output=capture,
        text=True, encoding="utf-8", errors="replace"
    )


def probe_clip(path: Path) -> dict:
    """Return dict with width, height, rotation, duration, codec, audio_codec, mean_db."""
    # Video stream
    r = run([
        "ffprobe", "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,codec_name,r_frame_rate",
        "-show_entries", "stream_tags=rotate",
        "-show_entries", "stream_side_data=rotation",
        "-of", "json",
        str(path)
    ])
    data = json.loads(r.stdout) if r.stdout else {}
    streams = data.get("streams", [{}])
    vs = streams[0] if streams else {}

    width = vs.get("width", 0)
    height = vs.get("height", 0)
    codec = vs.get("codec_name", "unknown")

    # Rotation: check tag first, then side_data
    rotation = 0
    tag_rot = vs.get("tags", {}).get("rotate")
    if tag_rot:
        try:
            rotation = int(tag_rot)
        except ValueError:
            pass
    else:
        for sd in vs.get("side_data_list", []):
            if "rotation" in sd:
                try:
                    rotation = int(sd["rotation"])
                except (ValueError, TypeError):
                    pass

    # Duration
    r2 = run([
        "ffprobe", "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        str(path)
    ])
    try:
        duration = float(r2.stdout.strip().split(",")[0])
    except (ValueError, AttributeError):
        duration = 0.0

    # Audio mean volume
    r3 = run([
        "ffmpeg", "-i", str(path),
        "-vn", "-af", "volumedetect",
        "-f", "null", "-"
    ])
    mean_db = -60.0
    for line in (r3.stderr or "").splitlines():
        if "mean_volume" in line:
            try:
                mean_db = float(line.split(":")[1].strip().replace(" dB", ""))
            except (ValueError, IndexError):
                pass

    return {
        "path": path,
        "width": width,
        "height": height,
        "codec": codec,
        "rotation": rotation,
        "duration": duration,
        "mean_db": mean_db,
        "is_portrait": _is_portrait(width, height, rotation),
        "is_nonstandard": _is_nonstandard(width, height, rotation),
    }


def _is_portrait(w: int, h: int, rot: int) -> bool:
    """True if clip will display as portrait (taller than wide)."""
    if rot in (90, -90, 270, -270):
        return w > h   # raw landscape stream that displays as portrait
    return h > w


def _is_nonstandard(w: int, h: int, rot: int) -> bool:
    """True if clip is not 16:9 landscape (needs background fill)."""
    if _is_portrait(w, h, rot):
        return True
    ratio = w / h if h else 0
    return not (1.7 < ratio < 1.8)  # 16:9 ≈ 1.777


# ── Resolution logic ─────────────────────────────────────────────────────────

def target_resolution(clips: list[dict]) -> tuple[int, int]:
    """
    Highest common denominator: the resolution held by the plurality.
    If 8K clips are majority, output is 8K. Tie goes higher.
    """
    buckets = []
    for c in clips:
        w, h, rot = c["width"], c["height"], c["rotation"]
        if rot in (90, -90, 270, -270):
            w, h = h, w   # swap to display dimensions
        # Snap to standard resolutions
        if w >= 7000:
            buckets.append((7680, 4320))
        elif w >= 3800:
            buckets.append((3840, 2160))
        elif w >= 1900:
            buckets.append((1920, 1080))
        else:
            buckets.append((w, h))

    counts = Counter(buckets)
    # Pick highest resolution with plurality
    top = sorted(counts.items(), key=lambda x: (-x[1], -x[0][0]))
    if not top:
        return (3840, 2160)
    best_res, best_count = top[0]
    # If higher resolution has >= 50% of plurality count, prefer higher
    for res, count in top:
        if res > best_res and count >= best_count * 0.5:
            best_res, best_count = res, count
    return best_res


# ── Background frame selection ───────────────────────────────────────────────

def pick_background(cfg: dict) -> Path:
    bg_dir = Path(cfg["background_frames_dir"])
    glob = cfg["background_frames_glob"]
    frames = list(bg_dir.glob(glob))
    if not frames:
        raise FileNotFoundError(
            f"No background frames found matching {bg_dir / glob}\n"
            f"Add sunset frame JPGs to {bg_dir}"
        )
    return random.choice(frames)


# ── Clip processing ──────────────────────────────────────────────────────────

def _unified_encode_args(cfg: dict) -> list[str]:
    """
    Identical encode tail used for EVERY clip.

    LESSON LEARNED (Sprint / 260423 rollup): mixing phone-native HEVC clips with
    NVENC-encoded ones at concat time causes playback hangs at clip boundaries.
    The fix is to re-encode ALL clips through one recipe so codec params (profile,
    level, pix_fmt, color, GOP structure, framerate, audio sample rate) are
    bit-identical — then stream-copy concat is bulletproof.
    """
    return [
        "-c:v", "hevc_nvenc",
        "-preset", cfg["nvenc_preset"],
        "-tune", "hq",
        "-rc", "vbr",
        "-cq", str(cfg["nvenc_cq"]),
        "-b:v", "0",
        "-profile:v", "main",
        "-level", "6.1",
        "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-colorspace", "bt709",
        "-r", "30",
        "-vsync", "cfr",
        "-g", "30",
        "-keyint_min", "30",
        "-bf", "0",
        "-no-scenecut", "1",
        "-c:a", "aac",
        "-b:a", cfg["audio_bitrate"],
        "-ar", "48000",
        "-ac", "2",
    ]


def process_clip(
    clip: dict,
    target_w: int,
    target_h: int,
    bg_frame: Path,
    out_dir: Path,
    cfg: dict,
) -> Path:
    """
    Re-encode every clip to target_w x target_h with the unified codec recipe.
    Portrait clips get rotated; non-16:9 clips get the sunset background fill;
    standard landscape clips get a passthrough scale + format normalize.
    """
    src = clip["path"]
    stem = src.stem
    out = out_dir / f"{stem}_nimue.mp4"

    if out.exists() and out.stat().st_size > 1_000_000:
        print(f"  [skip] {stem} already processed")
        return out

    rot = clip["rotation"]
    needs_bg = clip["is_portrait"] or clip["is_nonstandard"]

    transpose_filter = ""
    if rot in (-90, 270):
        transpose_filter = "[0:v]transpose=1,setsar=1[rotated];"
        scaled_input = "[rotated]"
    elif rot in (90, -270):
        transpose_filter = "[0:v]transpose=2,setsar=1[rotated];"
        scaled_input = "[rotated]"
    elif rot == 180:
        transpose_filter = "[0:v]transpose=1,transpose=1,setsar=1[rotated];"
        scaled_input = "[rotated]"
    else:
        scaled_input = "[0:v]"

    enc_tail = _unified_encode_args(cfg)

    if needs_bg:
        filter_complex = (
            f"{transpose_filter}"
            f"[1:v]scale={target_w}:{target_h},setsar=1[bg];"
            f"{scaled_input}scale={target_w}:{target_h}:force_original_aspect_ratio=decrease,setsar=1[scaled];"
            f"[bg][scaled]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]"
        )
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-noautorotate",
            "-i", str(src),
            "-i", str(bg_frame),
            "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "0:a?",
            *enc_tail,
            str(out),
        ]
    else:
        # Standard landscape — still re-encode with unified params for concat safety.
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src),
            "-vf", f"scale={target_w}:{target_h},setsar=1,format=yuv420p",
            "-map", "0:v:0", "-map", "0:a?",
            *enc_tail,
            str(out),
        ]

    print(f"  [encode] {stem} → {out.name}")
    result = run(cmd, capture=True)
    if result.returncode != 0:
        print(f"  [ERROR] {stem}: {result.stderr[-500:]}")
        raise RuntimeError(f"Failed to encode {src}")
    return out


# ── Concat list ──────────────────────────────────────────────────────────────

def build_concat_list(
    clips: list[dict],
    processed: dict,  # original_path → processed_path
    list_path: Path,
):
    with open(list_path, "w", encoding="utf-8") as f:
        for c in clips:
            p = processed.get(c["path"], c["path"])
            # ffmpeg concat needs forward slashes
            escaped = str(p).replace("\\", "/").replace("'", "\\'")
            f.write(f"file '{escaped}'\n")
    print(f"[nimue] Concat list: {len(clips)} entries → {list_path}")


# ── Music bed ────────────────────────────────────────────────────────────────

def build_music_bed(cfg: dict, duration: float, temp_dir: Path) -> Path:
    music_dir = Path(cfg["music_dir"])
    playlist_names = cfg.get("music_playlist") or []
    if playlist_names:
        mp3s = []
        missing = []
        for name in playlist_names:
            p = music_dir / name
            (mp3s if p.exists() else missing).append(p)
        if missing:
            print(f"[nimue] WARN — {len(missing)} playlist tracks missing in {music_dir}:")
            for p in missing:
                print(f"  missing: {p.name}")
        if not mp3s:
            raise FileNotFoundError(f"No playlist tracks found in {music_dir}")
        print(f"[nimue] Using curated playlist ({len(mp3s)} tracks)")
    else:
        mp3s = sorted(music_dir.glob("*.mp3"))
        if not mp3s:
            raise FileNotFoundError(f"No MP3s found in {music_dir}")

    # Repeat playlist until we cover the full video duration
    total = 0.0
    playlist = []
    while total < duration:
        for mp3 in mp3s:
            playlist.append(mp3)
            r = run(["ffprobe", "-v", "quiet",
                     "-show_entries", "format=duration",
                     "-of", "csv=p=0", str(mp3)])
            try:
                total += float(r.stdout.strip())
            except ValueError:
                pass
            if total >= duration:
                break

    concat_list = temp_dir / "music_concat.txt"
    with open(concat_list, "w") as f:
        for mp3 in playlist:
            escaped = str(mp3).replace("\\", "/").replace("'", "\\'")
            f.write(f"file '{escaped}'\n")

    bed_path = temp_dir / "music_bed.m4a"
    print(f"[nimue] Building music bed from {len(playlist)} tracks "
          f"(need {duration:.0f}s, have {total:.0f}s)...")
    run([
        "ffmpeg", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "aac", "-b:a", cfg["audio_bitrate"],
        str(bed_path), "-y"
    ], capture=True)
    return bed_path


# ── Mux ──────────────────────────────────────────────────────────────────────

def mux_with_music(
    video: Path,
    music_bed: Path,
    output: Path,
    cfg: dict,
):
    intro_vol = cfg["music_volume_intro"]
    main_vol = cfg["music_volume_main"]
    intro_dur = cfg["music_intro_duration"]

    vol_expr = f"if(lt(t,{intro_dur}),{intro_vol},{main_vol})"
    filter_complex = (
        f"[1:a]volume='{vol_expr}':eval=frame[mus];"
        f"[0:a][mus]amix=inputs=2:duration=first:normalize=0[aout]"
    )

    print(f"[nimue] Muxing music → {output.name}")
    run([
        "ffmpeg",
        "-i", str(video),
        "-i", str(music_bed),
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-b:a", cfg["audio_bitrate"],
        str(output), "-y"
    ], capture=True)


# ── Commands ─────────────────────────────────────────────────────────────────

def cmd_probe(args, cfg):
    folder = Path(args.folder)
    if not folder.exists():
        # Try as subfolder of output_dir
        folder = Path(cfg["output_dir"]).parent / "Daily" / args.folder
    clips = sorted(
        p for p in folder.iterdir()
        if p.suffix in cfg["video_extensions"]
    )
    print(f"\n{'File':<45} {'Dims':>12} {'Rot':>5} {'Dur':>7} {'dB':>7} {'Type'}")
    print("-" * 90)
    for p in clips:
        c = probe_clip(p)
        t = "PORTRAIT" if c["is_portrait"] else ("NONSTD" if c["is_nonstandard"] else "ok")
        print(f"{p.name:<45} {c['width']}x{c['height']:>4} {c['rotation']:>5}° "
              f"{c['duration']:>7.1f}s {c['mean_db']:>6.1f}dB  {t}")


def cmd_ingest(args, cfg):
    folder = Path(args.folder)
    if not folder.exists():
        folder = Path(cfg["output_dir"]) / args.folder
    if not folder.exists():
        print(f"[ERROR] Folder not found: {args.folder}")
        sys.exit(1)

    # Collect clips in order (filename = chronological for YYMMDD_HHMMSS naming)
    exts = set(cfg["video_extensions"])
    clips_paths = sorted(
        p for p in folder.iterdir() if p.suffix in exts
    )
    if not clips_paths:
        print(f"[ERROR] No video files found in {folder}")
        sys.exit(1)

    print(f"\n[nimue] Ingesting {len(clips_paths)} clips from {folder.name}")

    # Probe all clips
    print("[nimue] Probing clips...")
    clips = []
    for p in clips_paths:
        c = probe_clip(p)
        flag = " ← PORTRAIT" if c["is_portrait"] else (" ← NONSTD" if c["is_nonstandard"] else "")
        print(f"  {p.name}: {c['width']}x{c['height']} rot={c['rotation']}° "
              f"{c['duration']:.1f}s {c['mean_db']:.1f}dB{flag}")
        clips.append(c)

    # Target resolution
    tw, th = target_resolution(clips)
    print(f"\n[nimue] Target resolution: {tw}x{th}")

    # Set up temp dir
    temp_dir = Path(cfg["temp_dir"]) / folder.name
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Pick background frame
    bg = pick_background(cfg)
    print(f"[nimue] Background frame: {bg.name}")

    # Re-encode EVERY clip with unified codec params (concat-safety rule).
    # Phone-native HEVC + NVENC re-encodes mixed in one concat = playback hangs
    # at clip boundaries. Pay the encode cost once; get a bulletproof rollup.
    processed = {}
    print(f"\n[nimue] Re-encoding {len(clips)} clips with unified params (sequential)...")
    for i, c in enumerate(clips, 1):
        kind = "PORTRAIT" if c["is_portrait"] else ("NONSTD" if c["is_nonstandard"] else "landscape")
        print(f"  [{i}/{len(clips)}] {c['path'].name}  [{kind}]")
        out = process_clip(c, tw, th, bg, temp_dir, cfg)
        processed[c["path"]] = out

    # Build concat list
    concat_list = temp_dir / "concat.txt"
    build_concat_list(clips, processed, concat_list)

    # Determine output name
    date_str = folder.name[:6] if folder.name[:6].isdigit() else folder.name
    if args.name:
        base_name = args.name
    else:
        base_name = f"{date_str} Daily Rollup Vid"

    out_dir = Path(args.output or cfg["output_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)

    vid_path = temp_dir / f"{base_name}_VID.mp4"
    final_path = out_dir / f"{base_name}.mp4"

    # Concat
    print(f"\n[nimue] Concatenating → {vid_path.name}")
    result = run([
        "ffmpeg", "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c", "copy",
        str(vid_path), "-y"
    ], capture=True)
    if result.returncode != 0:
        print(f"[ERROR] Concat failed:\n{result.stderr[-1000:]}")
        sys.exit(1)

    total_duration = sum(c["duration"] for c in clips)

    if args.music_bed:
        # Build music bed
        bed = build_music_bed(cfg, total_duration, temp_dir)
        # Mux
        mux_with_music(vid_path, bed, final_path, cfg)
    else:
        # Just rename VID to final
        vid_path.rename(final_path)

    print(f"\n[nimue] ✓ Done → {final_path}")
    size_gb = final_path.stat().st_size / 1e9
    print(f"         {size_gb:.1f} GB  |  {total_duration/60:.1f} min  |  {tw}x{th}")

    if args.cleanup:
        print("[nimue] Cleaning up temp files...")
        for f in temp_dir.iterdir():
            if f != final_path:
                f.unlink(missing_ok=True)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    cfg = load_config()

    parser = argparse.ArgumentParser(
        description="Nimue — Clearwater Cruisin Daily Rollup Pipeline"
    )
    sub = parser.add_subparsers(dest="command")

    # probe
    p_probe = sub.add_parser("probe", help="Probe all clips in a folder")
    p_probe.add_argument("folder")

    # ingest
    p_ingest = sub.add_parser("ingest", help="Full ingest pipeline")
    p_ingest.add_argument("folder", help="Source folder (path or name under output_dir)")
    p_ingest.add_argument("--name", help="Output filename (without .mp4)")
    p_ingest.add_argument("--output", help="Output directory override")
    p_ingest.add_argument("--music-bed", action="store_true",
                           help="Mix Clearwater Cruisin Soul Soundtrack")
    p_ingest.add_argument("--no-background", action="store_true",
                           help="Skip sunset background for portrait clips")
    p_ingest.add_argument("--cleanup", action="store_true",
                           help="Delete temp files after completion")

    # music-bed only
    p_music = sub.add_parser("music-bed", help="Just build the music bed")
    p_music.add_argument("--duration", type=float, default=3600,
                          help="Target duration in seconds")

    args = parser.parse_args()

    if args.command == "probe":
        cmd_probe(args, cfg)
    elif args.command == "ingest":
        cmd_ingest(args, cfg)
    elif args.command == "music-bed":
        temp_dir = Path(cfg["temp_dir"])
        temp_dir.mkdir(parents=True, exist_ok=True)
        bed = build_music_bed(cfg, args.duration, temp_dir)
        print(f"[nimue] Music bed → {bed}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
