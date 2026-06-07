#!/usr/bin/env python3
"""Generate the Clearwater Cruisin' business-card BACK as a print-ready SVG
with a QR code to the site. 3.5x2in @ 300dpi (1050x600) + retro Florida vibe."""
import base64
import io
import segno

URL = "https://clearwater-cruisin.spacesangels.com/"
OUT = r"C:/Users/kenne/Downloads/clearwater_cruisin_card_back.svg"

# ── QR (high error correction so a logo/quiet-zone is robust) ────────────────
qr = segno.make(URL, error="h")
buf = io.BytesIO()
qr.save(buf, kind="png", scale=16, border=2, dark="#0e4f57", light="#ffffff")
qr_b64 = base64.b64encode(buf.getvalue()).decode()

# ── Palette (matches the front card) ─────────────────────────────────────────
CREAM = "#f3ead7"
TEAL = "#2a8f96"
TEAL_DK = "#0e4f57"
GOLD = "#e0a73c"
INK = "#2b2b2b"

W, H = 1050, 600

svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fcdd6"/>
      <stop offset="0.55" stop-color="#a9dde0"/>
      <stop offset="1" stop-color="{CREAM}"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#ffe7a8"/>
      <stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="band" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{TEAL}"/>
      <stop offset="1" stop-color="{GOLD}"/>
    </linearGradient>
  </defs>

  <!-- background -->
  <rect width="{W}" height="{H}" fill="url(#sky)"/>
  <rect width="{W}" height="{H}" fill="url(#sun)"/>

  <!-- sunburst rays -->
  <g transform="translate({W/2},170)" opacity="0.18">
    {''.join(f'<polygon points="0,0 {-26+i*0} -700 {26} -700" transform="rotate({a})" fill="{GOLD if i%2 else TEAL}"/>' for i,a in enumerate(range(-90,91,12)))}
  </g>

  <!-- palm silhouettes -->
  <g fill="{TEAL_DK}" opacity="0.85">
    <g transform="translate(70,300) scale(1.0)">
      <rect x="-4" y="-120" width="8" height="120"/>
      <path d="M0,-120 C-40,-150 -80,-150 -110,-130 C-78,-138 -42,-130 0,-120Z"/>
      <path d="M0,-120 C40,-150 80,-150 110,-130 C78,-138 42,-130 0,-120Z"/>
      <path d="M0,-122 C-20,-165 -10,-200 10,-220 C-2,-185 -6,-150 0,-122Z"/>
      <path d="M0,-120 C24,-160 60,-178 92,-178 C58,-170 26,-150 0,-120Z"/>
    </g>
    <g transform="translate(150,330) scale(0.8)">
      <rect x="-4" y="-120" width="8" height="120"/>
      <path d="M0,-120 C-40,-150 -80,-150 -110,-130 C-78,-138 -42,-130 0,-120Z"/>
      <path d="M0,-120 C40,-150 80,-150 110,-130 C78,-138 42,-130 0,-120Z"/>
      <path d="M0,-122 C-20,-165 -10,-200 10,-220 C-2,-185 -6,-150 0,-122Z"/>
    </g>
  </g>

  <!-- title -->
  <text x="{W/2}" y="120" text-anchor="middle"
        font-family="'Brush Script MT','Segoe Script','Pacifico',cursive"
        font-size="86" fill="{TEAL_DK}">Clearwater Cruisin'</text>
  <text x="{W/2}" y="168" text-anchor="middle"
        font-family="'Trebuchet MS',Arial,sans-serif" font-size="26"
        letter-spacing="5" fill="{GOLD}">PRESSURE WASHING &#183; SOUL QUEST</text>

  <!-- QR card -->
  <g transform="translate({W/2-95},205)">
    <rect x="-14" y="-14" width="218" height="218" rx="18" fill="#ffffff" stroke="{TEAL}" stroke-width="3"/>
    <image x="0" y="0" width="190" height="190" href="data:image/png;base64,{qr_b64}"/>
  </g>
  <text x="{W/2}" y="448" text-anchor="middle"
        font-family="'Trebuchet MS',Arial,sans-serif" font-weight="bold"
        font-size="24" letter-spacing="3" fill="{TEAL_DK}">SCAN TO CRUISE WITH US</text>

  <!-- contact band -->
  <rect x="0" y="486" width="{W}" height="6" fill="url(#band)"/>
  <g font-family="'Trebuchet MS',Arial,sans-serif" fill="{INK}" text-anchor="middle">
    <text x="{W/2}" y="528" font-size="26" font-weight="bold">727-256-4413 &#160;&#8226;&#160; clearwatercruisin@gmail.com</text>
    <text x="{W/2}" y="562" font-size="24" fill="{TEAL_DK}">clearwater-cruisin.spacesangels.com</text>
    <text x="{W/2}" y="590" font-size="16" letter-spacing="2" fill="{GOLD}">CLEARWATER CRUISIN' MINISTRIES &#183; with Max and Ty</text>
  </g>
</svg>'''

with open(OUT, "w", encoding="utf-8") as f:
    f.write(svg)
print("wrote", OUT)
print("QR ->", URL)
