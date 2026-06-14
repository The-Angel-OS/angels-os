# Church Go-To-Market (2026-06-14)

Sustaining the ministry *before* 501(c)(3) by serving the long tail of small
churches. Companion to `docs/planning/CHURCH_WEBSITE_GAP_ANALYSIS.md` (what we can
host) and `docs/strategy/COMMUNITY_OS_VERTICALS.md` (churches are one vertical of many).

> **Premise correction:** you do **not** need 501(c)(3) to earn this. Selling a
> website + giving platform to churches is ordinary business revenue (LLC / sole
> prop collects + pays tax on it). 501(c)(3) unlocks *tax-deductible gifts to Angel
> OS itself*, grants, and nonprofit credibility — none of which gate charging
> churches today. Critically, **the churches' own donations never touch your tax
> status**: we built giving as a Stripe Connect *destination charge*, so the gift
> goes straight into the church's account and you're just the rails taking a small
> fee. That's why the pre-501(c)(3) path is clean.

## "How many churches for ~$4K/month?"

Depends on the model:

| Model | $4K/mo requires |
|---|---|
| **Flat fee $29/mo** | **~140 churches** |
| **Flat fee $49/mo** | **~82 churches** |
| **Flat fee $99/mo** | **~40 churches** |
| **1% of giving** | ~**$400K/mo total giving volume** (e.g. ~80 churches @ $5K/mo, or ~40 @ $10K) |
| **Hybrid $29 base + 1% giving** (recommended) | **~140 churches** on the base alone; the % is upside |

**Headline: 40–150 churches**, against a US pool of **~350,000+ congregations**
(mostly small). The math is the easy part.

> ⚠️ The church-count and giving-volume figures are public ballparks, not our data.
> Before betting on the 1%-of-giving path, calibrate against ONE real church's actual
> monthly online-giving number.

## Pricing recommendation

**Low flat base + small giving %** — e.g. **$19–29/mo + 1% of giving**:
- the base covers bills predictably (doesn't depend on their giving volume),
- the % is aligned upside (you earn when they thrive),
- it's **constitutionally honest** (cost-recovery, not rent-seeking — Toward-53).

The platform fee is a config change, not a build: the donation destination charge
already carries an `application_fee_amount` (currently the 5% Justice Fund) — that's
the exact mechanism for a modest platform cut. (See the recurring-memberships build —
that's what makes the base fee *recurring* revenue.)

## The constitution as a sales weapon

Incumbents (Tithe.ly, Subsplash) are mildly extractive — fees on every gift, upsells.
The pitch *against* them, for a small church on nothing or quietly resentful of what
they pay now: *"a beautiful site, online giving that lands 100% in your account minus
a small honest fee, a real community space — and your Guardian Angel sets it up in
minutes."* The **community/Spaces layer + LEO conversational setup are what nobody
else has.**

## The real bottleneck: acquisition + support, not math

We proved a church site is *one provision call* and LEO can onboard the bank
conversationally — tech cost per church ≈ zero. The cost is **getting them in the
door and holding their hand** through Stripe Connect + content. So the metric to
obsess over is **cost-to-acquire-and-onboard per church**, and the lever is making it
**near self-serve.**

### Acquisition funnel sketch (the actual lever)
1. **"Claim your free church site in 5 minutes"** landing page → enter church name +
   email → LEO provisions a draft site instantly (we have this: provision-portal +
   church-template) and shows it live. *The demo IS the pitch.*
2. **LEO walks them through** branding, service times, and **"connect your bank"**
   (the conversational Connect onboarding we just built) — minimal human support.
3. **Free tier** (the site + community) → **paid** when they turn on giving / want
   the custom domain / advanced features. Land-and-expand, not a cold sale.
4. **First 3–5 real churches = proof + testimonials.** Grace Chapel (demo) becomes
   "here's a real parish using it" the moment one says yes — which is where the
   St. Alfred's / Episcopal / Board relationships matter most.

## Honest read
$4K/mo is ~100 small churches at a fair price, with near-infinite supply. Point the
energy at: (1) the self-serve claim funnel, (2) the pricing decision (low base + 1%),
(3) the first few real churches. The features are largely done; the **distribution**
is the work.
