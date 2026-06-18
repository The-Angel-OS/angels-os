# Session Handoff — 2026-06-18

**Status:** STANDBY until **Sunday 2026-06-22 00:00**. No new feature development.
We connect only to **(a) configure a new client** or **(b) fix something on the
identified-broken list**. This doc is the runbook so we can do both *without*
Opus 4.8 if credits are tight — and so LEO can eventually drive it internally.

---

## 0. The one goal that matters next

**Make LEO able to clone a vertical end-to-end** (read an ad → stand up a branded
draft site → wire booking + contact + Discovery), so customer onboarding doesn't
depend on a high-tier model. Today the capability exists as a **script factory**
(`scripts/provision-lead.ts`); the gap is wrapping it as a **LEO tool** so it runs
conversationally. See §5.

---

## 1. What shipped this session (all pushed to `main`, auto-deploys)

Two live commercial sites on the **kendev.co Diocese** (commercial arm), built from
real Tampa Craigslist ads via the Chrome extension:

- **Arctic Cool Solutions** (HVAC) — https://arctic-cool.kendev.co
- **Doc's Moving** (movers) — https://docs-moving.kendev.co

Plus platform-wide fixes (benefit every future tenant):

| Commit | What |
|--------|------|
| `9b24528` | **Lead→site factory** `scripts/provision-lead.ts` (swap the SPEC) |
| `83d98d7` | Arctic Cool provisioner (`scripts/provision-pauls-ac.ts`) |
| `9210026` | **N-domain aliases** — tenants resolve by `domains[]` (bring-your-own domains) |
| `3362fce` | **Hero image fit** (cover/contain/fill) configurable in page designer |
| `2b38c15` `60be8e5` | **Nav leakage fixed** — storefronts no longer show Donate/Works/Learn/Discovery/Spaces |
| `579e94b` | **Contact-form repair fixed** — was broken for EVERY tenant (queried a non-existent `tenant` field on `forms`) |
| `50a178a` | Booking shows "Quote" not "$0" for quote-based trades |
| `ce0d14d` | Heartbeat 500 fix (dead legacy `endeavors.federation` query) |
| `5fa7efa` | a11y: form-label contrast (last `/contact` axe violation) |
| federation set | Re-tiered network model + permanent five-pointed star + home widget |

Both sites verified by browsing: flyer hero fills clean, nav de-leaked, **booking
wizard works**, **contact form submits successfully**, footer clean, Discovery card
shows the flyer.

---

## 2. The environment (how to run anything)

- **DB:** local `.env` points at the **kendev** prod DB (`74.208.87.243/kendev`).
  Same PG host also has `angels` (spacesangels.com) and `wdeg` DBs — swap the db
  name in the connection string to target them.
- **Deploys auto-trigger** on push to `main`: Vercel builds spacesangels (`angels`),
  IONOS auto-deploys kendev (`kendev`). No manual deploy step anymore.
- **Hostnames:** `*.kendev.co` wildcard covers every subdomain free. Custom domains
  → add to the tenant's `domains[]` (now resolves, commit `9210026`).

### ⚠️ Two env flags you MUST set to run any `tsx`/`node` script
```
PAYLOAD_SKIP_PUSH=true              # never let a script push schema to prod
PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true   # stale plugin-nested-docs version mismatch otherwise throws
```
Example:
```
PAYLOAD_SKIP_PUSH=true PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true pnpm tsx scripts/provision-lead.ts
```

---

## 3. RUNBOOK — configure a new client (the repeatable play)

This is the whole onboarding, in order. Steps 1–2 are the fast path; 3–6 polish it
to a "sells-itself" site.

### 1. Read the lead's full ad (judge it, get the real services)
- Chrome extension: `navigate` to the Craigslist URL, `wait 3`, `screenshot`.
- Pull: business name, phone(s), license #, service area, full service list,
  whether they already have a website (no website = best prospect).
- Lead list already parsed: `scripts/_local/tampa-leads.json` (139 Tampa leads,
  categorized). Regenerate with `node scripts/_local/parse-tampa-leads.mjs`.

### 2. Provision the draft site — `scripts/provision-lead.ts`
Edit the `SPEC` block (name, slug, tagline, description, phone, region, services[],
home bullets), then run it. It creates: tenant + branding + `domains[]` alias +
space + default pages/nav + LEO + network-visible endeavor + admin link + bookable
**services** + flyer-style home content + meta. Site lives at `<slug>.kendev.co`.

### 3. Booking schedule (so `/book` isn't "Not Set Up Yet")
Services alone aren't enough — booking needs an **availability** schedule. Pattern
(see `scripts/_local/polish-sites.ts`): create weekly `availability` rows Mon–Sat
`08:00–18:00`, `slotDuration 120`, `isActive true`, `provider = user id 1`,
`tenant = <id>`. (Quote-based services show "Quote"; deposit 0 = "request a visit".)

### 4. Contact form (lead capture)
Call `ensureTenantContactForm(payload, tenantId, req)` — it find-or-creates the
shared **Contact Form** and wires a `formBlock` into the `/contact` page. Or hit the
endpoint: `GET /api/provision-ops/contact-form-repair?tenant=<slug>&key=$CRON_SECRET`.
(Fixed this session — it was broken for everyone.)

### 5. Discovery card image
The Discovery card reads the **endeavor** `logo` + `coverImage`. Set both to the
business's flyer/logo media id, else the card is blank. (Heartbeat gossip carries the
URL to peer nodes within ~5 min.)

