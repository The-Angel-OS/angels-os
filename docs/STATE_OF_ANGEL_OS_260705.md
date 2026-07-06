# State of The Angel OS — 2026-07-05

> Standing handoff after the "three-body chat cleanup + native STT + call-audio + money-hook recon"
> session. Supersedes docs/STATE_OF_ANGEL_OS_260704.md. Conventions: temporal-stamp every reply
> (`YYMMDD ~HHMM Opus 4.8 —`, open and close, markdown headings — Ken archives each
> prompt+response into a companion Google Doc); commit on `main`, push only when Ken says;
> one AI on the codebase at a time. "The Angel OS" (with the article).

---

## 1. The System — three bodies, one mind, one bus

One intelligence in three embodiments sharing a portable brain (`leoBrain.ts` / `runBrain` —
pure fn over a neutral message + neutral tool shape, the **sacred contract**). Each bolts on
its own tool belt:

- **Core** — `C:\Dev\angels-os`. Cloud: multi-tenant Payload CMS 3.77 (parked off 3.85) +
  Next 16 on Vercel; Spaces chat, LEO, federation, commerce, Works/Library. Repo
  github.com/The-Angel-OS/angels-os. `pnpm dev` → :3000.
- **Merlin** — `C:\Dev\merlin`. Home node: media server + local-compute contributor + sensor
  (camera/window). Runs as an **interactive-session Scheduled Task "Merlin"** (LocalSystem
  service retired — session-0 isolation blocked Sentinel window/camera capture).
- **Nimue** — `C:\Dev\nimue`. Native-first Android away team.
- **angel-brain** — `C:\Dev\angel-brain` (…/angel-brain). Unblocked → Core, not yet wired.

---

## 2. Deployed state (start of 260705)

- **Core (angels-os):** prod at `4ae2849`, READY. Both Vercel projects (angels-os +
  angels-os-kendev) auto-deploy main. Gate before every push: `pnpm exec tsc --noEmit`
  (zero src/ errors — the rest is known stale test drift), then confirm the deploy flips
  READY via the Vercel MCP.
- **Nimue:** v1.2.6 (versionCode 18) installed on both S23s — .233 (serial R5CW81LRKPT,
  Ken's) and .219 (RFCW425P4FD, "Ty~Ty", paired). Both run Ken's keystore → future
  installs are clean `adb install -r` (no uninstall/re-login). Build: `pnpm cap:sync` →
  `JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' gradle assembleRelease` →
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r`. Bump
  versionCode/versionName in `android/app/build.gradle`.
- **Merlin:** interactive-session Scheduled Task. Restart = `Stop-ScheduledTask -TaskName
  Merlin; Start-ScheduledTask -TaskName Merlin` (non-elevated OK; requires Ken logged in).
  NOT `net start merlin`.

---

## 3. What shipped this session

- **Telemetry CIC** (`/dashboard/telemetry`).
- **Merlin `/leo` + MerlinConsole** Spaces-style chat (strip `@@ANGELS_RESULT@@` plumbing /
  collapse / Copy-Speak / load-earlier).
- Dropped the shitcanned plugin-nested-docs.
- **Spaces single-load deep-links.**
- **node-bus auth fix** (CRON_SECRET fallback) + killed a zombie old-code Merlin process.
- **chat-send 500K cap for system authors** (unblocked `list_files`).
- **Poll re-entrancy guard** (timeout ×16 spam).
- **AI Costs "Providers in play"** live panel + AI-settings link.
- **Nimue native STT** (`@capacitor-community/speech-recognition`, replacing the flaky
  WebView Web Speech).
- **LiveKit call-audio fix** — a 60fps `requestAnimationFrame`→`setViews()` loop in
  CallStage was starving WebRTC audio (screen-off was the tell); now 10fps interval +
  24fps video cap + 2-up layout toggle.
- **`delegate_task` "field invalid: Content"** + a Messages `beforeValidate` hook coercing
  bare-string content → `{text}`.

---

## 4. Pending — Ken to verify on-device

- Native STT: tap 🎙 → speak → auto-submit (AUTO ● default).
- Call audio in `/spaces/6/17` with screen ON (post-rAF-fix). If still imperfect → build the
  native `MODE_IN_COMMUNICATION` audio-mode plugin (the next lever).
- `delegate_task`: "Nina, create a channel task…" should now land in #team.

---

## 5. Next slices (Ken's priority order)

1. **Nav-bug unify** — home "Speak with Leo" and the sidebar Leo DM resolve to different
   channels; make them one. (Quick; start here.)
2. **DM / address-book architecture** — enterprise-wide DMs as virtual per-member channels
   (separate from spaces) + an address book in the user settings bag with federation-wide
   call/chat favorites. Lands on the long-open members-as-channels/friends/profile gap.
3. **Nimue chat-cleanup port** — mirror strip/collapse/Copy-Speak/load-earlier onto Nimue's
   chat, rebuild + push both phones.
4. **Money bridge** — `creditOrderReward()` on Stripe `payment_intent.succeeded`
   (`src/endpoints/stripe-webhooks.ts`) + a `Tenants.rewardOnPurchase` policy, crediting the
   buyer's `user:<id>` AT wallet from the tenant float (mirror `creditQuestPayout.ts`). Token
   infra is production-ready — this is the ONE missing hook. Recon complete.
5. **Channel-aware routing** — a message in a `node:{endeavor}:{nodeId}` channel should broker
   to that Merlin's brain (via `node-ops/chat`) instead of Core LEO; toggle, default-to-node.
   Cures "ask local brain to list_files → timeout."
6. **Model dials (Merlin)** — enumerate Ollama models (`GET /api/tags`) + provider/model +
   thinking-effort picker in `/leo`.
7. **SSO lock-on** — Core `authed()` accepts a logged-in user + `userCanAccessEndeavor` (not
   just CRON_SECRET); Merlin lock-on uses the session → deletes the last `.env` dependency.
8. **Telemetry CIC phase 2** — federated view-only tier + heartbeat-as-message.
9. **Play Store** — bundleRelease AAB → Console (category Books & Reference).

---

## 6. Doctrine to hold

- Every ops-curl = a missing LEO tool (build the factory).
- Config-free for the 99%.
- Use the error stack as the repair loop.
- `payload_locked_documents_rels` drift after adding a collection →
  `GET /api/provision-ops/db-repair-locks`.
- Never drive a per-frame React re-render in the Nimue WebView during a call.

— 260705 ~2028 Opus 4.8 —
