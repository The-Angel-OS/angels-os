# Kessela conformance to www.kessela.com

Tenant **30** (`kessela`), live at `kessela.spacesangels.com`. Target: mirror the
WordPress original as closely as possible. Ken, 260813 — David C has not come
back on this, so mirror rather than redesign.

Measured 260813. Re-verify before trusting.

## Done

- **Header** — was 5 abbreviated items, two pointing somewhere other than the
  original (`/posts` and `/products/kessela-elite-belt`). Both resolved, so this
  was fidelity, not breakage. Now the reference's 4, with full labels, pointing at
  the mirrored pages:
  How to Use the Belt · Results & Testimonials · Studies & Blog · Buy Kessela Now!
- **Footer** — was 4 links, reference has 12. `navItems` is capped at 6, so the
  full set went into `navGroups` (columns), which is what that field is for:
  **Explore** (5) · **Support** (5) · **Legal** (2).

Applied live via `src/scripts/_local/kessela-nav-conform.ts`.

## Page inventory

All 27 pages exist. Every nav target returns 200. **Six are still `draft`** and
appear on the original under Studies & Blog:

| id | slug |
|---|---|
| 105 | what-advanced-science-studies-from-harvard-stanford… |
| 106 | science-research-on-the-ability-of-red-light-therapy…cellulite… |
| 107 | hydration-101-extremely-important-for-pbm |
| 109 | medical-studies-prove-pbm-can-help-eliminate-fat |
| 110 | led-light-therapy-clinically-proven-to-reduce-waist-hip-and-thigh… |
| 111 | studies-show-additional-weight-loss-benefits-with-red-light-therapy |

Publishing them is a one-line change **once someone confirms the content is
finished** — they may be drafts on purpose. Ask before publishing; these make
medical claims.

Also present and not on the original: `112 brief` ("Where we are — Kenneth") and
`113 pelvic-floor`. Working pages — decide whether they stay published.

## The homepage gap — the main remaining work

The reference homepage has **9 sections in order**:

1. Hero — "Kessela Elite Core-Contouring Belt", red light + EMS
2. Usage scenarios — three subsections (during workouts / relaxing / fat + tone)
3. Product description — NIR + RLT reduce fat while EMS builds muscle
4. Features — 10 min/day, intensity 1–9, "Each 10 minute session is equal to 300 sit-ups", hands-free
5. Technology breakdown — two columns: Red & Near Infrared Light (SMD) | Electrical Muscle Stimulation (four abdominal groups)
6. CTA — **"Lighten Your Workout Load, Electrify Your Results!"**, button **"Purchase today"**, one-year warranty
7. FAQ — 5–6 expandable questions
8. Results & Testimonials teaser — "See the amazing results!"
9. Trust badges — BBB A+ · 14-Day Money-Back · Warranty Guarantee · FDA Registered (Class II)

Our home (page **87**) is `11 × content`, `1 × trust_row`, `1 × showcase`. So the
content is largely there but flattened into generic content blocks, and **two
sections have no structural equivalent at all**:

- **No `faq` block on home.** The block exists and is already used on
  `buy-kessela-now` — it just isn't on the homepage.
- **No `cta` block on home.** Same: exists, used on `buy-kessela-now`, absent here.
- Section 5 (two-column technology) wants `media_text` or a two-column `content`;
  currently flat.
- Section 2 (three usage scenarios) wants `three_item_grid`; currently flat.

Trust badges are already a `trust_row` — check it carries the reference's four
badges.

### FAQ copy, verbatim from the original

1. **WHAT DOES A TREATMENT FEEL LIKE?** — "Users may experience a gentle warmth,
   which is emitted by the therapeutic LEDs, as well as a slight tingling and
   tightness from the EMS electrodes."
2. **HOW OFTEN SHOULD I USE THE KESSELA PHYSIQUE?** — "We recommend consistent
   daily use for the best results. For beginners, use the Kessela Physique once
   daily on the Electrical Muscle Stimulation (EMS) boost setting for 2-10 minute
   sessions."
3. **WILL THE KESSELA PHYSIQUE FIT MY WAIST?** — "The Kessela Physique comes in
   one size with a belt measurement of 26 inches to 45 inches (66cm to 114cm)."
4. **IS IT SAFE TO USE?** — "The Kessela Physique utilizes only clinically proven
   technology that has been shown to be safe and non invasive."
5. **HOW DO I USE THE ELECTRODE GEL WITH THE KESSELA PHYSIQUE?** — "The Electrode
   Gel ensures a safe passage of the electrodes to the body and should be applied
   with every use."

⚠️ The original names the product **"Kessela Physique"** in the FAQ while the hero
says **"Kessela Elite Core-Contouring Belt"**. Mirror the original's wording
rather than normalising it — ask Ken before "fixing" the inconsistency.

## Blocks in use across the tenant

`content` 229 · `trust_row` 22 · `faq` 3 · `showcase` 1 · `media_text` 1 ·
`cta` 1 · `product_panel` 1 · `form_block` 1

The lopsidedness is the story: 229 generic content blocks doing work that typed
blocks (`faq`, `cta`, `three_item_grid`, `media_text`) would do with the right
structure and styling. That is what "50–75% through matching blocks" means in
practice — the words are migrated, the structure mostly isn't.

## Suggested order

1. Homepage `faq` block (copy above) — highest visible fidelity, content in hand.
2. Homepage `cta` block — headline and button text in hand.
3. Section 5 → `media_text` two-column; section 2 → `three_item_grid`.
4. Verify `trust_row` on home carries all four badges.
5. Ask about the six drafts and the two extra pages.
6. Sweep the remaining pages for the same content-block-flattening.

Agent handing this off: [RUNBOOK_OPENCODE.md](RUNBOOK_OPENCODE.md) is the how —
ops endpoints, the idempotent script skeleton, and what to escalate rather than
guess (the six drafts above are an escalation, not a task).
