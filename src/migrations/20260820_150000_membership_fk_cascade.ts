import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Membership join rows now CASCADE with the thing they belong to.
 *
 * Payload declares a required relationship as a NOT NULL column but generates the
 * foreign key with `ON DELETE SET NULL`. Those two contradict: deleting the parent
 * makes Postgres try to write NULL into a NOT NULL column, so the delete fails
 * outright — `null value in column "user_id" of relation "space_memberships"
 * violates not-null constraint`. Found 260820 deleting a user who belonged to a
 * space; it fails the same way through the Payload API and the admin UI.
 *
 * CASCADE is the honest rule for these four: a membership is a row ABOUT a pairing.
 * Without its user, or without the group it grants access to, it is not an orphan
 * worth keeping — it is a row that can never be read again.
 *
 * ⚠️ This deliberately does NOT touch the other 27 columns platform-wide with the
 * same NOT NULL + SET NULL shape. Those are a separate question with different
 * answers per table, and changing them speculatively is how you turn a data model
 * into a demolition. In particular the durable rule that **deleting a space
 * ORPHANS, never cascades** still holds for every FK that points AT `spaces` from
 * content (messages, channels, works); `POST /api/space-ops/delete` remains the
 * supported way to remove a space. What changes here is only the membership rows,
 * which that endpoint already rewrites or removes explicitly.
 *
 * Hand-written + idempotent: drop the constraint if present, recreate with CASCADE.
 */

const TARGETS: Array<{ table: string; column: string; ref: string }> = [
  { table: 'space_memberships', column: 'user_id', ref: 'users' },
  { table: 'space_memberships', column: 'space_id', ref: 'spaces' },
  { table: 'tenant_memberships', column: 'tenant_id', ref: 'tenants' },
  { table: 'users_tenants', column: 'tenant_id', ref: 'tenants' },
]

const constraintName = (t: { table: string; column: string; ref: string }) =>
  `${t.table}_${t.column}_${t.ref}_id_fk`

function rebuild(onDelete: 'CASCADE' | 'SET NULL'): string {
  return TARGETS.map(
    (t) => `
      ALTER TABLE "${t.table}" DROP CONSTRAINT IF EXISTS "${constraintName(t)}";
      ALTER TABLE "${t.table}"
        ADD CONSTRAINT "${constraintName(t)}"
        FOREIGN KEY ("${t.column}") REFERENCES "${t.ref}"("id")
        ON DELETE ${onDelete} ON UPDATE NO ACTION;`,
  ).join('\n')
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(rebuild('CASCADE')))
  // How many people one time slot can hold. 1 = a one-to-one appointment (the
  // old, only, hard-coded behaviour); higher = a class, tour, or group session.
  await db.execute(
    sql.raw(
      `ALTER TABLE "availability" ADD COLUMN IF NOT EXISTS "capacity" numeric DEFAULT 1;`,
    ),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(rebuild('SET NULL')))
  await db.execute(sql.raw(`ALTER TABLE "availability" DROP COLUMN IF EXISTS "capacity";`))
}
