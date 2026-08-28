# Handoff — 260828 (evening session)

Paste the block below into a fresh session.

---

Continuing Angel OS. Read `docs/GLOBAL_PUNCH_LIST.md` first — the living issue board.
This supersedes `docs/HANDOFF_260828.md`, which was written before the cutover and now
describes a Railway that no longer serves us. For anything touching the ThinkPad,
`docs/selfhost/thinkpad/NODE_CONFIG.md` is the living config and carries the full revert
table.
Memory worth loading: `reference_live_node_is_railway` (⚠️ now says the opposite of its
name), `reference_angel_node_01_thinkpad`, `project_system_events_ledger`,
`project_booking_is_free_stripe_gates_money`, `project_nimue_playstore`,
`project_nimue_identity_refresh_bug`.

**Ken is CEO, you are CIO.** Temporal-stamp replies `YYMMDD ~HHMM Name —` top and bottom.
Ponytail mode. CTO mode — decide and act on the obvious. No Angel OS jargon in
customer-facing copy: a visitor to a church website should never learn what we are.

---

## ⛔ READ THIS FIRST — production moved to a laptop

**`*.spacesangels.com` is served by `angel-node-01`, a ThinkPad T440s on Ken's desk.**
Railway's trial expired mid-session; `railway up` answers *"Your trial has expired"* and
19 commits could not ship. The wildcard was repointed on 260827.

**Intended to move BACK on Sept 1**, when Railway can be paid. Every changed value and
its revert is tabled in `docs/selfhost/thinkpad/NODE_CONFIG.md`.

```bash
# Deploy is NO LONGER `railway up`. It is:
MSYS_NO_PATHCONV=1 wsl -d Ubuntu-22.04 -u root -e bash \
  /mnt/c/Dev/angels-os/docs/selfhost/thinkpad/push-to-node.sh
```

That script pulls **committed main** from GitHub, builds in WSL, pushes only changed
layers to the node's registry, restarts Core and health-checks. Commit and push first or
you will ship the previous commit.

**Telling the two apart:** `Server: cloudflare` = the node. `Server: railway-hikari` =
Railway. Railway's **Postgres is still serving** (only deploys are blocked); the node runs
a fresh 260827 restore of it, and `angels_old_260827` is the pre-cutover copy.

Reaching the box — same machine, three addresses:

| | |
|---|---|
| `node01.spacesangels.com` | its own tunnel hostname |
| `100.70.52.74` | Tailscale — `mstsc /v:100.70.52.74`, survives the LAN IP moving |
| `192.168.0.171` | LAN, and it **moves** |

`ssh -i ~/.ssh/angel_node angel@192.168.0.171` · logs: `lazydocker` on the box, or
`docker logs -f angelos-core` · the node reports itself to
`www.spacesangels.com/dashboard/telemetry` every 2 minutes.

---

## ✋ Open items, in the order they matter

### 1. The apex is still on Railway — needs Ken's hands
`spacesangels.com` has its own `CNAME → brdq7dq2.up.railway.app`, and an explicit record
beats the wildcard. `cloudflared` refuses to overwrite an existing apex record, so this is
a manual Cloudflare dashboard delete. Once it's gone:

```bash
ssh -i ~/.ssh/angel_node angel@192.168.0.171 \
  'cloudflared tunnel --origincert /home/angel/.cloudflared/cert.pem \
     route dns --overwrite-dns 7ec2ed85-6fda-4648-9257-0bfbd1a86cac "spacesangels.com"'
```

Not urgent — sign-in uses `www`, which is already on the node. But the apex serves frozen
code until it moves.

### 2. Nimue: 87 is in review, 88 is built and waiting
**87 (1.2.75)** was submitted to Closed testing – Alpha and is in Google's queue.
**88 (1.2.76)** is built, signed, at
`C:\Dev\nimue\android\app\build\outputs\bundle\release\app-release.aab` and fixes the
first-run experience 87 still ships broken:

- identity lists were `cache-first`, which revalidates and **throws the fresh result
  away** — so a portal you were just invited to stayed invisible until a force-close;
