# Card Stage — the breathing Delta as a prioritized card surface

> Spec (260712). The Nimue center — the breathing Starfleet Delta — is a
> **subscriber to a set of feeds** that renders their output as **cards** in a
> single focal slot. Idle = the Delta breathes; something to surface = a card
> materializes in the center; act or dismiss = it exhales back to the Delta.
> Same component, cropped to top-1, IS the Nimue Wear watch face.
>
> This is the UI expression of the factory principle: **one surface, many card
> producers.** Verse chips, LEO suggestions, image updates, the guardian-angel
> ceremony, DMs, remote directives — all become card *types*, not new screens.
> "That's the Young Lady's Illustrated Primer coming to life."

---

## 1. The Card

```ts
type CardKind =
  | 'suggestion'   // proactive Leo / the cortex groundskeeper
  | 'link'         // verse (open_passage), product, page, booking — a [[ref]]
  | 'image'        // most-recent image from a subscribed source (channel/gen)
  | 'ceremony'     // guardian-angel birth, and future rites
  | 'update'       // screen-update confirmation ("your page — here's the shot")
  | 'dm'           // an incoming DM off the AI Bus
  | 'directive'    // remote "display X locally" push (Merlin/telemetry/LEO)

interface CardAction {
  label: string
  kind: 'primary' | 'secondary' | 'dismiss'
  run: () => void | Promise<void>   // navigate, open detail, confirm, etc.
}

interface Card {
  id: string
  kind: CardKind
  priority: number          // higher wins; see §4
  source: string            // feed id that produced it (for dedupe + subscribe mgmt)
  title?: string
  body?: string             // short — the card is a glance, not a screen
  imageUrl?: string         // for kind:'image' / rich cards
  actions: CardAction[]     // 0–3; the first is the tap-to-open default
  detailHref?: string       // "tap for detail" target (a full screen)
  createdAt: number
  ttlMs?: number            // auto-expire (e.g. a suggestion that goes stale)
}
```

A card is a **glance with a tap**. Anything needing a full screen sets `detailHref`
and the stage routes there on the primary action.

## 2. Feeds (subscriptions)

The stage does not know about verses or images — it knows about **feeds**. A feed
is anything that can push cards. The user (or the system) subscribes the center to
a set of feeds; each feed's output flows into the queue.

```ts
interface CardFeed {
  id: string
  subscribe(emit: (card: Card) => void): () => void  // returns unsubscribe
}
```

First feeds to ship:
- **`suggestions`** — the cortex/event-loop (see [[project_event_loop_nimue]],
  [[project_proactive_agent_roadmap]]). The Delta is finally the proactive agent's
  visible face.
- **`links`** — parses the active message/reader stream for refs (verse
  `open_passage`, product, page, booking) → link cards. This subsumes the current
  "verse chip" — it's no longer a bespoke reader widget, it's a card feed.
- **`channel-photos`** — subscribe to a channel → its **most-recent image**
  surfaces as an image card. Generalizes to generated images and "anything the
  user is subscribing to."
- **`dm`** — the AI Bus DM channels (see §6).
- **`directives`** — a remote push ("display X locally"): the center is a
  directive-addressable display surface.

Feeds are just SSE/poll subscriptions under the hood; the stage is transport-blind.

## 3. Interaction states (the state machine)

```
        ┌────────────── idle (breathe) ──────────────┐
        │   queue empty → the Delta breathes slowly    │
        └──────────────────────────────────────────────┘
                         │ tap (or wake word)
                         ▼
                  active-listening
        the Delta breathes BACK — responsive, faster pulse
                         │ response resolves (verse/answer/etc.)
                         ▼
                    card shown
      the card materializes center, replacing the Delta;
      user controls (actions) appear; tap card → detailHref
                         │ act / dismiss / swipe-away
                         ▼
        queue has more? → next card   |   empty? → idle (breathe)
```

The **breath is the feedback loop**: idle-slow → listening-back → resolved. No
spinners; the Delta's pulse IS the state.

## 4. The queue — swap-in, queue-the-old, swipe

- New card of **higher priority** than the one shown → **swap in**; the current
  card is **pushed onto the queue** (not dropped).
- Lower/equal priority → appended to the queue.
- The user **swipes** between queued cards (horizontal). Swipe-away on a card
  dismisses it (respecting its actions — a `dismiss` action runs if present).
- A small **stack affordance** (dots / count) shows depth when >1 queued.
- `ttlMs` expiry silently removes stale cards from the queue.

