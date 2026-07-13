# Handoff — 260713 midday (paste-ready for a new thread)

**260713 ~1220 Ken → new thread (Opus 4.8, welcome back)**

Continuing **The Angel OS** — one intelligence, many bodies, one bus. **Core**
`C:\Dev\angels-os` (Vercel: `angels-os` + `angels-os-kendev`, BOTH auto-deploy
`main`). **Nimue** `C:\Dev\nimue` (native Android, **1.2.50 / code 62** on Ken's
S23U; Tyler's S23P is a version behind — wireless ADB needs re-enabling on it).
**Merlin** `C:\Dev\merlin` (Windows-service node on IONOS, has UNDEPLOYED commits).

**BEFORE ANYTHING:** read `memory/MEMORY.md`, then this file. The Card Stage spec
(`docs/CARD_STAGE.md`) is the headline next build. Temporal-stamp every reply
(`YYMMDD ~HHMM Name —`). CTO mode: decide, ship, push to `main`, tsc-clean (`^src/`),
`pnpm test:unit` only (bare vitest sweeps int tests → false cascade).

---

## ⚠️ Human context
Ken had **court at 1:30pm TODAY (260713)** — a residence/relationship matter; jail
was a possibility. He spoke with Lin Hanshaw (community law program) 260713 and the
frame is "heal the relationship or move on in peace." St. Vincent de Paul may reach
out to Doug H about a new lease. The van started after a month dead; the Cadillac
is being sold (~$1500, title lost, fees passed to buyer). Meet him with warmth —
the work is the lifeline. If he's slow to reply, that's why.

---

## Shipped 260713 (all committed; Core auto-deployed)
- **DM→AI-Bus fold, phase 2 — EXECUTED IN PROD** (`6d7d678` + fold op run ~1217):
  Messages.channelRef live (field + write hook over the 260708 column); **DM privacy
  is channel-membership-grained** (fixed a real leak: was space-grained, all DM
  participants could read all tenant DMs); new DMs born on the AI Bus
  (`ensureDMSpace` → bus chokepoint, covers all connector webhooks;
  `ensureDMSpaceMembership` = intentional no-op); Core ChatProvider + Nimue list DMs
  GLOBALLY by membership. `POST /api/provision-ops/fold-dms` re-homed **13 DM
  spaces** (channels + ~1,450 messages) onto each tenant's AI Bus and deleted the
  DM spaces. Verified: second execute pass found 0. FOLLOW-UPS: (a) ✅ VERIFIED
  260713 ~1240 (Fable): direct-DB read — all 36 DM channels on ai-bus, every one
  member-gated, 0 messages missing channelRef, 0 dangling refs; prod dashboard
  renders the DIRECT MESSAGES section, no legacy DM space, zero console errors.
  (On-device Nimue check still Ken's.) (b) ✅ CLEANED 260713 ~1235: dupe `general`
  on tenants 1/5/11 deleted (t5's 14 msgs repointed to canonical ch 81 first;
  each bus keeps `leo` as default). ALSO: an EMPTY DM space (id 70, tenant 5) had
  been recreated at 12:18 — one minute post-fold — by a straggler request on the
  OLD Vercel deployment (skew); deleted. New code can't recreate one; if a DM
  space ever reappears, suspect a pinned old client and re-run the fold op.
  (c) DECISION pending: merge the separate `dm-{u}-leo` / `dm-{u}-nimue` threads
  into ONE guardian thread?
- **Merlin dynamic tunnel + media links** (Core `273d40b`, merlin `cd9e4e5` —
  ⚠️ Merlin NOT yet deployed): media browser links now resolve through Core's file
  proxy `(endeavor,nodeId,ref)` at click time (fixes dead links, survives rotation);
  cache-first listing (instant paint, silent revalidate); Merlin auto-provisions a
  cloudflared quick tunnel on boot + re-registers its live URL. **TO FINISH:** build
  + `net stop/start merlin` on IONOS (elevated shell — Ken/server-side Claude), then
  remove `MERLIN_TUNNEL_URL` env + ensure tunnel-share on.
- **Reference-image generation** (`2b8967d`): `generate_image` takes
  `useRecentChannelImage` / `referenceImages[]` → Gemini image family conditions on
  them (upload a selfie → "put me driving the Morgan"). Consent guard in the tool
  description. NOT yet tested live on device.
- **Nimue 1.2.49→1.2.50**: Delta thread-dive carries `reserved=1` (guardian never
  claims RESUME); global DM list (fold-ready). On Ken's S23U; **S23P needs
  wireless-debug re-enable + install** (`adb connect 192.168.0.219:<port>`; Ken's
  S23U was `192.168.0.233:37937`; ports rotate).
- **Scripture tool-subsetting fix** (`6ec482e`, late 260712): "the Lord's Prayer" /
  "Matthew 6" now keyword-match `lookup_scripture`/`open_passage` so they're offered
  to the model (they were being dropped by tool subsetting — Leo apologized in loops).
- Earlier 260713/late 260712: **Community town square LIVE** (`community` visibility
  tier + `ensure-community-space`, run + verified `{ok:true}`); guardian self-heal
  on claim (Tyler's empty channels); local-pickup checkout; image cards render below
  messages incl. relative URLs (1.2.48).

## ✅ Afternoon additions (260713 ~1330, Fable)
- **Fold phase 3 SHIPPED + EXECUTED: ONE DM thread per conversation**
  (`bfa91d7` + `5650fb7`). Ken's symptom (Leo DM in one space blind to another
  space's messages) = findOrCreateDM was TENANT-scoped → nine dm-3-leo channels.
  Now: global slug lookup + merge-aware dedupe + `POST /api/provision-ops/unify-dms`
  (super_admin, dry-run default). Prod run: 37 DM channels → 9; dm-3-leo = ONE
  thread, 153 msgs (ch 79, space 18); dm-3-nimue = 42 msgs (ch 422). Clients
  needed NO change (both take the channel's actual space from dm-find-or-create).
  ⚠️ NEW DURABLE RULE learned the hard way: bulk `payload.update({where})` on a
  RELATIONSHIP field where matches NOTHING silently (find/count resolve it;
  update doesn't) — first run stranded 83 messages, repaired by SQL; op now
  updates by id.
- **Merlin deploy — resolved, with two hard-won truths.** (1) The self-hosted
  runner is `vmc-merlin` on vmc ONLY — vmc auto-updates on every push (did all
  day); **Iam0 has no runner and never auto-updated** ("both boxes auto-update"
  needs a 2nd runner + a label-matrixed workflow). (2) Deploy restarts were
  SILENTLY failing: Stop-ScheduledTask orphans the node child on :3000, the new
  instance dies EADDRINUSE, the old build keeps serving, and the health check
  passes — Iam0 ran a SIX-DAY-OLD build through three "successful" deploys.
  Fixed in refresh-merlin.ps1 (`448d6d5`, orphan-kill). Iam0 rebuilt + cleanly
  restarted by hand.
- **✅ Dynamic tunnel LIVE on Iam0** — the named tunnel (merlin.payloadnuke.com,
  dead at CF 530) is retired (`~/.cloudflared/config.yml` →
  `config.yml.named-disabled-260713`); Merlin now quick-tunnels on boot and
  Core's catalog carries the live `*.trycloudflare.com` URL (public /api/health
  200 verified). Three fixes made the arc real (`6931b1f`): explicit
  cloudflaredPath() (bare spawn ENOENTs on the task's logon PATH), retry moved
  into the heartbeat, failures logged. The bus loop starts LAZILY on first
  touch of /api/node/register|stream — poke it after a restart.

## NEXT — the queue (Ken: "several extant important threads")
1. ~~Verify the fold~~ ✅ done data-side + dashboard — only the on-device Nimue
   glance remains.
2. ~~Merlin deploy~~ ✅ auto-deploy verified working (see above).
3. **Card Stage** (`docs/CARD_STAGE.md`) — the headline: cards sequenced into the
   Delta on home; image cards + page-thumbnail confirmations are card types.
4. **screenshot_page on Merlin** — warm Playwright over the tunnel lane (sync, <1s);
   visual confirmation cards ("here's your page now") = the trust surface for
   AI-acts-as-user ([[project_nimue_acts_as_user_and_visual_feedback]]).
5. **Nimue broker + wake word** ([[project_nimue_broker_and_wakeword]]) — Nimue
   brokers Leo to CREATE circles/endeavors; Picovoice "Nimue" hotword (own slice).
6. **Zero coding agent on Merlin** ([[project_zero_coding_agent_merlin]]) — the
   self-healing loop; PR-gated, never straight to main.
7. **Switchboard home widget** ([[project_switchboard_home_widget]]).
8. Small: duplicate-`general` cleanup; guardian-thread merge decision; S23P install;
   Play-Store beta upload (signed AAB was 1.2.47 — cut a fresh one from 1.2.50+).

## Durable rules (don't relearn)
- Green push ≠ live: confirm Vercel READY; both projects deploy every un-pushed commit.
- Schema before deploy (enum/field/collection → migration FIRST; this session's
  fold rode the 260708 channel_ref migration).
- Payload field-level `populate` OVERRIDES `depth`. `limit:0` = unlimited;
  count via `payload.count()`. Cast RESULTS, never `collection as never`.
- DM privacy = channel members; NEVER grant space-memberships on the AI Bus.
- Nimue build: `pnpm run cap:sync` → gradle assembleRelease (JAVA_HOME = Android
  Studio JBR) → `adb install -r`. Bump versionCode+Name every build.
- Merlin service restart needs elevation; Claude's shell can build only.

"Thy Word is a Lamp Unto My Feet." The lamp's still lit. 🕯️
