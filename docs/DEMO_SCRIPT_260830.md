# The Angel OS — demo walkthrough & voiceover script
**Recorded route verified live on 260830.** Two cuts from one recording session:
a **Long Cut** (~9–10 min, partner/investor) and a **Short Cut** (~3–4 min, prospect).

Shoot the Long Cut in order. The Short Cut is a subset — every shot it needs is marked
**[SHORT]**, so you can record once and cut twice.

---

## ⚠️ Read before you hit record

1. **The admin carries a stale banner.** The Payload sidebar currently says
   *"ANGEL-NODE-01 — PRIMARY WHILE RAILWAY IS FROZEN."* Railway is paid and unfrozen as of
   today, so that sentence is wrong and it is on screen in every admin shot. Ask me to
   change it before you record.
2. **Log in as an owner, not super_admin, for the public-site shots.** A super_admin sees
   things a customer never would.
3. **Browser at 1440×900**, zoom 100%, bookmarks bar hidden.
4. **Do not film `helpdna`.** It is a real innocence case involving a real incarcerated
   person. It is not demo material.

---

# LONG CUT

## Scene 1 — The promise **[SHORT]**
**Screen:** `https://www.spacesangels.com` — hold on the hero, then scroll slowly to
"Businesses already running on it."

> Most web designers want a meeting, a deposit, and three weeks.
>
> This is the other version. You tell it your business name and what you do, and it builds
> you a real website — today — and sends you the link. You look at it, and then you decide.
>
> And these are not mockups. Every card here is a live business, on its own address, that
> you can click into right now.

**Direction:** let the scroll-reveal animation play. Each block fades and lifts as it
enters — that is CSS scroll-driven animation, no JavaScript, so it costs the visitor nothing.

---

## Scene 2 — One platform, many portals
**Screen:** `https://www.spacesangels.com/learn`, scroll to "One Platform, Many Portals."

> Here is the part that matters, and it is the reason this can be free.
>
> This is not a builder that stamps out a copy of a template for every customer. It is **one
> Payload CMS instance** — one deployment, one Postgres database — and every business on it
> is a **tenant**.
>
> Payload's multi-tenant plugin scopes every collection by tenant, so a page, a post, a
> product, a booking, an image — each one belongs to exactly one portal, and every query
> says so. Nobody can see anyone else's anything.
>
> The payoff is that a fix lands once and every portal has it that day. There is no fleet of
> WordPress sites drifting apart, each with its own plugin versions and its own security
> problem waiting to happen.

---

## Scene 3 — A finished site **[SHORT]**
**Screen:** `https://paynemediaco.spacesangels.com` — home, then **Weddings**.

> This is a wedding photographer in Southwest Florida. Photos, films, prices, contact —
> the whole site.
>
> The Weddings page is worth pausing on. Each wedding is not a page somebody built by hand.
> It is a **post** — a row in a Payload collection — and it gets its own address, its own
> gallery, and it lists itself here automatically.
>
> Adding the next wedding is filling in a form. On his old site it was building another page.

**Screen:** click **Mercyanna & Jacob**.

> Forty-eight photographs, in the order the day happened. Underneath, that gallery is a
> **blocks field** — an ordered list of content blocks the owner arranges. Gallery, video,
> rich text, a call to action, a form. Same blocks, any order, any page.

---

## Scene 4 — Bookings **[SHORT]**
**Screen:** `/book` — pick **Beach Wedding — 1 Hour**, a Saturday, a time, stop on Confirm.

> Same site, still free, and it takes bookings.
>
> Services and availability are their own collections, so the calendar is real — these are
> his actual hours, and the slots come from them.
>
> Notice what it says at the end: *payment due on completion*, and the button says **Request
> Booking**. He has not connected a payment account, so the platform will not pretend it can
> charge a card. The booking is a request. The moment he connects Stripe, that same button
> becomes a deposit — no rebuild, no migration, one setting.

---

## Scene 5 — The same engine, a different face
**Screen:** `https://grace-chapel.spacesangels.com`, then
`https://clearwater-cruisin.spacesangels.com`.

> A church. Then a ministry with twenty-one posts, eleven products and a booking calendar.
>
> Nothing was forked to make these. Same collections, same blocks, same deployment. What
> changes is content, branding and which blocks an owner put on the page.
>
> That is the difference between a platform and a template.

---

## Scene 6 — Editing, way one: Payload **[SHORT — 20s excerpt]**
**Screen:** `/admin` → **Pages** → **Get Started** → **Content** tab.