- `/enterprises` was gated to `super_admin`, so a normal user had **no join door at all**;
- nothing told anyone they could ask for their own portal, though `commission_endeavor`
  has always been free to any signed-in user. `/portals` now offers it.

**Ken's call:** replacing 87 means "Remove changes" and resubmitting, restarting the
review clock. Recommendation was to do it — nobody has downloaded the beta yet.

⚠️ Uploading the AAB **cannot be automated**: Chrome's file-upload tool caps at 10 MB and
the bundle is 16 MB. Ken drags the file; the rest can be driven. The durable fix is the
Play Developer API + `gradle-play-publisher`, which needs a service account Ken creates.

### 3. Twelve testers is the production gate — and the pool is too small
Play needs **12 opted-in testers for 14 continuous days**; 3 are opted in.
WDEG has **five** active members total, of whom one is an outside human:

```
billthecat1022@gmail.com      Ron Courtney
clearwatercruisin@gmail.com   ClearwaterCruisin
junaidmohiyuddin886@gmail.com Junaid Mohiyuddin
kenneth.courtney@gmail.com    Kenneth Courtney
tylersuzanne84@gmail.com      Tyler Suzanne
laurencourtney99@gmail.com    (added by Ken)
```

All Gmail, so all eligible. **This is a recruiting problem, not an engineering one** —
say so plainly rather than building more tester plumbing.

### 4. Merlin's shared roots don't match the file on disk
`media-roots.json` lists `DCIM (E:)`, `DCIM (G:)`, `Movies (E:)`, but the live shared-roots
config has only `Videos (Home)`. Same file-versus-database split that made the tunnel URL
keep reverting. Needs a look in Merlin's Shares page — and `E:` plugged in.

---

## ✅ What shipped in this session

**Booking is free on every plan** (`c17a6f9`). The `onlineBooking` capability is **deleted**,
not moved. It contradicted `PLAN_FEE_BPS`, which already charges a free portal 5% on each
deposit — a rate unearnable if a free portal cannot take a booking. The subscription buys
the fee *down* (5%/2%/0%); it never bought booking. Harpazo (Ron's site, tenant 17,
plan=free) was showing *strangers* an upgrade pitch aimed at the *owner*.
**What gates money is Stripe Connect**, and `booking-checkout.ts` already did it right:
no connected account, a $0 deposit, or COD → the booking is a REQUEST with no charge.
Ken's ruling, option C. Still open: prompt for Connect at the **first attempted charge**,
not at onboarding.

**The arrival ledger** (`a37b050`, `3e91a9a`). Twelve inbound endpoints did their work
inline and left no trace; only Stripe kept a row, and only for idempotency. New
`system-events` collection + `withEventLedger(source, handler)` wrapping at
**registration** in `payload.config.ts` — ten webhooks plus `/capture` and
`/bridge/inbound`, one behaviour, no edits inside handlers. Body read from a **clone** so
the wrapper cannot starve the handler; fail-soft both ways. Not a queue — Payload jobs
already run work, and `payload-jobs` already keeps failed rows, which is the scheduled
half of the same principle. This is the sensory record the error nervous system was
missing.

**Merlin was never down** — three faults made it look dead:

- the tunnel gate validated sessions against `127.0.0.1:3000` while the scheduled task
  starts Merlin on **3002** → every visitor bounced to `/admin/login`, signed in, bounced
  again. An infinite redirect that reads as a wrong password;
- the node-bus heartbeat only started when something *visited* `/api/node/register`, so
  after any restart it never started — 62 days grey on telemetry. Now in
  `instrumentation.ts`, Next's boot hook;
- it advertised a **quick tunnel pointed at the dead port**, so Core proxied media to an
  empty origin and 502'd every file. Named tunnels now win over minting a quick one, and
  the named write **re-asserts every tick** because settings hydrate from a
  `node-settings` global *after* boot and were clobbering it.

