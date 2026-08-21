import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Pages and Posts are versioned, so every column added to `pages` or `posts`
 * needs `version_<col>` on `_pages_v` / `_posts_v` too — Payload selects AND
 * inserts it there on every draft save.
 *
 * Missing it is not a missing feature, it is a blank admin: the create view
 * autosaves on open, the insert dies, and the page renders nothing at all —
 * no form, no nav, no error. That was 260821 13:32–16:37 for `hero_scrim`.
 *
 * ponytail: a text scan of the migration SQL, not a schema diff against a live
 * database. It catches the whole observed failure class for ~20 lines. If a
 * migration ever builds its SQL somewhere this regex can't see, upgrade to
 * diffing `payload migrate:create` output instead.
 */
const DIR = join(process.cwd(), 'src/migrations')
const VERSIONED = ['pages', 'posts'] as const

const sqlOfAllMigrations = () =>
  readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => readFileSync(join(DIR, f), 'utf8'))
    .join('\n')

describe('versioned collections keep their _v tables in step', () => {
  const all = sqlOfAllMigrations()

  for (const table of VERSIONED) {
    it(`every column added to "${table}" also lands on "_${table}_v"`, () => {
      const added = [
        ...all.matchAll(
          new RegExp(`ALTER TABLE "${table}" ADD COLUMN(?: IF NOT EXISTS)? "([a-z0-9_]+)"`, 'g'),
        ),
      ].map((m) => m[1]!)

      const missing = added.filter((col) => !all.includes(`version_${col}`))
      expect(missing, `add version_<col> on _${table}_v for: ${missing.join(', ')}`).toEqual([])
    })
  }
})
