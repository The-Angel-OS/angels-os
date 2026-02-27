/**
 * Playwright Global Setup
 *
 * Runs once before ALL test projects. Seeds the dev database with:
 * - Admin user (dev-admin@spacesangels.com / devdev123) with roles: ['admin']
 * - Test tenant, spaces, channels, projects, messages
 *
 * This ensures auth.setup.ts can log in as admin on the first try,
 * and dashboard tests have real data to work with.
 *
 * The seed script is idempotent (findOrCreate pattern) so it's safe
 * to run multiple times.
 */
import { execSync } from 'child_process'

export default async function globalSetup() {
  console.log('\n[global-setup] Seeding dev database for E2E tests...')
  const startTime = Date.now()

  try {
    // Run seed:dev — creates admin user + test data via Payload Local API
    // Uses overrideAccess: true, so roles: ['admin'] is properly set
    execSync('pnpm seed:dev', {
      cwd: process.cwd(),
      stdio: 'pipe', // Capture output to keep test runner output clean
      timeout: 120_000, // 2 minutes max (Payload boot + seed)
      env: { ...process.env },
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[global-setup] Dev seed complete in ${elapsed}s`)
    console.log('[global-setup] Admin: dev-admin@spacesangels.com / devdev123\n')
  } catch (err: unknown) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const message = err instanceof Error ? err.message : String(err)

    // Non-fatal: if seed fails, auth.setup will fall back to auto-create
    // (which creates a customer-level user, so admin tests may fail)
    console.warn(`[global-setup] Seed failed after ${elapsed}s: ${message}`)
    console.warn('[global-setup] Falling back to auth.setup auto-create (admin tests may fail)\n')

    // Check if it was a "user already exists" type error (expected)
    if (message.includes('already exists') || message.includes('duplicate')) {
      console.log('[global-setup] Seed data likely already exists — continuing.\n')
    }
  }
}
