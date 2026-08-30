# HANDOFF 260722 — Demo day live-ops (NeuroCare Pro + MobileMech1)

> New-session primer. **`docs/GLOBAL_PUNCH_LIST.md` is the single living issue board — read it
> first; it was updated this session** (new 260722 shipped batch + 4 new open items).

## Where things stand
- **Self-host stack** on Ken's laptop (`angelos-core` + `angelos-pg`, compose at
  `C:/Dev/datacenter/stack/docker-compose.yml` — NOT a git repo). Rebuild command:
  `docker compose -f C:/Dev/datacenter/stack/docker-compose.yml --project-directory C:/Dev/datacenter/stack up -d --build core`.
  Env-only change → recreate without `--build`.
- **A rebuild was IN FLIGHT at handoff time** carrying `03a8ecf` (auth batch) + `91ef738`
  (vision fix). Verify container is healthy and serving both before assuming anything below is live.
- **Demo happened**: Ken met David Christenson 260722 1pm (NeuroCare Pro, tenant 22).
  MobileMech1 = tenant 23 at `mobilmech1.payloadnuke.com`.

## Shipped today (commits on main)
| Commit | What |
|---|---|
| `d34c43d` | Every lead (voice + web form) auto-harvests a CRM Contact — `upsertContactFromLead` (dedupe tenant+email→tenant+phone, fill-blanks-only, notes accumulate) wired into `deliverLead` + `routeFormToAIBus`; view at `/dashboard/admin/contacts` |
| `bbf45a9` | Vapi `model.tools` invocations arrive as **`tool-calls` events** (not legacy `function-call`) — were silently no-oping; response contract `{results:[{toolCallId,result}]}` |
| `f479c56` | Command-center stats tenant-scoped (was showing whole-system numbers) |
| `508c7ef` | Media library picker filters by tenant; LEO sidebar chat gets the full composer control surface |
| `03a8ecf` | Passwordless auth: email code + **SMS OTP (Twilio Verify)**; `users.phone` E.164 anchor + normalize-on-save; self-service phone field on Account; provider-style "📱 Continue with a code" login button; `docs/AUTH_PHONE_SIGNIN.md` = the mapping contract |
| `91ef738` | Vision chain: retired `gemini-2.0-flash` fallback (404) → `GEMINI_VISION_MODEL \|\| GOOGLE_MODEL \|\| gemini-flash-latest` |

Plus non-repo: R2 bucket CORS extended to `https://*.payloadnuke.com` (Ken pasted merged policy);
`next.config.js` `middlewareClientMaxBodySize: '150mb'` (Next 16 default 10MB was truncating video
uploads); pg `ALTER DATABASE angels SET idle_in_transaction_session_timeout='300s'` (60s reaped
upload transactions); migrations `20260722_010000/020000/030000` applied (contacts phone/voice,
users.phone, redirects).

## Twilio (working, verified live by Ken)
- Verify service SID + Account SID + auth token live in `.env.local` (~lines 71–74) — not
  reproduced here (GitHub push protection). $20 loaded on the account.
- **No from-number / no 10DLC needed** for Verify OTP. Per-portal branding
  (`CustomFriendlyName`) coded but Twilio returns 60204 until approved → auto-degrades to
  "Angel OS". Raw outbound SMS (lead alerts) still needs 10DLC + a number (`resolveSmsSender` ready).

## LEO vision failure — root cause (today's last task)
Ken asked LEO to derive bookable services from the `mobilemech1_hero` flyer; LEO said "I couldn't
read that image." Two stacked failures: **(1) Anthropic key OUT OF CREDITS** (primary vision, now
providerHealth-skipped), **(2) Gemini fallback hardcoded to retired `gemini-2.0-flash`** → 404.
Fixed (2) in `91ef738`. (1) is Ken's call — Gemini vision suffices and is ~10x cheaper.
The *outcome* was delivered manually: **14 services exist on tenant 23** matching the flyer
(brake job $195, A/C compressor $300, radiator $175, A/C recharge $99, starter $150, front pads
$99, pre-purchase inspection $99 + diagnostics/alternator/battery/tune-up/water-pump/suspension/
service-call). Seed script: `src/scripts/_local/` (uncommitted _local scripts, see git status).

## Open items for next session (also on the punch list)
1. **Verify the rebuild** landed, then re-test LEO image analysis (space 72 / channel 610 on
   mobilmech1) — and fix `analyze_image` being called without `mediaId` (LEO should default to
   the message's attachment).
2. **Ken-side**: set David C's phone on his User record (Users → Phone); Anthropic credits
   decision; run the elevated Merlin→:3002 one-liner; disable Docker Model Runner; 10DLC
   campaign + CustomFriendlyName approval (optional).
3. **Nimue APK build** — chat-echo fix sits in `C:\Dev\nimue` commit `98ca0df`, unshipped.
4. Punch-list carry-overs: proposal pages voice/RAG exposure (P2), dashboard settings
   consolidation (ranked plan on punch list), AI Costs→Infrastructure Costs + AI Bus→System Bus
   renames, systematic tenant-filter audit (offered, unconfirmed), orphaned NULL-tenant address
   row (id 1) awaiting delete/re-home.

## Hard-won lessons (already in memory, repeated because they bit twice)
- **Test the provider's REAL contract** — hand-built payloads in the shape you assume pass your
  own tests and fail live (Vapi `message.phoneNumber`, `server.url` vs `serverUrl`, `tool-calls`
  vs `function-call`).
- Retired model ids fail as 404 *inside fallback chains* where nobody looks — pin model names to
  env with a `-latest` alias default.
