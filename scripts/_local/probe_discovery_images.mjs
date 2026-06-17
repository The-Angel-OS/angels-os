import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.join(process.cwd(), f), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {}
}

// Read-only: target the ANGELS DB (spacesangels.com), swapping /kendev -> /angels
let uri = process.env.DATABASE_URI || ''
uri = uri.replace(/\/kendev(\?|$)/, '/angels$1')
const host = (uri.match(/@([^/]+)\//) || [])[1] || '?'
const db = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || '?'
console.log(`Target: ${host} / ${db}`)

const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm')
const pgDir = fs.readdirSync(pnpmDir).find((d) => /^pg@\d/.test(d))
const pgIndex = path.join(pnpmDir, pgDir, 'node_modules', 'pg', 'lib', 'index.js')
const { default: pg } = await import(pathToFileURL(pgIndex).href)

const pool = new pg.Pool({ connectionString: uri, max: 1, connectionTimeoutMillis: 15000 })
const q = async (label, sql, params) => {
  try {
    const r = await pool.query(sql, params)
    console.log(`\n## ${label}`)
    console.table(r.rows)
    return r.rows
  } catch (e) {
    console.log(`\n## ${label} -> ERROR: ${e.message}`)
    return []
  }
}

try {
  await q('Tenants (id/slug/name)', `SELECT id, slug, name FROM tenants ORDER BY id`)
  await q('Endeavors: logo/coverImage presence', `
    SELECT e.id, e.name, e.logo_id, e.cover_image_id,
           (e.federation_network_visible) AS net_visible,
           e.tenant_id
    FROM endeavors e ORDER BY e.id`)
  await q('Pages with meta.image (home-ish)', `
    SELECT id, slug, title, tenant_id, meta_image_id
    FROM pages WHERE slug IN ('home','') OR slug IS NULL ORDER BY tenant_id`)
  await q('Header docs', `SELECT id, tenant_id FROM header ORDER BY tenant_id`)
  await q('Tenant branding logo fields', `
    SELECT id, slug, branding_logo_id, branding_favicon_id
    FROM tenants ORDER BY id`)
  await q('Media count per tenant', `
    SELECT tenant_id, count(*)::int n FROM media GROUP BY tenant_id ORDER BY tenant_id`)
  await q('Sample media (platform + clearwater)', `
    SELECT id, tenant_id, filename, alt FROM media
    WHERE tenant_id IN (1,5,11) ORDER BY tenant_id, id LIMIT 30`)
} catch (e) {
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
