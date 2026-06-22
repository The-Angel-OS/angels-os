# Node ↔ LEO communication over the message bus

> 260622 — the spine of dynamic comms between the three bodies. Model **B**: nodes
> talk to LEO over the existing `{space, channel, message}` bus, not a REST poke
> through a tunnel. "No new protocol" — the conversation *is* the wire and the log.

## Why the bus, not the tunnel

The first sketch was a pull-over-tunnel: register a `tunnelUrl`, have a Core LEO tool
`fetch(tunnelUrl + /api/node/skill)`. That's the *opposite* of the north star
(State report §4): NAT-fragile (home nodes are behind NAT; cloudflared quick tunnels
are ephemeral), one-directional (Core→Merlin only), and leaves no durable record.

The mesh wants **outbound-only, durable, bidirectional** comms. A node runs ONE
server-side poll loop that does three jobs at once:

1. **Presence** — the poll's timestamp re-registers `lastSeen` (keeps MerlinControl's
   5-min online window green).
2. **Command inbox** — the same poll pulls pending commands addressed to this node.
3. **Result post** — node executes, posts the answer back as a message.

Outbound-only ⇒ NAT traverses for free. Durable ⇒ the channel is the audit log.

**The tunnel doesn't die — it just changes job.** Command/control rides the bus;
**bulk/streaming** (movies, camera feeds, big files — report §4) rides the tunnel,
whose URL is advertised in the presence ping. Split by payload, not rivalry.

## Addressing — dedicated per-node channel

Each registered node gets its OWN channel in the endeavor's **AI Bus** space:

```
slug:  node:<endeavor>:<nodeId>      e.g.  node:clearwater-cruisin:Iam0
space: the endeavor tenant's AI Bus space (resolveAiBusSpaceId)
```

Least-privilege: a node polls only its own channel — never sees sibling nodes'
commands, no client-side target filtering, one clean log per node. Costs one
`channels` row. (Rejected: a shared endeavor ops channel — one compromised node would
read everyone's traffic.)

## Identity — dedicated node system-user + minted token

On register, Core idempotently provisions (all via existing helpers):

- **node system-user** — `findOrCreateSystemAgent` keyed `node-<nodeId>@<endeavor>…`,
  `isSystemUser: true`, `servesTenant = endeavor tenant`. Results are authored by the
  node, not the human who locked it on; revocable per-node; survives the human signing out.
- **per-node channel** — in the AI Bus space (`resolveAiBusSpaceId`).
- **space membership** — `findOrCreateSpaceMembership(member)` so the node user can
  read AND post (chat-send requires a membership row; `servesTenant` alone grants read
  but not post).
- **node token** — a short-lived Payload JWT minted for the node user (same `jose`
  pattern as `auth-system-token`). Returned in the register response. Merlin uses it as
  `Bearer` for poll + chat-send. **The heartbeat re-register refreshes the token before
  expiry** — no separate refresh path.

Register response gains: `{ channel, spaceId, nodeToken, nodeTokenExpiresAt }`.

## The envelope — no schema migration

Commands and results are ordinary messages discriminated by `metadata.kind`. We do
**not** add `messageType` enum values (that would be an `ALTER TYPE` on both DBs — the
exact hazard the deploy law warns about). `messageType: 'system'` is enough: it's
`!== 'user'`, so the moderation/reflex hooks skip it, and nothing auto-triggers.

```jsonc
// command  (LEO → node), posted by the list_node_files tool
{
  "messageType": "system",
  "channel": "node:clearwater-cruisin:Iam0",
  "content": { "text": "list files matching \"answer\"" },
  "metadata": {
    "kind": "node-command",
    "requestId": "<uuid>",
    "tool": "list_media",
    "args": { "query": "answer" }
  }
}

// result  (node → LEO), posted by the Merlin poll loop
{
  "messageType": "system",
  "channel": "node:clearwater-cruisin:Iam0",
  "content": { "text": "12 files…" },
  "metadata": { "kind": "node-result", "requestId": "<uuid>", "ok": true, "files": [ … ] }
}
```

## The loop (first light)

1. LEO runs `list_node_files(nodeId?, query)` → handler resolves the node + its channel
   from the `merlin-nodes` setting, posts a `node-command` message, returns
   *"Dispatched to Iam0 — reply incoming."* (Synchronous tool, async transport: the
   tool dispatches and returns; it does not block on the round-trip.)
2. Merlin's poll loop sees the command on its channel, runs the `list_media` skill
   (the `ade7586` shared-roots rail), posts a `node-result` message.
3. The result lands in the channel; the user sees it.

## Deferred (named, not built)

- **LEO-wake-on-result** — an `afterChange` on Messages that, on `metadata.kind ===
  'node-result'`, re-invokes LEO with the result as context so it can summarize/act.
  First light just surfaces the raw result in the channel.
- **Bulk transport over the tunnel** — File Browser / Media Library / cameras
  (MerlinControl tabbed panel, report §4).
- **Token-poor node dispatches thinking to a peer** — same bus, peer LEO as the target.