### 6. Hero image
Upload the flyer/banner as the Home page **High Impact** hero. Set **Image Fit =
Fill** for a pre-cropped banner (Cover crops, Contain letterboxes). If the image is a
self-contained flyer, **clear the hero overlay richText** so text isn't doubled.

### Branding cleanup gotchas
- If you rename a business after provisioning, the page **meta + hero + layout** keep
  the old name — do a whole-doc string replace across all the tenant's pages.
- Footer/header nav defaults no longer leak Donate/Angel OS (commit `60be8e5`), but
  **existing** tenants provisioned before that need their `header`/`footer` docs'
  `navItems` filtered (drop `/donate`, `/works`, `/learn`, `/federation`, `Angel OS`).

---

## 4. Reference: the live examples to copy

- **Arctic Cool** (tenant id 5, slug `arctic-cool`) — HVAC, flyer hero, 6 services,
  DINA-X5 promo. Full provisioner: `scripts/provision-pauls-ac.ts`.
- **Doc's Moving** (tenant id 6, slug `docs-moving`) — movers, gradient hero, 6
  services, hourly model. Generalized provisioner: `scripts/provision-lead.ts`.
- Admin user for both: **user id 1** (kenneth.courtney@gmail.com) as tenant_admin.

---

## 5. The LEO-capability gap (the actual next build, when dev resumes)

Today onboarding = a human runs `provision-lead.ts`. To let **LEO drive it** (the
factory principle: capability ships as a LEO tool first):

1. **`provision_vertical(spec)` LEO tool** — wraps the `provision-lead.ts` flow.
   Admin-gated. LEO already has `replicate_site(url)`; this is its richer sibling
   that also creates bookable services + booking schedule + contact form + Discovery
   image in one call.
2. **`read_ad(url)` capability** — LEO fetches/reads a listing (browser-automation in
   Nimue is the path; the roadmap already points here) and proposes a SPEC.
3. **Glue:** "LEO, build a site for this plumber" → read_ad → propose SPEC → human
   approves → provision_vertical → report URL + punch list. That's the whole loop
   without Opus.

This is the highest-leverage thing to build Sunday. Everything it needs already
exists as functions; it's a tool-wrapper + an approval step.

---

## 6. Identified-broken / open punch list (fix-only during standby)

- ⬜ Page `<title>` double-brands ("… | Angel OS | <Site>") — cosmetic.
- ⬜ Empty Posts/Shop nav items on storefronts (auto-demote on desktop; could hide).
- ⬜ Doc's Moving hero is a gradient — add their truck logo/photos when available.
- ⬜ 2 test form submissions left on Arctic Cool ("QA Test Claude", "Curl Test") — delete.
- ⬜ The "first month free → monthly → Karma Currency" billing model (design only; see
  token-economy memory — KC is ungated/non-cashable, fits "fees convert to KC").
- ⬜ Paul's Stripe Connect onboarding link + his own login (turnkey handoff finish).

---

## 7. Generic sales pitch (use/adapt per business)

> **"We already built your website. Take a look."**
>
> Hi [Name] — I saw your [trade] listing and built you a real website to show what's
> possible: **[slug].kendev.co**. Your services, your service area, your phone — and
> customers can **book a visit or message you right from the page**. No setup on your
> end.
>
> Most [plumbers/movers/HVAC techs] are losing jobs to whoever shows up first on a
> phone search. A clean site with online booking and instant lead capture fixes that —
> and it costs a fraction of what the big directory sites charge you per lead.
>
> **Here's the deal:** it's **free to start** — try it, send it to a few customers,
> see the leads come in. If it's earning its keep, it's a small flat monthly fee
> (no per-lead gouging, no contract). All you'd do is connect Stripe so you can take
> deposits and payments; we handle the rest.
>
> Want me to point it at your own domain ([business].com) and turn it on?

**Pitch notes:**
- Lead with the *finished site* (the fait accompli), not a sales deck.
- "No per-lead fees" is the wedge against Angi/Thumbtack/Yelp.
- "Free to start → flat monthly" — the free period converts to a flat fee (and
  internally, those fees credit Karma Currency on their dashboard).
- Custom domain is the close ("turn it on / point it at your domain").
- Differentiators baked into the product: online booking, instant lead capture,
  Discovery network listing, their own LEO/Nimue assistant.

---

## 8. Quick command reference

```bash
# Run any provisioning/maintenance script (ALWAYS these two env flags):
PAYLOAD_SKIP_PUSH=true PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true pnpm tsx scripts/<x>.ts

# Provision a new client:        edit SPEC in scripts/provision-lead.ts, then run it
# Re-parse the lead list:        node scripts/_local/parse-tampa-leads.mjs
# Repair a contact form:         GET /api/provision-ops/contact-form-repair?tenant=<slug>&key=$CRON_SECRET
# Pre-create a new schema column on all DBs (BEFORE deploying the field):
#   pattern in scripts/_local/ensure-hero-fit.mjs (DBs: kendev, angels, wdeg)
# Build + ship:                  pnpm build && git add -A && git commit && git push  (auto-deploys)
```

**Golden rule:** any new Payload field = pre-create its column on **all** prod DBs
(kendev/angels/wdeg) BEFORE the field code deploys, and default-render gracefully when
absent — or pages 500 (the schema-field-deploy footgun). See `ensure-hero-fit.mjs`.

---

*Nimue is proven in the field. Two verticals are live and selling. Standby engaged —
wake us to onboard a customer or fix the list above. — 260618*
