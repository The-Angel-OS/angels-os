# Angel OS as a Community-Organization OS — Verticals (2026-06-14)

The church template wasn't a church feature. It was the first proof that Angel OS is
a **vertical-template factory over one community-org stack**: a small organization,
online, in one provision. This doc grounds the thesis, the shared primitives, the
verticals, and — most importantly — the **one shared gap** whose closing lights up
every vertical (and our own revenue) at once.

## The thesis: six primitives, many vocabularies

A church, gym, Toastmasters club, makerspace, and market are the **same primitives
wearing different words**. ~90% of every vertical is the same engine.

| Primitive | Status | Church | Gym/Studio | Toastmasters | Makerspace | Market/Vendors |
|---|---|---|---|---|---|---|
| Website (Pages + blocks) | ✅ | parish site | studio site | club site | space site | market site |
| **Booking** (Services + Availability + bookingEngine) | ✅ | — | **class booking** | speech/role signup | **equipment/room booking** | **booth/stall booking** |
| **Community** (Spaces/Channels/presence) | ✅ | ministries | class groups | feedback/evals | project channels | vendor channel |
| **Money in** (Stripe Connect destination charge) | ✅ | giving | dues + drop-ins | dues | dues | booth fees |
| **Forms + e-signature** (Signatures) | ✅ | prayer/contact | **liability waivers** | guest signup | **liability waivers** | vendor agreement |
| Events/calendar | ✅ | services | workshops | meetings | classes | market days |

## The verticals (who each displaces, why it's a killer app)

- **Gyms / fitness studios** — booking + **waivers** (already built for rentals) +
  community is what they pay **Mindbody $139–599/mo** for. *Best first non-church
  target:* clear existing willingness to pay, the two must-haves already exist, and
  Kenneth has **two within walking distance**. Booking is the hook; the
  accountability/community layer is what Mindbody lacks.
- **Makerspaces** — equipment/room booking + **liability waivers** + project-channel
  community *is their culture*. Underserved (Skedda + Slack + a waiver PDF). Community-
  native crowd → they get the Spaces layer instantly. Ties to the rentals direction
  (a machine/room is a bookable asset).
- **Toastmasters** — tiny volunteer budgets, stuck on FreeToastHost. Low revenue per
  club, huge count, enormous goodwill. A community + meeting-roles play.
- **Markets / vendor booths** — the Pier (Clearwater), flea markets, farmers markets
  in **Safety Harbor, Dunedin, Tarpon Springs** (+ the other former Pinellas towns).
  A market is a **community of vendors**: booth/stall booking (reserve Saturday's
  spot), market-day events, a vendor community channel, booth fees via Connect. This
  one is **fractal** — the market is a community-org whose *members are themselves
  endeavors* (each vendor = an endeavor with its own catalog). That maps directly to
  the **holon/federation model**: a market holon containing vendor sub-endeavors. We
  already account for the *vendor* side with **Hays / Space Coast Cactus Farm** (Dave
  Rowe) — the new instance is the *market organizer* side.

> **Naming note (Hays Cactus Farm):** originally **"Hayes Cactus Farm"** (still the
> Google Maps listing), also **"Space Coast Cactus Farm"** per current owner Dave
> Rowe. Recommendation: keep the Google Maps name for discovery/SEO continuity;
> Space Coast can be a tagline/alias.

## The long tail under the thesis
Scout troops, HOAs, recovery groups, co-ops, neighborhood associations, music
ensembles, mutual aid, hobby clubs, book clubs, CSAs — any small membership/community
org that needs *a site + booking + community + a way to collect money + waivers*. No
point solution (Mindbody, Subsplash, Skedda, FreeToastHost) offers that combination
together. **That combination is the moat.**

## The one shared gap that unlocks everything

🔑 **Recurring memberships / dues.** Pledges (church), monthly membership (gym),
monthly dues (makerspace, Toastmasters), recurring booth (market). It's the *same*
Stripe-subscription build flagged for recurring giving. **Build it once → every
vertical gets recurring revenue, and so do we** (the platform fee rides on it). This
is the highest-leverage next build — it serves all five verticals, not one.

Second shared gap: a generic **member roster + "who's a member / dues current"**
model (clergy = officers = instructors = members = vendors). One people/membership
collection + block serves all.

## Baseline assumption: every endeavor manages ≥1 YouTube channel
Each endeavor (church, gym, vendor, club) assumes it runs **at least one YouTube
channel**, and eventually other platforms. Angel OS is the **content hub /
groundskeeper that syndicates OUT** to those platforms — it does not replace them
("Angel OS won't take over YouTube, probably ever"). We already have the rails:
`ingest_youtube_url` / `ingest_youtube_channel` tools, the Soulcast/social-automation
direction (issue #24), and the daily-rollup pipeline. So the site + the channel are
managed together as one presence — a real differentiator and a baseline capability
expectation for every vertical template.

## Strategic discipline
Four+ verticals = four+ sales motions; the risk is **sprawl**. The move:
1. **Build the shared primitives** (recurring memberships/dues + member roster) —
   they serve every vertical.
2. **Prove ONE vertical to real revenue** before chasing the next. Gyms = sharpest
   willingness-to-pay (already paying Mindbody; we have booking + waivers); churches
   = mission + warm intros. Run the **gym pilot + church demo in parallel** (different
   buyers, same engine); resist a third until one is paying.
3. **Thin per-vertical templates** on top (church template = the pattern; gym /
   makerspace / market templates are the same `provision* + apply-template` shape).

The factory thesis, applied to verticals: build the engine once, template the
vocabulary, let LEO do the provisioning.
