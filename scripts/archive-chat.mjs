#!/usr/bin/env node
/**
 * archive-chat — a Claude Code session transcript → readable Markdown.
 *
 * The conversations are ALREADY archived: Claude Code writes every session to
 * `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` as it happens. Nothing
 * needs to be copied out of the chat window; it only needs converting. This is
 * that converter — an hour of copy-and-paste becomes one command.
 *
 * Usage:
 *   node scripts/archive-chat.mjs                 # newest session for this repo
 *   node scripts/archive-chat.mjs --list          # what's there, newest first
 *   node scripts/archive-chat.mjs <sessionIdOrPrefix>
 *   node scripts/archive-chat.mjs --all           # every session, one file each
 *   node scripts/archive-chat.mjs --tools full    # full tool I/O (huge)
 *
 * Options:
 *   --out <dir>      output directory (default: ./chat-archive)
 *   --tools <mode>   none | summary (default) | full
 *   --thinking       include reasoning blocks (default: off)
 *
 * ponytail: prompts and replies are the archive; tool calls collapse to one
 * line each. A raw session is up to 8 MB and almost all of it is tool output
 * nobody re-reads. `--tools full` is there for the day that's wrong.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : i >= 0 ? true : fallback
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && typeof flag(args[i - 1].slice(2)) === 'string'))

const TOOLS = flag('tools', 'summary')
const SHOW_THINKING = Boolean(flag('thinking', false))
const OUT_DIR = path.resolve(typeof flag('out') === 'string' ? flag('out') : 'chat-archive')

/** Claude Code encodes the project path by replacing every non-alphanumeric with `-`. */
function projectDir(cwd = process.cwd()) {
  const encoded = cwd.replace(/[^a-zA-Z0-9]/g, '-')
  return path.join(os.homedir(), '.claude', 'projects', encoded)
}

