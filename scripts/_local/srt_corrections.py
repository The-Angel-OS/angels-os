#!/usr/bin/env python3
"""
srt_corrections.py — Clearwater Cruisin' caption correction module + CLI.

Two jobs:
  1. correct_text(s)      — de-glue concatenated words + apply the project
                            brand/placename/Trek dictionary. Voice-preserving.
  2. fix_srt_file(path)   — read an .srt, correct every cue's text, write it back
                            with cue numbers + timestamps preserved EXACTLY so it
                            stays frame-synced to the video.

This is imported by transcript_engine.py (shared dictionary) and also runs
standalone so you can fix a Whisper .srt by hand-feeding it:

    python srt_corrections.py "path/to/file.srt"           # fix in place
    python srt_corrections.py "path/to/file.srt" --dry      # preview, no write
    python srt_corrections.py "path/to/file.srt" -o out.srt # write elsewhere

DESIGN NOTES
  - De-glue inserts a space at lowercase->Uppercase boundaries (the
    "youHolding" artifact from word-timestamp SRTs exported without spaces),
    then RE-GLUES a protected list of legitimate camelCase tokens
    (YouTube, iSteady, ...) so we don't shatter them.
  - The dictionary is applied AFTER de-glue, ordered, case-insensitive where
    safe. Earlier entries win.
  - We never invent words. Ambiguous audio is left alone — this is a
    normalizer, not a rewriter.
"""

import re
import sys
from pathlib import Path

try:
    import wordninja
    _HAVE_NINJA = True
except ImportError:
    _HAVE_NINJA = False

# A small set of real words/tokens we never want segmented apart.
_KEEP_WHOLE = {
    "didnt", "dont", "cant", "wont", "isnt", "wasnt", "im", "ive", "id",
    "youre", "youve", "thats", "hes", "shes", "theyre", "weve", "gonna",
    "wanna", "gotta", "ok", "okay",
}

# ── Protected camelCase tokens (must survive de-glue) ─────────────────────────
# After we split lower->Upper boundaries, these get stitched back together.
PROTECTED = [
    "YouTube", "YouTuber", "iSteady", "iPhone", "iPad", "macOS", "iOS",
    "AngelOS",  # handled separately -> "Angel OS"
]

