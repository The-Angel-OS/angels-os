# Continuation — tightening Kessela

> Rewritten 260727 ~10:45, replacing the 00:50 version. Everything here is
> committed and deployed unless it says otherwise. **The focus is Kessela.**
> Read `docs/FOOTGUNS.md` first; this doc assumes it.

---

## 1. The situation, in one paragraph

David Christenson (NeuroCare Pro / Kessela) has ~2,500 red-light + EMS belts to
clear. **kessela.com is a WordPress brochure site that cannot take money** —
$599 printed on the page, no cart, and "Buy Kessela Now!" links to the page
you're already on. We mirrored it onto **kessela.spacesangels.com** (tenant 30)
and made it sell. David is the owner and the money; it is his show. He is
direct, judges on appearance in seconds, and hates long messages.

**Live state:** 25 pages (9 in nav, all published) · 20 media · 1 product
($599, 2,500 units) · 3 spaces · **0 posts** ← see §3.1.

Buy flow verified end to end: product page → add to cart → checkout → card
entry. Cart maths correct ($1,198 for two).

---

## 2. What's already built

| | |
|---|---|
| Mirror | Their pages at their paths, so DNS can flip without a redirect map |
| Store | Product $599 / 2,500 units, gallery, Add to cart, checkout |
| Hero | `splitPanel` — one full-bleed image, dark gradient left, coral squiggle, pill CTAs |
| Nav | Their five links, their order, via the override layer; utility pages `showInNav=false` |
| Brand | Their logo, favicon, dark theme, coral `#F0524A` |
| Lead capture | Kessela's own form → `routeFormToAIBus` → contact + Gotify, same engine as the phone line |
| Footer | Platform credit suppressed (`branding.hidePoweredBy`) |

Platform work from the same session that Kessela depends on: `/api/capture` +
`public/embed.js`, first-touch attribution, the sequence/drip engine on the
heartbeat, Google Calendar two-way booking, and a batch of access fixes.

---

## 3. The tightening work, ranked

### 3.1 Studies should be POSTS, not pages — Ken asked for this by name

The 8 study articles came in as Pages because their source paths are
page-shaped (`/hydration-101-extremely-important-for-pbm/` etc.). Their site
never had a blog engine; **ours should.**

`src/scripts/_local/import-site.ts` needs a `--collection=posts` flag: same
scrape, write to `posts` instead of `pages`. Then re-import the 8 study URLs
(listed in §5) and remove the page versions. Watch for slug collision — a post
and a page with the same slug will both want the route.

### 3.2 Portrait video — DECISION NEEDED BEFORE BUILDING

MediaText now takes an uploaded video with a real player (controls, no
autoplay, poster). What it can't do is **portrait** — the frame is hardcoded
`aspectRatio: 16 / 9`.

Ken asked for "a portrait or landscape video viewer control … independent of
the wrapped media control." I argued against a second block (that's the
million-block-types problem he himself named) and proposed instead:

1. an `aspect` select on MediaText — Landscape 16:9 / Portrait 9:16 / Square
2. group its 9 fields into *Content* and *Media* tabs, which is most of the
   "confusing options" complaint

**The open question, which he has not answered:** does he want video *beside
text* (fix MediaText) or video *on its own in the flow* (a small standalone
`Video` block is genuinely cleaner)? **Ask before building.**

### 3.3 Copy is still theirs, verbatim

Every mirrored page carries their wording. Ken wants it rewritten.

Compliance constraint straight from David: Kessela is a **registered** Class II
device — *not cleared, not approved* — and he says they make no claims. The live
site nonetheless says "reduce fat", "shrink fat cells", "equal to 300 sit-ups".
Separately, **Meta prohibits before/after and body-transformation claims
outright**, and Google gates medical-device ads. Get the list of claims he will
stand behind before writing marketing copy. Don't guess, and don't quietly
amplify what's already on their site.

### 3.4 Theme parity — the remaining blocks

Their design, in descending visual signal:

- **Trust-badge row** — 4 columns: badge image, bold label, one line (BBB /
  14-day money-back / warranty / FDA registered)
