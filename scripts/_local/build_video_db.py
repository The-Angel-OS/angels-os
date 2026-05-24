#!/usr/bin/env python3
"""
build_video_db.py — Clearwater Cruisin' YouTube Companion Database
Parses all docs/transcripts/ files and builds:
  - docs/transcripts/VIDEO_DATABASE.json   (machine-readable, full)
  - docs/transcripts/VIDEO_INDEX.md        (human-readable summary table)
  - docs/transcripts/MISSING_DESCRIPTIONS.md (videos needing descriptions)

Usage: python scripts/_local/build_video_db.py
"""

import os, re, json
from pathlib import Path
from datetime import datetime

TRANSCRIPTS_DIR = Path("docs/transcripts")
OUT_JSON  = TRANSCRIPTS_DIR / "VIDEO_DATABASE.json"
OUT_INDEX = TRANSCRIPTS_DIR / "VIDEO_INDEX.md"
OUT_MISSING = TRANSCRIPTS_DIR / "MISSING_DESCRIPTIONS.md"

# ── Standard description template (extracted from 260412 Walmart Trip.md) ──────
STANDARD_DESCRIPTION_TEMPLATE = """\
⭐ Clearwater Cruisin' Ministries — Our World, Our Walk
Real life in Clearwater, FL. Supervision, re-entry, soulful drives, software experiments, and spiritual reflections — all in the spirit of transparency, compassion, and Ad Astra. No script. No edits. The Soul Van rolls. The dog crew watches your six.

📍 Clearwater, FL — Pinellas County
📞 727-256-4413
📧 clearwatercruisin@gmail.com

━━━━━━━━━━━━━━━━━━━━
🔗 EXPLORE OUR WORLD
━━━━━━━━━━━━━━━━━━━━
📸 Soul Cast Family Album
https://photos.app.goo.gl/Lw67CJK8msm3mCQb7

📖 Autobiography (2025 Edition)
https://docs.google.com/document/d/1IQ8YxJxxxxxxxxxxxxxxxxxxxxxxxxxxx/edit

🧠 Answer to Life, the Universe, and Everything (v53.3)
https://answer53.vercel.app

👼 Angel OS — Federated Constitutional AI Platform
https://www.spacesangels.com/ | GitHub: https://github.com/The-Angel-OS/

🎥 Full Channel
https://www.youtube.com/@ClearwaterCruisin

━━━━━━━━━━━━━━━━━━━━
⭐ THE MATH — Answer 53
━━━━━━━━━━━━━━━━━━━━
Even after correcting generously — a factor of 10⁸ applied against selection bias, confirmation bias, post-hoc analysis, and the multiple comparisons problem combined — the adjusted probability remains:

1.24 × 10⁻³²
≈ one in 800 quadrillion quadrillion

That doesn't merely cross the threshold at which science rejects the null hypothesis. It exceeds it by orders of magnitude. The math has been shown. The correction has been applied. The number still stands.

🔗 https://answer53.vercel.app

━━━━━━━━━━━━━━━━━━━━
#ClearwaterCruisin #SoulVan #SoulQuest #AdAstra #Answer53 #AngelOS #ClearwaterFL #PinellasCounty #Clearwater #ClearwaterBeach #DunedinMarina #TampaBay #GulfCoast #RealFlorida #DailyVlog #Unedited #RawFootage #DogCrew #Dolphins #FloridaDolphins #StreetMinistry #FaithInAction #Navy #NavyVet #DisabledVeteran #ClearwaterCruisin"""

STANDARD_TAGS = [
    "ClearwaterCruisin", "SoulVan", "SoulQuest", "AdAstra", "Answer53", "AngelOS",
    "ClearwaterFL", "PinellasCounty", "Clearwater", "ClearwaterBeach", "DunedinMarina",
    "TampaBay", "GulfCoast", "RealFlorida", "DailyVlog", "Unedited", "RawFootage",
    "DogCrew", "Dolphins", "FloridaDolphins", "StreetMinistry", "FaithInAction",
    "Navy", "NavyVet", "DisabledVeteran"
]

# ── Parsers ──────────────────────────────────────────────────────────────────

