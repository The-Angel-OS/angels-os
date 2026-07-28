# Continuation — Kessela, and what this session learned

> Written 260728 ~13:50, superseding `CONTINUATION_260727.md`.
> Read `docs/FOOTGUNS.md` first; this assumes it. **§0 is time-critical.**
>
> This thread is memorialised at
> [Google Docs](https://docs.google.com/document/d/1n_dcEjPxP4-0atc7OtoYfcwwBSmNtBWzSgqzg1uXZ5A/edit?usp=sharing).
>
> Prefix and suffix replies `YYMMDD ~HHMM CITO —`.

---

## 0. TOMORROW, 09:00 — David's office. He is sending an Uber.

Kenneth is ~8–12 miles south. David is up from 06:00 and said to contact any time
after. **Kenneth moves house on Friday**, and his van is in the shop waiting on a
Passlock module (eBay, FedEx overnight, order 02-14967-46358) — so tomorrow is the
window.

**The agenda is [`docs/kessela/ACCOUNTS_SETUP.md`](kessela/ACCOUNTS_SETUP.md).**
Two items come before the rest:

1. **Stripe Connect for Kessela.** The tenant has NO connected account
   (`stripeAccountId: null`), so today every sale lands in Kenneth's Stripe, not
   David's. His name is not on the receipt and the agreed 10% cannot be collected.
   Ten minutes.
2. **Start Meta business verification** — days of waiting, outside anyone's control.

**Card protocol, agreed and written into the doc:** accounts created with David's
email as owner, Kenneth fills everything up to the billing step, **David types the
card**. Not a trust question — there must never be a version of this where Kenneth
handled a client's card.

### Two things to have ready before 09:00

**(a) An image on the site is NOT their product.** David, live on the call:
*"This picture that's on the screen, that's not our product. Who is that?"* —
Kenneth: *"I pulled that off of your website."* — David: *"I've never seen it
before."* It is most likely a showcase card, a study thumbnail, or a hero. **Ask
Kenneth which screen he was sharing, then remove it.** Do not guess and delete.

**(b) His actual ad-spend question, which is about CASH FLOW, not the number:**
> *"you said it's going to cost you 100 plus dollars for each sale. What does that
> look like? When do we evaluate it? Do I pay all the money?"*

He is asking when he spends, when he learns whether it worked, and whether he is
committing the whole budget up front. The answer: a small named test, a kill rule
written before a dollar moves, evaluated inside a week, and no — he does not
commit it all. **This is the condition on his approval and the one thing he asked
for by name.**

---

## 1. The deal, and where the relationship actually is

$600 for one week, **10% of everything sold**, approved 260727 — conditional on
the ad-spend plan. 2,500 units. His maths: 1,000 units at $400 = $40k to Kenneth.

**Four things moved since:**

- **He refused landed cost, and was right to.** *"I'm not sure what you're
  doing."* He was not being secretive — he thought the question was backwards. An
  owner expects to be TOLD what it costs to sell one. **Do not re-ask.** The
  replacement: *what do you want to clear per belt?* Everything else is
  subtraction.
- **He conceded the arithmetic** — *"if there's an ROI your numbers work"* — and
  volunteered "$100 a unit" himself, so the CAC frame landed by another route.
- **He asked for STRATEGY, not numbers.** *"the strategy is what matters to me and
  seems to determine the outcome."* Others have tried to sell this and failed;
  that is the question behind every other question.
- **He agreed $599 holds, and went further than we did:** *"We do promotions, we
  don't sell any more units, all we're doing is giving up profit."* **Pricing is
  closed. No discounts, no promos.**

### He handed over the positioning himself — use his sentence

> *"there's toys and then there's Kessela. One is a real medical device. The other
> is an internet toy trying to reach in your pocket."*

Better than anything we wrote, and unarguable coming back from him.

### The strategy, in one line

**Same product, same price, different aisle.** Fat loss puts a $599 belt beside a
$99 one and Meta bans the only imagery that would separate them. Pelvic floor puts
it beside $150-a-session physio, where $599 reads as *cheap*. Full argument in
[`PLAN_260727.md`](kessela/PLAN_260727.md) §3.4.

⚠️ **He was initially taken aback** at leading with incontinence on the same site.
That is why §14's answer is one tenant, two front doors — his existing site does
not change.

### A claims fact he gave unprompted

> *"on their thighs, their legs and their buttocks. Wherever the pad will fit, you
> can place it. It's designed for core, but that does not mean it can't be used
> anywhere else on the body."*

And: **when making certain claims, attribute them to NeuroCare Pro** — that is the
branding/source he wants behind a claim.

---

## 2. Claims — the approach that finally worked

**Stop asking for a list. Propose the words.**

[`docs/kessela/CLAIMS_SIGNOFF.md`](kessela/CLAIMS_SIGNOFF.md) — six written
sentences (B1–B6) he initials or strikes, plus two facts only he has. Two days of
asking for "a list of claims" produced nothing; a tick-box took him thirty seconds
to engage with. He reviewed the language and came back agreeing it needs care.

**The goal Kenneth stated: iterate on this with LEO.** The wording is a
conversation, not a document handed down.

**The fact everything hangs on:** Kessela is a **registered** Class II device.
Registration is a listing. It is not clearance and not approval. A cleared device
may state what it treats; a registered one may not.

**Three claims on kessela.com today are on the never-say list** — "clinically
proven", "reduce fat", "equal to 300 sit-ups". They are deliberately absent from
everything new. Bringing the existing pages into line is David's separate call.

---

## 3. What shipped (260727–260728)

| | |
|---|---|
| **Studies → Posts** | 8 articles live at `/posts`, dated, thumbnailed, share images. `import-site.ts --collection=posts` |
| **Warranty + returns** | Public forms on `/warranty`, `/refund-returns`, `/return-refund-request`, `/cancel-order-form` → one queue at `/dashboard/tickets` |
| **Trust badges** | TENANT-level, David's own wording, on 20 pages. One edit changes all |
| **FAQ** | Their five questions as `<details>` accordion + FAQPage JSON-LD |
| **Showcase** | Gradient band + 3 image cards — their most recognisable section |
| **Product panel** | Gallery + native `<dialog>` lightbox + richText copy (typography match) |
| **Video** | `aspect` on MediaText AND a standalone `video` block. Portrait 9:16 works |
| **Payments** | Klarna, Affirm, Link, Cash App, Apple/Google Pay live. EU redirects off |
| **Platform fee** | Per-tenant override; Kessela = 10% (inert until Connect) |
| **Branding** | `/login` and `/create-account` use the portal's name, incl. metadata |
| **`/brief`** | Sign-in only, hidden from nav — the members-area feature demoing itself |
| **Gotify + Uptime Kuma** | Restored from the 260712 backup; Kessela monitored incl. the buy page |
| **Runbook** | Cloudflare §2b, monitoring §2c, and `docs/deploy/UBUNTU_PROVISIONING.md` |

---

## 4. Open, in priority order

1. **The wrong-product image** (§0a) — ask Kenneth, then remove.
2. **Ad-spend cash-flow answer** (§0b) — for 09:00.
3. **Stripe Connect + payment methods on David's account** — the meeting.
4. **Claims sign-off** → then publish `/pelvic-floor` (built, draft, structure
   complete, wording proposed).
5. **Studies rewritten** — real citation, what it did, what it found, **what it
   does NOT show**. The honest-limits section IS the strategy. ⚠️ One article's
   *title* claims Harvard and Stanford; if they are not in the citations, the
   title goes. Blocked on nothing.
6. **Spec sheet** → the comparison table. Blocked on David.
7. **Stephanie call** — 45 minutes. The whole thesis lives in one person's head.
8. **YouTube how-tos as posts/studies**, plus shorts for reposting — Kenneth's
   plan. ⚠️ Kessela's own channel has **26 subscribers**; every audience is
   borrowed.
9. **Deep-linkable doc URLs** — `/dashboard/docs/<path>` so docs are shareable and
   addressable by a channel discussion. ~1 hour; the page already resolves by
   `relativePath`, it just never puts it in the URL.
10. **VAPI cost** — the docs say 15–33¢/min; Kenneth told David **35–45¢**. His is
    the safer number. Update `ACCOUNTS_SETUP.md` and `PLAN_260727.md` §13.

---

## 5. FOOTGUNS learned this session — all of these actually happened

**Add these to the class list. Every one cost real time or broke production.**

### 5.1 A layout update that omits `_status` UNPUBLISHES the page

Pages has drafts. `payload.update({ data: { layout } })` with no `_status` writes
a DRAFT — the live URL 404s, the script prints "updated", nothing errors.

**It took `/buy-kessela-now` — the only link that takes money — offline for about
four hours, then did the same to `/how-to-use-belt`.** Thirteen call sites had the
shape. Fixed as a class: `src/scripts/_local/_updatePageLayout.ts` carries the
doc's OWN status, and `tests/unit/scripts/pageLayoutStatus.test.ts` fails on the
pattern. FOOTGUNS §2.7b.

### 5.2 Derive table lists, NEVER enumerate them

Adding `aspect` to MediaText, I hand-listed the two Pages tables. MediaText is
also on **Posts and Products — six tables, not two.** Every post read died with
42703 and five pages went 502.

This is already written in FOOTGUNS §2.4. **I read that file the previous morning
and enumerated anyway.** The corrective migration derives from
`information_schema`.

### 5.3 A nested relationship SPENDS depth budget

`Media.createdBy` (a relationship, added for ticket-attachment ownership) pushed
`gallery[].image` past `depth: 3` on the product page, so it returned a bare ID.
`<Media>` got a number and threw **during hydration** — server HTML painted, then
the error boundary replaced it. Classic "renders briefly, then breaks".

**Rule: any relationship added to a widely-fetched collection wants `maxDepth: 0`
unless something genuinely needs it populated.**

### 5.4 A correlation is not a diagnosis

I could not reproduce 5.3, six cold curls returned 200, and a hard refresh
appeared to fix it — so I called it stale-bundle churn from repeated rebuilds.
Wrong. **The component would have told me in thirty seconds.** Read the code
before trusting a coincidence.

### 5.5 `Number('')` is 0, and 0 is finite

`set-tenant-fee.ts` guarded with `Number.isFinite(Number(arg('bps')))`. Running it
with no `--bps` — to READ a rate — **set two live tenants to 0%.** Check the flag
is PRESENT before parsing it; validating a parsed value cannot tell missing from
zero. This is FOOTGUNS §2.3 walked into inside the tooling for that very number.

### 5.6 Structure-specific tree walks fail silently

The mailto-rewrite script followed only `children` and `root`, never reached
`layout[].columns[].richText.root`, and reported a clean run on an unchanged
database. **A green result that changed nothing is worse than an error.** Walk
every value.

### 5.7 A percent-escape becomes part of the filename

WordPress named a file `…cellulite-%E2%80%93-Yes-it-works.jpg`. Taken off the URL,
the escape became the filename, R2 re-escaped the `%`, and the object 404'd at its
own `url` — a Media row that looked perfectly healthy with no blob behind it.
Decode before flattening to ASCII. **A HEAD over every media row's own `url` finds
this class in one pass.**

### 5.8 Git Bash rewrites a leading `/` in an argument

`--paths=/a/,/b/` silently became `C:/Program Files/Git/a/` and 7 of 8 imported.
Prefix `MSYS_NO_PATHCONV=1`.

### 5.9 Fix the metadata too

`/create-account` had branded body copy while `<title>` and the Open Graph card
still said "Angel OS". The browser tab and **every link preview anyone pasted**
still advertised the platform. Static `metadata` → `generateMetadata`.

### 5.10 Measure colour with the browser, not a regex

My first contrast pass parsed `oklab()` with a decimal regex and reported 1.09:1
for everything — an artifact I nearly acted on. Convert via canvas and let the
browser do it. And filter to VISIBLE elements: a `header a` sweep matched the
CLOSED mobile sheet.

---

## 6. Verification discipline

- **`docker compose up -d --build core` exits 0 when the BUILD FAILS.** Always
  confirm `docker ps` shows an age in **seconds**.
- **Curl the money path after ANY content change**, not the pages you edited:
  ```
  / · /buy-kessela-now · /products/kessela-elite-belt · /shop
  /posts · /warranty · /refund-returns · /brief · /login
  ```
  The page that breaks is rarely the one you touched.
- **Test gate: `pnpm test:unit` only.** GREEN and must stay green — **339 files /
  6,095 tests**.
- **A mocked payload does not validate selects.** Hit the live node.
- **Chrome (`mcp__claude-in-chrome__*`) drives Ken's real browser**; the in-app
  Browser pane cannot screenshot unless displayed, but `javascript_tool` and
  `get_page_text` work fine and are usually enough.

---

## 7. Scripts — `src/scripts/_local/`, all `pnpm payload run <path>`

| script | what |
|---|---|
| `provision-kessela.ts` | tenant + default pages/nav |
| `import-site.ts` | mirror a site. `--collection=posts` for articles. ⚠️ REPLACES layout |
| `kessela-store.ts` | form, product, buy CTA, per-page heroes |
| `kessela-nav.ts` | their nav + overrides |
| `kessela-brand.ts` | logo, dark theme, coral |
| `kessela-studies.ts` | publish the 8 study Posts, retire the duplicate Pages |
| `kessela-claim-forms.ts` | ticket forms on the four claim/return pages |
| `kessela-faq.ts` | FAQ accordion + their badge wording |
| `kessela-trust-sweep.ts` | tenant badges + a bare trustRow on every page |
| `kessela-showcase.ts` | the gradient band with three cards |
| `kessela-product-panel.ts` | gallery + lightbox + formatted copy on the buy page |
| `kessela-pelvic-floor-page.ts` | the second front door. DRAFT |
| `kessela-delink-emails.ts` | mailto → internal forms |
| `kessela-brief-page.ts` | `/brief`, sign-in only |
| `set-tenant-fee.ts` | per-tenant platform fee. ⚠️ see §5.5 |
| `_updatePageLayout.ts` | **use this for any layout write.** §5.1 |

⚠️ **`import-site.ts` REPLACES `layout`** — re-run `kessela-store.ts` and the
block scripts after it.

---

## 8. Where the documents live

| | |
|---|---|
| [`kessela/BRIEF_260728.md`](kessela/BRIEF_260728.md) | **David-facing roll-up.** Safe for anyone to read |
| [`kessela/PLAN_260727.md`](kessela/PLAN_260727.md) | Internal. §0 wins where it disagrees with the rest |
| [`kessela/CLAIMS_SIGNOFF.md`](kessela/CLAIMS_SIGNOFF.md) | The six lines he initials |
| [`kessela/ACCOUNTS_SETUP.md`](kessela/ACCOUNTS_SETUP.md) | Tomorrow's agenda |
| [`kessela/TRANSCRIPT_260727_david.txt`](kessela/TRANSCRIPT_260727_david.txt) | The deal |
| [`kessela/TRANSCRIPT_260728_david.txt`](kessela/TRANSCRIPT_260728_david.txt) | Pricing agreed, 09:00 set |
| [`deploy/UBUNTU_PROVISIONING.md`](deploy/UBUNTU_PROVISIONING.md) | The server, step by step |
| [`RUNBOOK_CONTINUITY.md`](RUNBOOK_CONTINUITY.md) | §2b Cloudflare, §2c monitoring |

**Transcribing a local video:** Merlin's `url_transcribe.py` is yt-dlp-first and
cannot take a path off disk. Use
`scratchpad/transcribe_local.py <file> <out.txt>` — same Whisper call, no download
step. CPU-only here; ~5 minutes for 10 minutes of audio.

---

## 9. Still true, and worth not forgetting

**⚠️ Nothing auto-starts `cloudflared` on the laptop.** A reboot takes every site
offline until a human types a command. Kenneth was mid-fix (service installed,
config staged at `C:\ProgramData\cloudflared\`, `sc.exe config` for the binPath
still to run elevated). **Confirm whether that landed.**

**⚠️ Uptime Kuma on the laptop cannot report that the laptop died.** An external
free monitor (UptimeRobot) on `spacesangels.com` is still the highest-value five
minutes available and is still not done.

**The prize is units sold, not hours.** $600 is a week; 10% of 2,500 units is the
job. Plan every hour against units moved — and remember the first swings are free
by design, because David is counting strikes.
