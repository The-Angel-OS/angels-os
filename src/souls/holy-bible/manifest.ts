// src/souls/holy-bible/manifest.ts
// The Holy Bible — a canonical BOOK Work owned by The Angel OS endeavor.
//
// Storage = Ronald's WDEG book format (one architecture for all editions):
//   public/library/holy-bible/manifest.json   — chapter pages (the skeleton)
//   public/library/holy-bible/text/web.json    — World English Bible edition
//   public/library/holy-bible/text/kjv.json    — King James Version edition
// A translation is just another language file (text/<code>.json), verse-structured,
// so the reader's existing language switcher toggles WEB↔KJV for free — and a
// Spanish/other edition later drops into the same slot. Built by
// scripts/ingest-bible.mjs (public-domain text from bible-api.com).
//
// Foundation of the "Illustrated Primer" pattern: this same Work feeds the reader,
// read-aloud (TTS), the [[ref]] reference resolver, and LEO scripture lookup.

import type { SoulManifest } from '../rainmaker/manifest'

export const holyBibleManifest: SoulManifest = {
  id: 'holy-bible',
  // Canonical at The Angel OS flagship — syndicates to every community
  // (publish-once-canonical). Daily-reading feature suggested by Ron.
  canonical: {
    origin: 'https://spacesangels.com',
    endeavor: 'platform',
    creditedTo: 'kenneth.courtney@gmail.com',
  },
  // Owned by The Angel OS, carried by Clearwater Cruisin (Ron's daily reader).
  subscribers: ['clearwater-cruisin'],
  published: true, // complete, WEB + KJV
  title: 'THE HOLY BIBLE',
  subtitle: 'World English Bible · King James Version — public domain',
  description:
    'The Holy Bible as a canonical Work of The Angel OS — verse-addressed and offered in two public-domain translations (the modern World English Bible and the classic King James Version), each stored as its own edition file so switching translations is the same gesture as switching languages. The foundation of the daily reader and the scripture reference spine. Daily three-chapter reading feature suggested by Ron — one of many gifts of the platform, freely given.',
  status: 'Canon',
  statusColor: 'var(--lcars-amber)',
  tags: ['scripture', 'bible', 'WEB', 'KJV', 'reader', 'public-domain'],
  // Paged book → reader loads public/library/holy-bible/ and renders <BookReader>.
  bookSlug: 'holy-bible',
  defaultDoc: 'about',
  docs: [
    {
      id: 'about',
      filename: 'about.md',
      title: 'About this edition',
      date: '',
      description: 'About the Holy Bible Work and its public-domain editions.',
      tier: 'index',
    },
  ],
}
