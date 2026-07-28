# Kessela — accounts to set up

**Bring this to the session.** Everything is created in **David's name, on
David's card**. He types the card; I don't touch it. Roughly an hour.

---

## Needs a card

| # | Account | What it does | Cost |
|---|---|---|---|
| 1 | **IONOS** — Linux VPS | The server. Runs the whole site, database, admin and AI. | **~$30/mo** for 12 vCore / 24 GB / 640 GB. Entry tiers from $2–9/mo but too small for this. |
| 2 | **Twilio** | Text-message sign-in codes and the SMS number | **~$1–2/mo** per number + ~1¢ per text |
| 3 | **Vapi** | The AI phone line that answers and books | **~$0.05/min** platform, **~$0.15–0.33/min** all-in once voice + model + carrier are counted. Pay as you go. |
| 4 | **Google Cloud** | Maps, calendar, mail, and the Gemini AI key | Pay as you go. Free monthly allowance covers current volume — **$0 measured over 30 days** |
| 5 | **Cloudflare** | Image/video storage (R2) + DNS | **Free** to start — 10 GB included, then ~1.5¢/GB |
| 6 | **Resend** | Order confirmations, claim replies, password resets | **Free** to 3,000 emails/month |

## Already has — nothing to do

- **Stripe** — payments. % per transaction, no monthly.
- **kessela.com** — his domain, part of the brand he bought.

## Not setting up

- **LiveKit** — in the stack but not actually used. Don't create it, don't pay
  for it.
- **OpenRouter / Groq** — AI fallbacks. Free tiers, only needed if Google's
  allowance is ever exceeded. Skip unless it comes up.

---

## The bottom line

| | |
|---|---|
| **Fixed monthly** | **~$32–42** — server + phone number. That's it. |
| **Variable** | Voice minutes (only when the phone line is used), AI beyond the free allowance |
| **Measured AI spend, last 30 days, whole platform** | **$2.57** |

**The AI is not the cost.** Almost all of it runs on free and local providers
already. The cost of this platform is a server and a phone number.

---

## How the hour runs

1. Log in as David, or create the account with **his email as owner**
2. I fill in everything up to the billing step
3. **He types the card.** I look at the ceiling.
4. Copy the API key into the platform, confirm it works, move to the next one

Every credential, renewal and dispute is his from day one — including if I
disappear tomorrow.

**Bring:** the card, and a phone for the verification texts most of these send.

---

## Order matters

Do **1 (IONOS)** first — the server takes a few minutes to provision and can
build in the background while we do the rest. Do **5 (Cloudflare)** second, so
DNS has time to propagate. The other four are five minutes each.

---

## Do these two FIRST — they are not optional

**1. Stripe Connect for Kessela.** Right now the tenant has no connected account,
so every sale on the site lands in Kenneth's Stripe rather than David's. Ten
minutes in the dashboard, and until it is done the 10% cannot be collected
automatically and David's name is not on the receipt.

**2. Start Meta business verification.** It can take days and nothing else can
proceed without it. Create the account and submit verification on day one even
if no ad runs for two weeks.

## Ad accounts — a separate half-day, not part of the hour above

Google *Ads* is NOT the Google API key. Different account, different billing.

| Account | Time | Gate |
|---|---|---|
| Meta Business Suite + ad account | ~1 hr | verification takes days |
| Meta domain verification | ~15 min | one DNS TXT record |
| Meta Pixel / Conversions API | ~1 hr | must fire on purchase |
| Google Ads | ~1 hr | medical device = restricted category, expect review |
| Google Merchant Center | ~1 hr | optional; needs product feed + returns policy |

Do not spend a dollar until the claims list exists — an ad that cannot state a
benefit returns nothing, and a rejected ad account is slow to un-reject.
