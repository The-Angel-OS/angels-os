#!/usr/bin/env python3
"""
transcript_engine.py — Clearwater Cruisin' Transcript Engine

PHASES:
  1. channel  — scrape all video IDs from @ClearwaterCruisin via yt-dlp
  2. fetch    — pull auto-captions via youtube-transcript-api for all known videos
  3. whisper  — download audio + transcribe via faster-whisper for missing ones
  4. edit     — apply uniform edits / proper noun fixes across all transcripts
  5. status   — print dashboard of transcript coverage

USAGE:
  python transcript_engine.py channel        # discover all channel videos
  python transcript_engine.py fetch          # fetch YT transcripts for all
  python transcript_engine.py fetch VIDEO_ID # fetch one specific video
  python transcript_engine.py whisper        # transcribe all missing
  python transcript_engine.py edit           # apply edit rules to all
  python transcript_engine.py status         # show coverage dashboard
"""

import os, sys, json, re, time
from pathlib import Path
from datetime import datetime

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT         = Path(__file__).parent.parent.parent          # angels-os/
TRANSCRIPTS  = ROOT / "docs" / "transcripts"
RAW_DIR      = TRANSCRIPTS / "raw"           # raw JSON from YouTube
PROCESSED    = TRANSCRIPTS / "processed"     # normalized + edited
AUDIO_DIR    = TRANSCRIPTS / "audio"         # temp audio for Whisper
DATABASE     = TRANSCRIPTS / "VIDEO_DATABASE.json"
CHANNEL_URL  = "https://www.youtube.com/@ClearwaterCruisin/videos"

RAW_DIR.mkdir(exist_ok=True)
PROCESSED.mkdir(exist_ok=True)
AUDIO_DIR.mkdir(exist_ok=True)

# ── Proper noun / edit dictionary ─────────────────────────────────────────────
# Applied in order — earlier entries take priority
EDIT_RULES = [
    # Place names
    (r'\bdunedin\b', 'Dunedin', re.IGNORECASE),
    (r'\bclearwater\b', 'Clearwater', re.IGNORECASE),
    (r'\bpinellas\b', 'Pinellas', re.IGNORECASE),
    (r'\bduneden\b', 'Dunedin', re.IGNORECASE),   # common misspelling
    (r'\bdunadin\b', 'Dunedin', re.IGNORECASE),
    (r'\bdunned in\b', 'Dunedin', re.IGNORECASE),
    (r'\bsafety harbor\b', 'Safety Harbor', re.IGNORECASE),
    (r'\bpalm harbor\b', 'Palm Harbor', re.IGNORECASE),
    (r'\btarpon springs\b', 'Tarpon Springs', re.IGNORECASE),
    (r'\bhoneymoon island\b', 'Honeymoon Island', re.IGNORECASE),
    (r'\bphillipe park\b', 'Philippe Park', re.IGNORECASE),
    (r'\bphilipe park\b', 'Philippe Park', re.IGNORECASE),
    (r'\benterprise dog park\b', 'Enterprise Dog Park', re.IGNORECASE),
    (r'\bst\.\s*alfred[\'s]*\b', "St. Alfred's", re.IGNORECASE),
    (r'\bst alfred[\'s]*\b', "St. Alfred's", re.IGNORECASE),

    # People / animals
    (r'\bozzie\b', 'Ozzie', re.IGNORECASE),   # osprey
    (r'\boprah\b', 'Oprah', re.IGNORECASE),   # osprey
    (r'\bdaisy\b', 'Daisy', re.IGNORECASE),
    (r'\bmika\b', 'Mika', re.IGNORECASE),
    (r'\btyler\b', 'Tyler', re.IGNORECASE),
    (r'\bthe fifth element\b', 'the Fifth Element', re.IGNORECASE),

    # Channel / brand
    (r'\bclear water cruising\b', 'Clearwater Cruisin\'', re.IGNORECASE),
    (r'\bclearwater cruising\b', 'Clearwater Cruisin\'', re.IGNORECASE),
    (r'\bclearwater cruis[ei]n\b', 'Clearwater Cruisin\'', re.IGNORECASE),
    (r'\bangel os\b', 'Angel OS', re.IGNORECASE),
    (r'\banswer53\b', 'Answer 53', re.IGNORECASE),
    (r'\bspacesangels\b', 'spacesangels', re.IGNORECASE),

    # Tech / equipment
    (r'\bs\s*23\b', 'S23', re.IGNORECASE),
    (r'\bs\s*23\s*ultra\b', 'S23 Ultra', re.IGNORECASE),
    (r'\bhohem\b', 'Hohem', re.IGNORECASE),
    (r'\bisteady\b', 'iSteady', re.IGNORECASE),
    (r'\bnvenc\b', 'NVENC', re.IGNORECASE),

    # Military / Navy
    (r'\buss baton rouge\b', 'USS Baton Rouge', re.IGNORECASE),
    (r'\bssn\s*689\b', 'SSN 689', re.IGNORECASE),
    (r'\buss los angeles\b', 'USS Los Angeles', re.IGNORECASE),
    (r'\bssn\s*688\b', 'SSN 688', re.IGNORECASE),
    (r'\bstation\b', 'STATION', re.IGNORECASE),   # sign-off

    # Cleanup — filler words (light touch — preserve voice)
    # Only strip pure filler at start of segment
    (r'^(uh,?\s+)', '', re.IGNORECASE),
    (r'^(um,?\s+)', '', re.IGNORECASE),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_database() -> list[dict]:
    if not DATABASE.exists():
        print(f"[!] DATABASE not found at {DATABASE}")
        print("    Run: python scripts/_local/build_video_db.py first")
        return []
    return json.loads(DATABASE.read_text(encoding='utf-8'))

def save_database(records: list[dict]):
    DATABASE.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding='utf-8')

