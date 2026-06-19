/**
 * Hard-decommission a tenant and all latent artifacts on this node (CLI front-end).
 *
 * The logic lives in src/utilities/decommissionTenant.ts — shared with LEO's
 * `decommission_tenant` tool. DRY-RUN BY DEFAULT; set DECOMMISSION_EXECUTE=true to delete.
 *
 *   # blast radius (safe):
 *   PAYLOAD_SKIP_PUSH=true PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true \
 *     TENANT_SLUG=hays-cactus pnpm tsx scripts/decommission-tenant.ts
 *
 *   # execute (irreversible — pg_dump first!):
 *   PAYLOAD_SKIP_PUSH=true PAYLOAD_DISABLE_DEPENDENCY_CHECKER=true \
 *     TENANT_SLUG=hays-cactus DECOMMISSION_EXECUTE=true pnpm tsx scripts/decommission-tenant.ts
 */
import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { decommissionTenant } from '../src/utilities/decommissionTenant'

const SLUG = process.env.TENANT_SLUG || 'hays-cactus'
const EXECUTE = process.env.DECOMMISSION_EXECUTE === 'true'

async function main() {
  const payload = await getPayload({ config })
  const r = await decommissionTenant(payload, { slug: SLUG, execute: EXECUTE })
  if (!r.found) {
    console.error(`❌ No tenant found with slug "${SLUG}". Nothing to do.`)
    process.exit(1)
  }
  console.log(`\n${EXECUTE ? '🔥 EXECUTING' : '🔍 DRY-RUN'} decommission "${SLUG}" (id ${r.tenantId})  domain=${r.domain}  name=${r.name}\n`)
  for (const s of r.steps) {
    const verb = s.status === 'error' ? `⚠️  ERROR: ${s.error}`
      : s.status === 'deleted' ? `✓ deleted ${s.count}`
      : s.status === 'scrubbed' ? `✓ scrubbed membership on ${s.count}`
      : `• would affect ${s.count}`
    console.log(`  ${s.collection.padEnd(26)} ${verb}`)
  }
  console.log(`\n${EXECUTE ? '🔥 Done.' : '🔍 Dry-run complete.'} ${r.totalRows} rows ${EXECUTE ? 'deleted' : 'would be deleted'}.`)
  if (!EXECUTE) console.log('   Re-run with DECOMMISSION_EXECUTE=true to delete (pg_dump first).')
  if (EXECUTE) console.log('   ⚠️ Bust tenant caches or wait 120s TTL so the host stops resolving.')
  process.exit(0)
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1) })