⚠️ **One port drift caused three separate outages.** `3000` was hardcoded in the auth
gate, `servingPort()` and `ensureAutoTunnel()`. `Set-ScheduledTask` needs elevation, so
the task still runs 3002 and the code now reads `process.env.PORT`. If Ken ever moves it
to 3000, `~/.cloudflared/config.yml` must move with it.

**MerlinControl is a directory browser now** (`2bd4474` Merlin, `42761f5` Core). It used
to ask over the AI Bus — post a command, poll every 1.5s for 30s — which is why it
rendered a flat capped table and cached to localStorage. `browseShared()` +
`/api/shared/list` on the node, `/api/node-ops/browse` proxying one level synchronously
through the tunnel. Folders, breadcrumb, inline viewer. **No cache, deliberately** — a
stale listing is how you get "not found" on something you just recorded. The node's own
error text reaches the screen, so an unplugged drive reads *"drive not connected"*.
Skipped: thumbnails.

**Merlin's federation language is gone** (`78c2a29`). There is one Enterprise; `/connect`
is a portal picker shaped like Nimue's — the portal you're in, the ones you've been in,
and a box for one you haven't. `lib/federation.ts` and the directory endpoints are
untouched: language and surface, not capability.

---

## ⚠️ Hard-won, do not re-learn

- **`.env.local` values carry literal quotes into the container.** `env_file: format: raw`
  (added to fix the `$`-in-secrets bug) does not strip them, so `PAYLOAD_SECRET="74e…"`
  reached Payload *with the quotes* — the node signed every JWT with a different secret
  than Railway, and sign-in died the moment it became production. Ten variables were
  affected. ⚠️ **The desktop stack at `C:\Dev\datacenter\stack` shares this shape and
  still has it** — and it explains the documented "system email auth fails with nothing in
  any log" mystery, since `SYSTEM_EMAIL_PASSWORD` is one of the ten.
- **Anything registered with a third party has its own copy of the truth.** Google OAuth
  is registered against `https://www.spacesangels.com` — *with* `www` — because that is
  what Railway's `SERVER_URL` was. Setting the node to the bare apex produced
  `redirect_uri_mismatch`. Health checks and page loads never touch OAuth, so this class
  of break only surfaces when a real person tries a real flow.
- **`httpHostHeader` in a tunnel config rewrites the Host.** The node's ingress pinned it
  to `node01.spacesangels.com`; left in place, every one of 23 portals would have resolved
  as node01. A multi-tenant origin must receive the Host intact.
- **`cloudflared` can need a restart after a network blip.** Its retry loop reconnected and
  logged `Registered tunnel connection`, but the edge kept 502ing every hostname until
  `systemctl restart cloudflared`.
- **A Windows scheduled task reporting `Running` proves nothing.** It reports the
  PowerShell wrapper, not the server. Merlin appeared "Running" while a stuck process held
  :3002 and every restart died on `EADDRINUSE`. Check the port, not the task.
- **KRdp shares the *running* Plasma session.** Autologin is now set (`User=angel` in
  `/etc/sddm.conf.d/20-kubuntu.conf`) so a reboot lands in Plasma with a session to share.
  `LIBVA_DRIVER_NAME=i965` lives in `/etc/environment.d/99-libva.conf` but **does not reach
  an already-running Wayland session** — a session started without it freezes video while
  input keeps working. Chrome Remote Desktop remains the unattended lifeline; it spawns
  its own session.
- **`NEXT_PUBLIC_SERVER_URL` is NOT baked** in this Dockerfile — no `ARG` declares it, so
  it is a runtime var and an env change plus restart is enough. (Client components must
  still receive it as a prop.)

---

## Not done, and honest about it

- **Connect-at-first-charge** for booking deposits. Nobody has a deposit pending.
- **Thumbnails** in the MerlinControl browser.
- **A retry sweeper** over `system-events.status = 'failed'`. The rows are selectable
  whenever it's wanted.
- **Folding `processed-stripe-events`** into the arrival ledger.
- **Nimue's identity-refresh fix is unproven on a device.** It builds and the reasoning is
  sound, but nobody has installed 88 and watched a new portal appear.
