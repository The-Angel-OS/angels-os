/**
 * EnvBanner — Payload Admin Component (`beforeNav`)
 *
 * A coloured strip naming the environment you are actually looking at.
 *
 * Production moved to Railway on 260730 while the laptop kept serving
 * kendev.co and payloadnuke.com off a *restore* of the same data — two admin
 * panels showing the same tenants, the same content, the same everything, one
 * of which is a copy whose writes go nowhere. Every hour lost this week to
 * "which one am I in" is an hour this strip would have saved.
 *
 * Server component on purpose: `ENV_LABEL` is read at request time. A
 * `NEXT_PUBLIC_*` would bake in at build and the container image is shared.
 *
 * Unset ENV_LABEL → renders nothing. Production stays unlabelled, so a missing
 * variable can never make a dev box look like production; the worst it can do
 * is make production look ordinary.
 */
export const EnvBanner = () => {
  const label = process.env.ENV_LABEL?.trim()
  if (!label) return null

  return (
    <div
      style={{
        background: process.env.ENV_LABEL_COLOR?.trim() || '#b45309',
        color: '#fff',
        font: '600 12px/1 system-ui, sans-serif',
        letterSpacing: '0.08em',
        padding: '7px 10px',
        textAlign: 'center',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  )
}
