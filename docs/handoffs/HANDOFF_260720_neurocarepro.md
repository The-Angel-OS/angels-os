# Handoff — NeuroCare Pro engagement + platform work (260720)

Paste-ready context for a new session. Start by reading `docs/GLOBAL_PUNCH_LIST.md` (the living tracker) and this file.

## The engagement (why this matters)
Ken met **David Christenson** (CTO/Founder of NeuroCare Pro — FDA-registered Pulsed Light Medical Technology / red-light therapy; a genuine genius + millionaire, impressive Tarpon Springs operation) on **260720**. Strong interest — he asked Ken to forward evidence to his assistant **Dave**. Ken's read: *"all we have to do is deliver and it sells itself."* The pitch is **Angel OS = a platform David OWNS** (his server/keys, local or cloud, Cloudflare-tunneled), that automates his hundreds-of-calls-a-day + equips his affiliate salesforce.

- David: `davidc@neurocarepro.com` · Dave: `davea@neurocarepro.com` — both provisioned as **`tenant_admin`** on the NeuroCare Pro tenant.
- **Tenant 22** = NeuroCare Pro, live at **`neurocarepro.payloadnuke.com`** (self-host / payloadnuke node).
- Invite links (magic-link, NOT Google — David's Google OAuth hangs on Brave): `/tenant-invite/<token>` — regenerate/find via `dashboard/admin/invitations` or the invite script.

## Demo surface — LIVE on `neurocarepro.payloadnuke.com` (tenant 22, home page id 67)
- **Full-screen video hero** — David's own `hero2.mp4` (media 392, on R2).
- **MediaText "Why NeuroCare Pro PLMT Is Different"** — his copy + his YouTube video (`c_80DB54mJc`).
- **Google Reviews "What our patients say"** — real **4.8★ / 85 reviews**, Place ID **`ChIJGVrNKqjxwogRH8rgl41qVMM`** (the *business* listing; the maps share-link code `DPhtRG1ispLiDAzZA` was NOT a place id).
- **Light theme** — `branding.defaultTheme = 'light'` (per-tenant; Clearwater stays `auto`/dark).
- **`/proposal`** page (id 69) — the pitch + a "Proposal documents" links section.

## Deliverables — `C:\Dev\neurocarepro\artifacts\`
- `neurocarepro-deck.html` — 19-slide pitch deck (published artifact: https://claude.ai/code/artifact/a7cbc1c5-cfee-46e5-8315-6d4df5b16974)
- `neurocarepro-research.md`, `neurocarepro-campaign-playbook.md`, `neurocarepro-video-transcript.md` — uploaded to media (R2); linked on /proposal
- `ncp-video-audio.srt/.vtt` — timestamped captions (yt-dlp+Whisper, local)
- The analysis doc is in Ken's Google Doc.

## NEXT (in priority order)
1. **Polish the "Proposal documents" links** — currently raw `.md` in media. Recommended: render each doc as a **Page** in the Pages collection (on-brand, self-hosted) and point the /proposal links there; deck as an iframe page. (Options: keep media .md / convert to PDF / **Pages ★**.)
2. **Header logo** — shows the Angel default, not their wordmark. `branding.logo` is set (media 393) but `Header/index.client.tsx:261` doesn't hydrate it to an object. Fix the header's tenant fetch depth.
3. **Merlin `:3002` move** — Core (prod) and Merlin collide on host :3000; every restart is a coin-flip and Core losing = payloadnuke DOWN (happened this session). Merlin is currently **stopped** (task stopped) so Core owns :3000. Repoint code already committed (Merlin `7c2f167` — federation → payloadnuke). Remaining: Merlin `package.json` + `refresh-merlin.ps1` + cloudflared `merlin.payloadnuke.com` ingress → `:3002`, then restart the Merlin task. Then run `refresh-merlin.ps1`.
4. **Merlin thin-client auth re-wire** — authenticate AS the user (payload/Google/OIDC) against payloadnuke, hold their JWT, act as them, Angel OS distributes. Building blocks exist (connect page email login; Core `/api/auth/federated`; identity graph).
5. **Google OAuth hangs** — even on modern Brave (stuck on accounts.google.com — likely Brave query-param stripping + our cross-subdomain token-relay). Use email login meanwhile. Investigate `/api/auth/complete` + token-relay.
6. Then the broader roadmap: telephony (Vapi) wiring, forms + email campaigns, FeatureCards block, LMS Quiz on Works, Platform Costs ledger.

## Platform features SHIPPED this session (all on `main`)
fullScreen hero (video/image), MediaText block, per-tenant `branding.defaultTheme`, reachable self-host portal domains (`getPortalDomainSuffix`), GoogleReviews block+business-place fallback, LEO bubble Spaces deep-link, global punch list, Merlin→payloadnuke repoint.

## ⚠️ Durable gotchas learned this session
- **WSL2 was uncapped → ate 14GB → machine DOA.** Fixed with `C:\Users\kenne\.wslconfig` (memory=12GB, autoMemoryReclaim). **BATCH code changes into FEW rebuilds** — each `next build` in the container spikes 4–8GB in WSL.
- **Merlin (task, host :3000) vs Core (Docker, host :3000) collide.** A stale Merlin node squatting `0.0.0.0:3000` blocked Core after a restart → cloudflared → Host Error. Fix = free :3000 + `docker restart angelos-core`. Permanent fix = Merlin → :3002.
- **Media collection blocks `text/html`** (XSS) — can't upload the HTML deck.
- **CTA block links = `maxRows: 2`** — >2 links must go in a Content block with Lexical link nodes.
- **Google "place id" from a maps *share link* (`maps.app.goo.gl/XXX`) is NOT a place id** — resolve the short URL (the `!19s` segment is the real `ChIJ…` id) or Places `searchText`; reviews live on the BUSINESS place, not the address place.
- Container one-off scripts: `docker cp` the .ts in + `node_modules/.bin/payload run <script>` (tsx is pruned; `payload run` needs top-level await, not a floating `main()`).

## Ops quick-ref
- Rebuild Core: `docker compose -f C:/Dev/datacenter/stack/docker-compose.yml --project-directory C:/Dev/datacenter/stack up -d --build core` (~3–5 min; boot-migrate runs pending migrations). Bounces the live node — batch changes, don't over-rebuild.
- DB: `docker exec -i angelos-pg psql -U postgres -d angels`
- Ken's user id = 3.