function sessions(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const full = path.join(dir, f)
      const st = fs.statSync(full)
      return { id: f.replace(/\.jsonl$/, ''), file: full, mtime: st.mtime, size: st.size }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

const textOf = (block) => (typeof block === 'string' ? block : block?.text ?? '')

/**
 * A heading Google Docs can navigate by.
 *
 * Docs builds its outline pane from heading levels, so a `## Claude` on every
 * turn produces an outline reading "Ken / Claude / Ken / Claude" that navigates
 * nowhere. ONE heading per exchange, named after what was actually asked, turns
 * that outline into a contents page.
 */
function topicOf(text, n) {
  const stamp = /^\d{6}\s+\d{3,4}\s*-?\s*/ // "260826 1833 - "
  const furniture = /^[#>*`|-]/ // markdown decoration, not a sentence
  const line =
    text
      .split('\n')
      .map((l) => l.replace(stamp, '').trim())
      .find((l) => l && !furniture.test(l)) ?? ''
  const cleaned = line.replace(/^\d{6}\s*~?\d{0,4}\s*/, '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return `Exchange ${n}`
  const short = cleaned.length > 72 ? cleaned.slice(0, 69).replace(/\s+\S*$/, '') + '…' : cleaned
  return `${n}. ${short}`
}

/**
 * Push headings inside a message two levels down, so a `##` in a reply nests
 * UNDER its exchange heading instead of competing with it in the outline.
 */
const demoteHeadings = (md) =>
  md.replace(/^(#{1,6})(\s)/gm, (_m, hashes, sp) => '#'.repeat(Math.min(6, hashes.length + 2)) + sp)

/** One-line summary of a tool call — enough to follow the thread, not to drown in it. */
function summarizeTool(block) {
  const input = block.input ?? {}
  const one = (s) => String(s).replace(/\s+/g, ' ').slice(0, 160)
  const detail =
    input.command ??
    input.file_path ??
    input.pattern ??
    input.path ??
    input.query ??
    input.prompt ??
    ''
  return `\`${block.name}\`${detail ? ` — ${one(detail)}` : ''}`
}

function render(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
  const out = []
  let title = null
  let started = null
  let turns = 0

  for (const line of lines) {
    let e
    try {
      e = JSON.parse(line)
    } catch {
      continue // a partially-flushed final line is normal on a live session
    }

    if (e.type === 'custom-title' && e.customTitle) title = e.customTitle
    if (e.isSidechain) continue // subagent chatter is not the conversation
    if (e.type !== 'user' && e.type !== 'assistant') continue
    if (!started && e.timestamp) started = e.timestamp

    const content = e.message?.content
    const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : Array.isArray(content) ? content : []

    if (e.type === 'user') {
      // A "user" entry carrying tool_result is the harness replying to a tool
      // call, not a person typing.
      const spoken = blocks.filter((b) => b.type === 'text' || typeof b === 'string')
      if (!spoken.length) {
        if (TOOLS === 'full') {
          for (const b of blocks.filter((b) => b.type === 'tool_result')) {
            const body = Array.isArray(b.content) ? b.content.map(textOf).join('\n') : textOf(b.content)
            if (body.trim()) out.push('```\n' + body.slice(0, 20000) + '\n```\n')
          }
        }
        continue
      }
      const text = spoken.map(textOf).join('\n').trim()
      if (!text) continue
      turns++
      out.push(`\n## ${topicOf(text, turns)}\n`)
      out.push(`\n**Ken** · ${e.timestamp ? new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 16) : ''}\n\n`)
      out.push(demoteHeadings(text) + '\n')
      continue
    }

    for (const b of blocks) {
      if (b.type === 'thinking' && SHOW_THINKING) {
        out.push(`> *(reasoning)* ${textOf(b).replace(/\n/g, '\n> ').slice(0, 4000)}\n`)
      } else if (b.type === 'text') {
        const t = textOf(b).trim()
        if (t) out.push(`\n**Claude**\n\n${demoteHeadings(t)}\n`)
      } else if (b.type === 'tool_use' && TOOLS !== 'none') {
        out.push(`- ⚙ ${summarizeTool(b)}\n`)
      }
    }
  }

  const header = [
    `# ${title || path.basename(file, '.jsonl')}`,
    '',
    `*Session \`${path.basename(file, '.jsonl')}\` · ${started ? new Date(started).toISOString().slice(0, 10) : 'undated'} · ${turns} prompts · exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')}*`,
    '',
  ].join('\n')

  return { markdown: header + out.join(''), title, turns, started }
}

// ── main ─────────────────────────────────────────────────────────────────────
const dir = projectDir()
const all = sessions(dir)

if (!all.length) {
  console.error(`No sessions found in ${dir}\nRun this from the project directory whose chats you want.`)
  process.exit(1)
}

if (flag('list')) {
  console.log(`${all.length} sessions in ${dir}\n`)
  for (const s of all.slice(0, 40)) {
    console.log(
      `${s.id.slice(0, 8)}  ${s.mtime.toISOString().slice(0, 16).replace('T', ' ')}  ${String(Math.round(s.size / 1024)).padStart(6)} KB`,
    )
  }
  process.exit(0)
}

const wanted = flag('all')
  ? all
  : positional.length
    ? all.filter((s) => s.id.startsWith(positional[0]))
    : [all[0]]

if (!wanted.length) {
  console.error(`No session matching "${positional[0]}". Try --list.`)
  process.exit(1)
}

fs.mkdirSync(OUT_DIR, { recursive: true })
for (const s of wanted) {
  const { markdown, title, turns, started } = render(s.file)
  const stamp = (started ?? s.mtime.toISOString()).slice(0, 10).replace(/-/g, '')
  const slug = (title || s.id.slice(0, 8)).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  // Two sessions can share a date AND a title — the nightly sweeps do — and the
  // second silently ate the first. An archiver that loses files is worse than none.
  let outFile = path.join(OUT_DIR, `${stamp}-${slug}.md`)
  if (fs.existsSync(outFile)) outFile = path.join(OUT_DIR, `${stamp}-${slug}-${s.id.slice(0, 8)}.md`)
  fs.writeFileSync(outFile, markdown, 'utf8')
  console.log(`${outFile}  (${turns} prompts, ${Math.round(markdown.length / 1024)} KB)`)
}