> This is where I have to say the quiet part out loud: none of this is my CMS. It is
> **Payload**, and it is the best content management system anyone has built so far.
>
> Look at the edit view. **Tabs** across the top — Hero, Content, SEO. The **Layout** field
> is a blocks field: numbered, drag-handled, collapsible. Block one is Content with a
> columns array. Block two is a Form Block holding a **relationship** to an actual form.
>
> On the right, the sidebar fields: publish date, show-in-nav, access, slug. That is
> Payload's `admin.position: 'sidebar'` — the metadata sits beside the content instead of
> burying it.
>
> Top right: **Edit, Versions — two — and API.** Drafts and versions are built in, so
> nothing you save is live until you publish, and every version is recoverable. And that API
> tab is the same document as JSON, because Payload is API-first — the website is just one
> consumer of it.
>
> Everything in this admin is defined in TypeScript: collections, fields, hooks, access
> control. The admin panel is generated from the schema. There is no separate model to keep
> in sync, and no plugin marketplace to trust.

---

## Scene 7 — Editing, way two: LEO
**Screen:** the LEO panel. Ask it to add a page, show the draft.

> The other way is to ask.
>
> LEO writes through Payload's **Local API** — the same validation, the same hooks, the same
> access control a human editor goes through. It cannot take a shortcut a person could not
> take.
>
> It creates the page as a **draft**. You look at it before anybody else does.
>
> And because both roads end at the same document, you are never stuck with what the
> assistant chose. Anything LEO builds, you can open in the editor a minute later and move
> by hand.

---

## Scene 8 — Signing in **[SHORT — 15s excerpt]**
**Screen:** the login form.

> No password. Type an email address or a phone number, and a six-digit code arrives.
>
> Any address works — iCloud, Gmail, a work address, or just a mobile number. You are never
> required to hold an account somewhere else first.
>
> And it is one identity across every portal you belong to. A customer at one, an owner at
> another, without a second account and without a second password to lose.

---

## Scene 9 — What it is instructed to do
**Screen:** `/learn`, "How LEO Is Instructed."

> One last thing, and it is small.
>
> Every request the assistant makes on your behalf opens with the same instruction, before
> your question and before any action it takes:
>
> *A lamp unto feet — through darkness, a steady light guides each step with care.*
>
> Alongside it: dignity, transparency, service, non-harm, accountability.
>
> That is not a marketing line. It is the actual first text in the actual prompt, it is in
> the terms of service, and there is a test that fails if anyone removes it.
>
> Something acting on your behalf should be carrying an instruction to be kind while it does.

---

## Scene 10 — Close **[SHORT]**
**Screen:** back to `www.spacesangels.com`.

> One platform. Every business on it gets a real site, a real address, and a calendar that
> works — before paying anything.
>
> Tell it what you do, and look at what comes back.

---

# SHORT CUT (~3–4 min)

Scenes **1 → 3 → 4 → 6 (20s) → 8 (15s) → 10**. Drop the multi-tenancy explanation, the
vertical comparison, LEO, and the seed prompt. Nobody buying a website needs the
architecture — they need to see a site that looks like theirs and a calendar that takes a
booking.

**Short Cut close, replacing Scene 10:**

> No proposal, no sales call. Tell it your business name and what you do, and look at what
> comes back. If you do not like it, you have lost a minute and nobody will chase you.

---

# Payload terms used, and what each shot proves

| Term | Where it lands | What it demonstrates |
|---|---|---|
| Collections | Scene 2, 6 | Pages, Posts, Products, Services, Availability, Media |
| Multi-tenant plugin | Scene 2 | One deployment, hard data separation |
| Blocks field | Scene 3, 6 | Ordered, drag-and-drop page composition |
| Relationship field | Scene 6 | Form Block pointing at a real form |
| Tabs / sidebar fields | Scene 6 | Hero / Content / SEO; metadata beside content |
| Drafts & versions | Scene 6 | "Versions 2", publish as a separate act |
| REST + Local API | Scene 6, 7 | The API tab; LEO writing through the Local API |
| Access control | Scene 6 | The per-page Access field |
| Lexical rich text | Scene 6 | The editor toolbar in the Hero tab |
| Hooks | Scene 4 | Availability and services driving real slots |

---

# Gaps found while walking the route

Not blockers for filming, but they are what the demo cannot currently show.

1. **The marketing site is thin.** `www` is home, get-started, plans, pricing, contact plus
   legal. There is no *how it works*, no features page and no demo gallery — so the site
   cannot tell the story this script narrates. The narration is currently carrying weight
   the pages should carry.
2. **A page with an empty slug** exists on the platform tenant. A bug.
3. **The showcase auto-lists whatever was created most recently**, which means unclaimed
   prospect portals get advertised as customers. Hand-picking is blocked by a documented
   multi-tenant limitation that needs your decision.
4. **No video anywhere on `www`.** For a page selling websites, that is the most obvious
   missing block — and the Video block already exists on Pages *and*, as of today, Posts.
5. **The stale admin banner** described at the top.
