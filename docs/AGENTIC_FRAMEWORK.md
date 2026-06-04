# Angel OS — Agentic Framework

> Canonical map of how agents act in Angel OS: LEO's tools, the AI bus and channels,
> external connectors, voice (VAPI), and the crew actor model. This is the single source
> of truth — other docs should link here rather than restate it.
> _Last re-evaluated: 2026-06-04._

---

## 1. LEO's tool system — 119 tools

All tools are declared in **`src/utilities/leo-data-tools.ts`** as `LEO_TOOLS`
(`Anthropic.Tool[]`) and dispatched by **`executeToolCall(name, input, ctx)`** →
private `executeToolSwitch()`. Input is validated by `validateToolInput()`
(`src/utilities/toolInputSchemas.ts`) before the handler runs; content-mutating tools
trigger `revalidateAfterMutation()` afterward (`CONTENT_MUTATION_TOOLS`).

Executor context:
```ts
type ToolExecutorContext = { payload; tenantId?; spaceId?; userId?; tenantAiConfig? }
```
Wired into the model loop via `convertToolsForAISDK(LEO_TOOLS, executeToolCall, ctx)`
in `ConversationEngine.ts`; streamed through `src/endpoints/leo-stream.ts`.

### Categories (~19, by functional phase / sprint)

| Category | ~Count | Representative tools |
|---|---|---|
| Query / discovery | 20 | `query_products`, `query_posts`, `query_bookings`, `query_orders`, `query_events`, `query_knowledge`, `query_media` |
| Booking / scheduling | 5 | `create_booking`, `check_available_slots`, `cancel_booking`, `reschedule_booking`, `update_booking_status` |
| Cart / shopping | 2 | `add_to_cart`, `view_cart` |
| Image & media | 6 | `generate_image`, `improve_image`, `edit_image_text`, `analyze_image`, `attach_image_to_product`, `replace_image` |
| Product management | 2 | `create_product`, `update_product` |
| Order routing & fulfillment | 6 | `find_producers`, `browse_network`, `route_order`, `accept_order`, `update_fulfillment`, `check_fees` |
| Business setup | 4 | `configure_business`, `configure_endeavor`, `connect_stripe_account`, `disconnect_stripe_account` |
| Vendor onboarding | 5 | `onboard_vendor`, `suggest_products`, `generate_cad_instructions`, `fetch_reviews`, `draft_review_response` |
| Content management | 8 | `create_post`, `update_post`, `create_page`, `update_page`, `ingest_youtube_url`, `ingest_youtube_channel`, `manage_categories` |
| Space / community | 3 | `create_space`, `complete_enlistment`, `sign_constitution` |
| Federation | 13 | `ping_federation`, `query_federation`, `broadcast_capability`, `route_federated_request`, `negotiate_deal`, `search_federation_wide`, `discover_federation_products`, `send_federation_message`, `leo_handoff`, `request_endeavor_migration` |
| Communication / messaging | 9 | `send_message`, `send_direct_message`, `create_announcement`, `send_email`, `send_sms`, `send_whatsapp`, `send_telegram`, `send_slack`, `send_follow_up` |
| Inventory | 4 | `update_inventory`, `track_inventory_movement`, `set_low_stock_alert`, `query_inventory_history` |
| Financial | 3 | `generate_invoice`, `query_financial_reports`, `issue_refund` |
| CRM & analytics | 5 | `create_customer_profile`, `log_interaction`, `segment_customers`, `analyze_trends`, `recommend_products` |
| Workflow & emergency | 5 | `delegate_task`, `escalate_issue`, `send_emergency_alert`, `document_incident`, `log_maintenance_note` |
| Enterprise ops | 3 | `check_enterprise_health`, `get_enterprise_stage`, `query_board_members` |
| Synchronicity / intelligence | 3 | `federation_pulse`, `my_place`, `find_synchronicities` |
| Generic Payload CRUD | 4 | `payload_find`, `payload_create`, `payload_update`, `payload_delete` |
| Forms | 3 | `send_inline_form`, `create_form`, `query_form_submissions` |
| Theme & navigation | 7 | `get_theme_settings`, `update_theme_settings`, `get_page_hero`, `set_page_hero`, `update_navigation`, `query_navigation`, `add_calendar_to_page` |
| Research / provisioning | 2 | `research_and_provision`, `track_soul` |
| Diagnostics | 3 | `query_application_logs`, `connector_health_summary`, `run_subsafe_check` |

### Gating — currently permissive
There is **no role/permission/crew gating at the tool layer.** Any authenticated caller
with data access can invoke any of the 119 tools. Guardrails live *below* tools:
- Payload collection access rules (read/write per user).
- `validateToolInput()` field-safety (Zod) + the `PAYLOAD_CRUD_ALLOWED_COLLECTIONS`
  allow-list for the generic CRUD tools (`toolInputSchemas.ts`).
- Message visibility via space membership (`collections/Messages` read access).

Per-agent escalation rhythm is configurable (`agentConfig.modelStrategy` on system users).

---

## 2. The AI bus — Messages + Channels + Spaces + SSE

