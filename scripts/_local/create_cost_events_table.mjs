// Creates the cost_events table to match Payload's CostEvents collection schema.
// Idempotent. Usage: node scripts/_local/create_cost_events_table.mjs <kendev|angels>
import { config as dotenv } from 'dotenv'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { Client } = require(path.join(process.cwd(), 'node_modules/.pnpm/pg@8.16.3/node_modules/pg'))
dotenv({ path: '.env.local' }); dotenv({ path: '.env' })

const target = process.argv[2] || 'kendev'
const uri = process.env.DATABASE_URI.replace(/\/(kendev|angels)(\b|\?|$)/, `/${target}$2`)
const dbName = uri.match(/\/([^/?]+)(\?|$)/)[1]

const DDL = `
DO $$ BEGIN
  CREATE TYPE enum_cost_events_category AS ENUM ('intelligence','telephony','storage','infra','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE enum_cost_events_unit AS ENUM ('tokens','seconds','minutes','bytes','gb','requests','count');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS cost_events (
  id serial PRIMARY KEY,
  tenant_id integer,
  category enum_cost_events_category DEFAULT 'intelligence' NOT NULL,
  source varchar NOT NULL,
  provider varchar,
  cost_cents numeric,
  cost_estimated boolean DEFAULT true,
  currency varchar DEFAULT 'usd',
  billed_to_tenant_key boolean DEFAULT false,
  quantity numeric,
  unit enum_cost_events_unit,
  model varchar,
  tier varchar,
  input_tokens numeric,
  output_tokens numeric,
  total_tokens numeric,
  latency_ms numeric,
  ttft_ms numeric,
  finish_reason varchar,
  tool_call_count numeric,
  failed_over boolean,
  message_ref_id integer,
  conversation_id varchar,
  user_id varchar,
  occurred_at timestamp(3) with time zone,
  metadata jsonb,
  updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
  created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE cost_events ADD CONSTRAINT cost_events_tenant_id_tenants_id_fk
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE cost_events ADD CONSTRAINT cost_events_message_ref_id_messages_id_fk
    FOREIGN KEY (message_ref_id) REFERENCES messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS cost_events_tenant_id_idx ON cost_events (tenant_id);
CREATE INDEX IF NOT EXISTS cost_events_category_idx ON cost_events (category);
CREATE INDEX IF NOT EXISTS cost_events_provider_idx ON cost_events (provider);
CREATE INDEX IF NOT EXISTS cost_events_cost_cents_idx ON cost_events (cost_cents);
CREATE INDEX IF NOT EXISTS cost_events_billed_to_tenant_key_idx ON cost_events (billed_to_tenant_key);
CREATE INDEX IF NOT EXISTS cost_events_model_idx ON cost_events (model);
CREATE INDEX IF NOT EXISTS cost_events_conversation_id_idx ON cost_events (conversation_id);
CREATE INDEX IF NOT EXISTS cost_events_user_id_idx ON cost_events (user_id);
CREATE INDEX IF NOT EXISTS cost_events_occurred_at_idx ON cost_events (occurred_at);
CREATE INDEX IF NOT EXISTS cost_events_updated_at_idx ON cost_events (updated_at);
CREATE INDEX IF NOT EXISTS cost_events_created_at_idx ON cost_events (created_at);

-- CRITICAL: Payload adds one FK column per collection to payload_locked_documents_rels.
-- Without this, checkDocumentLockStatus (runs on every create/update/delete) throws
-- "column cost_events_id does not exist" and breaks ALL writes (e.g. LEO can't save).
ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS cost_events_id integer;
DO $$ BEGIN
  ALTER TABLE payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_cost_events_fk
    FOREIGN KEY (cost_events_id) REFERENCES cost_events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_cost_events_id_idx
  ON payload_locked_documents_rels USING btree (cost_events_id);
`

const c = new Client({ connectionString: uri })
await c.connect()
console.log('Connected to DB:', dbName)
await c.query(DDL)
const cnt = await c.query("select count(*) c from cost_events")
console.log('cost_events table ready. rows:', cnt.rows[0].c)
await c.end()
