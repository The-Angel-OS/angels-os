# The Federation

A single Angel OS node is useful. The network of them is the real idea. **Federation** is how sovereign nodes — separate processes, separate databases, no shared state — discover each other, trust each other, and grow together.

## The Diocese model

The unit of federation is the **Enterprise** — think of it as a **Diocese**. An Enterprise is the unit of *identity*, *trust*, and *probation*. The endeavors running on it (its "parishes") inherit its standing: if a Diocese is in good standing, its endeavors are too.

This keeps trust at the right grain. You don't vouch for a thousand individual shops; you establish trust between Dioceses, and the shops inherit it.

## How nodes connect

- **Signed heartbeats.** Each node periodically sends a signed heartbeat to its peers. That heartbeat carries who it is, what it offers, and a gossip index of its catalog — so peers learn about each other's works and offerings without a central server.
- **First-contact bootstrap.** A brand-new node sends one signed heartbeat to a registry peer, and discovery becomes mutual. Every future node clips onto the mesh with a single call.
- **Self-describing.** Any node can be asked for the current roster — itself plus its peers — so the network is legible from any point in it, signed in or not.

## Why federate

A federated network routes around weakness. If one node is token-poor or overloaded, the architecture is designed so it can lean on a peer. Knowledge, works, and eventually compute can flow to where they're needed. The network gets more resilient — not more fragile — as it grows.

It also means **no single owner**. There is no central Angel OS company that can be bought, captured, or shut down to take the network with it. Each node is sovereign. The federation is an agreement among equals, governed by the people who run it — which is the subject of the constitution, and of the votes any logged-in member can cast.

## The end state

The goal is a living mesh: many Enterprises, each serving their own community, each keeping their makers whole, all strengthening one another. A cooperative the size of the internet, owned by no one and serving everyone.
