---
title: "Three Bodies, One Brain: The Weekend We Taught a Pool to Breathe"
date: 2026-06-22
author: Kenneth Courtney (with Claude / The Angel OS dev loop)
tags: [engineering, postgres, pgbouncer, vercel, payload, federation, angel-os]
teaser: >
  A 34-second spinner. A database that swore it was healthy. Six hours of
  detective work that ended not where anyone expected. This is the story of the
  weekend we stabilized The Angel OS — killed a phantom outage, taught our chat
  to stop eating its own replies, made our Library travel across the network, put
  a mobile app on the Play Store, and watched the first home node light up on its
  endeavor's page. A field report on shipping a three-body distributed system
  when the bug is never quite where the error message points.
---

# Three Bodies, One Brain: The Weekend We Taught a Pool to Breathe

The Angel OS is three bodies sharing one mind. **Core** is the cloud — the
multi-tenant CMS, the Spaces chat, the federation backbone. **Merlin** is the
home node — a desktop that turns a spare laptop into a media server and a
contributor of local compute. **Nimue** is the handheld — a native Android client
that goes where you go. They run one portable brain (`leoBrain.ts`) with different
tool belts bolted on. The dream is a mesh: a satellite, a lander, and a phone, all
speaking the same language, all contributing back.

This weekend the dream had a 34-second spinner in it. Here's how we got it out.

---

## Act I — The outage that wasn't where it said it was

It started, as these things do, with a toast: **"Something went wrong."** Saving a
page in the admin would hang for 34 to 45 seconds, then 500. The server logs were
emphatic and misleading — a `Failed query` against `payload_locked_documents`, the
table Payload uses to lock a document while you edit it. The obvious read was
*schema drift*: a missing column on one of our two databases.

So we checked. We built a self-healing endpoint that runs `CREATE TABLE IF NOT
EXISTS` and `ADD COLUMN IF NOT EXISTS` against the live database and reports what
was actually missing. The answer came back: **nothing.** Every table, every column,
present and correct. We even replayed the exact failing lock query against the
production database by hand. It ran in 84 milliseconds and returned a row.

That's the first lesson of distributed debugging: **the error message is a witness,
not the culprit.** Drizzle, our ORM, wraps the real failure in a generic
`Failed query` string. The query wasn't broken. Something underneath it was.

The "something" looked, for a while, like **connection exhaustion**. The Angel OS
deploys the same repository to half a dozen Vercel projects, and they all point at
one IONOS PostgreSQL server capped at 100 connections. Each warm serverless
instance holds a few connections; enough warm instances and you peg the cap, and
new requests can't get in. That theory had teeth — it had caused a real outage
days earlier. So over the weekend we stood up a proper fix: a **pgBouncer
connection pooler**, installed *on the database box itself.*

That installation deserves its own war story. The server was RAM-starved — under a
gigabyte free. Native Windows poolers were off the table. So pgBouncer went into
**WSL1 running an Alpine Linux rootfs** — a 3-megabyte userland imported with
LxRunOffline — fronted as a Windows service via NSSM, terminating **TLS 1.3** at
port 6432 with a self-signed certificate so the only unencrypted hop is the
loopback to Postgres. SCRAM auth passthrough doesn't work through a pooler (you
can't replay a stored verifier), so we dropped `auth_query` and used a static
userlist. Transaction-mode pooling, `max_client_conn=2000`,
`max_db_connections=35` so two databases share the 100-cap safely. It is, frankly,
a beautiful little contraption.

And it **still didn't fix the save.**

Here is the moment the whole investigation turned. We pulled `SHOW POOLS` from the
live pooler *during* a failing save. If pgBouncer were the bottleneck, we'd see
clients queued — `cl_waiting` climbing, `maxwait` ticking toward 30 seconds.
Instead: **`cl_waiting = 0`. `maxwait = 0`.** The pooler was handing out connections
instantly and the application was *still* timing out at exactly 30 seconds.

That single data point cracked the case by elimination. If the pooler never makes
you wait, but you wait anyway and die at your own 30-second `connectionTimeoutMillis`,
then the starvation is happening inside **your own application's connection pool.**
And ours was configured `max: 2` per serverless instance — a deliberate, sensible
mitigation from the *pre-pooler* era, when every app connection was a real backend
connection against that 100-cap.

But Payload wraps a save in a transaction holding one connection. And under our own
"pass `req`" rule, any hook or access-check that forgets to pass the request
context opens a *second* connection. The document-lock check wants a third. With a
pool of two, the third query waits for a slot that will never free — because the
slots are held by the very save that's waiting on them. A self-inflicted deadlock,
invisible to the database, invisible to the pooler, costing exactly one
`connectionTimeoutMillis` every time.

The fix was one number: **`max: 2` → `max: 10`.** Safe now precisely *because* the
pooler exists — pgBouncer caps the real backend regardless of how many client
connections the apps open. We deployed it. The error changed — from a connection
failure to a different, narrower bug entirely — and a moment later, a heavy
multi-image message (a Walmart receipt and a gas-pump photo, itemized and totaled
by the AI in a single message) saved cleanly. The fire was out.

**The lesson, for the LinkedIn crowd:** when your pooler says it isn't queuing but
your app still times out at its own pool timeout, stop tuning the pooler. The
starvation is upstream, in the client. A pool sized for the wrong era is a pool
that strangles itself.

---

## Act II — The chat that swallowed its own replies

With saves alive, we turned to a regression that had been quietly maddening: LEO,
our assistant, would *stream a reply into the chat* — you'd watch it type — and
then, on the next refresh, the message would be **gone.**

