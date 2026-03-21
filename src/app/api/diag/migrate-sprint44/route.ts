import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * One-shot migration for Sprint 44 missing columns.
 * DELETE AFTER RUNNING ONCE.
 * GET /api/diag/migrate-sprint44?key=angel-migrate-44
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('key') !== 'angel-migrate-44') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  try {
    const payload = await getPayload({ config: configPromise })
    const db = (payload.db as any).drizzle

    if (!db) {
      return NextResponse.json({ error: 'Cannot access drizzle instance' }, { status: 500 })
    }

    // Add missing Sprint 44 columns to tenants table
    const alterStatements = [
      // AI Config fields (Sprint 44)
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_openai_api_key" varchar`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_google_ai_api_key" varchar`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_cloudflare_account_id" varchar`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_cloudflare_ai_token" varchar`,
      // Preferred image provider enum + column
      `DO $$ BEGIN CREATE TYPE "public"."enum_tenants_ai_config_preferred_image_provider" AS ENUM('auto', 'openai', 'google', 'openrouter', 'cloudflare'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_preferred_image_provider" "enum_tenants_ai_config_preferred_image_provider" DEFAULT 'auto'`,
    ]

    for (const sql of alterStatements) {
      try {
        await db.execute({ sql, params: [] })
        results.push(`OK: ${sql.slice(0, 80)}...`)
      } catch (err) {
        results.push(`SKIP: ${sql.slice(0, 80)}... (${err instanceof Error ? err.message.slice(0, 100) : 'unknown'})`)
      }
    }

    // Verify by querying a tenant
    try {
      const test = await payload.find({
        collection: 'tenants',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      results.push(`VERIFY: Found ${test.docs.length} tenant(s) — query succeeded!`)
    } catch (err) {
      results.push(`VERIFY FAILED: ${err instanceof Error ? err.message.slice(0, 200) : 'unknown'}`)
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      results,
    }, { status: 500 })
  }
}
