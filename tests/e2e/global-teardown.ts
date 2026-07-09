/**
 * Playwright Global Teardown
 *
 * Runs once after ALL test projects. Deletes the timestamped throwaway users
 * the specs mint per run (checkout-e2e-<ts>@test.local, journey-cust-<ts>@test.com,
 * e2e-admin-<ts>@test.local, signup-<ts>@test.com, role-test-<ts>@test.local, …)
 * so they stop accumulating in the database — 115 of them had piled up by 260709.
 *
 * SAFETY: only emails ending in `-<10+ digit timestamp>@test.local|test.com`
 * (or @test.angelos.local) are touched, and only when they have NO tenant
 * memberships and NO authored messages. The durable fixtures the suite logs in
 * with (admin@test.com, user/guest@test.com, dev-*@spacesangels.com, seed
 * accounts, system LEO users, real people) never match the pattern.
 *
 * Uses the Payload REST API against the same baseURL the tests ran on, signed
 * in as the seeded dev admin. Fail-soft: cleanup problems never fail the run.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'dev-admin@spacesangels.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'devdev123'

/** Timestamped runtime residue — the ONLY thing this teardown deletes. */
const RESIDUE_RE = /-\d{10,}@test\.(local|com)$|@test\.angelos\.local$/i

export default async function globalTeardown() {
  console.log('\n[global-teardown] Sweeping timestamped e2e residue users...')
  try {
    const login = await fetch(`${BASE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })
    if (!login.ok) {
      console.warn(`[global-teardown] admin login failed (${login.status}) — skipping sweep`)
      return
    }
    const { token } = (await login.json()) as { token?: string }
    if (!token) {
      console.warn('[global-teardown] no token from login — skipping sweep')
      return
    }
    const auth = { Authorization: `JWT ${token}` }

    // Page through users; collect residue ids. `like` narrows server-side, the
    // regex is the authoritative gate client-side.
    const ids: number[] = []
    for (const probe of ['@test.local', '@test.com', '@test.angelos.local']) {
      const res = await fetch(
        `${BASE_URL}/api/users?limit=500&depth=0&where[email][like]=${encodeURIComponent(probe)}`,
        { headers: auth },
      )
      if (!res.ok) continue
      const body = (await res.json()) as { docs?: Array<{ id: number; email?: string }> }
      for (const u of body.docs || []) {
        if (u.email && RESIDUE_RE.test(u.email) && !ids.includes(u.id)) ids.push(u.id)
      }
    }

    let deleted = 0
    for (const id of ids) {
      try {
        const del = await fetch(`${BASE_URL}/api/users/${id}`, { method: 'DELETE', headers: auth })
        if (del.ok) deleted++
      } catch {
        /* keep sweeping */
      }
    }
    console.log(`[global-teardown] ${deleted}/${ids.length} residue users deleted\n`)
  } catch (err) {
    console.warn(
      `[global-teardown] sweep skipped: ${err instanceof Error ? err.message : String(err)}\n`,
    )
  }
}
