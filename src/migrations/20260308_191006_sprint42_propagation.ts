import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Sprint 42: User Propagation Layer + Flagship Commissioning

  // 1. Add propagationTrigger enum + column to tenant_memberships
  await db.execute(sql`
    CREATE TYPE "public"."enum_tenant_memberships_propagation_trigger" AS ENUM('purchase', 'booking', 'event_registration', 'space_join', 'federation_interaction', 'manual');
  `)
  await db.execute(sql`
    ALTER TABLE "tenant_memberships"
    ADD COLUMN "propagation_trigger" "enum_tenant_memberships_propagation_trigger";
  `)

  // 2. Add isFlagship + commissionedAt to tenants (setup group)
  await db.execute(sql`
    ALTER TABLE "tenants"
    ADD COLUMN "setup_is_flagship" boolean DEFAULT false,
    ADD COLUMN "setup_commissioned_at" timestamp(3) with time zone;
  `)

  // 3. Add commissionedAt + commissionedBy to endeavors (federation group)
  await db.execute(sql`
    ALTER TABLE "endeavors"
    ADD COLUMN "federation_commissioned_at" timestamp(3) with time zone,
    ADD COLUMN "federation_commissioned_by" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "endeavors"
    DROP COLUMN IF EXISTS "federation_commissioned_at",
    DROP COLUMN IF EXISTS "federation_commissioned_by";
  `)
  await db.execute(sql`
    ALTER TABLE "tenants"
    DROP COLUMN IF EXISTS "setup_is_flagship",
    DROP COLUMN IF EXISTS "setup_commissioned_at";
  `)
  await db.execute(sql`
    ALTER TABLE "tenant_memberships"
    DROP COLUMN IF EXISTS "propagation_trigger";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_tenant_memberships_propagation_trigger";
  `)
}