The "bus" is the **`Messages`** collection plus real-time fan-out, organized by
**`Channels`** within **`Spaces`**.

- **`collections/Messages`** — universal message; 18 `messageType`s including
  `whatsapp_message`, `discord_message`, `telegram_message`, `sms_message`,
  `email_message`, `voice_call`, plus `user`/`ai_agent`/`system`/`announcement`/
  `booking`/`form_submission`/`federation_message`. `visibility` ∈ private|tenant|network.
  `afterChange` runs workflows and `broadcastToSubscribers()`.
- **`collections/Channels`** — `type` (general/leo/support/sales/dm/…) and **`source`**
  (native/discord/telegram/slack/whatsapp/email/sms/google_chat/federation). Holds widget
  state (`data`/`widgets`/`dataVersion`).
- **`collections/Spaces`** — tenant workspace; `enabledApplets`.
- **Read**: `GET /api/ai-bus/poll` (since/space/channel filters) and
  `GET /api/ai-bus/stream` (SSE). **Route**: `AgentRouter` selects the responding agent by
  channel → keyword → default → first.
- **Post programmatically**: `payload.create({ collection:'messages', data:{ space, channel,
  messageType, content, author, tenant, visibility } })`.

---

## 3. Connectors — external platforms → channels → AI bus

Framework is real: **`collections/Connectors`** (per-tenant, config JSON, `routingChannel`,
`systemUser`, health `status`), admin UI at `/dashboard/admin/connectors`, a 30-min health
cron (`connector-health-cron.ts` + `connectorProbes.ts`), and shared `bridgeHelpers.ts`
(find-or-create bridge channel + guest user, dedup, mark active/error). Inbound pattern:
verify secret → resolve tenant → ensure space → bridge channel → guest user → persist
inbound `Message` → `leoProcessMessage()` → persist `ai_agent` reply → reply to platform.

| Platform | Status | Entry points |
|---|---|---|
| WhatsApp | ✅ live | `endpoints/whatsapp-webhook.ts` |
| Discord | ✅ live | `endpoints/discord-webhook.ts` |
| Telegram | ✅ live | `endpoints/telegram-webhook.ts` |
| Slack | ✅ live | `endpoints/slack-webhook.ts` |
| SMS (Twilio) | ✅ live | `endpoints/sms-webhook.ts` |
| Email (IMAP in / Resend out) | ✅ live | `endpoints/email-poll.ts` |
| YouTube | ✅ live (poll) | `endpoints/youtube-poll.ts` |
| Generic bridge | ✅ live | `endpoints/bridge-inbound.ts` |
| **LinkedIn** | ⚠️ **stub** | catalog entry only — no `linkedin-poll.ts`/probe |
| **X / Twitter** | ❌ **absent** | no type, UI, webhook, or poll |

---

## 4. Voice — VAPI (≈80% to a working 1-800)

`endpoints/vapi-webhook.ts` handles `assistant-request`/`conversation-update`/
`function-call`/`end-of-call-report`, resolves tenant (dedicated number → fuzzy
business-name match → `DEFAULT_TENANT_SLUG`), runs `leoProcessMessage()`, and persists turns
to the AI bus (`channel:'voice'`, `messageType:'voice_call'`). `endpoints/vapi-setup.ts`
(super_admin) points the platform number's `server.url` at the webhook. Per-tenant config
in `tenants.vapi` (dedicated number, voiceId, greeting). Env: `VAPI_PRIVATE_KEY`,
`VAPI_PHONE_NUMBER_ID`, `VAPI_WEBHOOK_SECRET`, `NEXT_PUBLIC_SERVER_URL`.

Gaps for a clean 1-800: call-log/analytics persistence (duration, outcome), self-serve
per-tenant number provisioning, and extensible function-definition mapping (today hardcoded
in `buildToolMessage()`).

---

## 5. Crew actor model

`collections/CrewAssignments` maps a `tenant-membership` to an `endeavor` with a naval role
(department, station, rank, watchSection, dutyStatus, capabilities). `crew-routing-engine.ts`
scores crew for **human work units** (skill 35 / dept 25 / duty 20 / load 15 / pheromone 5).
System agents (LEO/Nimue) are users with `agentConfig` + `servesTenant`; `AgentRouter`
chooses which agent answers a channel.

**No link today** between crew assignments and which tools or channels an agent/member may
use. The Crew Relations admin page (`/dashboard/admin/crew`) manages the roster.

---

## 6. Roadmap (open work)

1. **X / Twitter connector** — add `twitter`/`x` to the Connectors catalog + admin fields,
   an inbound webhook (or poll), a health probe, and the bridge→AI-bus path (mirror Discord).
2. **LinkedIn connector** — implement `linkedin-poll.ts` + probe; the catalog entry already exists.
3. **VAPI 1-800 hardening** — persist call logs + analytics; self-serve number provisioning;
   data-driven function definitions instead of hardcoded mappings.
4. **Tool gating by crew/role** — optionally derive an allowed-tool set from crew
   department/capabilities or membership role (today fully permissive).