# ── Project dictionary (brand / place / people / Trek / tech) ─────────────────
# (pattern, replacement, flags). Applied in order.
EDIT_RULES = [
    # ── Pinellas place names ──
    (r'\bdunedin\b', 'Dunedin', re.IGNORECASE),
    (r'\bduneden\b', 'Dunedin', re.IGNORECASE),
    (r'\bdunadin\b', 'Dunedin', re.IGNORECASE),
    (r'\bdunned in\b', 'Dunedin', re.IGNORECASE),
    (r"\bdon't need\b(?=.{0,20}marina)", 'Dunedin', re.IGNORECASE),  # ASR: "don't Need and Marina"
    (r'\bclearwater\b', 'Clearwater', re.IGNORECASE),
    (r'\bpinellas\b', 'Pinellas', re.IGNORECASE),
    (r'\bsafety harbor\b', 'Safety Harbor', re.IGNORECASE),
    (r'\bpalm harbor\b', 'Palm Harbor', re.IGNORECASE),
    (r'\btarpon springs\b', 'Tarpon Springs', re.IGNORECASE),
    (r'\blake tarpon\b', 'Lake Tarpon', re.IGNORECASE),
    (r'\bhoneymoon island\b', 'Honeymoon Island', re.IGNORECASE),
    (r'\bphilipp?e?\s+park\b', 'Philippe Park', re.IGNORECASE),
    (r'\bphillipe\b', 'Philippe', re.IGNORECASE),
    (r'\bphilippine\b', 'Philippe', re.IGNORECASE),   # ASR mishear of Philippe
    (r'\benterprise dog park\b', 'Enterprise Dog Park', re.IGNORECASE),
    (r'\blakeland\b', 'Lakeland', re.IGNORECASE),
    (r'\bbentonville\b', 'Bentonville', re.IGNORECASE),
    (r'\bour lady of clearwater\b', 'Our Lady of Clearwater', re.IGNORECASE),
    (r'\bst\.?\s*alfred[’\']?s?\b', "St. Alfred's", re.IGNORECASE),

    # ── People / animals ──
    (r'\bozzie\b', 'Ozzie', re.IGNORECASE),
    (r'\bdaisy\b', 'Daisy', re.IGNORECASE),
    (r'\bmika\b', 'Mika', re.IGNORECASE),
    (r'\btyler\b', 'Tyler', re.IGNORECASE),

    # ── Channel / brand / project ──
    (r'\bclear ?water cruis(?:ing|in|en)\b', "Clearwater Cruisin'", re.IGNORECASE),
    (r'\bangel ?os\b', 'Angel OS', re.IGNORECASE),
    (r'\banswer ?53\b', 'Answer 53', re.IGNORECASE),
    (r'\bspaces ?angels\b', 'spacesangels', re.IGNORECASE),

    # ── Consumer brands (caption-grade proper casing) ──
    (r'\bgreat value\b', 'Great Value', re.IGNORECASE),
    (r'\bvan ?camp[’\']?s?\b', "Van Camp's", re.IGNORECASE),
    (r'\bbeanie weenie?s?\b', 'beanie weenies', re.IGNORECASE),
    (r'\bone ?wheels?\b', 'Onewheel', re.IGNORECASE),     # board brand
    (r'\bcadillac cts\b', 'Cadillac CTS', re.IGNORECASE),
    (r'\blenovo legion\b', 'Lenovo Legion', re.IGNORECASE),
    (r'\bnetflix\b', 'Netflix', re.IGNORECASE),
    (r'\bwawa\b', 'Wawa', re.IGNORECASE),
    (r'\bwalmart\b', 'Walmart', re.IGNORECASE),
    (r'\bhp\b', 'HP', 0),  # keep uppercase only when already standalone token

    # ── Star Trek / lore ──
    (r'\baway team\b', 'away team', re.IGNORECASE),
    (r'\bweight team\b', 'away team', re.IGNORECASE),       # ASR mishear
    (r'\buss enterprise\b', 'USS Enterprise', re.IGNORECASE),
    (r'\bthe fifth element\b', 'the Fifth Element', re.IGNORECASE),

    # ── Tech / equipment ──
    (r'\bs\s*23\s*ultra\b', 'S23 Ultra', re.IGNORECASE),
    (r'\bs\s*23\b', 'S23', re.IGNORECASE),
    (r'\bhohem\b', 'Hohem', re.IGNORECASE),
    (r'\bisteady\b', 'iSteady', re.IGNORECASE),
    (r'\bnvenc\b', 'NVENC', re.IGNORECASE),

    # ── Military / Navy ──
    (r'\buss baton rouge\b', 'USS Baton Rouge', re.IGNORECASE),
    (r'\buss los angeles\b', 'USS Los Angeles', re.IGNORECASE),

    # ── Light filler cleanup (start of cue only — preserve voice elsewhere) ──
    (r'^(uh,?\s+)', '', re.IGNORECASE),
    (r'^(um,?\s+)', '', re.IGNORECASE),
]


def deglue(text: str) -> str:
    """Insert spaces at lowercase->Uppercase boundaries (concatenation artifact),
    then restore protected camelCase tokens. Conservative: only splits a
    lower->Upper transition, never touches ALLCAPS runs or Upper->lower."""
    # Split: a lowercase letter immediately followed by an uppercase letter.
    spaced = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', text)
    # Re-glue protected tokens that we may have split (e.g. "You Tube" -> "YouTube").
    for tok in PROTECTED:
        broken = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', tok)
        if broken != tok:
            spaced = re.sub(re.escape(broken), tok, spaced, flags=re.IGNORECASE)
    # Collapse any double spaces introduced.
    return re.sub(r'  +', ' ', spaced)


