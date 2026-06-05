# Federation Testbed — two sovereign nodes (spacesangels.com ⇄ kendev.co)

Graduate the emergent-network mockup into a *real* two-instance federation, so we
can test sovereign syndication, cross-node dispatch, and failover for real — while
keeping the cost near zero.

## Why two instances (not one deployment, two tenants)

The federation thesis is **sovereign nodes**: separate process, separate database,
no shared state. You can't test that inside one deployment. Two Vercel projects off
the **same repo** (no code fork — just different env) gives us:

- **Node A** — `spacesangels.com` — current prod, current Postgres + Blob.
- **Node B** — `kendev.co` — a second Vercel project off this same repo, its own
  Postgres + Blob, its own couple of tenants. The alternative federated Enterprise.

They federate over the endpoints that already exist (`/api/federation/*`). Nothing
new to build to make them talk — it's an ops/env exercise.

## Cost reality (the important part)

**The federation protocol is pure compute — ~zero LLM tokens.** Heartbeats, capacity
snapshots, work routing, pheromone trails, catalog, Works syndication, and signature
verification are deterministic math over HTTP. Two nodes can bounce off each other
indefinitely and spend no model tokens. Tokens are only spent when an **agent
actually thinks** (a conversation, a `generation` work unit) — and that path is
already bounded by the AI-gateway credit pressure + per-endpoint rate limits.

Guardrails to keep it that way:
1. **Heartbeats are reflexes, never thoughts** — keep the `heartbeat-cron` interval
   sane; never invoke an LLM on a heartbeat or discovery ping.
2. **Node B runs agent-cold** — coordinate + replicate, but don't auto-respond with
   the LLM (recommended flag: `FEDERATION_AGENT_AUTORESPOND=false`; needs a small
   wire-up in the agent entrypoint — see Follow-ups).
3. **Simulator first, instances second** — prove ~90% (emergence, routing, failover,
   trails) in the zero-cost mock (`GET /api/federation/simulate`); stand up Node B
   only for what genuinely needs two DBs (cross-wire signatures, replication,
   partitions).

## Stand up Node B (kendev.co) — checklist

These are the steps that need your accounts (Vercel / DNS / DB). No code changes.

1. **Postgres for Node B** — a separate database (a free Neon/Supabase project or a
   Neon branch is plenty for testing). Note its connection string.
2. **Blob store for Node B** — a separate Vercel Blob store (its own
   `BLOB_READ_WRITE_TOKEN`) so each node's CAS is its own.
3. **Vercel project** — "New Project" → import this same repo → name it e.g.
   `angels-os-kendev`. Set env from `.env.node2.example` (below). Deploy.
4. **DNS** — point `kendev.co` (+ `www`) at the new Vercel project.
5. **Tenant(s) on Node B** — seed at least one tenant on Node B (its own Enterprise)
   so it has something to publish/federate. Add `kendev.co` to that project's
   `TENANT_DOMAINS` if apex-domain resolution is needed (middleware returns null for
   bare 2-part hosts otherwise).
6. **Peer the two nodes** — set `FEDERATION_REGISTRY_URL` on each to point at the
   other (Node A → `https://kendev.co`, Node B → `https://spacesangels.com`). For
   early testing you may set `FEDERATION_ALLOW_UNSIGNED_PINGS=true` on both, then
   tighten once keys are exchanged.

## What to test (cross-wire, all ~zero-token)

- **Handshake** — `POST /api/federation/heartbeat` between nodes; confirm each
  records the other (with its real `senderDomain`) and `/federation/discover` shows
  the peer.
- **Catalog / discovery** — `GET /api/federation/catalog` surfaces the other node's
  listings.
- **Works syndication (the headline)** — seal a Work on Node A, then on Node B pull
  its manifest and **verify the Ed25519 signature across the wire** (provenance can't
  be forged), replicate its CAS by `cid`, and read it offline. This is `worksSeal` +
  the manifest endpoint + `library_replicate` over HTTP.
- **Cross-node dispatch** — `POST /api/federation/dispatch-work` from A to B; watch a
  pheromone trail form across instances.
- **Suitcase** — `/federation/suitcase/export` on A → `/import` on B (data
  portability / the Suitcase Principle).

## Graduating the mockup into the real mesh

The simulator's transport abstraction is the bridge. In `EmergentNetwork`, a mock
node becomes Node B with one line:

```ts
net.bringOnline('kendev', 'https://kendev.co') // LiveTransport → real /api/federation/dispatch-work
```

Start all-mock, flip one node to `liveBaseUrl: 'https://kendev.co'`, and the rest of
the mesh keeps simulating around the one real node. Fill in live pieces as they come
online — exactly the design goal.

## Phased path

- **Phase 0 — done** — zero-cost mock simulator (`/api/federation/simulate`).
- **Phase 1** — a "Central" dashboard to watch the mock (and later the real mesh).
- **Phase 2** — stand up Node B at kendev.co (this checklist); graduate one node live.
- **Phase 3** — cross-instance Works publish/subscribe with signed-grant verification.

## Follow-ups (small code, when we want them)

- Wire `FEDERATION_AGENT_AUTORESPOND=false` so a node coordinates without thinking.
- A `node2` seed script (one tenant + a sample Work to publish).
- Point `BookReader` / Library at a peer's manifest URL for cross-node reading.
