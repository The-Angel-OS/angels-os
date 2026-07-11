# Focused pass — Channel & DM model (handoff, 260711)

One coherent area, four threads Ken raised. Diagnoses are complete; this is immediately executable in a fresh session (fits the "downshift maintenance to Sonnet" plan).

## The design decisions (Ken, 260711)
1. **DMs are the user's, not a space's.** Do NOT silo them in a dedicated "Direct Messages" space. Surface the user's DM section in **every space's navigator**, alongside that space's channels — so contacts are always one tap away, from anywhere. (Discord/Slack-style: channels are per-space; DMs are global.)
2. **The AI Bus / system-log is the channel PER ENDEAVOR.** Each endeavor has its bus channel; going cross-endeavor is a context switch on Core. The tool-audit (shipped to `application-logs`) should also surface in the endeavor's bus channel.
3. **Echo everything for now** (troubleshooting); make it a toggle later.

## Thread 1 — LEO/node PM channels navigable (#4)  — MOSTLY DONE
- The LEO DM is already a proper `type:'dm'` channel, slug `dm-{userId}-leo`, user as member (`src/utilities/dmChannels.ts`). Core's navigator lists it (confirmed in a Core screenshot: LEO + `Nimue ↔ Kenneth` both appear under DIRECT MESSAGES).
- Remaining: it FEELS un-navigable because the channel is **empty** (see Thread 2).

## Thread 2 — Nimue local loop → AI Bus, navigable in Core (#2)  — EXACT FIX FOUND
- Echo path exists: `cortex.ts` → `logSignal()` → `messageLog.ts` `CoreSubmitter.push()` → POST `/api/chat/send`.
- **It no-ops** at `src/lib/messageLog.ts:216`: only posts when the signal payload carries `spaceId + channel`; Nimue's loop events don't, so nothing graduates → the Nimue channel stays empty.
- **Fix:**
  1. Add a **node-channel resolver** in Nimue (there isn't one) — the `Nimue ↔ {user}` DM, mirroring the LEO pattern (`dm-{userId}-nimue`). Resolve/create it once, cache it.
  2. In `CoreSubmitter.push`, **default to the resolved node channel** when the signal has no explicit target.
  3. Broaden `NIMUE_POLICY` rules (messageLog.ts) to echo more event types (trips, voice, photos, cortex suggestions) — the "echo everything for troubleshooting" dial.
- Result: Nimue's loop populates its node channel → navigable + useful in Core Spaces.

## Thread 3 — DMs in every space's navigator  — DESIGN CHANGE
- Today the navigator loads the user's DM channels scoped to a `dmSpace` and shows them as a section (Core `ChatProvider.tsx` loads `type=dm & space=dmSpace & members=userId`). DMs render only in the DM-space view.
- **Change:** the DM section should render in EVERY space's navigator (the user's DMs are global). Decouple the DM list from the active space — always fetch + show the user's DMs regardless of which space is active. Channels remain per-space.
- Files: `src/components/ChatControl/ChatProvider.tsx` (DM load is already separate from channel load — surface it in every space, not just the DM space), `MultiChannelChat.tsx` (render the DM section unconditionally).

## Thread 4 — Nimue ⟷ Core navigator parity  — GAP
- Nimue's `src/app/channels/page.tsx` shows LESS than Core (screenshot: only `LEO · Guardian`, "No channels here", missing the Nimue DM). It resolves channels/DMs from a different source/scope than Core's `ChatProvider`.
- **Fix:** align Nimue's channels page to the same resolution Core uses — the user's channels for the active space + the user's global DMs (LEO, node, user DMs). Likely `src/lib/channels.ts` `listChannels` scope + the DM query.

## Suggested order (shared plumbing)
1. **Node-channel resolver** (Nimue) — unblocks #2 and gives the Nimue DM a stable identity.
2. **CoreSubmitter default-to-node-channel + broaden policy** — #2 echo works.
3. **DMs-in-every-space** (Core navigator) — the design change.
4. **Nimue navigator parity** — align to Core's resolution.
5. (Polish) parent-nav top collapse-toggle to match the channel panel's affordance.

## Also shipped this session (context)
Scripture backend fix (CDN loader — verify "Psalm 32" live), My Circles + chooser-parity fix, save_contact + invite autocomplete, AI CRUD audit → application-logs, feature flags (federation/endeavors off), Nimue 1.2.44 (nav chip, sequencing fix, Find-Enterprise hidden). All committed + deployed.
