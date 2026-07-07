/**
 * changelog — turn the repo's git history into a structured, on-site changelog.
 *
 * The deployed site has no .git at runtime (Vercel builds from a shallow clone),
 * so we read history from the GitHub REST API for the public repo instead. That
 * keeps the changelog LIVE — it reflects `main` as it moves, with no build step
 * or committed data file to regenerate.
 *
 * Conventional-commit messages (`type(scope): subject`) are parsed into typed
 * entries and grouped by day. Non-conforming messages fall back to type 'other'
 * so nothing is dropped. Merge commits and bot/tooling noise are filtered.
 *
 * Auth: unauthenticated GitHub API is 60 req/hr per IP — plenty behind the 1h
 * cache. Set GITHUB_TOKEN (or GH_TOKEN) to lift the ceiling on busy nodes.
 */

const REPO = process.env.CHANGELOG_REPO || 'The-Angel-OS/angels-os'
const BRANCH = process.env.CHANGELOG_BRANCH || 'main'

export interface ChangelogEntry {
  sha: string
  shortSha: string
  url: string
  /** Conventional-commit type, lowercased (feat, fix, docs…) or 'other'. */
  type: string
  scope: string | null
  /** True when the message flagged a breaking change (`type!:` or footer). */
  breaking: boolean
  subject: string
  date: string
  author: string
}

export interface ChangelogDay {
  /** YYYY-MM-DD (UTC). */
  date: string
  entries: ChangelogEntry[]
}

export interface Changelog {
  repo: string
  branch: string
  total: number
  /** Count per type across all fetched entries. */
  typeCounts: Record<string, number>
  days: ChangelogDay[]
  /** Set when the fetch failed or was rate-limited — the UI shows a soft notice. */
  error?: string
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/

/** Messages we never surface as changelog entries. */
function isNoise(firstLine: string): boolean {
  if (firstLine.startsWith('Merge ')) return true
  if (/^chore\(deps\)/i.test(firstLine)) return true
  if (/^chore\(release\)/i.test(firstLine)) return true
  return false
}

interface RawCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: { name?: string; date?: string } | null
    committer: { date?: string } | null
  }
  author: { login?: string } | null
}

function parseEntry(raw: RawCommit): ChangelogEntry | null {
  const message = raw.commit?.message || ''
  const firstLine = message.split('\n')[0].trim()
  if (!firstLine || isNoise(firstLine)) return null

  const m = CONVENTIONAL.exec(firstLine)
  const breakingFooter = /\bBREAKING[ -]CHANGE\b/.test(message)

  let type = 'other'
  let scope: string | null = null
  let subject = firstLine
  let breaking = breakingFooter

  if (m) {
    type = m[1].toLowerCase()
    scope = m[2] || null
    breaking = breaking || Boolean(m[3])
    subject = m[4].trim()
  }

  const date = raw.commit?.author?.date || raw.commit?.committer?.date || ''
  return {
    sha: raw.sha,
    shortSha: raw.sha.slice(0, 7),
    url: raw.html_url,
    type,
    scope,
    breaking,
    subject,
    date,
    author: raw.commit?.author?.name || raw.author?.login || 'unknown',
  }
}

/**
 * Fetch + parse recent history into a grouped changelog. `maxCommits` caps how
 * far back we page (100/req); the default keeps the payload snappy while still
 * covering weeks of a busy repo. Cached for 1h via the fetch layer.
 */
export async function getChangelog(maxCommits = 250): Promise<Changelog> {
  const perPage = 100
  const pages = Math.max(1, Math.ceil(maxCommits / perPage))
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const raw: RawCommit[] = []
  let error: string | undefined

  try {
    for (let page = 1; page <= pages; page++) {
      const url = `https://api.github.com/repos/${REPO}/commits?sha=${encodeURIComponent(
        BRANCH,
      )}&per_page=${perPage}&page=${page}`
      const res = await fetch(url, {
        headers,
        // Revalidate hourly — the changelog needn't be to-the-second, and this
        // keeps us far under the API rate limit.
        next: { revalidate: 3600, tags: ['changelog'] },
      })
      if (!res.ok) {
        // 403 = rate limited (or private). Surface a soft error, keep what we have.
        error =
          res.status === 403
            ? 'GitHub API rate limit reached — showing cached history. Set GITHUB_TOKEN to raise the limit.'
            : `GitHub API returned ${res.status}.`
        break
      }
      const batch = (await res.json()) as RawCommit[]
      if (!Array.isArray(batch) || batch.length === 0) break
      raw.push(...batch)
      if (batch.length < perPage) break
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load history.'
  }

  const entries = raw.map(parseEntry).filter((e): e is ChangelogEntry => e !== null)

  const typeCounts: Record<string, number> = {}
  for (const e of entries) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1

  // Group by UTC day, preserving the newest-first order the API returns.
  const byDay = new Map<string, ChangelogEntry[]>()
  for (const e of entries) {
    const day = (e.date || '').slice(0, 10) || 'undated'
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(e)
  }
  const days: ChangelogDay[] = Array.from(byDay.entries()).map(([date, es]) => ({ date, entries: es }))

  return { repo: REPO, branch: BRANCH, total: entries.length, typeCounts, days, error }
}
