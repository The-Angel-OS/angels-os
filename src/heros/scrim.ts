/**
 * How hard a hero darkens its image so the heading stays readable.
 *
 * Dialable because the right amount depends on the picture: a photograph needs
 * a real bed under the text, while an image that carries its OWN words — a
 * poster, an infographic, a lettered van — goes muddy under one. Tap Gray's
 * services hero was the case that asked for this.
 *
 * A multiplier rather than four hand-written gradients per hero: each hero
 * keeps the gradient SHAPE that suits its layout, and only the alphas move.
 * `strong` is 1 and is the default, so every hero built before this renders
 * exactly as it did.
 */
export type ScrimLevel = 'strong' | 'medium' | 'light' | 'none'

const FACTORS: Record<ScrimLevel, number> = {
  strong: 1,
  medium: 0.6,
  light: 0.3,
  none: 0,
}

export function scrimFactor(level: string | null | undefined): number {
  return FACTORS[(level as ScrimLevel) ?? 'strong'] ?? 1
}

/** Scale the alphas in an `rgba(...)` gradient string. 0 returns ''. */
export function scaleScrim(gradient: string, level: string | null | undefined): string {
  const f = scrimFactor(level)
  if (f === 0) return ''
  if (f === 1) return gradient
  return gradient.replace(
    /rgba\(([^)]+)\)/g,
    (_m, inner: string) => {
      const parts = inner.split(',').map((x) => x.trim())
      if (parts.length < 4) return `rgba(${inner})`
      const a = Math.round(Number(parts[3]) * f * 100) / 100
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${a})`
    },
  )
}
