# ── Angel OS Core — container image (Railway / Fly / bare Docker) ─────────────
# Payload 3.77 + Next.js 16 + Postgres. Off Vercel.
#
# Design notes:
#  - Migrations run at BOOT (against the runtime DB), NOT at build — the DB isn't
#    reachable during `docker build`. (The repo's `build` script chains
#    `payload migrate && next build`; here we split them.)
#  - Non-standalone: we ship the full app + node_modules and run `next start`, so
#    the `payload` CLI is present for boot migrations and there's zero interaction
#    with the custom `outputFileTracing*` config. Railway isn't size-billed.
#  - Media is on Cloudflare R2, so the container is STATELESS (no volumes).
#  - Portable: the same image runs on Railway, Fly.io, or any Docker host.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ── deps: install with the frozen lockfile (sharp fetches its linux-x64 prebuilt) ──
# patches/ is required — package.json pnpm.patchedDependencies references
# patches/payload@3.77.0.patch, so a frozen install ENOENTs without it.
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc* ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# ── build: next build only (no migrate). Payload's build needs PAYLOAD_SECRET +
#    DATABASE_URI to be PRESENT but does not query the DB — so we use PLACEHOLDER
#    FALLBACKS inline (the host's real values, e.g. Railway's injected service env,
#    win when set).
#
#    NEXT_PUBLIC_* CANNOT be set from the host here, and setting them as service
#    vars does nothing: a Docker build sees only ARGs that this file declares, not
#    the platform's environment. Anything the server must know at runtime therefore
#    belongs in a plain (non-NEXT_PUBLIC_) var — see SERVER_URL in getURL.ts. Add an
#    explicit ARG below only for a value the CLIENT bundle genuinely must inline. ──
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# PAYLOAD_SECRET must be >=32 chars (Payload validates at build); this placeholder is
# only a fallback for local builds — the host's real secret wins when set.
RUN PAYLOAD_SECRET="${PAYLOAD_SECRET:-build_time_placeholder_secret_not_used_at_runtime_00}" \
    DATABASE_URI="${DATABASE_URI:-postgres://build:build@localhost:5432/build}" \
    NODE_OPTIONS="--no-deprecation --max-old-space-size=4096" \
    pnpm exec next build

# ── runner ──
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# If sharp ever fails to load on this base, uncomment:
# RUN apt-get update && apt-get install -y --no-install-recommends libvips42 && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# Apply migrations to the RUNTIME DB, then serve. If migrate fails the boot fails —
# better than serving against an un-migrated schema. `start` = `next start` (honors PORT).
CMD ["sh", "-c", "pnpm run migrate && pnpm run start"]
