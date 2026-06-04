#!/usr/bin/env python3
"""
book_import.py — Angel OS Library: modular book-import engine.

Rule-of-53 design: not a WDEG one-off. A small pipeline —

    SOURCE ADAPTER  -->  normalized Book  -->  SINK

so importing the next work (Ready Player Everyone, anyone's book) means writing a
new adapter, not a new script. The reader (components/Library/BookReader) is
source-agnostic: it renders a manifest, whether that manifest came from static
page images today or the message store tomorrow.

NORMALIZED MODEL
  Book  { slug, title, subtitle, pages: [Page] }
  Page  { order, title?, image?, caption?, markdown? }

ADAPTERS (pluggable)
  WdegImageAdapter   — a directory of page_NNN.png images + optional alt/caption

SINKS (pluggable)
  StaticAssetSink    — web-optimize images (ffmpeg) into public/library/<slug>/
                       and emit manifest.json   (zero DB; CDN/offline friendly)
  DryRunSink         — print the plan, write nothing
  (future) MessagesSink — channel + one message per page (the message-backed path)

USAGE
  python book_import.py wdeg --sink static   # optimize + write manifest
  python book_import.py wdeg --sink dryrun    # show the plan only
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ANGELS = Path(__file__).resolve().parents[2]          # angels-os/
PUBLIC_LIBRARY = ANGELS / "public" / "library"
WDEG_SRC = Path("C:/Dev/wdeg/public/wdeg/images")
WDEG_MEDIA_JSON = Path("C:/Dev/wdeg/extracted-content/media-raw.json")

WEB_WIDTH = 1600       # px — readable on any device, ~10x smaller than source
WEBP_QUALITY = 82


# ── Normalized model ──────────────────────────────────────────────────────────
class Page:
    def __init__(self, order, image=None, title=None, caption=None, markdown=None):
        self.order = order
        self.image = image          # source path (pre-optimization)
        self.title = title
        self.caption = caption
        self.markdown = markdown


class Book:
    def __init__(self, slug, title, subtitle=None):
        self.slug = slug
        self.title = title
        self.subtitle = subtitle
        self.pages = []


# ── Source adapters ───────────────────────────────────────────────────────────
class WdegImageAdapter:
    """Where Did Everyone Go — a directory of page_NNN.png images."""

    slug = "wdeg"

    def load(self) -> Book:
        book = Book("wdeg", "Where Did Everyone Go")
        # captions from the WDEG media export (alt text), if present
        captions = {}
        if WDEG_MEDIA_JSON.exists():
            try:
                data = json.loads(WDEG_MEDIA_JSON.read_text(encoding="utf-8"))
                items = data if isinstance(data, list) else (data.get("docs") or [])
                for r in items:
                    fn = r.get("filename") or ""
                    m = re.search(r"page[_-]?(\d+)", fn, re.I)
                    if m:
                        captions[int(m.group(1))] = r.get("alt") or None
            except Exception:
                pass

        imgs = sorted(WDEG_SRC.glob("page_*.png"))
        for img in imgs:
            m = re.search(r"page[_-]?(\d+)", img.name, re.I)
            if not m:
                continue
            n = int(m.group(1))
            book.pages.append(Page(order=n, image=img, caption=captions.get(n)))
        book.pages.sort(key=lambda p: p.order)
        return book


ADAPTERS = {"wdeg": WdegImageAdapter}


# ── Sinks ─────────────────────────────────────────────────────────────────────
def _have_ffmpeg() -> bool:
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


class StaticAssetSink:
    """Optimize page images to webp + emit a manifest the BookReader consumes."""

    def emit(self, book: Book):
        if not _have_ffmpeg():
            print("[!] ffmpeg not found — required for image optimization.")
            sys.exit(1)
        out_dir = PUBLIC_LIBRARY / book.slug
        out_dir.mkdir(parents=True, exist_ok=True)

        manifest_pages = []
        for i, p in enumerate(book.pages, 1):
            web_name = f"page_{p.order:03d}.webp"
            web_path = out_dir / web_name
            if p.image and not web_path.exists():
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-i", str(p.image),
                     "-vf", f"scale={WEB_WIDTH}:-1:flags=lanczos",
                     "-quality", str(WEBP_QUALITY),
                     str(web_path)],
                    check=True,
                )
            kb = web_path.stat().st_size // 1024 if web_path.exists() else 0
            manifest_pages.append({
                "order": p.order,
                "image": f"/library/{book.slug}/{web_name}",
                **({"caption": p.caption} if p.caption else {}),
                **({"title": p.title} if p.title else {}),
                **({"markdown": p.markdown} if p.markdown else {}),
            })
            print(f"  page {p.order:>3}  ->  {web_name}  ({kb} KB)")

        manifest = {
            "slug": book.slug,
            "title": book.title,
            "subtitle": book.subtitle,
            "pageCount": len(manifest_pages),
            "pages": manifest_pages,
        }
        (out_dir / "manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        total_kb = sum(
            (out_dir / f"page_{p['order']:03d}.webp").stat().st_size
            for p in manifest_pages
            if (out_dir / f"page_{p['order']:03d}.webp").exists()
        ) // 1024
        print(f"\nWrote {len(manifest_pages)} pages + manifest.json -> {out_dir}")
        print(f"Total optimized size: {total_kb} KB ({total_kb/1024:.1f} MB)")


class DryRunSink:
    def emit(self, book: Book):
        print(f"[DRY RUN] Book: {book.title} (slug={book.slug}) — {len(book.pages)} pages")
        for p in book.pages:
            cap = f"  | {p.caption}" if p.caption else ""
            print(f"  page {p.order:>3}  {p.image.name if p.image else ''}{cap}")
        print("\n(no files written)")


SINKS = {"static": StaticAssetSink, "dryrun": DryRunSink}


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ADAPTERS:
        print(__doc__)
        print("Available books:", ", ".join(ADAPTERS))
        sys.exit(0)
    book_key = sys.argv[1]
    sink_key = "static"
    if "--sink" in sys.argv:
        sink_key = sys.argv[sys.argv.index("--sink") + 1]
    if sink_key not in SINKS:
        print(f"[!] Unknown sink '{sink_key}'. Choices: {', '.join(SINKS)}")
        sys.exit(1)

    book = ADAPTERS[book_key]().load()
    print(f"Loaded '{book.title}' — {len(book.pages)} pages. Sink: {sink_key}\n")
    SINKS[sink_key]().emit(book)
