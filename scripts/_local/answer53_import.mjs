#!/usr/bin/env node
/**
 * answer53_import.mjs — bring "53.3 — The New Answer" into the Angel OS Library.
 *
 * Reads the canonical chapter source from the standalone Answer 53 project
 * (C:\Dev\answer53\lib\chapters.ts) and emits one markdown doc per chapter into
 * docs/vision/answer53/, plus prints the SoulManifest `docs` array so the
 * manifest can be authored faithfully.
 *
 * One-shot, idempotent: re-running overwrites the chapter .md files. The
 * hand-written index doc (00-about.md) and manifest.ts are NOT touched.
 *
 *   node scripts/_local/answer53_import.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SRC = 'C:\\Dev\\answer53\\lib\\chapters.ts'
const OUT = path.join(ROOT, 'docs', 'vision', 'answer53')

const raw = fs.readFileSync(SRC, 'utf-8')

// Each chapter: { slug: '…', title: '…', number: N, content: `…` },
const re =
  /slug:\s*'([^']+)',\s*title:\s*'([^']*)',\s*number:\s*(\d+),\s*content:\s*`([\s\S]*?)`,\s*\}/g

// The source carries docx→md escape artifacts (e.g. `\+`, `\)`, `\~`, `\<`),
// doubled to `\\+` etc. by reading the .ts file as text. Collapse any run of
// backslashes that precedes ASCII punctuation down to the punctuation itself,
// so the Library text is clean canonical prose.
const normalize = (s) => s.replace(/\\+([!-/:-@[-`{-~])/g, '$1')

fs.mkdirSync(OUT, { recursive: true })

const docs = []
let m
while ((m = re.exec(raw)) !== null) {
  const [, slug, title, numberStr, content] = m
  const number = Number(numberStr)
  const nn = String(number).padStart(2, '0')
  const filename = `${nn}-${slug}.md`
  // The chapter content has no top-level H1 (the app renders title separately),
  // so we add one — the SoulViewer styles H1 as the document header.
  const body = `# ${title}\n\n${normalize(content.trim())}\n`
  fs.writeFileSync(path.join(OUT, filename), body, 'utf-8')
  docs.push({ id: slug, filename, title, number })
  console.log(`  wrote ${filename}  (${title})`)
}

console.log(`\n${docs.length} chapters → ${path.relative(ROOT, OUT)}\n`)
console.log('// manifest docs (chapters) — paste into manifest.ts:')
console.log(
  JSON.stringify(
    docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      title: `Ch. ${d.number} — ${d.title}`,
      tier: 'chapter',
    })),
    null,
    2,
  ),
)
