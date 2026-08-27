# angel-node-01 — the living configuration

**What this file is.** The state of the ThinkPad, written down so any future
session can pick it up cold without re-discovering it, and so the other two
identical T440s clones can be brought to the same place deliberately rather than
by memory. `README.md` in this directory is how the box was BUILT; this is what
it currently IS.

Last verified: **260826**.

---

## Reaching it

```bash
ssh -i ~/.ssh/angel_node angel@192.168.0.171
```

| | |
|---|---|
| Hostname | `angel-node-01` |
| LAN address | **192.168.0.171** — DHCP, and it MOVES (it was .170 until the NetworkManager migration) |
| SSH key | `~/.ssh/angel_node` on Ken's desktop. Password auth is off. |
| Console login | user `angel`, password `angel` (lab box, physical access only) |
| sudo | passwordless |

> **Never hardcode the IP anywhere that matters.** It changed once already
> during a routine network change. Everything that must survive addresses the
> box by its tunnel hostname; the LAN IP is for SSH convenience only. If SSH
> fails, scan `192.168.0.170`–`.175` before assuming the box is down.

## The hardware, and what it is actually good for

ThinkPad T440s — Haswell-ULT i5, **7.1 GB RAM**, 163 GB disk (22 GB used),
Intel HD 4400 graphics. One of **three identical clones**; this is the first.

| | |
|---|---|
| Bare server, idle | 578 MB |
| With KDE Plasma running | ~1.3 GB |
| Postgres 18 + PgBouncer | ~200 MB |

RAM has never been the constraint. **The BUILD is.** `next build` needs more
headroom than the whole machine has, which is why `core` pulls a prebuilt image
and never builds one. The laptop's other genuine advantage is the battery: a
built-in UPS, which is the cheapest clean-shutdown insurance available.

## What is running

| Thing | State | Notes |
|---|---|---|
| Ubuntu | 26.04 LTS | unattended security updates on |
| Docker | 29.7.2, Compose v5.5.0 | |
| **Registry** | ✅ `angelos-registry`, 127.0.0.1:5000 | so a rev ships only changed layers |
| **Postgres 18** | ✅ healthy | container `angelos-pg`, bound to 127.0.0.1:5432 |
| **PgBouncer** | ✅ healthy | container `angelos-pgbouncer`, 127.0.0.1:6432, transaction mode |
| **Core** | ✅ serving | `angelos-core:local`, health 200 local and public |
| KDE Plasma 6.6.6 | ✅ Wayland, SDDM | |
| KRdp (RDP server) | ✅ autostart | shares the LIVE Plasma session |
| Chrome Remote Desktop | ✅ enabled | its OWN virtual X session, not the physical one |
| Claude Code | ✅ `/usr/local/bin/claude` | native Linux build |
| `gh` CLI | ✅ 2.46.0 | for VS Code GitHub auth |
| cloudflared | ✅ installed | tunnel `angel-node-01` → `node01.spacesangels.com` |

Stack files live in `/opt/angelos`:

```
/opt/angelos/.env.local        secrets, 600, copied from the desktop
/opt/angelos/stack/.env        PGUSER / PGPASS, 600
/opt/angelos/stack/docker-compose.yml   ← from docs/selfhost/thinkpad/node-compose.yml
/opt/angelos/tunnel-setup.sh   ← from docs/selfhost/thinkpad/tunnel-setup.sh
/opt/angelos/backup.sh         nightly pg_dump, keeps 14 days
/opt/angelos/backups/
```

## Watching it work

**Logs, live, with a UI** — `lazydocker` is installed (`/usr/local/bin/lazydocker`).
SSH in or use the RDP session's terminal and run `lazydocker`: containers on the
left, logs streaming on the right, arrow keys to switch, `q` to quit. No web
service, no port, nothing to secure.

Plain-terminal equivalents, when a UI is more than the question deserves:

```bash
docker logs -f --tail 100 angelos-core     # just Core, following
cd /opt/angelos/stack && docker compose logs -f   # everything, interleaved
journalctl -u cloudflared -f                # the tunnel
systemctl list-timers angel-heartbeat.timer # is telemetry still beating
```

**In the dashboard**: the box registers itself with Core every 2 minutes via
`/opt/angelos/node-heartbeat.sh` (systemd timer `angel-heartbeat.timer`), so it
appears in **/dashboard/telemetry** beside Merlin with CPU, RAM, disk, uptime,
tunnel state and the container roll-call. Registration also mints its bus
identity — channel `node:platform:angel-node-01` — so LEO can address it.

The script is `docs/selfhost/thinkpad/node-heartbeat.sh` in the repo; it uses
only `/proc`, `df` and `curl`, and `/node-ops/register` is idempotent, so a
timer posting JSON *is* the whole telemetry client.

## Remote access — three ways in, and they are not interchangeable

**1. SSH** — headless work. Always available.

**2. KRdp + Windows `mstsc`** — the REAL Plasma desktop.

```bash
mstsc /v:192.168.0.171
```

Credentials are set in System Settings → Remote Desktop and live in KWallet.
Config persists at `~/.config/krdpserverrc` with `Autostart=true`.

