import { config } from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..')
config({ path: path.join(root, '.env.local') }); config({ path: path.join(root, '.env') })
const base = process.env.DATABASE_URI || process.env.DATABASE_URL

const SQL = `
-- live block table (id = varchar PK, matches sibling blocks)
CREATE TABLE IF NOT EXISTS pages_blocks_membership (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  _path text NOT NULL,
  id varchar PRIMARY KEY,
  rich_text jsonb,
  cta_text varchar,
  block_name varchar
);
CREATE INDEX IF NOT EXISTS pages_blocks_membership_order_idx ON pages_blocks_membership (_order);
CREATE INDEX IF NOT EXISTS pages_blocks_membership_parent_id_idx ON pages_blocks_membership (_parent_id);
CREATE INDEX IF NOT EXISTS pages_blocks_membership_path_idx ON pages_blocks_membership (_path);
DO $$ BEGIN
  ALTER TABLE pages_blocks_membership ADD CONSTRAINT pages_blocks_membership_parent_id_fk
    FOREIGN KEY (_parent_id) REFERENCES pages(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- versioned (_pages_v) block table (id = serial PK)
CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_membership_id_seq";
CREATE TABLE IF NOT EXISTS "_pages_v_blocks_membership" (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  _path text NOT NULL,
  id integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_membership_id_seq'),
  rich_text jsonb,
  cta_text varchar,
  _uuid varchar,
  block_name varchar
);
ALTER SEQUENCE "_pages_v_blocks_membership_id_seq" OWNED BY "_pages_v_blocks_membership".id;
CREATE INDEX IF NOT EXISTS "_pages_v_blocks_membership_order_idx" ON "_pages_v_blocks_membership" (_order);
CREATE INDEX IF NOT EXISTS "_pages_v_blocks_membership_parent_id_idx" ON "_pages_v_blocks_membership" (_parent_id);
CREATE INDEX IF NOT EXISTS "_pages_v_blocks_membership_path_idx" ON "_pages_v_blocks_membership" (_path);
DO $$ BEGIN
  ALTER TABLE "_pages_v_blocks_membership" ADD CONSTRAINT "_pages_v_blocks_membership_parent_id_fk"
    FOREIGN KEY (_parent_id) REFERENCES "_pages_v"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`

for (const db of ['angels','kendev']) {
  const u = new URL(base); u.pathname='/'+db
  const c = new pg.Client({ connectionString: u.toString(), ssl:false }); await c.connect()
  try {
    await c.query(SQL)
    const r = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('pages_blocks_membership','_pages_v_blocks_membership') ORDER BY table_name`)
    console.log(`[${db}] OK — tables now: ${r.rows.map(x=>x.table_name).join(', ')}`)
  } catch(e){ console.error(`[${db}] FAILED: ${e.message}`) } finally { await c.end() }
}
