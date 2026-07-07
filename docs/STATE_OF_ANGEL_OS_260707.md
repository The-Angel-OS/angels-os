# State of The Angel OS — 260707

> **One brain, three bodies, one purpose that just got urgent.** Core (Vercel/Payload
> cloud) · Merlin (Windows home node) · Nimue (native Android) share one portable
> `leoBrain`. This session hardened the provisioning factory, gave LEO a *direct Google
> brain* + a live provider switchboard, and stood up the **monetization keystone**: a
> signed-in user can now claim their own paid `{slug}.kendev.co` Guardian Angel in one
> call. The mission stopped being abstract — this platform is the plan to lift Kenneth
> out of a near-homeless spot, so from here the north star is **conversion to recurring
> revenue**, everything else in service of it.

---

## 1. Situation

The pieces exist. What's missing is the *last mile of conversion*: turn "download Nimue"
into "paying Guardian Angel." Every architectural doctrine already points here — config-
free-for-the-99%, LEO-tool-first factory, three-body shared brain, the token economy. The
job now is to wire the funnel and get beta testers (Junaid + Manjula sourcing them; the
personal portals for Damien/Junaid/Manjula/RatnaKumar were the seed of exactly this).

**Revenue thesis:** a Guardian Angel is a paid recurring subscription. The fee funds
philanthropy + platform upkeep + living expenses, and is legible as convertible into
karma coins / angel tokens over time — alongside that person's Merlin compute
contributions. The portal *is* the substrate; the subscription *is* the lifeline.

---

## 2. Shipped this session (all live on `main`)

