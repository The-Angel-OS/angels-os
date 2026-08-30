# Handoff — 260818, Angel OS revenue push

Paste the block below into a fresh session.

---

Continuing the Angel OS revenue push. Read `docs/HANDOFF_260818.md` and the memory
files `project_demo_site_funnel`, `project_anthonyjstudio_portal` before acting.

## Where things stand

**LIVE = Railway.** Deploy is `railway up -s Core` (never auto-deploy from GitHub).
Live DB = `railway variables -s Postgres --kv` → `DATABASE_PUBLIC_URL`.
Gate is `pnpm test:unit` ONLY (358 files / ~6,330 tests, green). It has flaked
three times under load — always clean on a re-run; re-run before believing a
failure, and chain with `&&` not `;` so a red gate actually blocks a push.

**The offer** (locked, do not re-litigate): we build a small business a real
5-page website free, then charge to host and maintain it.
- Free — subdomain, small footer credit
- $49/mo — own domain, credit removed, unlimited edits
- $149/mo — plus online booking, deposits, CRM, AI assistant

**What works end to end today:**
- `POST /api/provision-ops/demo-site?key=$CRON_SECRET` with
  `{ businessName, trade, city, phone, email, generateHero? }` → a complete
  live 5-page site in ~1 minute. Idempotent on slug. Trade packs live in
  `src/utilities/demoSiteTemplates.ts` (handyman, cleaning, moving,
  photography, accounting, general) — adding a vertical is a table entry.
- `POST /api/provision-ops/pages-from-spec` — ordered `sections[]`: content,
  cta, gallery, faq, mediaText, trustRow, featuredEndeavors, contactForm.
- Apex `spacesangels.com` — home + `/pricing` rewritten 260818 in plain
  language for tradespeople. Specs in the scratchpad as `home.json` /
  `pricing.json`; re-publish by POSTing them to pages-from-spec.
- AI image generation (Cloudflare `steps`, NOT `num_steps` — that 400s).

**Live portals:** shineandcleansolutions (33), anthonyjstudio (32), kessela,
neurocarepro, clearwater-cruisin, harpazo (fully configured booking demo —
this is the link to show trades), two mobile mechanics.

## What actually blocks a paying customer

1. **No plan-checkout endpoint** for $49/$149. `guardian-angel-checkout` is
   hardwired to a different product. Checkout uses inline `price_data`, so the
   Stripe catalog is irrelevant — do NOT go create products.
2. **Stripe webhook is missing `customer.subscription.created/updated/deleted`.**
   Registered and enabled at `www.spacesangels.com/api/stripe/webhooks` with
   only 5 events. `stripe-webhooks.ts` handles the subscription events to sync
   Memberships, so a recurring plan would charge and never register — silently.
   Ken adds these in the Stripe dashboard; it is not a code change.
3. **Custom domains** need the Railway plan upgrade. The $49 tier promises them
   on the live pricing page today. Ken's plan: first paying customer funds it.
4. **"Hosting and security included"** on the pricing page is unverified —
   confirm backups actually happen before anyone pays for them.

## Open work, roughly in value order

- **VAPI cross-portal routing.** The platform router in `vapi-webhook.ts`
  already greets as Angel OS, fuzzy-matches a spoken business name, routes and
  captures the lead. It never runs because one tenant has
  `vapi.phoneNumber = +17274408797` set, taking the dedicated fast path.
  Probing the live webhook on 260818 returned "LEO, the AI assistant for
  NeuroCare Pro"; Ken believes it is bound to Kessela. **Re-probe and confirm
  which tenant before changing anything.** Clearing that one field switches on
  platform routing — no deploy. Give that tenant its own number first if they
  are actively using the line.
- **Anthony J Studio (tenant 32) must be rebranded or taken down.** It is
  publicly live using a real person's business name and his photographs, taken
  from his public Model Mayhem listing. He was never contacted and never agreed.
  Recommended: rebrand into a generic photography-vertical demo with generated
  images — keeps the homepage social-proof tile, removes the exposure, and
  yields a demo for every photographer in Central Florida. One `demo-site` call
  with `generateHero: true`, then purge media 503–522.
- **Theme engine / block polish.** `TenantStyles.tsx` already injects
  `--tenant-primary`, `--tenant-secondary`, heading fonts. Only 5 of 24 blocks
  consume them. WordPress-parity here is a COVERAGE problem — ~19 blocks of
  mechanical conversion on a working foundation, no new architecture.
- **Videos.** Ken wants short clips highlighting features, hosted on YouTube and
  embedded. The `mediaText` block now supports `width: 'full'` (full-width
  viewer), `side: right|left|alternate`, and `playback: player|autoplay|ambient`.
  External YouTube/Vimeo go in `videoUrl`; uploads go in `media`.
- **Demo sites for the warm list.** Six prospects were contacted 260817 and
  none have been sent a site with their own name on it — the move that worked
  for Anthony's. Monica / Shine & Clean (609-817-5997), a handyman
  (786-872-8624), All American Local Movers (352-484-4107), Thoroughbred Moving,
  Neel (tax), Computer Zone (727-692-5114), Caleb / CG Web Design.

## Hard-won gotchas — do not rediscover these

- **Discovery is FORCE-PRIMARY** in `Header/index.client.tsx` (~line 298) and
  bypasses pins and caps entirely. The only switch is the endeavor's
  `federation.networkVisible`.
- **`maxInline` must be 0** to keep derived links out of a bar — pinned items
  bypass the cap, so any positive value is a slot Discovery takes on its way
  past. `normalizeNavOverrides` keeps 0 only when something is pinned.
- **Read the actual href before hiding a nav item.** "Join" is
  `/join-the-angel-os-today`. Hiding `/join` silently does nothing.
- **`provisionPortal` only applied `defaultTheme` / `networkVisible` on CREATE**
  until 260817 — both are stamped explicitly now, but assume any other
  create-only field has the same shape.
- **`ensureTenantContactForm` returns `{ formId }`, not `{ id }`.**
- **Verify a deploy by watching `/api/health` uptime RESET**, not by grepping
  for content that was already there.
- **curl gets bot-blocked** by Canva and some hosts — a 403 from curl is not
  proof a link is broken. Check in the browser before telling anyone their link
  is down.

## How Ken wants to work

CTO mode: decide and act, don't ask on the obvious, commit and push to main.
Temporal stamp every reply, `YYMMDD ~HHMM Name —`, top and bottom.
He is bootstrapped and cash-tight — prefer work that shortens the path to the
first $49 over platform polish. Ponytail mode is active: laziest solution that
actually works, and leave one runnable check behind for non-trivial logic.
