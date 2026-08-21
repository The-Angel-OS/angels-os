import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * An applied migration is frozen history.
 *
 * Payload records a migration by NAME, so editing a file that has already run
 * on the live node changes nothing there — the new SQL never executes. On
 * 260821 a column was appended to an already-applied migration; the deploy
 * shipped a config selecting a column that did not exist, every tenant lookup
 * failed, and every page on every portal went down.
 *
 * This locks each migration's contents by hash. A changed hash fails; a new
 * file just needs its hash recorded (run with UPDATE_MIGRATION_HASHES=1).
 * ponytail: a hash manifest, not a git-history walk — same catch, no git.
 */
const DIR = join(process.cwd(), 'src', 'migrations')
const MANIFEST = join(__dirname, 'migration-hashes.json')

const hashOf = (file: string) =>
  createHash('sha256').update(readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n')).digest('hex')

describe('migrations are frozen once written', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts').sort()
  const current = Object.fromEntries(files.map((f) => [f, hashOf(f)]))

  if (process.env.UPDATE_MIGRATION_HASHES === '1') {
    writeFileSync(MANIFEST, JSON.stringify(current, null, 2) + '\n')
  }

  const recorded: Record<string, string> = existsSync(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
    : {}

  it('has a recorded hash for every migration', () => {
    const missing = files.filter((f) => !recorded[f])
    expect(
      missing,
      `New migration(s) not in the manifest. Record them: UPDATE_MIGRATION_HASHES=1 pnpm vitest run tests/unit/migrations`,
    ).toEqual([])
  })

  it('never changes a migration that already exists', () => {
    const changed = files.filter((f) => recorded[f] && recorded[f] !== current[f])
    expect(
      changed,
      `Edited an existing migration. Payload records migrations by NAME, so an edit ` +
        `NEVER re-runs on a node that already applied it — the schema silently diverges ` +
        `from the config and every query touching the new column fails. Add a NEW ` +
        `migration file instead.`,
    ).toEqual([])
  })
})