| Area | What landed |
|---|---|
| **Provisioning** | Owner-invites now mint a pending **tenant-membership** → show on the team page + use the `/tenant-invite` URL. Four folio portals verified (Damien #7, Junaid #8, Manjula #9, RatnaKumar #10). |
| **Deprovision** | `POST /provision-ops/decommission` — the teardown half (dry-run default, `confirmSlug` to execute). Provision↔deprovision pair complete. |
| **AI — direct Google** | `attemptGoogle` (Gemini via OpenAI-compat, your `GOOGLE_AI_API_KEY`). New default binding order `ollama,google,groq,nvidia,gateway,openrouter` — Google is the primary cloud brain; gateway stays first for `max`-intent tool-heavy escalations (prompt caching + 10K tool chain). Google excluded from the `sensitive` pipe. |
| **AI — switchboard** | `getProviderStatus()` + `GET /provision-ops/ai-status` + `ProviderSwitchboard` on `/dashboard/ai-costs`: green/amber/red/gray dots, "In use" flag, latency, blob storage — the "up even if unchosen" board + a probe LEO's eval loop can call. |
| **Content** | `create_post_from_media` now frames an optional **YouTube/Vimeo video** (hero = first photo, gallery = all photos, body = user text + LEO's image analysis). Posts Gallery block tables created on both DBs (tool unblocked without the TTY migration). Gallery-table endpoint generalized to any collection. |
| **Monetization** | `POST /provision-ops/claim-guardian-angel` — self-serve: a signed-in user provisions their OWN portal, becomes `tenant_admin` directly. **Collision-suffixed slug** (name/email base, `-2/-3…`). Shipped DARK behind `GUARDIAN_ANGEL_SELF_PROVISION`; paid funnel behind `GUARDIAN_ANGEL_REQUIRE_PAYMENT` (Stripe stub); base domain parameterized. |
| **Federation map** | Click a Diocese → focus it + reveal *its* endeavors (declutter the "whack"); default focuses the substrate; labels flip above upper-half nodes. |
| **Changelog** | Live git-history changelog on the dashboard (GitHub API, grouped by day, type filters). |

---

## 3. The organism — where each body stands

- **Core (cloud brain):** LEO ~125 tools, single `executeToolCall` chokepoint. Now has a
  direct Google brain + a self-probe (switchboard). Escalations are durable (AI Bus sink).
  Provisioning is a true factory (provision/invite/decommission/claim all as endpoints +
  tools). See [[project_organism_self_improving]], [[project_error_nervous_system_audit]].
- **Merlin (home node):** witness node, camera sentinel, file bridge, distributed compute.
  The intended home for provider pipes (Google/NVIDIA re-shared to the mesh) and BOLO.
  See [[project_merlin_distributed_compute]], [[project_merlin_camera_sentinel]].
- **Nimue (Android):** press-to-speak → autosubmit → speak-aloud loop is **confirmed
  perfect**. Offline Works + Spaces cache, escalation watch, media viewer. Next: the
  image-toast + granular toggles (§4.1) and the Guardian-Angel first-run hook (§4.2).
- **angel-brain:** unblocked to Core, not yet wired into a live self-improvement loop.
  Reference to graft from: `pi` ([[reference_pi_local_agent]]).

---

## 4. Outstanding organism / amalgam features

### 4.1 Nimue image notifications (channel photo → toast on phone + watch)
- New photo uploaded to a channel → **notification with the image** (BigPictureStyle on
  watch, Google-Messages-style).
- **Granular on/off toggle** at three scopes: a specific **channel**, a **space**, or the
  whole **endeavor**. Default on for the connected endeavor.
- **Control-panel component** (collapsible) showing the **last uploaded image** + a live
  feed; a **settings option on the home panel** to manage the toggles.
- Substrate exists (escalation AI-Bus sink + Nimue escalation watch); this is a new event
  type ("media.uploaded") + the toggle model + the home-panel settings surface.
  See [[project_nimue_notifications]], [[project_nimue_lifelog_ingestion]].

### 4.2 Monetization funnel (the lifeline — highest priority)
1. **Nimue first-run hook** — on Google sign-in, POST `claim-guardian-angel`; land the
   user in their new portal.
2. **Stripe paywall** — implement the entitlement check + a real Checkout session; flip
   `GUARDIAN_ANGEL_REQUIRE_PAYMENT=true`.
3. **Nimue help text + fix clunky enterprise-switching** — onboarding must feel like a
   million bucks.
4. Flip `GUARDIAN_ANGEL_SELF_PROVISION=true` once 1–2 land. Beta testers via Junaid/Manjula.
- **Collision detector:** slug-collision suffixing already lives in `claim-guardian-angel`;
  hoist it into `provisionPortal` so every path (endeavor names/prefixes) is protected.
  Custom domains come later. See [[project_guardian_angel_monetization]].

### 4.3 Network of Jarvises / emergent capabilities / Life360
- Each Guardian Angel = an individual Jarvis; they **communicate amongst each other** over
  the node bus → emergent capabilities. Nimue encapsulates **Life360** (presence, location,
  quests-like-Uber) as real value. See [[project_node_bus_comms]],
  [[project_guardian_timeline_vision]], [[project_comms_layer]].

### 4.4 Economy: fees → karma/tokens + Merlin contributions
- Recurring Guardian-Angel fees legible as convertible into **karma coins / angel tokens**,
  combined with that person's **Merlin compute contributions**. See
  [[project_token_economy]], [[project_karma_principles]], [[project_billing_reconciliation]].

### 4.5 Open-source Ring network + BOLO
- An **open-source Amazon-Ring-doorbell network**: neighborhood IP cameras feeding the
  BOLO/guardian layer. Need a couple of **IP cameras to test BOLO** on Merlin's camera
  sentinel. See [[project_merlin_camera_sentinel]], [[project_spaces_realtime_cameras]].

### 4.6 Self-improvement loop
- `probe_ai_status` LEO tool (LEO runs the switchboard on itself); wire angel-brain;
  review `pi`. See [[project_proactive_agent_roadmap]], [[project_organism_self_improving]].

---

## 5. Immediate priorities (revenue-first)

1. **Verify the Google flip** — confirm `AI_PROVIDER_ORDER` took effect after the redeploy
   (switchboard shows `google` selected). Kills the image-analysis cost bleed.
2. **Guardian-Angel funnel** (§4.2) — the conversion path. Stripe + Nimue first-run hook.
3. **Nimue image-toast + toggles** (§4.1) — the daily-delight feature that keeps people in.
4. **Collision detector hoist** into `provisionPortal`.
5. Beta testers onboarded (Junaid/Manjula) against a working paid funnel.

---

## 6. One open ops action

`AI_PROVIDER_ORDER` env was set but hadn't taken effect (no redeploy had run since the
change; Vercel bakes env at build-start). A redeploy (`d9922de`) is in flight to pick it
up. Verify with:
```
curl -s "https://platform.kendev.co/api/provision-ops/ai-status?key=$CRON_SECRET" | grep -o '"order":\[[^]]*\]'
```
`google` present → done. Still `gateway,ollama,groq` → wrong var/scope, revisit.

---

*260707 ~0255 Opus 4.8 — the parts are all here; the funnel is the mile that matters.*
