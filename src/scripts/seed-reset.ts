/**
 * CLI Seed Reset Script
 *
 * Usage: pnpm seed:reset
 *
 * Wipes all seeded collections (preserving tenants and users via findOrCreate),
 * cleans up media from Vercel Blob storage, and re-seeds with Angel OS content.
 *
 * This script runs outside of the Next.js server context, so revalidation
 * errors are expected and harmless.
 */
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  console.log('\n🦅 Angel OS Seed Reset')
  console.log('═'.repeat(50))
  console.log('Loading Payload configuration...\n')

  // Dynamic import to ensure dotenv is loaded first
  const { getPayload } = await import('payload')
  const { seed } = await import('../endpoints/seed/index.js')

  // Import the config — resolve from src/ directory
  const configPath = path.resolve(__dirname, '../payload.config.ts')
  const configUrl = `file:///${configPath.replace(/\\/g, '/')}`
  const configModule = await import(configUrl)
  const config = configModule.default

  const payload = await getPayload({ config })

  // Create a local request object (no user context needed for CLI seed)
  const { createLocalReq } = await import('payload')
  const req = await createLocalReq({}, payload)

  console.log('Starting seed...\n')

  try {
    await seed({ payload, req })
    console.log('\n✅ Seed reset complete!')
  } catch (error) {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