⚠️ **KRdp shares a RUNNING session.** After a reboot, SDDM sits at the greeter
and there is nothing to share — someone must log in at the laptop first. This
is the single most likely reason a future "RDP is broken" turns out not to be.

⚠️ The physical screen mirrors what you do, and the screen locker will lock you
out mid-session if it fires.

**3. Chrome Remote Desktop** — the off-network lifeline. It spawns its OWN
virtual X session running XFCE; it **cannot** attach to the physical Plasma
session and never will — CRD's Linux host has no such mode, and Plasma here is
Wayland, so there is no X display to attach to. That independence is exactly
what makes it useful when Plasma wedges.

> The CRD PIN was exposed in a screenshot on 260826 and should be rotated at
> remotedesktop.google.com/access.

## Networking

**NetworkManager owns the Wi-Fi**, deliberately, so the Plasma applet actually
manages it. This REVERSES the `99-angel-unmanaged.conf` fence the build kit
installs — do not put it back without asking.

The migration path that works is **netplan's renderer**, not a hand-written NM
profile:

```yaml
# /etc/netplan/99-wifi.yaml
network:
  version: 2
  renderer: NetworkManager
  wifis:
    wlp3s0:
      dhcp4: true
      access-points:
        "SETUP-5E8E": { password: "…" }
```

…then delete `/etc/NetworkManager/conf.d/99-angel-unmanaged.conf`,
`netplan apply`, restart NetworkManager. Netplan writes the NM connection from
the same YAML, so the PSK is never retyped.

Two things that bit, both worth knowing before repeating it on clone #2:

1. **The link drops ~20s and the DHCP lease CHANGES.** Anything addressing the
   box by IP breaks at the moment you are watching it.
2. **A rollback guard must be cancelled by the VERIFICATION, not by you.** The
   first attempt worked and was then undone by its own timer while SSH was still
   reconnecting to the new address — a success that looked like a failure. Put
   the connectivity check INSIDE the script that runs on the box, and remember
   `ssh host 'bash -s'` dies with the connection.

Ethernet (`enp0s25`) is present and DOWN — the box is 20 feet from the router on
Wi-Fi and measures **200 Mbps down / 160 up**. Plugging in later changes nothing
that matters, because the tunnel dials out either way.

`ufw` is **inactive**. Every service port is bound to 127.0.0.1 and the tunnel is
the only ingress, so there is nothing listening on the LAN except SSH and RDP.

## The Cloudflare tunnel — why there is no router work

A tunnel dials **out** to Cloudflare's edge and holds the connection open. There
is no port to forward, no static IP to hold, and no router admin to have —
which matters here because the router is Cox's and Ken has no admin on it. The
box can change IP, move to ethernet, or be carried to another building; the
hostname keeps resolving because the edge routes to whichever connection is
currently dialled in.

| | |
|---|---|
| Tunnel name | `angel-node-01` |
| Hostname | `node01.spacesangels.com` |
| Zone authorized | `spacesangels.com` |
| Origin | `http://127.0.0.1:3001` |
| Service | systemd `cloudflared`, enabled at boot |
| Config | `/etc/cloudflared/config.yml` |

**A specific record beats the wildcard without touching it.**
`node01.spacesangels.com` is its own CNAME; `*.spacesangels.com` keeps pointing
at Railway. Production does not move and nothing has to be unbound.

⚠️ **A tunnel is an identity, not a machine.** Two hosts running the same tunnel
id both register and traffic splits between them at random — which, with two
different databases behind them, is a bad afternoon. Each clone gets its own
tunnel and its own hostname.

Set up (idempotent) with:

```bash
ssh -i ~/.ssh/angel_node angel@<node> 'bash /opt/angelos/tunnel-setup.sh node01.spacesangels.com'
```

## ⚠️ 260827 — this node IS production, temporarily

Railway's trial expired and `railway up` refuses, so 19 commits could not ship.
The wildcard was moved here on 260827. **Intended to move BACK on the 1st**, when
Railway can be paid.

What was changed, and how to put it back:

| Thing | Now | Revert to |
|---|---|---|
| `*.spacesangels.com` CNAME | this tunnel | `qh3cy3sm.up.railway.app` |
| `spacesangels.com` (apex) | **still Railway** — an explicit record beat the wildcard and cloudflared would not overwrite it | — |
| `COOKIE_DOMAIN` (compose L102) | `.spacesangels.com` | `node01.spacesangels.com` |
| `NEXT_PUBLIC_SERVER_URL` (compose L97) | `https://spacesangels.com` | `https://node01.spacesangels.com` |
| `ENV_LABEL` (compose L95) | PRIMARY while Railway is frozen | second node, restore of production |
| `/etc/cloudflared/config.yml` | wildcard ingress, **no** `httpHostHeader` | `config.yml.bak-260827` |
| DB | fresh restore of Railway, 260827 | `angels_old_260827` is the pre-cutover copy |

`httpHostHeader` had to go: it rewrote every request's Host to node01, so every
portal resolved as node01. A multi-tenant origin must receive the Host intact.