def fmt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    if h:
        return f"{h:02d}:{m:02d}:{s:05.2f}"
    return f"{m:02d}:{s:05.2f}"

def apply_edits(text: str) -> str:
    for pattern, replacement, flags in EDIT_RULES:
        text = re.sub(pattern, replacement, text, flags=flags)
    return text

# ── Phase 1: Channel discovery ────────────────────────────────────────────────

def phase_channel():
    """Scrape all video IDs from the YouTube channel via yt-dlp."""
    try:
        import subprocess, json as _json
        print(f"Scraping channel: {CHANNEL_URL}")
        result = subprocess.run(
            [
                "yt-dlp",
                "--flat-playlist",
                "--print", '%(id)s\t%(title)s\t%(upload_date)s\t%(view_count)s\t%(duration)s',
                "--no-warnings",
                CHANNEL_URL,
            ],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            print(f"[!] yt-dlp error: {result.stderr[:200]}")
            return []

        channel_videos = []
        for line in result.stdout.strip().splitlines():
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            vid_id = parts[0].strip()
            title  = parts[1].strip() if len(parts) > 1 else ''
            date   = parts[2].strip() if len(parts) > 2 else ''
            views  = int(parts[3]) if len(parts) > 3 and parts[3].strip().isdigit() else None
            dur    = int(parts[4]) if len(parts) > 4 and parts[4].strip().isdigit() else None
            channel_videos.append({
                'yt_id': vid_id,
                'yt_url': f'https://www.youtube.com/watch?v={vid_id}',
                'title': title,
                'upload_date': date,
                'views': views,
                'duration_seconds': dur,
            })

        print(f"Found {len(channel_videos)} videos on channel")

        # Merge with existing database
        records = load_database()
        existing_ids = {r.get('yt_id') for r in records if r.get('yt_id')}
        added = 0
        for v in channel_videos:
            if v['yt_id'] not in existing_ids:
                # New video not in our database
                records.append({
                    'filename': f"{v['upload_date']} {v['title']}.txt",
                    'date_code': v['upload_date'][2:8] if v.get('upload_date') else None,
                    'time_code': None,
                    'display_date': f"{v['upload_date'][:4]}-{v['upload_date'][4:6]}-{v['upload_date'][6:8]}" if v.get('upload_date') else None,
                    'title': v['title'],
                    'yt_url': v['yt_url'],
                    'yt_id': v['yt_id'],
                    'views': v['views'],
                    'duration_seconds': v['duration_seconds'],
                    'status': 'published',
                    'has_description': False,
                    'has_transcript': False,
                    'transcript_status': 'unknown',
                    'needs_description': True,
                })
                added += 1
            else:
                # Update view counts
                for r in records:
                    if r.get('yt_id') == v['yt_id']:
                        r['views'] = v['views']
                        if v.get('duration_seconds'):
                            r['duration_seconds'] = v['duration_seconds']

        save_database(records)
        print(f"Added {added} new videos. Total: {len(records)}")
        return channel_videos

    except FileNotFoundError:
        print("[!] yt-dlp not found. Install: pip install yt-dlp")
        return []
    except Exception as e:
        print(f"[!] Channel scrape failed: {e}")
        return []

# ── Phase 2: Fetch transcripts from YouTube ────────────────────────────────────

def fetch_one(video_id: str, record: dict, api=None) -> dict:
    """Fetch transcript for one video. Returns updated record.
    v1.x API: YouTubeTranscriptApi() is instantiated, segments are objects.
    """
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    try:
        # RequestBlocked is the base; IpBlocked subclasses it — catch base covers both
        from youtube_transcript_api._errors import RequestBlocked
    except ImportError:
        RequestBlocked = Exception
    if api is None:
        api = YouTubeTranscriptApi()

    out_file = RAW_DIR / f"{video_id}.json"

    # Skip if already fetched
    if out_file.exists():
        existing = json.loads(out_file.read_text(encoding='utf-8'))
        record['transcript_status'] = existing.get('source', 'fetched')
        record['has_transcript'] = True
        return record

    try:
        transcript_list = api.list(video_id)
        transcript = None
        source = 'unknown'

        try:
            transcript = transcript_list.find_manually_created_transcript(['en'])
            source = 'manual'
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(['en'])
                source = 'auto_generated'
            except Exception:
                try:
                    for t in transcript_list:
                        transcript = t
                        source = f'auto_{t.language_code}'
                        break
                except Exception:
                    pass

        if transcript is None:
            record['transcript_status'] = 'none'
            record['has_transcript'] = False
            return record

        segments = transcript.fetch()
        data = {
            'video_id': video_id,
            'title': record.get('title', ''),
            'yt_url': record.get('yt_url', ''),
            'source': source,
            'fetched_at': datetime.now().isoformat(),
            'segments': [
                {
                    'start': seg.start,
                    'duration': seg.duration,
                    'text': seg.text,
                    'text_edited': apply_edits(seg.text),
                }
                for seg in segments
            ]
        }
        out_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
        record['transcript_status'] = source
        record['has_transcript'] = True
        print(f"  + {video_id} [{source}] {len(segments)} segs")
        return record

    except TranscriptsDisabled:
        record['transcript_status'] = 'disabled'
        record['has_transcript'] = False
        return record
    except NoTranscriptFound:
        record['transcript_status'] = 'none'
        record['has_transcript'] = False
        return record
    except RequestBlocked as e:
        record['transcript_status'] = 'IpBlocked'
        record['has_transcript'] = False
        print(f"  ! {video_id} - IP BLOCKED")
        return record
    except Exception as e:
        err = str(e)[:80]
        record['transcript_status'] = f'error: {err}'
        record['has_transcript'] = False
        print(f"  ! {video_id} - {err}")
        return record

def phase_fetch(target_id: str = None):
    """Fetch transcripts for all published videos (or one specific ID)."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        print("[!] youtube-transcript-api not installed. Run: pip install youtube-transcript-api")
        return

    records = load_database()
    to_fetch = [r for r in records if r.get('yt_id') and r.get('status') == 'published']

    if target_id:
        to_fetch = [r for r in records if r.get('yt_id') == target_id]
        if not to_fetch:
            # Create a minimal record for an ad-hoc video ID
            to_fetch = [{'yt_id': target_id, 'title': target_id, 'yt_url': f'https://www.youtube.com/watch?v={target_id}', 'status': 'published'}]

    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()   # single instance, reused for all requests

    print(f"Fetching transcripts for {len(to_fetch)} videos...")
    ok, skip, fail, ip_blocked = 0, 0, 0, 0
    DELAY = 1.5            # seconds between requests
    BLOCK_BACKOFF = 120    # seconds to pause if IP-blocked

    for i, record in enumerate(to_fetch, 1):
        vid_id = record['yt_id']
        out_file = RAW_DIR / f"{vid_id}.json"
        if out_file.exists() and not target_id:
            skip += 1
            continue

        title_safe = record.get('title','')[:40].encode('ascii', errors='replace').decode('ascii')
        print(f"  [{i}/{len(to_fetch)}] {vid_id} {title_safe}", flush=True)
        record = fetch_one(vid_id, record, api=api)

        # Update in records list
        for r in records:
            if r.get('yt_id') == vid_id:
                r.update({k: v for k, v in record.items() if k in ('transcript_status', 'has_transcript')})

        status = record.get('transcript_status', '')
        if record.get('has_transcript'):
            ok += 1
        elif 'IpBlocked' in status or 'ip' in status.lower():
            ip_blocked += 1
            if ip_blocked >= 3:
                print(f"  [!] IP blocked 3 times in a row — pausing {BLOCK_BACKOFF}s then retrying...", flush=True)
                save_database(records)
                time.sleep(BLOCK_BACKOFF)
                ip_blocked = 0
                api = YouTubeTranscriptApi()   # fresh session
        else:
            fail += 1
            ip_blocked = 0

        # Polite rate limiting
        time.sleep(DELAY)

    save_database(records)
    print(f"\nFetch complete: {ok} fetched, {skip} skipped (cached), {fail} failed/none")

# ── Phase 3: Whisper transcription ─────────────────────────────────────────────

def phase_whisper(model_size: str = 'base'):
    """Transcribe videos with no YouTube transcript using faster-whisper."""
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("[!] faster-whisper not installed. Run: pip install faster-whisper")
        return

    records = load_database()
    need_whisper = [
        r for r in records
        if r.get('yt_id')
        and r.get('transcript_status') in ('none', 'disabled', 'unknown', None)
        and not (RAW_DIR / f"{r['yt_id']}.json").exists()
    ]

    if not need_whisper:
        print("No videos need Whisper transcription.")
        return

    print(f"Loading Whisper model: {model_size}")
    model = WhisperModel(model_size, device="cuda", compute_type="float16")

    print(f"Transcribing {len(need_whisper)} videos...")
    for i, record in enumerate(need_whisper, 1):
        vid_id = record['yt_id']
        audio_file = AUDIO_DIR / f"{vid_id}.m4a"
        out_file = RAW_DIR / f"{vid_id}.json"

        t_safe = record.get('title','')[:50].encode('ascii', errors='replace').decode('ascii')
        print(f"\n[{i}/{len(need_whisper)}] {vid_id} - {t_safe}")

        # Download audio via yt-dlp
        if not audio_file.exists():
            import subprocess
            print(f"  Downloading audio...")
            r = subprocess.run(
                [
                    "yt-dlp",
                    "-f", "bestaudio[ext=m4a]/bestaudio",
                    "-o", str(audio_file),
                    "--no-warnings",
                    record['yt_url'],
                ],
                capture_output=True, text=True, timeout=300
            )
            if r.returncode != 0:
                print(f"  [!] Download failed: {r.stderr[:100]}")
                continue
            print(f"  Downloaded: {audio_file.stat().st_size // 1024}KB")

        # Transcribe
        try:
            print(f"  Transcribing...")
            segments_gen, info = model.transcribe(str(audio_file), beam_size=5)
            segments = list(segments_gen)

            data = {
                'video_id': vid_id,
                'title': record.get('title', ''),
                'yt_url': record.get('yt_url', ''),
                'source': f'whisper_{model_size}',
                'language': info.language,
                'fetched_at': datetime.now().isoformat(),
                'segments': [
                    {
                        'start': seg.start,
                        'duration': seg.end - seg.start,
                        'text': seg.text.strip(),
                        'text_edited': apply_edits(seg.text.strip()),
                    }
                    for seg in segments
                ]
            }
            out_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')

            # Update database
            for r in records:
                if r.get('yt_id') == vid_id:
                    r['transcript_status'] = f'whisper_{model_size}'
                    r['has_transcript'] = True

            print(f"  OK {len(segments)} segments - {info.language}")

            # Delete audio to save space
            audio_file.unlink(missing_ok=True)

        except Exception as e:
            print(f"  [!] Whisper failed: {e}")

    save_database(records)
    print("\nWhisper transcription complete.")

# ── Phase 4: Edit engine ───────────────────────────────────────────────────────

def phase_edit(video_id: str = None, dry_run: bool = False):
    """Apply edit rules to all transcripts (or one video)."""
    files = [RAW_DIR / f"{video_id}.json"] if video_id else sorted(RAW_DIR.glob("*.json"))
    files = [f for f in files if f.exists()]

    if not files:
        print("No transcript files found.")
        return

    print(f"Applying edits to {len(files)} transcripts {'(DRY RUN)' if dry_run else ''}...")
    edited_count = 0

    for fpath in files:
        data = json.loads(fpath.read_text(encoding='utf-8'))
        changed = False
        for seg in data.get('segments', []):
            new_text = apply_edits(seg['text'])
            if new_text != seg.get('text_edited', seg['text']):
                seg['text_edited'] = new_text
                changed = True

        if changed:
            edited_count += 1
            if not dry_run:
                fpath.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
            print(f"  {'[DRY] ' if dry_run else ''}Edited: {fpath.name}")

    print(f"Done: {edited_count}/{len(files)} files updated.")

def export_srt(video_id: str) -> str:
    """Export a transcript as .srt subtitle file."""
    fpath = RAW_DIR / f"{video_id}.json"
    if not fpath.exists():
        return f"No transcript for {video_id}"

    data = json.loads(fpath.read_text(encoding='utf-8'))
    segments = data.get('segments', [])
    lines = []
    for i, seg in enumerate(segments, 1):
        start = fmt_time(seg['start']).replace('.', ',')
        end   = fmt_time(seg['start'] + seg.get('duration', 2)).replace('.', ',')
        text  = seg.get('text_edited', seg['text'])
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")

    out = PROCESSED / f"{video_id}.srt"
    out.write_text('\n'.join(lines), encoding='utf-8')
    return str(out)

def export_plaintext(video_id: str, edited: bool = True) -> str:
    """Export a transcript as clean plaintext."""
    fpath = RAW_DIR / f"{video_id}.json"
    if not fpath.exists():
        return ""

    data = json.loads(fpath.read_text(encoding='utf-8'))
    field = 'text_edited' if edited else 'text'
    parts = [seg.get(field, seg['text']) for seg in data.get('segments', [])]
    return ' '.join(parts)

# ── Phase 5: Status dashboard ──────────────────────────────────────────────────

def phase_status():
    records = load_database()
    published = [r for r in records if r.get('yt_id')]
    fetched = [r for r in published if (RAW_DIR / f"{r['yt_id']}.json").exists()]
    auto    = [r for r in fetched if 'auto' in str(r.get('transcript_status',''))]
    manual  = [r for r in fetched if 'manual' in str(r.get('transcript_status',''))]
    whisper = [r for r in fetched if 'whisper' in str(r.get('transcript_status',''))]
    missing = [r for r in published if not (RAW_DIR / f"{r['yt_id']}.json").exists()]

    print("\n" + "="*50)
    print("  TRANSCRIPT ENGINE - COVERAGE DASHBOARD")
    print("="*50)
    print(f"  Total DB records:      {len(records)}")
    print(f"  Published (have URL):  {len(published)}")
    print(f"  Transcripts fetched:   {len(fetched)}")
    print(f"    Auto-generated:      {len(auto)}")
    print(f"    Manual captions:     {len(manual)}")
    print(f"    Whisper (local):     {len(whisper)}")
    print(f"  Still missing:         {len(missing)}")
    coverage = len(fetched) / len(published) * 100 if published else 0
    print(f"  Coverage:              {coverage:.1f}%")
    print("="*50)

    if missing:
        print(f"\n  Missing ({len(missing)} videos):")
        for r in missing[:20]:
            t_safe = r.get('title','')[:50].encode('ascii', errors='replace').decode('ascii')
            print(f"    {r.get('yt_id','')} - {t_safe}")
        if len(missing) > 20:
            print(f"    ... and {len(missing)-20} more")

    # Top by views
    with_views = sorted([r for r in fetched if r.get('views')], key=lambda x: x['views'], reverse=True)
    if with_views:
        print("\n  Top transcribed by views:")
        for r in with_views[:5]:
            t_safe = r.get('title','')[:45].encode('ascii', errors='replace').decode('ascii')
            print(f"    {r['views']:>8,} - {t_safe}")

# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'status'
    arg = sys.argv[2] if len(sys.argv) > 2 else None

    if cmd == 'channel':
        phase_channel()
    elif cmd == 'fetch':
        phase_fetch(target_id=arg)
    elif cmd == 'whisper':
        model = arg or 'base'
        phase_whisper(model_size=model)
    elif cmd == 'edit':
        phase_edit(video_id=arg)
    elif cmd == 'edit-dry':
        phase_edit(video_id=arg, dry_run=True)
    elif cmd == 'export-srt':
        if arg:
            print(export_srt(arg))
        else:
            print("Usage: transcript_engine.py export-srt VIDEO_ID")
    elif cmd == 'status':
        phase_status()
    else:
        print(__doc__)
