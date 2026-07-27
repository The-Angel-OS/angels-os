/**
 * GET/POST /api/sequence-ops/tick — send whatever sequence steps are due.
 *
 * The platform could already broadcast, but only while a human sat on the
 * dashboard page: sendCampaignChunk is called repeatedly by the browser. A
 * two-week clearance cannot depend on somebody keeping a tab open, so the drip
 * runs here, off the heartbeat, unattended.
 *
 * Driven by `nextSendAt`, so the query asks "what is due?" rather than walking
 * every contact on every run.
 *
 * Bounded on purpose: one batch per tick. A backlog drains over several ticks
 * instead of one request trying to send thousands of emails and timing out
 * halfway with no record of where it stopped.
 */
import type { PayloadHandler } from 'payload'

import { resolveEmailSender } from '@/utilities/resolveEmailSender'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'

/** Per-tick cap. With the heartbeat at ~5 min this drains ~600/hour. */
const BATCH = 50
/** Consecutive failures before we stop rather than retry a dead address forever. */
const MAX_FAILURES = 3

const personalize = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '')

export const sequenceTickHandler: PayloadHandler = async (req) => {
  const { payload } = req

  // Same shared-secret gate the other cron endpoints use.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  let sent = 0
  let stopped = 0
  let failed = 0

  try {
    const due = await payload.find({
      collection: 'sequence-enrollments',
      where: {
        and: [
          { status: { equals: 'active' } },
          { nextSendAt: { less_than_equal: now.toISOString() } },
        ],
      },
      limit: BATCH,
      depth: 2, // sequence + contact populated
      sort: 'nextSendAt',
      overrideAccess: true,
      req,
    })

    for (const row of due.docs as unknown as Record<string, unknown>[]) {
      const enrollment = row as {
        id: number | string
        tenant?: { id?: number | string } | number | string
        sequence?: { steps?: Array<{ delayHours: number; subject: string; body: string }>; isActive?: boolean }
        contact?: { id?: number | string; email?: string; name?: string; contactStatus?: string; unsubscribeToken?: string }
        currentStep: number
        enrolledAt: string
        sendFailures?: number
      }

      const steps = enrollment.sequence?.steps || []
      const step = steps[enrollment.currentStep]
      const contact = enrollment.contact

      const finish = async (status: 'completed' | 'stopped', reason?: string) => {
        await payload.update({
          collection: 'sequence-enrollments',
          id: enrollment.id,
          data: { status, stoppedReason: reason, nextSendAt: null } as Record<string, unknown>,
          depth: 0,
          overrideAccess: true,
          req,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
      }

      // Ran out of steps, sequence switched off, or the contact opted out.
      if (!step || enrollment.sequence?.isActive === false) {
        await finish('completed')
        stopped++
        continue
      }
      if (!contact?.email || contact.contactStatus === 'unsubscribed') {
        await finish('stopped', 'unsubscribed')
        stopped++
        continue
      }

      const tenantId =
        typeof enrollment.tenant === 'object' ? enrollment.tenant?.id : enrollment.tenant

      try {
        const sender = await resolveEmailSender(payload, tenantId as number | string)
        const baseUrl = getServerSideURL()
        const unsubscribeUrl = `${baseUrl}/unsubscribe/${contact.unsubscribeToken || ''}`
        const vars = { name: contact.name || '', email: contact.email, unsubscribeUrl }

        const html = `${personalize(step.body, vars)}
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
          <p style="font-size:12px;color:#999;text-align:center;">
            <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a>
          </p>`

        await sender.sendEmail({
          to: contact.email,
          subject: personalize(step.subject, vars),
          html,
          text: `${personalize(step.body, vars).replace(/<[^>]+>/g, '')}\n\nUnsubscribe: ${unsubscribeUrl}`,
        })

        const nextIndex = enrollment.currentStep + 1
        const nextStep = steps[nextIndex]
        // Delays are absolute from ENROLMENT, so a slow tick never compounds
        // into drift — step 3 lands 72h after signup regardless of when step 2
        // actually went out.
        const nextSendAt = nextStep
          ? new Date(new Date(enrollment.enrolledAt).getTime() + nextStep.delayHours * 3600_000)
          : null

        await payload.update({
          collection: 'sequence-enrollments',
          id: enrollment.id,
          data: {
            currentStep: nextIndex,
            lastSentAt: now.toISOString(),
            sendFailures: 0,
            nextSendAt: nextSendAt ? nextSendAt.toISOString() : null,
            status: nextStep ? 'active' : 'completed',
          } as Record<string, unknown>,
          depth: 0,
          overrideAccess: true,
          req,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

        sent++
      } catch (err) {
        failed++
        const failures = (enrollment.sendFailures || 0) + 1
        if (failures >= MAX_FAILURES) {
          await finish('stopped', 'failed')
        } else {
          // Back off an hour rather than hammering a failing provider every tick.
          await payload.update({
            collection: 'sequence-enrollments',
            id: enrollment.id,
            data: {
              sendFailures: failures,
              nextSendAt: new Date(now.getTime() + 3600_000).toISOString(),
            } as Record<string, unknown>,
            depth: 0,
            overrideAccess: true,
            req,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
        }
        void logError({
          level: 'warning',
          source: 'sequence-tick',
          message: `Sequence step failed for enrolment ${enrollment.id} (attempt ${failures}): ${err instanceof Error ? err.message : String(err)}`,
        })
      }
    }

    return Response.json({ ok: true, sent, stopped, failed, considered: due.docs.length })
  } catch (err) {
    void logError({
      level: 'error',
      source: 'sequence-tick',
      message: `Sequence tick failed: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
    })
    return Response.json({ error: 'Sequence tick failed' }, { status: 500 })
  }
}