Priority bands (higher = more urgent): `directive`(90) > `dm`(70) >
`ceremony`(60) > `update`(50) > `link`(40) > `image`(30) > `suggestion`(20).
Within a band, newest first. (Numbers tunable; the point is the ordering.)

## 5. Wear parity (free)

The Wear watch face subscribes to the **same card stream** and renders **top-1**
only — no swipe, no stack, just the current highest-priority card on the breathing
Delta, with its primary action. Build the stream once; the watch is the phone's
center cropped to a single card. "The breathing Delta that loads the suggested
chip" is literally the same component at two sizes.

## 6. Paired backend — the AI Bus is the one backbone

The DM and image feeds depend on the channel-model cleanup
([[project_message_channel_rekey]], `docs/HANDOFF_channel_model_260711.md`):

- **Remove DM Spaces everywhere.** DMs are `systemType`-marked channels on the
  per-portal **AI Bus** (honest name: System Bus). Resolved by marker, not slug;
  hidden from the picker. The `dm` feed subscribes to the bus.
- **Delete a channel → its messages re-home to the AI Bus** (the catch-all
  orphan home), never lost. `move_channel(channel → AI Bus)` is the one verb.
- The AI Bus is thus both the **message backbone** and a **card feed source**.

## 7. Build order

1. **Card stage** — focal slot, breathe↔card transition, swipeable prioritized
   queue, the state machine. The keystone Nimue component.
2. **Feeds `suggestions` + `links`** — two producers prove the stage; the verse
   chip returns *as a link card* (closes the regression).
3. **`ceremony` card** — the guardian-angel birth plays in the stage; revise auth
   to **check-not-provision** so login is instant and the birth is the ceremony.
4. **Channel-model pass** (backend) — remove DM Spaces, DMs→AI Bus, delete→rehome
   — lights up the `dm` and `channel-photos` feeds.
5. **Wear** — subscribe the watch face to the stream, render top-1.
6. **Nav/home-button cleanup** — after the stage lands (it reshapes home anyway).

Rides along in the first Nimue rebuild: **hide the language chooser**; the verse
fix is subsumed by the `links` feed.

## 8. Decisions (Ken, 260712)

- **Voice / activation — tap-to-speak v1, keep the auto-mode.** No wake word yet.
  The existing **Nimue auto-mode** stays: tap activates → a **state change marks
  activation/deactivation** → the dictation loop (native STT beep → sense
  end-of-speech → auto-submit → response) runs; **any tap deactivates auto-submit
  on the next response.** This loop is already seamless (3+ iterations carried
  hands-free). Later: **override Google Assistant** (and integrate with it if/when
  the partner program reopens) — "integrate with everything eventually" is the
  whole point of The Angel OS.
- **Persistence — rebuild from feeds on launch.** Cards are ephemeral; the queue
  reconstructs from live feeds. (No serialized queue.)
- **Where cards land — the Nimue channel.** Any incoming card also flows to the
  user's **Nimue channel** (their per-device channel on the AI Bus), so the center
  and the message history stay one truth.

## 9. Images are first-class — and eventually the whole surface

The watch face is **image-forward**: an image card *is* the face. This matters now
(generated images, latest channel photo) and grows:

- **Generated-image cards** — surface the existing **generate-image pipeline** in a
  card. Today: show the finished image. **Tomorrow, as nano-banana / faster image
  models close the latency gap, cards render in REAL TIME** — the card *is* a live
  image the model is drawing. The stage should treat an image card's payload as
  potentially **streaming**, not just a final URL.
- **Full-screen destiny** — a card can expand to full-screen; once real-time gen is
  fast enough, the breathing Delta and a full-screen live image are the *same
  surface* at two scales (phone center → full-screen → watch face). Design the
  image card so full-screen is a scale, not a different component.

## 10. Adjacent (tracked elsewhere, but they touch the stage)

- **Channels** (channel-model pass): delete a channel → it **rehomes wholesale to
  the AI Bus**; **move channels** freely; a new user's Community/portal must come
  with **default spaces + a `main`/`general` channel** (today a fresh user lands in
  Community with none). Channels double as **personal trackers** — mileage log,
  inventory, shopping list — that segregate now and roll up later; each is a
  potential card feed (📷/log subscriptions).
- **Nav**: a bigger, always-present **Home/back** affordance on every screen (the
  current top bar works but is too small). The stage reshapes home; do the nav
  cleanup in the same pass.
</content>