The DNS flip itself:

```bash
cloudflared tunnel --origincert /home/angel/.cloudflared/cert.pem   route dns --overwrite-dns <tunnel-id> "*.spacesangels.com"
```

`--origincert` is required — the service runs as root and the cert lives in
`/home/angel/.cloudflared`.

---

## This was a SECOND NODE, not production (pre-260827)

Railway is live and serves `*.spacesangels.com`. This box serves a **restore** of
the same data on its own hostname — same tenants, same content, two admin panels.

- `ENV_LABEL` renders a blue "second node" strip — but ONLY inside the Payload
  admin panel, after sign-in: it is mounted at `admin.components.beforeNav`
  (`src/components/EnvBanner`). It does NOT appear on the public site or on the
  /admin login screen, so its absence there proves nothing. To tell the two
  nodes apart without signing in, ask the container:
  `docker exec angelos-core printenv | grep -E 'ENV_LABEL|DATABASE_URI'` — a
  DATABASE_URI pointing at `pgbouncer` is the local restore, by definition.
- **`COOKIE_DOMAIN` is scoped to `node01.spacesangels.com`, NOT `.spacesangels.com`.**
  An apex cookie would be sent to Railway too, and against a restored database
  the same session id means a different user row on each side.
- Run it in parallel for two weeks before any cutover conversation.

## Two bugs the real hardware surfaced — do not re-learn these

**Compose silently blanks any secret containing a `$`.** Docker Compose
interpolates `env_file` contents, so `SYSTEM_EMAIL_PASSWORD` reached the
container as an **empty string** — measured: 17 characters raw, 0 interpolated.
Fixed with `format: raw`:

```yaml
env_file:
  - path: /opt/angelos/.env.local
    format: raw
```

⚠️ **The desktop stack at `C:\Dev\datacenter\stack\docker-compose.yml` still has
this bug** — same `.env.local`, same shape. System email auth is failing there
with nothing in any log naming the variable.

**postgres:18 refuses the old mount point.** It wants the volume at
`/var/lib/postgresql`, one level ABOVE the classic `/var/lib/postgresql/data`,
so `pg_upgrade --link` has no mount boundary to cross. Mount the old path and 18
refuses to start, citing data it cannot use — on an empty volume.

**Haswell needs the i965 VA driver, not iHD.** `intel-media-va-driver` (iHD) only
supports Broadwell and newer, so libva logs `iHD_drv_video.so init failed` and
falls back. Pinned in `/etc/environment.d/99-libva.conf` — note that
`/etc/environment` does NOT reach a Wayland session, which is why the first
attempt had no effect. This removes a failed probe; it was not the cause of the
one-frame RDP freeze (a reboot and fresh login fixed that).

## Shipping a revision — one command from the desktop

```
docs/selfhost/thinkpad/push-to-node.cmd     (double-click, or run the .sh in WSL)
```

Pulls the latest COMMITTED main into WSL, builds there, pushes to the node's
registry, restarts Core, waits for health, prints the local and public status
codes, and dumps Core's logs and exits non-zero if it does not come back.

**Docker Desktop is NOT required and should not be reinstated.** It is a paid GUI
over an engine that `apt install docker.io` provides free, and on this desktop
its engine would not start at all (WSL distro stopped, no pipe). The build runs
inside WSL Ubuntu 22.04 — 11 GB and 6 CPUs, which is what the ThinkPad lacks.
`wsl -u root` needs no password, so nothing had to be bought or unlocked.

**Why a registry rather than `docker save | ssh docker load`:** save writes every
layer, so a one-line change re-sends 400 MB and takes six minutes — and a
six-minute deploy is one you stop using. A push sends only what changed. The
registry is bound to 127.0.0.1 on the node and reached over an SSH forward;
Docker exempts localhost from its TLS rule, so there are no certificates and no
`insecure-registries` edits on either machine.

⚠️ It builds from a **clean clone of pushed main**, never the working tree —
shipping uncommitted work is how a node ends up running something no commit
describes.

`.github/workflows/node-image.yml` does the same thing in CI and is the better
answer the day the GitHub account's billing lock clears; it needs no machine and
makes clones #2 and #3 a `docker pull`.

## Still open

- `db-repair-sequences` and `db-repair-locks` — id sequence drift is guaranteed
  after any restore, and should be run before anything writes here.
- Merlin stays on the DESKTOP by Ken's call (260827): it serves media off an
  external drive plugged in there, and `merlin.spacesangels.com` already works.
  `merlin.kendev.co` is staged in the desktop's `~/.cloudflared/config.yml`
  above the `*.kendev.co` wildcard, inert until a CNAME exists.
- Clones #2 and #3.

## Making clones #2 and #3

The build kit (`README.md` + `user-data`) produces the base. Then, in order:
`bootstrap.sh` → copy `.env.local` and `stack/.env` → this directory's
`node-compose.yml` → `tunnel-setup.sh` with a **different** hostname and tunnel
name → optionally `kubuntu-desktop`, `krdp`, `gh`, Claude Code.

The lid config, the unattended updates and the nightly backup all come from the
build kit and need nothing further.
