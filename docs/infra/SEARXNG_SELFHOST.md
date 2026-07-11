# Self-hosting SearXNG — LEO's owned web-retrieval backbone

SearXNG is a self-hosted **metasearch** engine: it queries Google/Bing/DuckDuckGo/
Wikipedia/etc. and returns aggregated results **with no per-provider API keys and no
per-query cost**. It's LEO's `web_search` backbone — the config-free-intelligence
stance applied to retrieval. Core prefers it over Tavily/Brave when `SEARXNG_URL` is
set (`src/utilities/webSearch.ts`).

Runs anywhere Docker runs. These instructions target the **VMC/IONOS box** that already
hosts Uptime Kuma + Gotify behind **nginx** — SearXNG slots in the same way. Fully
portable: tear down = stop the container; move = copy `searxng/` to a new host and
re-point `SEARXNG_URL`.

---

## 1. Install (Docker)

Pick a home, e.g. `/opt/searxng` (or `C:\srv\searxng` on Windows Docker).

```bash
mkdir -p /opt/searxng && cd /opt/searxng
```

`docker-compose.yml`:

```yaml
services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - "127.0.0.1:8888:8080"   # bind to LOCALHOST only — nginx terminates TLS in front
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=https://search.YOURDOMAIN/   # public URL nginx serves
      - SEARXNG_SECRET=CHANGE_ME_TO_A_LONG_RANDOM_HEX  # `openssl rand -hex 32`
    cap_drop: [ALL]
    cap_add: [CHOWN, SETGID, SETUID]
```

First run generates `./searxng/settings.yml`. Start it once, then edit that file:

```bash
docker compose up -d
```

## 2. Enable the JSON API (REQUIRED — Core reads JSON)

SearXNG disables JSON output by default. Edit `./searxng/settings.yml`:

```yaml
search:
  formats:
    - html
    - json          # ← add this line; Core hits /search?...&format=json

server:
  secret_key: "PASTE_THE_SAME_HEX_AS_SEARXNG_SECRET"
  limiter: false     # we front it with nginx + a private URL; the bot-limiter blocks server-to-server JSON
  # (optional) bind_address stays default; the container port mapping handles exposure
```

Restart: `docker compose restart searxng`.

Verify JSON works locally on the box:

```bash
curl -s 'http://127.0.0.1:8888/search?q=cicero&format=json' | head -c 300
# → {"query":"cicero","results":[{"title":"Cicero - Wikipedia","url":...}] ...}
```

If you get HTML or a 403, the `formats: [json]` / `limiter: false` edits didn't take — recheck settings.yml and restart.

## 3. nginx reverse proxy (same pattern as gotify/uptime-kuma)

Add a server block (adjust to your existing cert setup — reuse the wildcard/LE cert you
already use for the other services):

```nginx
server {
    listen 443 ssl;
    server_name search.YOURDOMAIN;

    ssl_certificate     /etc/letsencrypt/live/YOURDOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOURDOMAIN/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

**Access note:** Core calls this server-to-server from Vercel, so the URL must be
publicly reachable. If you'd rather NOT expose it publicly, keep it private and reach it
via the Merlin/Cloudflare tunnel instead, then set `SEARXNG_URL` to that tunnel host.
Either way there are no keys — availability is the only requirement.

## 4. Point Core at it

Set on **both** Vercel projects (`angels-os` + `angels-os-kendev`), Production:

```
SEARXNG_URL = https://search.YOURDOMAIN
```

Redeploy (or it picks up on next deploy). Verify end-to-end: ask LEO something that
needs the live web ("what's the latest on X"); the `web_search` result will carry
`provider: "searxng"`. No key envs needed; Tavily/Brave remain optional fallbacks.

## 5. Tear down / move to a new server

- **Stop:** `docker compose down` (data is just the config dir; nothing stateful to lose).
- **Move:** copy the whole `/opt/searxng` dir (compose + `searxng/settings.yml`) to the
  new host, `docker compose up -d`, re-point nginx, and update `SEARXNG_URL`. That's it —
  no database, no migration.
- **Disable entirely:** unset `SEARXNG_URL` on Vercel → Core falls back to Tavily/Brave/
  DuckDuckGo automatically. Nothing breaks.

## Config summary (the whole surface)

| Where | Key | Value |
|---|---|---|
| VMC docker | `SEARXNG_SECRET` / `settings.yml server.secret_key` | same long hex |
| VMC settings.yml | `search.formats` | `[html, json]` |
| VMC settings.yml | `server.limiter` | `false` |
| nginx | `server_name` | `search.YOURDOMAIN` → `127.0.0.1:8888` |
| Vercel (both projects) | `SEARXNG_URL` | `https://search.YOURDOMAIN` |

That's the entire footprint — five settings, one container, zero API keys, fully portable.