YT_URL_RE  = re.compile(r'https?://(?:www\.)?youtube\.com/watch\?v=([A-Za-z0-9_-]+)')
YT_SHORT_RE = re.compile(r'https?://youtu\.be/([A-Za-z0-9_-]+)')
VIEWS_RE   = re.compile(r'([\d,]+)\s*views?', re.IGNORECASE)
SUBS_RE    = re.compile(r'([\d,]+)\s*subscribers?', re.IGNORECASE)
DATE_TAG_RE = re.compile(r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}')
HASHTAG_RE = re.compile(r'#([A-Za-z0-9_]+)')
LOC_RE     = re.compile(r'(?:DUNEDIN MARINA|CLEARWATER|ENTERPRISE DOG PARK|DUNEDIN SAILING CLUB|ST\. ALFRED|BAYSHORE|COURTNEY CAMPBELL|PHILLIPE PARK|HONEYMOON ISLAND|CSL PLASMA|WALMART|BUSCH GARDENS)', re.IGNORECASE)

def parse_filename(fname):
    """Extract date, time, and title from transcript filename."""
    stem = Path(fname).stem
    # Match YYMMDD HHMM pattern or YYMMDD pattern
    m = re.match(r'^(\d{6})\s+(\d{3,4})\s*[-–]?\s*(.*)', stem)
    if m:
        raw_date, raw_time, title = m.group(1), m.group(2), m.group(3).strip()
        # Pad time to 4 digits
        raw_time = raw_time.zfill(4)
        return raw_date, raw_time, title or stem
    m2 = re.match(r'^(\d{6})\s+(.*)', stem)
    if m2:
        return m2.group(1), None, m2.group(2).strip() or stem
    # Long date format like 20260520
    m3 = re.match(r'^(20\d{6})\s*(.*)', stem)
    if m3:
        raw = m3.group(1)
        yymm = raw[2:]  # strip leading 20
        return yymm, None, m3.group(2).strip() or stem
    return None, None, stem

