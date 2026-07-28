# Kessela — accounts to set up

**Bring this to the session.** Everything is created in **David's name, on
David's card**. He types the card; I don't touch it. Assume nothing — every step
is written out, including the ones that look obvious.

---

## 0. Do these two FIRST — everything else waits on them

### 0.1 Stripe Connect for Kessela — 10 minutes, blocks the money

Right now the Kessela tenant has **no connected Stripe account**
(`stripeAccountId: null`). Every sale on the site therefore lands in **Kenneth's**
Stripe, not David's. Checkout works — the money is simply in the wrong account.

Until this is done:
- David's name is **not** on the customer's receipt
- the agreed **10% cannot be collected automatically** (there is no split to take
  it from)
- refunds and disputes route to the wrong party

**Steps:** dashboard → Endeavor settings → Payments → *Connect Stripe* → David
completes Stripe's onboarding in his own name (EIN or SSN, bank account, business
address). Stripe asks for ID. He should have his driver's licence to hand.

### 0.2 Start Meta business verification — 5 minutes, then days of waiting

It gates every paid channel and the wait is outside anyone's control. Create it
and submit on day one even if no ad runs for a fortnight.

---

## 1. Accounts that need a card

| # | Account | What it does | Cost |
|---|---|---|---|
| 1 | **IONOS** — Linux VPS | The server. Runs the site, database, admin, AI. | **~$30/mo** for 12 vCore / 24 GB / 640 GB |
| 2 | **Twilio** | Text-message sign-in codes, SMS number | **~$1–2/mo** + ~1¢ per text |
| 3 | **Vapi** | The AI phone line that answers and books | **~$0.05/min** platform; **~$0.15–0.33/min** all-in |
| 4 | **Google Cloud** | Maps, calendar, mail, Gemini key | Pay as you go — **$0 measured over 30 days** |
| 5 | **Cloudflare** | Image/video storage (R2) + DNS | **Free** to start (10 GB included) |
| 6 | **Resend** | Order confirmations, claim replies, resets | **Free** to 3,000 emails/month |

**Order:** IONOS first (it provisions in the background), Cloudflare second (DNS
propagates while you do the rest). The other four are five minutes each.

---

## 2. Payment methods — five minutes that decide how $599 feels

**This is NOT covered by "David already has Stripe."** Payment methods are
configured **per Stripe account**, and direct charges use the **connected**
account's settings. So this must be done again on David's account even though
it's already done on Kenneth's.

**Already enabled on Kenneth's platform account (260728):** card, Apple Pay,
Google Pay, Link, Cash App Pay, **Klarna**, **Affirm**.
**Deliberately off:** Bancontact, EPS, giropay, iDEAL — Belgian, Austrian, German
and Dutch bank redirects, useless for a belt shipping to Florida and pure clutter
at checkout.

**Steps on David's account:** Stripe Dashboard → Settings → Payment methods →
enable **Klarna** and **Affirm**; disable the four EU methods above.

### What it costs him

| Method | Fee | On a $599 belt |
|---|---|---|
| Card | 2.9% + 30¢ | **$17.67** |
| **Klarna — Financing** | 2.99% + 30¢ | **$18.21** |
| Klarna — Pay in 4 | 5.99% + 30¢ | $36.20 |
| Affirm | 6% + 30¢ | $36.24 |

**Klarna Financing costs the same as a card.** Pay-in-4 and Affirm cost about
**$18 more per unit** — charged only on sales that complete, and a share of those
would not have happened at all.

⚠️ **Klarna classifies "medical devices" as a RESTRICTED business** — high risk,
subject to extra due diligence. There is **no separate Klarna application**:
Stripe holds that relationship, you toggle it on, and Stripe may review or
decline. It went straight through on Kenneth's account; it may not on David's.
Don't promise it before it's on.

**Why it matters:** Kenneth paid for a $129 car part with Klarna yesterday — three
payments of about $42 — with the cash sitting in his account. He chose to keep
the cash. That is the $599 buyer exactly, and it is also why the **Affirm badge
already on kessela.com is currently a promise checkout cannot keep.**

---

## 3. Already has — nothing to do

- **Stripe account** — exists. *(But see §0.1 and §2: Connect and payment methods
  are both still outstanding. "Has Stripe" is not "is set up".)*
- **kessela.com** — his domain, part of the brand he bought.

---

## 4. NOT setting up

- **LiveKit** — in the stack but not used. Don't create it, don't pay for it.
- **OpenRouter / Groq** — AI fallbacks on free tiers. Only needed if Google's
  allowance is exceeded. Skip unless it comes up.

---

## 5. Ad accounts — a separate half-day, not part of the hour above

**Google *Ads* is NOT the Google API key.** Different account, different billing,
different verification. Nothing chains off the API key.

| Account | Time | Gate |
|---|---|---|
| Meta Business Suite + ad account | ~1 hr | verification takes days (§0.2) |
| Meta domain verification | ~15 min | one DNS TXT record |
| Meta Pixel / Conversions API | ~1 hr | must fire on purchase |
| Google Ads | ~1 hr | medical device = restricted category, expect review |
| Google Merchant Center | ~1 hr | optional; needs product feed + returns policy |

**Spend nothing until the claims list exists.** An ad that cannot state a benefit
returns nothing at any budget, and a rejected ad account is slow to un-reject.

---

## 6. The bottom line

| | |
|---|---|
| **Fixed monthly** | **~$32–42** — server + phone number |
| **Variable** | Voice minutes, AI beyond the free allowance, payment fees per sale |
| **Measured AI spend, 30 days, whole platform** | **$2.57** |

**The AI is not the cost.** Almost all of it runs on free and local providers.
The cost of this platform is a server and a phone number.

The one line nobody can estimate is **voice minutes** — it depends on how many
calls a month the phone line takes. That is David's number, not ours.

---

## 7. How the hour runs

1. Log in as David, or create the account with **his email as owner**
2. Kenneth fills in everything up to the billing step
3. **David types the card. Kenneth looks at the ceiling.**
4. Copy the key into the platform, confirm it works, move to the next

Every credential, renewal and dispute is his from day one — including if Kenneth
disappears tomorrow.

**Bring:** the card, a phone for verification texts, and photo ID for Stripe.
