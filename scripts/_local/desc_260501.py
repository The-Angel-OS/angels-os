#!/usr/bin/env python3
"""
Generate the YouTube description for 260501 Solfin Quest daily rollup.

Usage:
  python desc_260501.py > C:/Users/kenne/AppData/Local/Temp/260501_description.md
"""

import csv
import os
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

_DEFAULT_MANIFEST = r"C:\Users\kenne\AppData\Local\Temp\260501_manifest.tsv"
MANIFEST = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ.get("MANIFEST", _DEFAULT_MANIFEST))

# Build order from dashcam_260501.sh — clips play in this exact sequence
BUILD_ORDER = [
    (1,  "P", "20260430_120904.mp4"),
    (2,  "P", "20260501_064418.mp4"),
    (3,  "L", "20260501_064625.mp4"),
    (4,  "L", "20260501_083816.mp4"),
    (5,  "L", "20260501_085525.mp4"),
    (6,  "L", "20260501_085925.mp4"),
    (7,  "L", "20260501_091457.mp4"),
    (8,  "L", "20260501_093322.mp4"),
    (9,  "L", "20260501_093542.mp4"),
    (10, "L", "20260501_093727.mp4"),
    (11, "L", "20260501_101219.mp4"),
    (12, "P", "20260501_101811.mp4"),
    (13, "P", "20260501_105207.mp4"),
    (14, "P", "20260501_105219.mp4"),
    (15, "P", "20260501_105249.mp4"),
    (16, "P", "20260501_105300.mp4"),
    (17, "P", "20260501_105333.mp4"),
    (18, "L", "20260501_114913.mp4"),
    (19, "L", "20260501_115001.mp4"),
    (20, "L", "20260501_115110.mp4"),
    (21, "L", "20260501_115220.mp4"),
    (22, "L", "20260501_115519.mp4"),
    (23, "L", "20260501_115805.mp4"),
    (24, "P", "20260501_120424.mp4"),
    (25, "L", "20260501_120445.mp4"),
    (26, "F", "20260501_121232~2.mp4"),
    (27, "P", "20260501_121501.mp4"),
    (28, "P", "20260501_121817.mp4"),
    (29, "P", "20260501_122433.mp4"),
    (30, "P", "20260501_122543.mp4"),
    (31, "P", "20260501_122613.mp4"),
    (32, "P", "20260501_122747.mp4"),
    (33, "P", "20260501_125443.mp4"),
    (34, "P", "20260501_130052.mp4"),
    (35, "L", "20260501_130507.mp4"),
    (36, "H", "20260501_142818.mp4"),
    (37, "H", "20260501_142915.mp4"),
    (38, "H", "20260501_142946.mp4"),
    (39, "H", "20260501_143011.mp4"),
    (40, "H", "20260501_143032.mp4"),
]


def parse_wall_clock(filename: str) -> datetime | None:
    """Extract wall-clock time from filename like 20260501_130507.mp4"""
    m = re.match(r"(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})", filename)
    if not m:
        return None
    y, mo, d, h, mi, s = (int(x) for x in m.groups())
    return datetime(y, mo, d, h, mi, s)


def fmt_timestamp(total_seconds: float) -> str:
    """Format seconds as M:SS or H:MM:SS for YouTube chapters."""
    ts = int(round(total_seconds))
    if ts < 0:
        ts = 0
    h = ts // 3600
    m = (ts % 3600) // 60
    s = ts % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def fmt_wall_clock(dt: datetime) -> str:
    """e.g. '12:09pm' or '6:44am'"""
    return dt.strftime("%-I:%M%p").lower() if hasattr(dt, "strftime") else ""


def fmt_wall_clock_win(dt: datetime) -> str:
    """Windows-compatible: no %-I, use %#I instead."""
    h = dt.hour % 12 or 12
    ampm = "am" if dt.hour < 12 else "pm"
    return f"{h}:{dt.minute:02d}{ampm}"


def date_label(dt: datetime) -> str:
    """e.g. '4/30' or '5/01'"""
    return f"{dt.month}/{dt.day:02d}"


