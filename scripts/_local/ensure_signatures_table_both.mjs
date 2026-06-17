// One-off: provision the `signatures` table (+ enums + lock-rel column) on BOTH
// prod DBs via raw pg, BEFORE deploying the config that references it. Idempotent,
// additive-only. Mirrors src/endpoints/ensure-signatures-table.ts exactly.
import pg from 'pg'
import fs from 'fs'

function readEnvUri() {
  if (process.env.DATABASE_URI) return process.env.DATABASE_URI
  const line = fs.readFileSync('.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URI='))
  return line.split('=').slice(1).join('=').replace(/^["']|["'\r]$/g, '')
}

const kendevUri = readEnvUri()
if (!/\/kendev(\?|$)/.test(kendevUri)) {
  console.error('Refusing: DATABASE_URI does not end in /kendev — got', kendevUri.replace(/:[^:@]+@/, ':****@'))
  process.exit(1)
}
const angelsUri = kendevUri.replace('/kendev', '/angels')

const STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE enum_signatures_document_type AS ENUM ('agreement','waiver','booking','tos','constitution','form','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE enum_signatures_signature_type AS ENUM ('typed','drawn'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "signatures" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "signer_name" varchar NOT NULL,
     "signer_id" integer,
     "document_type" enum_signatures_document_type DEFAULT 'agreement',
     "document_ref" varchar NOT NULL,
     "document_title" varchar,
     "document_checksum" varchar NOT NULL,
     "signature_type" enum_signatures_signature_type DEFAULT 'typed' NOT NULL,
     "signature_data" varchar NOT NULL,
     "content_hash" varchar,
     "signed_at" timestamp(3) with time zone NOT NULL,
     "ip_address" varchar,
     "user_agent" varchar,
     "metadata" jsonb,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "signatures_tenant_idx" ON "signatures" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "signatures_signer_idx" ON "signatures" ("signer_id");`,
  `CREATE INDEX IF NOT EXISTS "signatures_document_type_idx" ON "signatures" ("document_type");`,
  `CREATE INDEX IF NOT EXISTS "signatures_document_ref_idx" ON "signatures" ("document_ref");`,
  `CREATE INDEX IF NOT EXISTS "signatures_content_hash_idx" ON "signatures" ("content_hash");`,
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "signatures_id" integer;`,
]

async function run(label, uri) {
  const client = new pg.Client({ connectionString: uri, ssl: false })
  await client.connect()
  let ran = 0
  const errors = []
  for (let i = 0; i < STATEMENTS.length; i++) {
    try {
      await client.query(STATEMENTS[i])
      ran++
    } catch (e) {
      errors.push({ i, error: e.message })
    }
  }
  const tbl = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_name='signatures'`)
  const col = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name='payload_locked_documents_rels' AND column_name='signatures_id'`,
  )
  await client.end()
  console.log(`[${label}] ran=${ran}/${STATEMENTS.length} signaturesTable=${tbl.rows.length > 0} lockRelCol=${col.rows.length > 0} errors=${JSON.stringify(errors)}`)
}

await run('kendev', kendevUri)
await run('angels', angelsUri)
console.log('done')