The trail ran through three separate bugs, each a small lesson in transactional
discipline:

- **The deadlock.** Sending a message would hang forever. A moderation hook ran a
  nested `payload.update` *without* passing the request — opening a second
  transaction that deadlocked waiting on a row lock the first, uncommitted
  transaction was holding. The message was waiting for itself. Passing `req`
  unified the transaction and broke the knot.
- **The deep-link scatter.** Pasting a link like `/dashboard/spaces/6/17` bounced
  you to the root space. The chat provider was ignoring the URL entirely and
  restoring stale state from local storage, then auto-jumping to the LEO DM and
  rewriting the address bar before the real channel could resolve. We centralized
  the route parsing into one pure function, gated the URL-sync until the channel
  was resolved, and let the link win.
- **The vanishing reply.** The streaming endpoint created LEO's message *without an
  explicit tenant*, leaning on a hook to fill it in. When that hook intermittently
  failed, the multi-tenant validator rejected the write — and the stream swallowed
  the error silently. You saw the text from the stream; the database never got it;
  the next poll refetched and erased your view. The fix: pass the tenant
  explicitly, every time, at every persist site.

Three bugs, one theme: **in a transactional, multi-tenant system, every nested
write has to join the conversation it was born in.** Pass the context. Always.

---

## Act III — Teaching the Library to travel

The Angel OS Library — our Works: books, essays, the things people publish — is
meant to be *federated*. A work is canonical at the endeavor that published it, and
other nodes subscribe to canonical-pointed copies. But `answer53`, a work
canonical to Clearwater Cruisin', was throwing **"Document not found"** on the
kendev node. A prior refactor had moved Works from disk files into the database and
deleted the files — so a node that never had the content had nothing to fall back
to.

The tempting fix was a render-time fetch: when a work is missing, grab it from the
peer that hosts it. We ruled that out fast. Our cross-node fetches get caught by a
WAF and suffer cold-boot latency — and we'd already learned, building Discovery,
that a render-time peer fetch is fragile. So instead we built **out-of-band
replication**: a `works-ops/pull` endpoint that fetches the assembled work from its
home node and upserts a *local subscriber copy*, content-checksum preserved. The
reader stays strictly local; the network work happens in a job that can retry.
Three works now live on kendev that never did before, rendering instantly, their
SEO authority still pointing home.

**Lesson:** don't put the network on the user's hot path. Replicate out of band,
read locally. The fast path should never depend on a stranger's uptime.

---

## Act IV — A phone, a lander, and the first light

Two embodiments advanced this weekend.

**Nimue**, the Android client, got dressed for the **Google Play Store**: generated
icons, a signed bundle, a privacy policy and a real "delete account" flow wired for
federated data, and — crucially — error bubbling. Nimue had been *swallowing*
upload failures; now they bridge to Core's logging endpoint and surface on the
dashboard and our Gotify alerts. A client that hides its own errors is a client you
debug blind.

And **Merlin** — the home node — finally **locked onto an endeavor.** We built the
`MerlinControl` block (its database table had never been pushed to production, so
the block was invisible in the admin until we fixed that), taught it to **infer its
endeavor from the page it lives on** instead of demanding a hand-typed slug, and
then fired the registration: Merlin posted its catalog up to Core's
`/api/node-ops/register`, and a node named **`Iam0`** — a literal laptop on a desk —
appeared, online and green, on the Clearwater Cruisin' endeavor page. Capabilities:
media, ingest, cameras, compute.

That's the whole thesis of the system in one green dot: a lander, reporting
telemetry up to its satellite. The first of many — the plan is to install it on
every machine in the house, each one a remote-controllable, resource-sharing node
contributing back to the network.

---

## Act V — The gate, and what's still ahead

We also shipped **page-level membership gating**: pages now declare an access level
(public, authenticated, members, members-in-good-standing), and ineligible visitors
get a clean "members only" prompt instead of a 404 — and gated pages quietly
disappear from the navigation. The Merlin control panel itself now lives behind
exactly that gate.

Not everything closed. A residual Payload framework bug only appears in the
production build when re-publishing one particular page — reproducible nowhere in
development, which makes a careful framework version bump the right, deliberate next
step rather than a midnight patch. The reverse tunnel that would let you reach a
home node's media library *over the internet* (rather than its useless LAN address)
is the next real build. The Bible needs a chapter-by-chapter navigation layer
before the mobile reader can carry all 1,189 of its pages. Honest engineering
leaves a clean list of what's still open.

---

## The shape of the thing

Strip away the war stories and a pattern remains, the one we keep returning to:
**the bug is almost never where the error points.** A schema error was a connection
problem. A connection problem was a pool-sizing problem. A "kendev node health"
problem turned out to be shared code running on both nodes. The discipline that
actually ships software isn't cleverness — it's refusing to fix the symptom until
you've found the thing underneath it, and being willing to throw out your favorite
theory the moment the data disagrees. `cl_waiting = 0` was worth more than six
hours of plausible hypotheses.

There's a philosophy underneath The Angel OS we call Answer 53 — *love in the
architecture*, the idea that a system built with care leaves the people who use it
and build it whole. A weekend like this is what that looks like in practice: not a
heroic all-nighter, but a patient, honest hunt, ending with a laptop's green dot on
a ministry's web page and a chat that finally remembers what it said.

Three bodies. One brain. One more weekend closer to the mesh.

*— Field report, 2026-06-22*