def load_manifest() -> dict:
    """Load manifest TSV into dict keyed by filename."""
    rows = {}
    with open(MANIFEST, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            rows[row["filename"]] = row
    return rows


def main():
    manifest = load_manifest()

    # Build clip data in play order
    clips = []
    for seq, treat, filename in BUILD_ORDER:
        row = manifest.get(filename)
        if not row or row.get("duration_s") == "MISSING":
            print(f"WARNING: clip {seq} ({filename}) missing from manifest", file=sys.stderr)
            continue
        dur = float(row["duration_s"])
        wc = parse_wall_clock(filename)
        clips.append({
            "seq": seq,
            "treat": treat,
            "filename": filename,
            "duration": dur,
            "wall_clock": wc,
            "orient": row.get("orient", "?"),
            "width": row.get("width", "?"),
            "height": row.get("height", "?"),
            "fps": row.get("fps", "?"),
            "vcodec": row.get("vcodec", "?"),
            "resolution": f"{row.get('width', '?')}x{row.get('height', '?')}",
        })

    # Compute cumulative timestamps
    cum = 0.0
    for c in clips:
        c["start_ts"] = cum
        cum += c["duration"]

    # ── Opening paragraph ─────────────────────────────────────────────────
    print(
        "Solfin Quest at the Dunedin Boat Club, May 1st 2026 — with a 4/30 evening "
        "lead-in and a sunrise launch the next morning. Daily rollup format: every "
        "clip in order, stitched end-to-end with the Clearwater Cruisin' Soul "
        "Soundtrack underneath at low volume so the original audio (wind, water, "
        "dolphins, whatever conversations happened) stays front and center. Portrait "
        "clips get a sunset-frame backdrop so they don't squish the screen. 8K HEVC "
        "throughout."
    )
    print()

    # ── CHAPTERS ──────────────────────────────────────────────────────────
    SCENE_GAP_MINUTES = 10

    print("CHAPTERS")
    print("─" * 40)

    prev_wc = None
    for i, c in enumerate(clips):
        wc = c["wall_clock"]
        ts = fmt_timestamp(c["start_ts"])

        # Scene-break detection: gap > 10 min between consecutive wall-clock times
        if prev_wc and wc:
            gap_min = (wc - prev_wc).total_seconds() / 60
            if gap_min > SCENE_GAP_MINUTES:
                wc_label = fmt_wall_clock_win(wc)
                # Infer a scene label from time of day
                hour = wc.hour
                if hour < 7:
                    scene = "Pre-dawn"
                elif hour < 10:
                    scene = "Morning session"
                elif hour < 12:
                    scene = "Late morning"
                elif hour < 14:
                    scene = "Midday"
                elif hour < 17:
                    scene = "Afternoon"
                else:
                    scene = "Evening"
                print()
                print(f"────────  🌄 {scene} ({wc_label})")
                print()

        # Chapter line
        wc_str = fmt_wall_clock_win(wc) if wc else "?"
        dl = date_label(wc) if wc else "?"
        orient_emoji = "📱" if c["orient"] == "portrait" else ""
        # <!-- ANNOTATE --> placeholder for user to fill in clip descriptions
        print(f"{ts:<10}{orient_emoji} {c['filename'].replace('.mp4', '')} — {dl} {wc_str}  <!-- ANNOTATE -->")

        prev_wc = wc

    print()

    # ── Per-clip details table ────────────────────────────────────────────
    print("<details>")
    print("<summary>Per-clip details (40 clips)</summary>")
    print()
    print("| # | Filename | Wall Clock | Duration | Orient | Resolution | FPS | Codec |")
    print("|---|----------|------------|----------|--------|------------|-----|-------|")
    for c in clips:
        wc_str = fmt_wall_clock_win(c["wall_clock"]) if c["wall_clock"] else "?"
        dl = date_label(c["wall_clock"]) if c["wall_clock"] else "?"
        dur_str = fmt_timestamp(c["duration"])
        print(
            f"| {c['seq']:02d} "
            f"| {c['filename']} "
            f"| {dl} {wc_str} "
            f"| {dur_str} "
            f"| {c['orient']} "
            f"| {c['resolution']} "
            f"| {c['fps']} "
            f"| {c['vcodec']} |"
        )
    print()
    total_dur = sum(c["duration"] for c in clips)
    print(f"**Total runtime:** {fmt_timestamp(total_dur)} ({len(clips)} clips)")
    print()
    print("</details>")
    print()

    # ── Hashtags ──────────────────────────────────────────────────────────
    print(
        "#ClearwaterCruisin #DunedinBoatClub #SolfinQuest #DailyRollup #8K "
        "#Pinellas #FloridaSunset #VanLife #DolphinQuest"
    )
    print()

    # ── Cross-links ───────────────────────────────────────────────────────
    print("─" * 40)
    print("MORE CLEARWATER CRUISIN' CONTENT:")
    print()
    print("Previous Quest: 260430 Dan Brown Was Substantially Right")
    print("  → <!-- LINK -->")
    print()
    print("Soul Van content thread")
    print("  → <!-- LINK -->")
    print()
    print("Southern Life YouTube channel")
    print("  → <!-- LINK -->")
    print()
    print("Telepathy Tapes podcast")
    print("  → <!-- LINK -->")
    print()


if __name__ == "__main__":
    main()
