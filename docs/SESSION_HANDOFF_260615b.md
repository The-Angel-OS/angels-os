# Handoff addendum — 2026-06-15 (pt 2)

Follows SESSION_HANDOFF_260615.md. All committed + deployed (main).

## Shipped
- `1c0917f` OpenRouter direct fallback (`@ai-sdk/openai-compatible` + `OPENROUTER_API_KEY`), last in `AI_PROVIDER_ORDER` → LEO never goes dark when gateway auth fails. Verified IDs: low=claude-3.5-haiku, med=claude-sonnet-4, high/crit=claude-opus-4.1.
- `ccc98b6` Two-lane model posture (prototype): `TASK_MODEL_MAP` derived from 2 lanes — `agentic` (Claude Sonnet, user-facing) / `mechanical` (Gemini Flash, background). Env-tunable: `LEO_AGENTIC_MODEL`, `LEO_MECHANICAL_MODEL`, `*_FALLBACKS`, `AI_PROVIDER_ORDER`. Prompt caching added on Anthropic path in `attemptGateway`. ⚠️ standard chat now Sonnet (was Flash); ⚠️ verify cache-hit rate + that gateway forwards `providerOptions.anthropic.cacheControl` (else follow-up = per-message breakpoints at streamText site).
- `2e47b8e` Spaces fix: `createChannel` now uses `channelSpaceId` not `spaceId` (spaceId flips to DM space → channels were landing in Direct Messages). Data: created `general` in Harpazo Community (space6, ch#27), deleted stray ch#26.

## Diagnosed (config, not code)
- "AI Gateway: Invalid API key" = local OIDC expired AND/OR the `angels-os-kendev` Vercel project missing `AI_GATEWAY_API_KEY`. Fix: set `AI_GATEWAY_API_KEY` (+ `OPENROUTER_API_KEY` for the fallback) on that project, redeploy; local = `vercel env pull`. User was setting it. Not revoked.

## Open / next
- ⬜ Provider-auth escalation (REQUESTED, not built): fire `dispatchEscalation` when getSmartModel exhausts/auth-fails; + document "add a new escalation in 2 steps". Infra exists (dispatchEscalation, connectorTransports, gotifyEscalation).
- ⬜ DM virtual roster UI (Spaces sub-slice #2): backend exists (`/api/messages-ops/dm-roster`, `dm-find-or-create`); wire under DIRECT MESSAGES — virtual DM per member + call-history list.
- ⬜ Provisioning gap: community/main space born with 0 channels (harpazo); should seed `general`. Other tenants' community spaces have channels.
- ⬜ Verify caching + two-lane cost in prod (watch served-model tags).

## Notes
- Two prod DBs (angels, kendev), local .env→kendev; probe via scripts/_local/*.mjs (pg, ssl:false). Local payload boot blocked by dep mismatch (plugin-nested-docs 3.85.1 vs payload 3.77.0) — use REST/pg, not tsx.
- Verify by DATA not status/grep (page redirects=200+RSC; wrong-column pg query errors look like 0 rows).