- **Numbered feature cards** — big ghost numeral, eyebrow, heading, copy,
  button, alternating image side
- **Dark columned footer** — logo + blurb left, two link columns, social

**The rule Ken set, and it's the right one:** add blocks, don't fork per
client. The squiggle in `src/heros/SplitPanel/index.tsx` reads
`var(--tenant-primary)`, which `TenantStyles` already emits — so the same block
on Clearwater picks up Clearwater's colour. **Parameterise on branding.** The
coral pill styling is scoped *inside* the hero rather than applied to the global
Button variants, for the same reason.

### 3.5 Smaller

- **Condensed headline font.** Theirs is condensed, ours isn't — it's most of
  the remaining difference at a glance. A design call, not code.
- **Hero image.** Ken uploaded `kessela-hero-3-new.jpg`; on screen the right
  side reads flat and grey. He may want a different crop. The Media field works,
  so it's a 30-second swap in the editor.
- **A probe MediaText block** sits on `/how-to-use-belt` (id `mt-probe-1`),
  added by hand to verify the player. It's a genuine section — keep or delete.

---

## 3b. Tickets / warranty engine — slice 1 SHIPPED (5404467)

`tickets` collection: ONE primitive, `type` discriminates warranty / support /
return / question. Signed-in only. `product` is a relationship (fills itself
from the catalog). Read access is an OR — a customer isn't a member of the
seller's tenant, so ownership is separate from tenant scope. `internalNotes`
uses field-level read access, not `admin.hidden`.

Conversation is NOT a field: `channelRef` points at a channel so threads reuse
Messages/attachments/presence/LEO. The row owns lifecycle, the channel owns
discussion.

Dashboard: `/dashboard/tickets` (queue, type+status filters, open above closed)
and `/dashboard/tickets/[id]` (attachments rendered large, video as a real
player, inline status/priority). Detail page re-checks the tenant because
`requirePortalManager` proves you manage A portal, not THIS one.

**Explicitly NOT built** (in the collection's doc comment — don't add by drift):
SLA timers, business-hours calendars, escalation matrices, queue/view builders,
CSAT surveys, automation builders, multi-brand form schemas.

**NEXT SLICE — the public claim form.** Ken's constraint: the customer upload
control must allow UPLOAD but NOT "use existing", because a customer must never
browse the tenant's media library. Reuse the endeavor-settings upload control
minus that affordance. Also still to do: `query_tickets` / `update_ticket_status`
LEO tools, and wiring `channelRef` to an actual channel on create.

Note: the `escalateNewTicket` afterChange hook posts to AI Bus + Gotify, but
hooks DO NOT fire on raw SQL inserts — test through the API.

## 4. Traps — every one cost real time. Don't re-learn them.

- **TWO hero configs existed.** `src/fields/hero.ts` is the live one (Pages and
  Posts import it). `src/heros/config.ts` was dead and is now deleted — but I
  edited it for an evening before noticing. If a field change has no effect,
  check you're editing the file that is actually imported.
- **A CLI script cannot revalidate a cached global.** `revalidateTag` needs a
  request context. Header/footer edits from `payload run` sit in Postgres while
  the site serves the old nav until `docker restart angelos-core`.
- **`docker compose up -d --build core` reports healthy when the BUILD FAILS** —
  the old container keeps serving. Always confirm `docker ps` shows an age in
  *seconds*.
- **`overflow-hidden` on a NavigationMenu root clips the dropdown panels**,
  because they are children of it. I "fixed" a cosmetic overlap that way and
  silently broke Home/More on every portal.
- **A lazy resolver keyed on a menu OPENING stops working when rendered
  inline.** That's how "Edit this page" vanished — it now checks `open || inline`.
- **`admin.condition` only HIDES a field; it does not exempt it from
  validation.** A `required: true` url with a condition made internal links
  unsaveable. Use conditional `validate`.
- **A JSX comment cannot be the first child of a ternary branch.** Three times
  in one night. Put it above the `{cond ? (`.
- **`ALTER TYPE` matches the enum's ARRAY type too** (`_enum_..._`). Filter
  `typtype = 'e'`.
