# Session Handoff — 2026-06-20 (Sat eve) — Three-Body State

Angel OS three-body dev: **Core** `C:\Dev\angels-os` (Payload+Next, Vercel) · **Nimue** `C:\Dev\nimue` (native Android, Capacitor) · **Merlin** `C:\Dev\merlin` (local media server PWA).

## 🔥 The one real fire
**kendev node: "error initializing Payload"** — `platform.kendev.co` + `kendev.kendev.co` dashboards 500 on `/api/users/me` ("There was an error initializing Payload"), bounce to `/dashboard`. **NOT caused by this session** (all commits code-only, no schema; spacesangels/angels DB is healthy, only kendev DB fails). It's a **Payload bootstrap failure on the kendev DB** — either DB unreachable/slow at init (IONOS timeout; pool max=3, timeout=30s on Vercel) or kendev schema drift (known: `contacts.unsubscribe_token` missing). **To fix:** pull the digest from Vercel → kendev deployment → Runtime Logs (the dashboard now SHOWS the digest, commit 274658b), confirm kendev DB reachable, run kendev `ensure-*`/drift checks. ⚠️ Physics: when Payload itself is down, the DB-backed error log can't write — digest + Vercel runtime logs are the diagnostic path.

## Core — what shipped this session (all pushed, prod GREEN, latest = 274658b)
- Media picker tenant-scope leak fix (74bc0ac)
- **LEO moderation** reflex classifier on every message + `content_flagged` escalation (0a4489f); user **report** endpoint `/api/moderation/report` (f26f994); **account-deletion** system-routed `/api/account/deletion-request` (9e3a83d) + `/delete-account` page (b31f843); leo-stream **empty-completion logging** (13af751, fixes silent blank LEO responses — logs image count/finishReason)
- Footer "Powered by **The Angel OS**" → github.com/The-Angel-OS (f355c6a)
- ⭐ **THE HOLY BIBLE** — complete Work: Stage1 Philemon (479caf6) → book/language-file refactor → full 66-book ingest (64ce685). 1,189 chapters, 31,095 verses each WEB+KJV.
- **lookup_scripture LEO tool** (3c62848) — conversational scripture door
- ⭐ **Convergence increment 1** (d7be6f7) — Work syndication: 3 divergent sources → 1 (soul manifest). Deleted WORK_SUBSCRIPTIONS map; platform-index rule.
- ⭐ **Publish-state gate** (8c00107) — Works = version-controlled working copies; `published?` flag; only published show publicly.
- Dashboard error boundary: digest + best-effort log (274658b)

