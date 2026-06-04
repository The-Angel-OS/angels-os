#!/usr/bin/env python3
"""
book_import.py — Angel OS Library: modular book-import engine.

Rule-of-53 design: not a WDEG one-off. A small pipeline —

    SOURCE ADAPTER  -->  normalized Book  -->  SINK

so importing the next work means writing a new adapter, not a new script. The
reader (components/Library/BookReader) is source-agnostic: it renders a manifest
+ per-language text, whether that came from static files today or the message
store tomorrow.

NORMALIZED MODEL
  Book  { slug, title, subtitle, languages[], pages: [Page] }
  Page  { order, image, texts: {langCode: str} }

ADAPTERS (pluggable)
  WdegAdapter — page_NNN images + per-language plain-text (public/wdeg/<lang>/NNN.txt)

SINKS (pluggable)
  StaticAssetSink — web-optimize images (ffmpeg) -> public/library/<slug>/,
                    emit manifest.json (pages+languages) + text/<lang>.json
  DryRunSink      — print the plan, write nothing

USAGE
  python book_import.py wdeg --sink static
  python book_import.py wdeg --sink dryrun
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ANGELS = Path(__file__).resolve().parents[2]
PUBLIC_LIBRARY = ANGELS / "public" / "library"
WDEG_BASE = Path("C:/Dev/wdeg/public/wdeg")
WDEG_IMAGES = WDEG_BASE / "images"
WDEG_MEDIA_JSON = Path("C:/Dev/wdeg/extracted-content/media-raw.json")

WEB_WIDTH = 1600
WEBP_QUALITY = 82

LANG_NAMES = {
    "en": "English", "es": "Español", "fr": "Français", "de": "Deutsch",
    "it": "Italiano", "pt": "Português", "nl": "Nederlands", "pl": "Polski",
    "sv": "Svenska", "ru": "Русский", "ar": "العربية", "he": "עברית",
    "ur": "اردو", "hi": "हिन्दी", "zh": "中文", "ja": "日本語", "ko": "한국어",
}
RTL = {"ar", "he", "ur"}


class Page:
    def __init__(self, order, image=None):
        self.order = order
        self.image = image
        self.texts = {}          # langCode -> text


class Book:
    def __init__(self, slug, title, subtitle=None):
        self.slug = slug
        self.title = title
        self.subtitle = subtitle
        self.languages = []      # list of lang codes, en first
        self.pages = []


# ── Source adapters ───────────────────────────────────────────────────────────
class WdegAdapter:
    slug = "wdeg"

    def load(self) -> Book:
        book = Book("wdeg", "Where Did Everyone Go")

        # Pages come from the extracted page images (page_NNN.png).
        src_imgs = Path("C:/Dev/wdeg/public/wdeg/images")
        imgs = sorted(Path("C:/Dev/wdeg").glob("public/wdeg/images/page_*.png")) or \
            sorted((ANGELS / "public" / "library" / "wdeg").glob("page_*.webp"))
        # Prefer the high-res extracted PNGs if present.
        png_dir = Path("C:/Dev/wdeg")
        extracted = sorted((Path("C:/Dev/wdeg/public/wdeg/images")).glob("page_*.png"))
        if not extracted:
            extracted = sorted(Path("C:/Dev/wdeg/public/wdeg/images").glob("page*.png"))

        # We standardize on the 26 extracted page_NNN.png used previously.
        wdeg_extracted = sorted(Path("C:/Dev/wdeg/public/wdeg/images").glob("page_*.png"))
        page_imgs = wdeg_extracted or sorted(
            Path("C:/Dev/wdeg/public/wdeg/images").glob("page_0*.png"))
        # Fallback to the project public source already optimized
        if not page_imgs:
            page_imgs = sorted((Path("C:/Dev/wdeg/public/wdeg/images")).glob("page*.jpg"))

        for img in page_imgs:
            m = re.search(r"(\d+)", img.name)
            if not m:
                continue
            book.pages.append(Page(order=int(m.group(1)), image=img))
        book.pages.sort(key=lambda p: p.order)

        # Languages: every <lang>/ folder that has NNN.txt files.
        langs = []
        for d in sorted(WDEG_BASE.iterdir()):
            if d.is_dir() and list(d.glob("[0-9][0-9][0-9].txt")):
                langs.append(d.name)
        # English first, then the rest.
        langs = (["en"] if "en" in langs else []) + [l for l in langs if l != "en"]
        book.languages = langs

        # Per-page text for each language.
        for p in book.pages:
            for lang in langs:
                f = WDEG_BASE / lang / f"{p.order:03d}.txt"
                if f.exists():
                    p.texts[lang] = f.read_text(encoding="utf-8").strip()
        return book


ADAPTERS = {"wdeg": WdegAdapter}


# ── Sinks ─────────────────────────────────────────────────────────────────────
def _have_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


class StaticAssetSink:
    def emit(self, book: Book):
        if not _have_ffmpeg():
            print("[!] ffmpeg not found — required for image optimization.")
            sys.exit(1)
        out_dir = PUBLIC_LIBRARY / book.slug
        text_dir = out_dir / "text"
        out_dir.mkdir(parents=True, exist_ok=True)
        text_dir.mkdir(parents=True, exist_ok=True)

        # Optimize images + build page list.
        manifest_pages = []
        for p in book.pages:
            web_name = f"page_{p.order:03d}.webp"
            web_path = out_dir / web_name
            if p.image and not web_path.exists():
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-i", str(p.image),
                     "-vf", f"scale={WEB_WIDTH}:-1:flags=lanczos",
                     "-quality", str(WEBP_QUALITY), str(web_path)],
                    check=True,
                )
            manifest_pages.append({"order": p.order, "image": f"/library/{book.slug}/{web_name}"})

        # Per-language text files: text/<lang>.json -> { "<order>": "text" }
        for lang in book.languages:
            payload = {str(p.order): p.texts.get(lang, "") for p in book.pages}
            (text_dir / f"{lang}.json").write_text(
                json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")

        manifest = {
            "slug": book.slug,
            "title": book.title,
            "subtitle": book.subtitle,
            "pageCount": len(manifest_pages),
            "languages": [
                {"code": c, "name": LANG_NAMES.get(c, c.upper()), "rtl": c in RTL}
                for c in book.languages
            ],
            "defaultLanguage": "en" if "en" in book.languages else (book.languages[0] if book.languages else "en"),
            "textBase": f"/library/{book.slug}/text",
            "pages": manifest_pages,
        }
        (out_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {len(manifest_pages)} pages, {len(book.languages)} languages -> {out_dir}")
        print("Languages:", ", ".join(book.languages))


class DryRunSink:
    def emit(self, book: Book):
        print(f"[DRY RUN] {book.title} — {len(book.pages)} pages, {len(book.languages)} languages")
        print("Languages:", ", ".join(book.languages))
        for p in book.pages[:5]:
            have = "".join("✓" if l in p.texts else "·" for l in book.languages)
            print(f"  page {p.order:>3}  {p.image.name if p.image else '':<16} text[{have}]")
        print("  ...")


SINKS = {"static": StaticAssetSink, "dryrun": DryRunSink}


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ADAPTERS:
        print(__doc__)
        print("Available books:", ", ".join(ADAPTERS))
        sys.exit(0)
    sink_key = "static"
    if "--sink" in sys.argv:
        sink_key = sys.argv[sys.argv.index("--sink") + 1]
    if sink_key not in SINKS:
        print(f"[!] Unknown sink '{sink_key}'. Choices: {', '.join(SINKS)}")
        sys.exit(1)
    book = ADAPTERS[sys.argv[1]]().load()
    print(f"Loaded '{book.title}' — {len(book.pages)} pages, {len(book.languages)} langs. Sink: {sink_key}\n")
    SINKS[sink_key]().emit(book)
