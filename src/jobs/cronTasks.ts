/**
 * Scheduled work — the ten crontab lines, moved into Payload's jobs queue.
 *
 * The old design was an Alpine container running `crond` that curled this app's
 * own HTTP endpoints with a shared secret. It failed three ways in two days: a
 * Windows editor wrote CRLF into the crontab and every job silently stopped for
 * twenty hours; the crontab hard-coded `http://core:3000`, so moving Core would
 * have killed it anyway; and every failure was a log line in a container nobody
 * reads. (docs/PLAN_260731_DEPLOY_JOBS_ENVIRONMENTS.md, FOOTGUNS 2.7c)
 *
 * Here the schedule lives in the app, runs wherever the app runs, and every
 * attempt is a row in `payload-jobs`.
 *
 * ponytail: the tasks CALL the existing endpoint handlers rather than the plan's
 * "extract each body into a shared function" — same no-HTTP, no-duplication
 * result for ~40 lines instead of ten refactors. A `PayloadHandler` here only
 * ever touches `req.payload`, `req.headers` and `req.url`, so a synthetic req
 * over the real one is enough. If a handler ever grows a dependency on the HTTP
 * layer proper, extract that one.
 */
import type { PayloadRequest, TaskConfig } from 'payload'
import type { PayloadHandler } from 'payload'

import { connectorHealthCronHandler } from '@/endpoints/connector-health-cron'
import { federationHeartbeatCronHandler } from '@/endpoints/federation-heartbeat-cron'
import { healStalledMessagesHandler } from '@/endpoints/heal-stalled-messages'
import { logConsolidateHandler } from '@/endpoints/log-consolidate'
import { notificationsPollHandler } from '@/endpoints/notifications-poll'
import { sequenceTickHandler } from '@/endpoints/sequence-tick'
import { solvencyBriefingHandler } from '@/endpoints/solvency-briefing'
import { verifyOnboardingHandler } from '@/endpoints/verify-onboarding'
import { youtubePollHandler } from '@/endpoints/youtube-poll'

/** One queue. The per-task `schedule` below is what actually spaces them out. */
export const CRON_QUEUE = 'cron'

/**
 * Run a normal endpoint handler in-process.
 *
 * `Object.create(req)` rather than a spread: the job's real req stays on the
 * prototype chain (payload, transactionID, locale, …) and we only shadow the two
 * things the handlers read off the HTTP layer.
 */
export const callHandler = async (
  handler: PayloadHandler,
  req: PayloadRequest,
  path: string,
): Promise<{ output: Record<string, unknown> }> => {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Loud, not silent: three of these handlers 403 without it, and a job row
    // that says why beats four that say "Forbidden".
    throw new Error('CRON_SECRET is not set — scheduled tasks cannot authenticate')
  }

  const cronReq = Object.create(req) as PayloadRequest
  Object.assign(cronReq, {
    headers: new Headers({ authorization: `Bearer ${secret}` }),
    url: `http://localhost${path}`,
  })

  const res = await handler(cronReq)
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    // Throwing is what puts it in `payload-jobs` as a failure instead of a
    // completed job whose output nobody reads.
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(body).slice(0, 500)}`)
  }
  return { output: body }
}

type CronSpec = {
  /** Six fields: second minute hour day month weekday. */
  cron: string
  handler: PayloadHandler
  /** Path + query, exactly as the crontab called it. */
  path: string
  retries?: number
  slug: string
}

const SPECS: CronSpec[] = [
  // — every 5 minutes ————————————————————————————————————————————————
  // heal-stalled ran every minute in the crontab; its threshold is 10 minutes,
  // so every 5 is the same watchdog for a fifth of the queries.
  {
    cron: '0 */5 * * * *',
    handler: healStalledMessagesHandler,
    path: '/api/message-ops/heal-stalled',
    slug: 'heal-stalled-messages',
  },
  {
    cron: '0 */5 * * * *',
    handler: sequenceTickHandler,
    path: '/api/sequence-ops/tick',
    slug: 'sequence-tick',
  },
  {
    cron: '0 */5 * * * *',
    handler: federationHeartbeatCronHandler,
    path: '/api/federation/heartbeat-cron',
    slug: 'federation-heartbeat',
  },
  {
    cron: '0 */5 * * * *',
    handler: notificationsPollHandler,
    path: '/api/notifications/poll',
    slug: 'notifications-poll',
  },

  // — hourly ——————————————————————————————————————————————————————————
  {
    cron: '0 17,47 * * * *',
    handler: connectorHealthCronHandler,
    path: '/api/connector-ops/health',
    retries: 2,
    slug: 'connector-health',
  },
  {
    cron: '0 7 * * * *',
    handler: youtubePollHandler,
    path: '/api/youtube/poll',
    retries: 2,
    slug: 'youtube-poll',
  },

  // — daily ———————————————————————————————————————————————————————————
  {
    cron: '0 0 3 * * *',
    handler: verifyOnboardingHandler,
    path: '/api/provision-ops/verify-onboarding?all=1',
    retries: 2,
    slug: 'verify-onboarding',
  },
  {
    cron: '0 30 3 * * *',
    handler: logConsolidateHandler,
    path: '/api/log-ops/consolidate',
    retries: 2,
    slug: 'log-consolidate',
  },
  {
    cron: '0 0 13 * * *',
    handler: solvencyBriefingHandler,
    path: '/api/solvency-ops/briefing',
    retries: 2,
    slug: 'solvency-briefing',
  },

  // NOT scheduled: `/api/email/poll` (every 2 min in the crontab). It has
  // returned 500 since before the crontab broke — inbound email → AI Bus has
  // been down longer than anyone noticed. Scheduling it would just manufacture
  // a failed job row every two minutes. Fix it, then add it back here.
]

export const cronTasks: TaskConfig<any>[] = SPECS.map((spec) => ({
  slug: spec.slug,
  handler: async ({ req }) => callHandler(spec.handler, req, spec.path),
  label: spec.slug,
  retries: spec.retries,
  schedule: [{ cron: spec.cron, queue: CRON_QUEUE }],
})) as TaskConfig<any>[]