### Bible facts (for Primer stages)
- Files: `public/library/holy-bible/{manifest.json, text/web.json, text/kjv.json}` (verse-structured, Ronald's WDEG book format). Source of record: `src/souls/holy-bible/data/<CODE>.json` (both translations inline — the [[ref]]/LEO-lookup source). Ingest: `scripts/ingest-bible.mjs` (bulk getBible v2 source, `.bible-tmp/` gitignored). Re-run: `node scripts/ingest-bible.mjs ALL`.
- `src/utilities/scripture.ts` = ref parser + `lookupScripture(ref, web|kjv)` via BUNDLED dynamic import (0-fs).

### Converged Works model (single source of truth = soul manifest)
- `canonical.endeavor`=owner · `manifest.subscribers[]` · `availableGlobally` · `published`. `src/souls/subscriptions.ts` derives all; **platform flagship indexes EVERY Work**.
- PUBLISHED: wdeg, holy-bible, angel-os-handbook. WORKING COPIES (unfinished, hidden from public index, reachable by direct link): **rainmaker, gpt-psychosis, ready-player-everyone, answer53**.
- ✅ Cross-portal verified live: platform=3 works, clearwater-cruisin=3, wheredideveryonego=2 (holy-bible not subscribed there).

### Convergence track remaining (Pony Tail — eliminate ALL redundancy)
- **Inc 2:** two registries — file `SOULS` map ↔ `Works` DB collection → unify.
- **Inc 3:** channel `workDraft` authoring workshop → `Works` rows on **seal** (= the VCS commit model: seal=commit, published=HEAD; works-seal.ts/checksum/jsonVersion partway there).
- **Inc 4:** content → Payload **blob** storage (the **0-filesystem release** goal; client path already DB-backed, web readers still `fs.readFileSync`).

### Primer (Bible) stages remaining
- **2b:** `[[BOOK.ch.vs]]` reference resolver — inline scripture popovers across Works (same scripture.ts).
- **3:** "Daily Bread" Quest + streak (QuestParticipations; ⚠️ karma payout OFF by default — "never paid to pray").
- **4:** Nimue "Today's Reading" + read-aloud (device TTS, verse karaoke; shares foreground-service w/ voice).

## Nimue — `C:\Dev\nimue` (versionCode 7 / 1.0.6 on both phones)
- **Installed:** S23 Ultra (192.168.0.233, wireless adb port ROTATES — ask for fresh) + S23 (USB serial RFCW425P4FD).
- **Shipped:** Report button + moderation; READ_MEDIA_IMAGES removed (uses Android Photo Picker); channel-persistence fix; one-handed **channel quick-switcher** + Home link; fitted home screen; **new The Angel OS emblem** icon; home **version stamp + connection identity**; **errors-as-toasts** (`lib/log.ts` → ToastHost); **LiveKit voice** (`VoiceBar` + `lib/livekit.ts`); common logging path.
- ⚠️ **VOICE BUG (parked):** `[failed@mic]: Could not start audio source`. MainActivity now grants WebChromeClient getUserMedia, but mic won't start. FIX: add `MODIFY_AUDIO_SETTINGS` permission + request `RECORD_AUDIO` eagerly (on Join tap) before getUserMedia.
- **Play Store:** v1.0.4 (code 5) AAB uploaded to internal testing. Listing drafted (name `Nimue — The Angel OS`, short/full desc, new emblem icon + feature graphic). Content rating 12+, data safety done, target 18+, privacy + `/delete-account` URLs live. **Still need: ≥2 phone screenshots** (BlueStacks tablet for tablet shots). ⚠️ uploaded AAB predates Report/moderation/voice — cut a fresh AAB (versionCode 8) when ready.
- **Build:** `export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"; pnpm build && npx cap sync android && cd android && ./gradlew assembleRelease` (APK) / `bundleRelease` (AAB). Keystore `android/upload-keystore.jks` (gitignored).
- **adb:** `ADB="/c/Users/kenne/AppData/Local/Android/Sdk/platform-tools/adb.exe"`; `$ADB connect 192.168.0.233:<port>` (rotates) or USB; `install -r`; on signature mismatch → `uninstall com.angels.nimue` then `install`.

## Merlin — `C:\Dev\merlin`
- New The Angel OS emblem PWA icons regenerated (icon-192/512/maskable, favicon, apple-icon). `generate-icons.mjs` supports `ICON_SRC` override (white-label per Core endeavor).
- ⬜ **Ollama provider (#3)** — the ORIGINAL punch-list item, still NOT started (deferred all session). `src/lib/leoProviders.ts`: Provider union + `callOllama()` adapter + settings field + `pickProvider()`.

## Banked quick wins
- **Portal Chooser:** preserve dashboard path on switch + remember last space per portal (Vercel-style; user wants this).
- **Voice mic fix** (above).
- **Discovery** surfacing Works+Products+Services + Subscribe button (universal catalog).
- Pre-existing **test type errors** cleanup (`tests/unit/utilities/createLogger.test.ts`, `recordCostEvent.test.ts` — non-blocking; Next build skips tests).

## Laws / lessons reaffirmed this session
- **"The Angel OS"** always (with article) in prose/copy/docs/UI.
- **0 filesystem artifacts in release** — Payload/blob via configured storage adapter.
- **Pony Tail / Answer53:** eliminate redundancy, ONE source of truth per concern.
- **Works = version control:** nothing's ever "ready"; you publish a VERSION (seal=commit, published=HEAD).
- **Errors must bubble up** (Nimue toasts + Core error log); but Payload-init failures can't self-log → digest + Vercel runtime logs.
- ⚠️ **Pre-push gate:** `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "^src/"` (FULL src/, never a narrow filename grep — that hid a build error across 5 red deploys tonight).