def segment_glued(text: str) -> str:
    """Aggressive de-glue for fully space-stripped runs ('youholding' ->
    'you holding'). Operates ONLY on long alphabetic tokens that are not already
    real words, preserving all surrounding punctuation, digits, and casing
    anchors. Requires wordninja; no-op if unavailable."""
    if not _HAVE_NINJA:
        return text

    def is_real_word(w: str) -> bool:
        lw = w.lower()
        if lw in _KEEP_WHOLE:
            return True
        # wordninja splitting a real word returns itself (length 1).
        return len(wordninja.split(lw)) == 1

    def fix_token(m: re.Match) -> str:
        tok = m.group(0)
        # Skip short tokens, ALLCAPS (acronyms), and tokens with internal caps
        # (already camelCase handled by deglue) or that are real words.
        core = tok
        if len(core) < 8 or core.isupper() or is_real_word(core):
            return tok
        if any(c.isupper() for c in core[1:]):
            return tok  # leave camelCase to deglue()
        parts = wordninja.split(core)
        if len(parts) <= 1:
            return tok
        # Preserve leading capital of the original token on the first part.
        if core[0].isupper():
            parts[0] = parts[0].capitalize()
        return ' '.join(parts)

    # Match alphabetic runs (with optional internal apostrophes).
    return re.sub(r"[A-Za-z][A-Za-z']*", fix_token, text)


def apply_dictionary(text: str) -> str:
    for pattern, replacement, flags in EDIT_RULES:
        text = re.sub(pattern, replacement, text, flags=flags)
    return text


def correct_text(text: str, do_deglue: bool = True, do_segment: bool = False) -> str:
    """Full correction pipeline (voice-preserving):
      1. deglue()        — split lower->Upper boundaries (sawDave -> saw Dave)
      2. segment_glued() — optional: split fully space-stripped runs (needs wordninja)
      3. dictionary      — brand/place/Trek proper-noun normalization
    """
    if do_deglue:
        text = deglue(text)
    if do_segment:
        text = segment_glued(text)
    text = apply_dictionary(text)
    # Normalize whitespace without touching cue structure.
    return re.sub(r'[ \t]+', ' ', text).strip()


# ── SRT parsing (cue numbers + timestamps preserved verbatim) ─────────────────
_TIMING = re.compile(r'^\d\d:\d\d:\d\d[,.]\d{3}\s*-->\s*\d\d:\d\d:\d\d[,.]\d{3}')


def fix_srt_file(path: Path, out: Path = None, do_deglue: bool = True,
                 do_segment: bool = False, dry: bool = False) -> dict:
    """Correct every cue's text block in an .srt, preserving indices/timestamps.
    Returns {cues, changed} stats."""
    raw = path.read_text(encoding='utf-8-sig')
    # Split into blocks on blank lines; a block = index / timing / text-lines.
    blocks = re.split(r'\r?\n\r?\n', raw.strip())
    out_blocks = []
    changed = 0
    for block in blocks:
        lines = block.splitlines()
        if len(lines) < 3 or not _TIMING.match(lines[1].strip()):
            out_blocks.append(block)  # passthrough anything non-standard
            continue
        idx, timing = lines[0], lines[1]
        text = ' '.join(l.strip() for l in lines[2:] if l.strip())
        fixed = correct_text(text, do_deglue=do_deglue, do_segment=do_segment)
        if fixed != text:
            changed += 1
        out_blocks.append(f"{idx}\n{timing}\n{fixed}")

    result = '\n\n'.join(out_blocks) + '\n'
    target = out or path
    if not dry:
        target.write_text(result, encoding='utf-8')
    return {'cues': len(out_blocks), 'changed': changed, 'target': str(target)}


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    args = [a for a in sys.argv[1:]]
    if not args:
        print(__doc__)
        sys.exit(0)
    dry = '--dry' in args
    no_deglue = '--no-deglue' in args
    do_segment = '--segment' in args   # aggressive: split fully-glued runs
    out = None
    if '-o' in args:
        out = Path(args[args.index('-o') + 1])
    src = Path(next(a for a in args if not a.startswith('-')
                    and a != (str(out) if out else None)))
    if not src.exists():
        print(f"[!] Not found: {src}")
        sys.exit(1)
    if do_segment and not _HAVE_NINJA:
        print("[!] --segment needs wordninja: pip install wordninja")
        sys.exit(1)
    stats = fix_srt_file(src, out=out, do_deglue=not no_deglue,
                         do_segment=do_segment, dry=dry)
    tag = '[DRY] ' if dry else ''
    print(f"{tag}{src.name}: {stats['changed']}/{stats['cues']} cues corrected "
          f"-> {stats['target']}")
