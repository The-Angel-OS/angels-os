# Continuation — 260727, header consolidation + theme parity

> Written 00:50 on 260727 at the end of a very long session. Pick this up in a
> fresh context. Everything below is committed and deployed unless it says
> otherwise.

## Where things stand

**kessela.spacesangels.com is live and sells.** Tenant 30. Mirrored from
kessela.com (which has a $599 price and NO cart — their "Buy Kessela Now!" link
points at the page you're already on). Product created at $599 / 2,500 units;
Ken confirmed the buy flow runs from product page to card entry.

Also shipped tonight: lead capture for third-party sites (`/api/capture` +
`public/embed.js`), first-touch attribution, the drip/sequence engine on the
heartbeat, Google Calendar two-way for booking, and a pile of access fixes —
see `docs/FOOTGUNS.md` and the git log from 260726.

## The three asks still open

### 1. Header consolidation — ✅ DONE 260727 0110 (30c2f4f)

Portal switch + "Edit this page" now live inside the account avatar, which
reclaimed the space that was cutting off MORE and gave portal switching its
first mobile home. Cart badge un-clipped. PortalSwitcher gained an `inline`
mode (list only, no trigger) so it can nest without dropdown-in-dropdown pain.

⚠️ If you touch `inline`: the "Edit this page" resolver is lazy and was keyed
on the menu OPENING. Inline never opens, so it silently stopped resolving —
it now checks `open || inline`. Any other lazy work in that component needs
the same treatment.

Original ask, kept for context:

### 1b. Header consolidation (Ken, 260727 0043) — original wording

Current state and what he wants:

- **"MORE" is cut off** at ~938px. The nav row competes with the tenant
  switcher, presence pill, avatar and cart. **Do NOT fix this with
  `overflow-hidden` on the NavigationMenu root** — that clips the dropdown
  panels, which are children of it, and silently breaks Home/More on every
  portal. I did exactly that tonight and had to revert it (40482b4).
- **Merge the portal chooser and the edit-page control into the KC presence
  avatar** — one control for what are currently three. Ken calls the edit-page
  menu "ever so useful", so it must survive the merge, not be dropped.
- **That control has no mobile equivalent at all**, which he says "sucks". The
  mobile sheet (`src/components/Header/MobileMenu.tsx`) is where it goes.

Files: `src/components/Header/index.client.tsx` (the row layout, ~line 337
onward), `src/components/Header/MobileMenu.tsx`, `src/components/Header/AccountMenu.tsx`.

### 2. Block parity with their theme

Ken's framing, and it's correct: David is "very very superficial", so looking
right IS the product for this audience. He also set the constraint — **add
blocks, don't fork them per client, and don't end up with a million types.**

Done: `splitPanel` hero (dark slab + photo + accent squiggle + pill CTAs).

Still to build, in descending visual signal:
- **Trust-badge row** — 4 columns: badge image, bold label, one line of copy
  (BBB / 14-day money-back / warranty / FDA registered).
- **Numbered feature cards** — big ghost numeral behind an eyebrow + heading +
  copy + button, alternating image side.
- **Dark columned footer** — logo + blurb left, two link columns, social row.

**The pattern to follow** (this is the important part): the squiggle in
`src/heros/SplitPanel/index.tsx` reads `var(--tenant-primary)`, which
`TenantStyles` already emits. So the same block on Clearwater picks up
Clearwater's colour. **Parameterise on branding, never fork per tenant.** Coral
pill styling is scoped INSIDE the hero rather than applied to global Button
variants, for the same reason.

### 3. Kessela odds and ends

- Their logo is white-on-transparent; tenant is set to `defaultTheme: dark` so
  it shows, but a visitor with a stored light preference sees a light header
  and no logo. Either get a dark-on-transparent logo from David or accept it.
- The mirrored pages still carry their copy verbatim. Ken wants the language
  changed — nothing has been rewritten yet.

## Scripts, and the order they must run in

All in `src/scripts/_local/`, all idempotent, all `pnpm payload run <path>`:

| script | what |
|---|---|
| `provision-kessela.ts` | tenant + default pages/nav |
| `import-site.ts` | `-- --tenant=kessela --base=https://kessela.com` — mirrors pages + images |
| `kessela-store.ts` | form, product, buy CTA, per-page heroes |
| `kessela-nav.ts` | their nav + overrides |
| `kessela-brand.ts` | logo, dark theme, coral |
| `kessela-access.ts` | Community space, roles, invitations |

⚠️ **`import-site.ts` REPLACES `layout`**, so it wipes the contact form and the
buy CTA. Always re-run `kessela-store.ts` after it.

## Traps this session actually hit — don't re-learn these

- **A CLI script cannot revalidate a cached global.** `revalidateTag` needs a
  request context. Header/footer changes made by `payload run` sit in Postgres
  while the site serves the old nav until `docker restart angelos-core`. Cost
  two rounds of "why isn't this live".
- **`docker compose up -d --build core` reports healthy when the build FAILS** —
  the old container keeps running. Always check `docker ps` shows an age in
  *seconds*.
- **A JSX comment cannot be the first child of a ternary branch.** I made this
  mistake three times tonight. Put it above the `{cond ? (`.
- **ALTER TYPE on an enum also matches the array type** Postgres auto-creates
  (`_enum_..._`). Filter `typtype = 'e'`.
- **Verify a menu fix by clicking a link INSIDE the open menu**, not by
  screenshotting the closed trigger.

## Deploy loop

```
edit → npx tsc --noEmit → pnpm test:unit → docker compose up -d --build core
```
~2 minutes per cycle. Chrome (`mcp__claude-in-chrome__*`) drives Ken's real
browser and is the only way to see what's actually rendered — the in-app
Browser pane can't screenshot unless the pane is displayed.

## Standing context

Suite is GREEN and must stay green: 337 files / 6,084 tests. `pnpm test:unit`
only. Read `docs/FOOTGUNS.md` before changing anything. Prefix and suffix
replies `YYMMDD ~HHMM CITO —`.