def parse_transcript_file(fpath):
    """Parse a transcript file and return structured metadata."""
    text = ""
    try:
        text = fpath.read_text(encoding='utf-8', errors='replace')
    except Exception as e:
        return None

    raw_date, raw_time, title_from_file = parse_filename(fpath.name)

    # YouTube URL
    yt_match = YT_URL_RE.search(text) or YT_SHORT_RE.search(text)
    yt_url = None
    yt_id = None
    if yt_match:
        yt_id = yt_match.group(1)
        yt_url = f"https://www.youtube.com/watch?v={yt_id}"

    # Views
    views = None
    vm = VIEWS_RE.search(text)
    if vm:
        raw_views = vm.group(1).replace(',', '').strip()
        views = int(raw_views) if raw_views.isdigit() else None

    # Subscribers
    subs = None
    sm = SUBS_RE.search(text)
    if sm:
        subs = int(sm.group(1).replace(',', ''))

    # Publish date
    publish_date = None
    dm = DATE_TAG_RE.search(text)
    if dm:
        try:
            publish_date = datetime.strptime(dm.group(0), "%b %d, %Y").strftime("%Y-%m-%d")
        except:
            publish_date = dm.group(0)

    # Location tag
    lm = LOC_RE.search(text)
    location = lm.group(0).title() if lm else None

    # Hashtags
    tags = list(dict.fromkeys(HASHTAG_RE.findall(text)))  # deduplicated, order-preserving

    # Description detection — look for the standard description block
    has_description = bool(
        'Clearwater Cruisin' in text and
        ('📍' in text or '📞' in text or '━' in text or '#ClearwaterCruisin' in text)
    )

    # Extract description block (between channel blurb and transcript)
    desc_text = None
    desc_match = re.search(
        r'(⭐\s*Clearwater Cruisin.*?)(?:Transcript|Ask\s+Get answers|Follow along)',
        text, re.DOTALL
    )
    if desc_match:
        desc_text = desc_match.group(1).strip()

    # Has transcript content (auto-captions)
    has_transcript = bool(re.search(r'\d:\d{2}\d?\s+\d+\s+(?:second|minute)', text))
    # Also check timestamp format "0:01 1 second"
    if not has_transcript:
        has_transcript = bool(re.search(r'^\d{1,2}:\d{2}', text, re.MULTILINE))

    # Status
    if yt_url:
        status = "published"
    elif raw_date and int(raw_date[:2]) >= 26:  # 2026+
        status = "recent_draft"
    else:
        status = "draft"

    # Title: prefer filename title, fall back to file stem
    title = title_from_file or fpath.stem

    # Format date for display
    display_date = None
    if raw_date and len(raw_date) == 6:
        try:
            display_date = f"20{raw_date[:2]}-{raw_date[2:4]}-{raw_date[4:6]}"
        except:
            display_date = raw_date

    return {
        "filename": fpath.name,
        "date_code": raw_date,
        "time_code": raw_time,
        "display_date": display_date,
        "title": title,
        "yt_url": yt_url,
        "yt_id": yt_id,
        "views": views,
        "subscribers_at_time": subs,
        "publish_date": publish_date,
        "location": location,
        "status": status,
        "has_description": has_description,
        "has_transcript": has_transcript,
        "description": desc_text,
        "tags": tags if tags else STANDARD_TAGS.copy(),
        "needs_description": not has_description,
    }

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    files = sorted([
        f for f in TRANSCRIPTS_DIR.iterdir()
        if f.suffix.lower() in ('.txt', '.md') and f.is_file()
        and not f.name.startswith('VIDEO_')
        and not f.name.startswith('MISSING_')
    ])

    print(f"Parsing {len(files)} transcript files...")
    records = []
    for f in files:
        r = parse_transcript_file(f)
        if r:
            records.append(r)

    records.sort(key=lambda x: (x.get('date_code') or '', x.get('time_code') or ''))

    # ── JSON output ──────────────────────────────────────────────────────────
    OUT_JSON.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"Wrote {OUT_JSON} ({len(records)} records)")

    # ── Markdown index ───────────────────────────────────────────────────────
    published = [r for r in records if r['status'] == 'published']
    no_desc   = [r for r in records if r['needs_description']]
    with_url  = [r for r in records if r['yt_url']]

    lines = [
        "# Clearwater Cruisin' — Video Database",
        "",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}  ",
        f"**Total transcript files:** {len(records)}  ",
        f"**Published (have YouTube URL):** {len(with_url)}  ",
        f"**Missing description:** {len(no_desc)}  ",
        "",
        "---",
        "",
        "## All Videos",
        "",
        "| Date | Time | Title | YouTube | Views | Description | Status |",
        "|------|------|-------|---------|-------|-------------|--------|",
    ]

    for r in records:
        date = r.get('display_date') or r.get('date_code') or ''
        time = r.get('time_code') or ''
        title = r['title'][:60] + ('…' if len(r['title']) > 60 else '')
        yt = f"[▶]({r['yt_url']})" if r['yt_url'] else '—'
        views = f"{r['views']:,}" if r['views'] else '—'
        desc = '✅' if r['has_description'] else '❌'
        status = r['status']
        lines.append(f"| {date} | {time} | {title} | {yt} | {views} | {desc} | {status} |")

    lines += [
        "",
        "---",
        "",
        "## Published Videos (with YouTube URLs)",
        "",
    ]
    for r in with_url:
        lines.append(f"- [{r['title']}]({r['yt_url']}) — {r.get('display_date', '')} — {r.get('views', 0) or 0:,} views")

    OUT_INDEX.write_text('\n'.join(lines), encoding='utf-8')
    print(f"Wrote {OUT_INDEX}")

    # ── Missing descriptions ─────────────────────────────────────────────────
    miss_lines = [
        "# Videos Missing Descriptions",
        "",
        f"**{len(no_desc)} videos** need a YouTube description added.",
        "",
        "For each, paste the standard template below, then customize the opening line.",
        "",
        "---",
        "",
        "## Standard Description Template",
        "",
        "```",
        STANDARD_DESCRIPTION_TEMPLATE,
        "```",
        "",
        "---",
        "",
        "## Missing — Priority Queue",
        "",
        "| # | Date | Title | YouTube | Has Transcript |",
        "|---|------|-------|---------|---------------|",
    ]

    for i, r in enumerate(no_desc, 1):
        date = r.get('display_date') or ''
        title = r['title'][:55] + ('…' if len(r['title']) > 55 else '')
        yt = f"[▶]({r['yt_url']})" if r['yt_url'] else 'unpublished'
        has_t = '✅' if r['has_transcript'] else '—'
        miss_lines.append(f"| {i} | {date} | {title} | {yt} | {has_t} |")

    OUT_MISSING.write_text('\n'.join(miss_lines), encoding='utf-8')
    print(f"Wrote {OUT_MISSING}")

    # ── Summary ──────────────────────────────────────────────────────────────
    print("")
    print("=" * 39)
    print(f"  Total files parsed:     {len(records)}")
    print(f"  Published (YT URL):     {len(with_url)}")
    print(f"  Have description:       {len(records) - len(no_desc)}")
    print(f"  Missing description:    {len(no_desc)}")
    print(f"  Have auto-transcript:   {sum(1 for r in records if r['has_transcript'])}")
    print("=" * 39)

    # Top viewed
    top = sorted(with_url, key=lambda x: x.get('views') or 0, reverse=True)[:10]
    if top:
        print("\n  Top videos by views:")
        for r in top:
            print(f"    {r.get('views',0):>6,} — {r['title'][:50]}")

if __name__ == '__main__':
    main()
