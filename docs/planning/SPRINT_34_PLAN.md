# Sprint 34 — Connectors Phase 2: Slack + Telegram Bridges

## Context

Sprint 33 proved the multi-tenant connector pattern with Discord. Every Enterprise gets its own bot. The Connectors collection handles per-tenant config with JSON config, routing channels, system users, and 2-tier resolution. Discord was the first; now we replicate.

**Why Slack + Telegram now:**
- Both types already registered in Connectors schema (`slack`, `telegram`)
- Discord proved the pattern: webhook endpoint + bot manager + formatter + ~95 tests
- Every connector after Discord is cheaper — the architecture is settled
- v1.0.0 target is Q3 2026 — connectors expand LEO's reach before launch
- Both are headless/API-first — no UI work needed beyond enabling in SocialProvidersPanel

**Parallel track:** Engine test coverage audit for Sprint 5 engines (Guardian Angel, Justice Fund, Print-on-Demand) and Sprint 32 engines (Synchronicity, Booking).

---

## Phase 1: Slack Multi-Tenant Bot Bridge

### File: `src/slack/bot.ts` — NEW (~350 lines)

Standalone script using `@slack/bolt` (Slack's official SDK). Follows Discord BotManager pattern: manages N Slack apps, one per active `slack` connector.

### Dependency

```
pnpm add @slack/bolt @slack/web-api
```

### `package.json` script

```json
"slack": "npx tsx src/slack/bot.ts"
```

### Architecture

```
src/slack/bot.ts
├── SlackBotManager class
│   ├── apps: Map<connectorId, { app: App, tenantId: string, config }>
│   ├── workspaceToTenant: Map<teamId, tenantId>  — reverse lookup
│   ├── start()
│   │   ├── Connect to Payload (REST or Local API)
│   │   ├── findAllConnectors(payload, 'slack')
│   │   ├── For each connector: createApp(connector)
│   │   └── 60s poll interval for connector changes
│   ├── createApp(connector)
│   │   ├── New App({ token, signingSecret, appToken })
│   │   ├── Register message + event handlers
│   │   ├── Register slash commands: /ask, /pulse, /weather
│   │   ├── Build teamId → tenantId mapping
│   │   └── app.start() on socket mode
│   ├── destroyApp(connectorId)
│   └── syncConnectors()
├── Message handling
│   ├── shouldRespond(message, config): mention, leo channel, or DM
│   ├── postToPayload(body, webhookSecret)
│   └── formatResponse(text): Slack mrkdwn formatting
└── Graceful shutdown
```

### Slack Connector Config Schema

```json
{
  "botToken": "xoxb-...",
  "appToken": "xapp-...",
  "signingSecret": "abc123...",
  "teamIds": ["T01234567"],
  "leoChannelName": "leo",
  "webhookSecret": "shared-secret-for-this-tenant"
}
```

| Field | Purpose |
|-------|---------|
| `botToken` | Slack bot token (OAuth install, xoxb-) |
| `appToken` | Slack app-level token (for Socket Mode) |
| `signingSecret` | Slack signing secret (request verification) |
| `teamIds` | Workspace IDs this bot serves |
| `leoChannelName` | Channel where bot auto-responds without mention |
| `webhookSecret` | Per-connector HMAC secret for webhook auth |

---

### File: `src/endpoints/slack-webhook.ts` — NEW (~280 lines)

Follows `src/endpoints/discord-webhook.ts` pattern exactly.

### Route: `POST /api/slack/webhook`

### Request Shape

```typescript
interface SlackWebhookRequest {
  type: 'message' | 'slash_command' | 'app_mention'
  content: string
  connectorId: string
  teamId: string
  channelId: string
  channelName: string
  userId: string               // Slack user ID (U01234567)
  userName: string
  isDM: boolean
  threadTs?: string            // Slack thread timestamp (for threaded replies)
  commandName?: string         // 'ask' | 'pulse' | 'weather'
}
```

### Handler Logic

```
slackWebhookHandler: PayloadHandler
├── 1. Parse request body
├── 2. Validate webhook secret (connector lookup + HMAC comparison)
├── 3. Resolve tenant from connector
├── 4. Resolve Payload user
│   ├── Find by socialProviders: provider='slack', providerId=userId
│   ├── If not found: create guest user (slack-{userId}@guests.angel-os.local)
│   └── socialProviders: [{ provider:'slack', providerId, displayName }]
├── 5. Resolve Space + Channel
│   ├── ConversationId: slack-{teamId}-{channelId} or slack-dm-{userId}
│   └── Thread tracking: slack-thread-{threadTs}
├── 6. Route slash commands → LEO tools
├── 7. Process via leoProcessMessage()
├── 8. Persist to AI Bus (messageType='slack_message' / 'ai_agent')
├── 9. Update connector.lastActivity
└── 10. Return { text, conversationId, agentName, threadTs }
```

### File: `src/utilities/slack-formatter.ts` — NEW (~80 lines)

LEO markdown → Slack mrkdwn conversion.

| Conversion | From | To |
|------------|------|----|
| Bold | `**text**` | `*text*` |
| Italic | `*text*` | `_text_` |
| Headers | `# Header` | `*Header*` (bold) |
| Links | `[text](url)` | `<url\|text>` |
| Code blocks | ``` | ``` (same) |
| Message split | — | 4000 chars (Slack limit) |

---

## Phase 2: Telegram Multi-Tenant Bot Bridge

### File: `src/telegram/bot.ts` — NEW (~300 lines)

Uses `telegraf` (most popular Telegram bot framework for Node.js). One bot per active `telegram` connector.

### Dependency

```
pnpm add telegraf
```

### `package.json` script

```json
"telegram": "npx tsx src/telegram/bot.ts"
```

### Architecture

```
src/telegram/bot.ts
├── TelegramBotManager class
│   ├── bots: Map<connectorId, { bot: Telegraf, tenantId: string, config }>
│   ├── chatToTenant: Map<chatId, tenantId>
│   ├── start()
│   │   ├── findAllConnectors(payload, 'telegram')
│   │   ├── For each connector: createBot(connector)
│   │   └── 60s poll for changes
│   ├── createBot(connector)
│   │   ├── New Telegraf(botToken)
│   │   ├── Register message + command handlers
│   │   ├── bot.launch() (long polling) or webhook mode
│   │   └── Build chatId → tenantId mapping
│   ├── destroyBot(connectorId)
│   └── syncConnectors()
├── Message handling
│   ├── shouldRespond(ctx, config): group mention, private, or leo group
│   ├── postToPayload(body, webhookSecret)
│   └── splitResponse(text, max=4096): string[]
└── Commands: /ask, /pulse, /weather, /start
```

### Telegram Connector Config Schema

```json
{
  "botToken": "123456:ABC-DEF...",
  "allowedChatIds": ["-1001234567890"],
  "leoGroupName": "leo",
  "webhookSecret": "shared-secret",
  "webhookUrl": "https://example.com/api/telegram/webhook"
}
```

### File: `src/endpoints/telegram-webhook.ts` — NEW (~260 lines)

Follows same pattern as Discord/Slack webhook handlers.

### Route: `POST /api/telegram/webhook`

### Request Shape

```typescript
interface TelegramWebhookRequest {
  type: 'message' | 'command'
  content: string
  connectorId: string
  chatId: string              // Telegram chat ID (negative for groups)
  chatTitle: string
  userId: string              // Telegram user ID (numeric)
  userName: string            // @username or first_name
  isPrivate: boolean
  replyToMessageId?: number
  commandName?: string
}
```

### File: `src/utilities/telegram-formatter.ts` — NEW (~70 lines)

LEO markdown → Telegram MarkdownV2 conversion.

| Conversion | From | To |
|------------|------|----|
| Bold | `**text**` | `*text*` |
| Italic | `*text*` | `_text_` |
| Headers | `# Header` | `*Header*` (bold) |
| Links | `[text](url)` | `[text](url)` (same) |
| Escape chars | — | `\\.\\!\\#` etc (Telegram MarkdownV2 requires escaping) |
| Message split | — | 4096 chars (Telegram limit) |

---

## Phase 3: Slack OAuth — User Account Linking

### File: `src/endpoints/auth-slack.ts` — NEW (~300 lines)

Follows `src/endpoints/auth-google.ts` and `auth-discord.ts` pattern.

**`authSlackInitHandler`** (GET /api/auth/slack):
- Slack OAuth URL: `https://slack.com/oauth/v2/authorize`
- Scopes: `users:read`, `users:read.email`, `chat:write`
- State encoding: `{ redirect, mode, userId, origin }`

**`authSlackCallbackHandler`** (GET /api/auth/slack/callback):
- Exchange code for access token: `https://slack.com/api/oauth.v2.access`
- Fetch user: `https://slack.com/api/users.identity`
- Extract: user ID, real_name, email, image_72
- Link/create user (same pattern as Google/Discord)

### File: `src/components/forms/SocialProvidersPanel/index.tsx` — MODIFY

Add `'slack'` and `'telegram'` to `AVAILABLE_PROVIDERS`.

Slack/Telegram metadata (icon, colors, label) may need definition if not already present.

### File: `.env.example` — MODIFY

```env
# Slack OAuth (platform-level — one OAuth app for all tenants)
SLACK_CLIENT_ID=your-slack-app-client-id
SLACK_CLIENT_SECRET=your-slack-app-client-secret
```

Note: Telegram has no OAuth flow — users link via bot `/link` command.

---

## Phase 4: Engine Test Coverage Audit

Verify and fill test gaps for engines from earlier sprints.

### Engines to Audit

| Engine | File | Expected Tests | Action |
|--------|------|---------------|--------|
| Guardian Angel | `guardianAngelEngine.ts` | 106 (S5) | Verify exists, add edge cases |
| Justice Fund | `justiceFundEngine.ts` | 63 (S5) | Verify exists, add edge cases |
| Print-on-Demand | `printOnDemandEngine.ts` | 61 (S5) | Verify exists, add edge cases |
| Synchronicity | `synchronicity-engine.ts` | ~30 (S32) | Fill if sparse |
| Booking | `bookingEngine.ts` | ~40 (S32) | Fill if sparse |
| Business Intel | `BusinessIntelligenceProcessor.ts` | Unknown | Assess + write |

### Target: Add ~40 edge-case tests across audited engines

Focus areas: empty inputs, boundary conditions, concurrent operations, malformed data (following Sprint 27 adversarial testing pattern).

---

## Phase 5: Tests

### `tests/unit/endpoints/slack-webhook.test.ts` — NEW (~40 tests)

| Group | Tests |
|-------|-------|
| Auth (4) | Valid connector secret, invalid → 401, missing → 401, unknown connector → 404 |
| Request parsing (4) | Valid message, slash command, app_mention, missing content → 400 |
| Connector resolution (5) | Lookup by ID, tenant, disabled → 403, config validation, lastActivity |
| User resolution (5) | Linked Slack user, guest creation, synthetic email, existing guest, display name |
| ConversationId (4) | Channel format, DM format, thread format, deterministic |
| Slash commands (4) | /pulse, /weather, /ask, unknown |
| LEO processing (4) | Success, error → graceful, empty, agent routing |
| AI Bus persistence (4) | User msg saved, LEO response saved, Slack metadata, connectorId |
| Multi-tenant (3) | Different connectors → different tenants, isolation, guest scoping |
| Response shape (3) | Correct fields, thread_ts passthrough, long text |

### `tests/unit/endpoints/telegram-webhook.test.ts` — NEW (~35 tests)

Same structure as Slack webhook tests, adapted for Telegram specifics (chatId, replyToMessageId, isPrivate).

### `tests/unit/utilities/slackFormatter.test.ts` — NEW (~20 tests)

| Group | Tests |
|-------|-------|
| formatForSlack (8) | Bold, italic, headers, links, code blocks, emoji, empty, nested |
| splitMessage (8) | Under limit, paragraph split, sentence split, hard split, 4000 char limit |
| Edge cases (4) | Unicode, null, very long, special chars |

### `tests/unit/utilities/telegramFormatter.test.ts` — NEW (~18 tests)

| Group | Tests |
|-------|-------|
| formatForTelegram (8) | Bold, italic, headers, links, MarkdownV2 escaping, code blocks |
| splitMessage (6) | Under limit, paragraph split, 4096 char limit, empty |
| Edge cases (4) | Unicode, null, special chars (dots, exclamation, hash) |

### `tests/unit/slack/bot.test.ts` — NEW (~18 tests)

| Group | Tests |
|-------|-------|
| SlackBotManager (6) | Start with N connectors, createApp, destroyApp, syncConnectors add/remove, config change, shutdown |
| shouldRespond (4) | App mention → true, leo channel → true, DM → true, random → false |
| buildPayload (4) | Message shape, slash command, DM flag, connectorId |
| postToPayload (4) | Success, timeout, error recovery, retry |

### `tests/unit/telegram/bot.test.ts` — NEW (~16 tests)

Same structure as Slack bot tests, adapted for Telegraf specifics.

### `tests/unit/endpoints/auth-slack.test.ts` — NEW (~12 tests)

Same structure as auth-discord tests.

---

## Files Summary

| File | Action | Lines |
|------|--------|-------|
| `src/slack/bot.ts` | Create | ~350 — Multi-app Slack bot manager |
| `src/endpoints/slack-webhook.ts` | Create | ~280 — Multi-tenant Slack message processing |
| `src/utilities/slack-formatter.ts` | Create | ~80 — Markdown → Slack mrkdwn |
| `src/endpoints/auth-slack.ts` | Create | ~300 — Slack OAuth init + callback |
| `src/telegram/bot.ts` | Create | ~300 — Multi-bot Telegram manager |
| `src/endpoints/telegram-webhook.ts` | Create | ~260 — Multi-tenant Telegram processing |
| `src/utilities/telegram-formatter.ts` | Create | ~70 — Markdown → Telegram MarkdownV2 |
| `src/payload.config.ts` | Modify | +12 — Register 5 new endpoints |
| `src/components/forms/SocialProvidersPanel/index.tsx` | Modify | +2 — Enable Slack + Telegram |
| `.env.example` | Modify | +3 — Slack OAuth env vars |
| `package.json` | Modify | +4 — @slack/bolt, telegraf deps + scripts |
| `tests/unit/endpoints/slack-webhook.test.ts` | Create | ~40 tests |
| `tests/unit/endpoints/telegram-webhook.test.ts` | Create | ~35 tests |
| `tests/unit/endpoints/auth-slack.test.ts` | Create | ~12 tests |
| `tests/unit/utilities/slackFormatter.test.ts` | Create | ~20 tests |
| `tests/unit/utilities/telegramFormatter.test.ts` | Create | ~18 tests |
| `tests/unit/slack/bot.test.ts` | Create | ~18 tests |
| `tests/unit/telegram/bot.test.ts` | Create | ~16 tests |
| Various engine test files | Modify | ~40 edge-case tests |

**Total new tests: ~199**
**Running total: 2,482 + 199 = ~2,681 tests**

---

## Key Patterns Reused

| Pattern | Source | Reuse |
|---------|--------|-------|
| Connector resolution | `src/utilities/resolveConnector.ts` | `findAllConnectors('slack')`, `findAllConnectors('telegram')` |
| Multi-tenant bot manager | `src/discord/bot.ts` | BotManager architecture, sync poll, graceful shutdown |
| Webhook handler | `src/endpoints/discord-webhook.ts` | Secret validation, leoProcessMessage, AI Bus persistence |
| OAuth flow | `src/endpoints/auth-discord.ts` | State encoding, code exchange, user linking |
| Message formatter | `src/utilities/discord-formatter.ts` | splitMessage, platform-specific markdown conversion |
| Adversarial testing | Sprint 27 pattern | Edge cases, boundary conditions, malformed inputs |

---

## Verification

1. `pnpm add @slack/bolt @slack/web-api telegraf` — installed
2. `npx tsc --noEmit` — zero errors
3. `pnpm test:unit` — all ~2,681 tests pass
4. **Slack setup**: Create `slack` connector in admin with bot token + team ID
5. **Telegram setup**: Create `telegram` connector in admin with bot token + chat IDs
6. **Bot startup**: `pnpm slack` and `pnpm telegram` — managers start, create clients per connector
7. **Multi-tenant**: Two slack connectors → two Slack apps, each serving own workspace
8. **Channel mention**: @Bot in Slack → LEO responds with tenant context
9. **Telegram private**: DM to Telegram bot → private LEO conversation
10. **Slash commands**: /pulse, /weather, /ask all work on both platforms
11. **AI Bus**: All messages persisted with connectorId + platform metadata
12. **Guest users**: Unlinked users get guest accounts scoped to tenant
13. **Message splitting**: Slack at 4000, Telegram at 4096 chars
14. **Engine audit**: All audited engines have verified test coverage
15. Commit and push to main
