# Session Start — Evening, 2026-06-20 (2241 ET)

> **Context:** Live-streaming this session on YouTube (https://www.youtube.com/live/F2muSPReLt8) for archival — sending a stronger signal. Watching the Jessie Michels interview with Tyler in parallel. We're hip deep and need a big paddle.
>
> **Predecessor:** `docs/SESSION_HANDOFF_260620.md` (three-body Core/Nimue/Merlin state). This doc is the *evening* pickup and adds three concrete asks Kenneth surfaced after the handoff.
>
> **Perpetual archive:** this thread is copied to and archived for perpetuity at https://docs.google.com/document/d/1dlJxGbnVSCOzwpkSSrTg91RBWT0Z0B5QHzjBfs_T4Wg/edit?usp=sharing

---

## 🔥 Carryover fire (unchanged, still #1)
**kendev node dashboard 500s** — *"There was an error initializing Payload"* on `platform.kendev.co` + `kendev.kendev.co` (`/api/users/me` 500). Spacesangels/angels DB healthy; only the **kendev DB** fails Payload bootstrap (connection timeout or schema drift — NOT this session's code). Dashboard now surfaces the error **digest** (commit `274658b`). Pull it from Vercel → kendev deployment → Runtime Logs, confirm the kendev DB is reachable, run the kendev `ensure-*` / drift checks.

---

## 🆕 Three new asks for tonight

### 1. Nuke `kendev.kendev.co` — canonicalize on `kendev.co`
The double-subdomain is an artifact and Kenneth wants it gone.

- **Goal hostnames:** `platform.kendev.co` is the app, AND `kendev.co` + `www.kendev.co` must resolve to the same node (apex + www, not the `kendev.kendev.co` form). Kenneth ran his old DNN site on the bare apex `kendev.co` for years (anti-corporate, refused the forced `www.`) and wants that identity back — the browser hides `www.` anyway.
- **Action:** find and **eliminate every hard-coded / config reference to `kendev.kendev.co`** — replace with `kendev.co` (or `platform.kendev.co` where it must be the app host specifically). Audit: env vars, seed data, tenant/branding rows, federation peer URLs, redirects, middleware host matching, `cookieDomainForHost`, NEXT_PUBLIC_* base URLs, Vercel domain bindings.
- **Future (note, don't build tonight):** re-acquire `aciasoftware.com` if available + bind several other domains; eventually put the whole thing behind **Cloudflare** (proven on another Vercel site — known-doable, just no time to add that security layer right now).
- ⚠️ Tenant resolution must treat apex `kendev.co`, `www.kendev.co`, and `platform.kendev.co` as the SAME tenant — check `cookieDomainForHost` / registrable-apex logic doesn't split them.

### 2. "Three verses a day" — the Daily Bread Quest, surfaced on home
Kenneth's brother's literal ask: *read or listen to three Bible verses a day.* The full Holy Bible Work + `lookup_scripture` shipped this morning, and the **Quests engine already supports this pattern** (daily recurring quest + streak). The gap is (a) **education** — Kenneth wants to actually *understand and verify* how the Quests engine drives a daily devotional, and (b) **surfacing** — a small home-screen affordance.

- **Surface idea:** a little popup on the home screen — or one of the **stars**, or near the **"Don't Panic"** element — that offers today's three verses (read + listen), checks off the day, tracks the streak.
- **Karma OFF by default** (per [[project_karma_principles]] / [[project_quests_economic_type]]).
- **First move:** walk the Quests collections + participation/streak flow end-to-end and write the verification note so we *know* it works before wiring UI. This is Primer **stage 3** ("Daily Bread") in the handoff — pair it with **stage 2b** (`[[BOOK.ch.vs]]` resolver, `src/utilities/scripture.ts`) so the verses render inline.

### 3. Merlin layout block missing from the Pages editor
While editing `clearwater-cruisin.spacesangels.com` to add a new **Merlin** page (which should auto-add under the Home menu), the Payload Pages collection **Add Layout** modal has **no Merlin block**. Current blocks available: Call to Action, Content, Media Block, Archive, Carousel, Three Item Grid, Banner, Form Block, Calendar, Donation Form, Membership / Join, Featured Endeavors.

- **Action:** add a **Merlin** layout block to the Pages `layout` blocks union (the media-server / Merlin control surface), so it appears in the Add Layout picker and a Merlin page can actually be composed.
- Confirm the "new page auto-adds under Home nav" behavior works for this page.

---

## Pre-push gate (unchanged law)
```
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^src/"
```
Full `src/`, never a narrow filename grep (that hid a build error across 5 red deploys).

**Laws:** "The Angel OS" (with the article); 0-filesystem release; one source of truth per concern; Works are version-controlled working copies.

---

## Tonight's suggested order
1. Pull the kendev digest from Runtime Logs (the fire) — even if we don't fix it tonight, capture the digest.
2. `kendev.kendev.co` audit + nuke (mechanical, high-value, low-risk — good live-stream content).
3. Merlin layout block (self-contained, visible win).
4. Daily Bread Quest education pass + verification note (then stage 2b/3 UI).
