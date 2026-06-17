# Spaces, the Library & Works

Two surfaces carry most of the day-to-day life of an Angel OS node: **Spaces** (how people communicate) and the **Library** (how knowledge and stories are published).

## Spaces & the AI Bus

A **Space** is a place — like a Discord server or a Slack workspace — and inside it are **channels**. Every endeavor gets a default set: a main community space, direct messages, and an **AI Bus** where Leo and the system speak.

The AI Bus is the nervous system. It's where Leo posts, where errors surface, where inbound messages from connected services (Gotify, WhatsApp, voice calls) arrive and get routed. Everything is *messages* — which is what makes it cacheable, searchable, and portable.

Voice and video are built in: any channel can host a real-time room (powered by LiveKit) with microphone, camera, and screen sharing.

## The Library — publish freely, read anywhere

The **Library** (`/works`) is a publishing platform. A **Work** is a book, a case file, a manifesto, or a living document — read freely, no account required. Real works already live here: an illustrated 26-page book in 17 languages, multi-chapter manifestos, case files.

Three ideas make the Library powerful:

- **Publish once, stay canonical.** A Work is canonical at its home endeavor. When other endeavors carry a copy, those copies point back home (`rel=canonical`), so the author keeps the authority and the search ranking. You publish once; it propagates.
- **Content-addressed & offline-ready.** Every Work carries a **checksum** — a fingerprint of its content. A client can ask "has anything changed?" cheaply, and only re-download what actually changed. That's what lets a Work be **downloaded once and read offline** — the Audible-style library experience.
- **Distributable.** Because a Work is portable data (JSON + media, addressed by checksum), it can travel: from one node to another across the federation, and — crucially — *bundled into the Nimue client itself*, so a book can ship in your pocket and be read with no signal at all.

## Why this matters

The Library isn't a feature; it's the point of a lot of the architecture. A grower's care guides, a brother's book, a community's founding documents, even *this handbook* — all become first-class, shareable, offline-readable Works. Knowledge on Angel OS is meant to be free to read, easy to find, and impossible to lose.
