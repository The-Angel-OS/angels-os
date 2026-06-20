// src/souls/holy-bible/manifest.ts
// The Holy Bible — a canonical Work owned by The Angel OS endeavor.
//
// Content of record: verse-addressed JSON (WEB + KJV per verse) in ./data/<CODE>.json,
// produced by scripts/ingest-bible.mjs. Each CHAPTER is a doc (= a reader page),
// so the existing document reader paginates chapter-by-chapter. Books group spans
// of chapter-docs. The docs list is generated (./index.generated.json) so the full
// 66-book ingest just re-runs the script and re-indexes — no manual manifest edits.
//
// Foundation of the "Illustrated Primer" pattern: this same Work feeds the reader,
// read-aloud (TTS), the [[ref]] reference resolver, and LEO scripture lookup.

import type { SoulManifest, SoulDoc } from '../rainmaker/manifest'
import index from './index.generated.json'

type IndexDoc = { id: string; filename: string; title: string; tier: string; book: string; bookName: string; chapter: number }
const generated = index as { generatedFrom: string[]; docs: IndexDoc[] }

const docs: SoulDoc[] = generated.docs.map((d) => ({
  id: d.id,
  filename: d.filename,
  title: d.title,
  date: '',
  description: `${d.bookName} ${d.chapter}`,
  tier: 'chapter',
}))

export const holyBibleManifest: SoulManifest = {
  id: 'holy-bible',
  // Canonical at The Angel OS flagship — syndicates to every community
  // (publish-once-canonical). Daily-reading feature suggested by Ron.
  canonical: {
    origin: 'https://spacesangels.com',
    endeavor: 'platform',
    creditedTo: 'kenneth.courtney@gmail.com',
  },
  title: 'THE HOLY BIBLE',
  subtitle: 'World English Bible · King James Version — public domain',
  description:
    'The Holy Bible as a canonical Work of The Angel OS — verse-addressed and offered in two public-domain translations (the modern World English Bible and the classic King James Version). The foundation of the daily reader and the scripture reference spine. Daily three-chapter reading feature suggested by Ron — one of many gifts of the platform, freely given.',
  status: 'Canon',
  statusColor: 'var(--lcars-amber)',
  tags: ['scripture', 'bible', 'WEB', 'KJV', 'reader', 'public-domain'],
  defaultDoc: docs[0]?.id ?? 'phm-1',
  docs,
}