- **Never enumerate block/rels tables by hand.** Derive from
  `information_schema` — a hand list is incomplete by construction, which is how
  the 42703 outage happened.
- **A mocked payload does not validate selects.** `contactStatus: 'active'`
  passed nine unit tests and 500'd on every real capture. For anything writing a
  real collection, hit the live node before believing green tests.
- **Verify a menu fix by clicking a link INSIDE the open menu**, not by
  screenshotting the closed trigger.

---

## 5. Scripts — and the ORDER matters

All in `src/scripts/_local/`, all idempotent, all `pnpm payload run <path>`:

| script | what |
|---|---|
| `provision-kessela.ts` | tenant + default pages/nav |
| `import-site.ts` | `-- --tenant=kessela --base=https://kessela.com [--paths=…]` |
| `kessela-store.ts` | form, product, buy CTA, per-page heroes |
| `kessela-nav.ts` | their nav + overrides |
| `kessela-brand.ts` | logo, dark theme, coral |
| `kessela-hero-favicon.ts` | hero still + favicon |
| `kessela-access.ts` | Community space, roles, invitations |

⚠️ **`import-site.ts` REPLACES `layout`** — it wipes the contact form and the
buy CTA. **Always re-run `kessela-store.ts` after it.**

The 8 study URLs for §3.1:

```
/kessela-advanced-pbm-red-light-nir-ems-belt-your-first-two-weeks/
/what-advanced-science-studies-from-harvard-stanford-published-medical-journals-say-about-red-light-therapy/
/science-research-on-the-ability-of-red-light-therapy-to-improve-the-appearance-of-cellulite-yes-it-works/
/hydration-101-extremely-important-for-pbm/
/efficacy-of-low-level-laser-therapy-for-body-contouring-and-spot-fat-reduction/
/medical-studies-prove-pbm-can-help-eliminate-fat/
/led-light-therapy-clinically-proven-to-reduce-waist-hip-and-thigh-circumference/
/studies-show-additional-weight-loss-benefits-with-red-light-therapy/
```

---

## 6. Open bugs

- **Stuck `"..."` on a describe-image turn.** Kessela space 85, message 7145.
  Placeholder posted 05:08:33, turn died ~2s in, never cleared. The container
  has restarted so those logs are gone — **reproduce with `docker logs -f
  angelos-core` running before touching anything.** FOOTGUNS §2.6 class. There
  is supposed to be self-healing where a NEW turn clears stale placeholders;
  verify whether it fired.
- **`mediaToAiBus` fails for uploads created outside a request** (P2 on the
  punch list). Media rows are fine; only the AI-Bus mirror fails. Verify normal
  user uploads are unaffected before "fixing" it.

Fixed in the same session and worth knowing about: LEO fabricating a "rate
limit" when the tool actually said "a prompt is required"; LEO's voice (no "As
your Guardian Angel", no federation jargon); light-theme chat contrast
(`prose-invert` applied unconditionally).

---

## 7. Deploy loop

```
edit → npx tsc --noEmit → pnpm test:unit → docker compose up -d --build core
```

~2 minutes a cycle. Chrome (`mcp__claude-in-chrome__*`) drives Ken's real
browser and is the only reliable way to *see* the result — the in-app Browser
pane can't screenshot unless the pane is displayed.

**The suite is GREEN and must stay green: 337 files / 6,084 tests.**
`pnpm test:unit` only — a bare `vitest run` boots Payload and cascades into
timeouts.

Prefix and suffix replies `YYMMDD ~HHMM CITO —`.

---

## 8. If you need to prioritise

The demo works today. What would actually move units, roughly in order:

1. **Posts engine for the studies** (§3.1) — it's the content that sells a
   medical device, and it's the one thing he asked for by name.
2. **Copy rewrite** (§3.3) — theirs reads dated and carries claims he may not
   want to stand behind.
3. **Trust badges** (§3.4) — FDA-registered, warranty, money-back. The cheapest
   credibility on the page for a $599 device.
4. Theme polish — real, but it's the thing to charge for rather than give away
   at 2am.
