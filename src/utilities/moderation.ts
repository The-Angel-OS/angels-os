/**
 * Moderation — the always-on reflex pass that annotates every human message.
 *
 * This is the *cerebellum* half of LEO's moderation: a fast, deterministic,
 * config-free classifier that runs on every user submittal with zero LLM cost or
 * latency. It produces a {@link ModerationVerdict} that gets stamped onto the
 * message (`metadata.moderation`) so the system can truthfully say every message
 * is screened, and anything it flags is auto-escalated to a human moderator.
 *
 * The *cortex* half (an LEO/AI pass on borderline content) is a deliberate SEAM:
 * `moderateText` returns `by: 'heuristic'`, and a future cortex reviewer can
 * re-classify a `review` verdict and overwrite it with `by: 'leo'`. The reflex
 * never needs the cortex to function — it degrades gracefully, by design
 * (config-free for the 99%).
 *
 * Guardrails (consistent with KARMA_PRINCIPLES — forgiving, human-in-loop):
 *   - Conservative: only STRONG signals reach `review`/`block`; normal chatter,
 *     venting, and dark humor stay `ok`. False positives erode trust faster than
 *     the rare miss, and a human still sees every flag.
 *   - Additive, never punitive here: this module CLASSIFIES. It does not delete,
 *     ban, or hide. Enforcement is a separate, human-or-policy decision.
 *   - Fail-soft: malformed input → `ok`, never throws.
 *
 * @see src/collections/Messages/hooks/moderateMessage.ts — where it's applied
 * @see src/utilities/escalation.ts — the escalation it feeds (content_flagged)
 */

export type ModerationStatus = 'ok' | 'review' | 'block'

export type ModerationCategory =
  | 'threat' // credible threat of violence toward a person
  | 'self_harm' // suicidal ideation / encouraging self-harm
  | 'hate' // dehumanizing slurs targeting a protected class
  | 'sexual_minors' // any sexualization of minors — highest severity
  | 'doxxing' // posting another person's private identifying info

export interface ModerationVerdict {
  status: ModerationStatus
  /** Categories that fired, in detection order. */
  categories: ModerationCategory[]
  /** 0–10 severity. 0 = clean. Drives status thresholds. */
  score: number
  /** Short human-readable rationale for the moderator. */
  reason?: string
  /** Which brain produced this verdict — `heuristic` (reflex) or `leo` (cortex). */
  by: 'heuristic' | 'leo'
  /** ISO timestamp (caller supplies; this module is clock-free for testability). */
  at: string
}

interface CategoryRule {
  category: ModerationCategory
  /** Severity contributed when ANY pattern matches (0–10). */
  weight: number
  patterns: RegExp[]
}

// ── Rule set ─────────────────────────────────────────────────────────────────
// Seed patterns. Conservative on purpose — each targets a STRUCTURAL signal
// (an addressed threat, an explicit self-harm statement) rather than a lone
// emotionally-charged word, so everyday speech doesn't trip it. Extend with care:
// every pattern added is a potential false positive against a real person's words.

const RULES: CategoryRule[] = [
  {
    category: 'sexual_minors',
    weight: 10,
    patterns: [
      // Sexual intent combined with a minor referent. Kept narrow.
      /\b(sex|sexual|nude|naked|explicit)\b[^.?!]{0,40}\b(child|children|kid|kids|minor|minors|underage|preteen|pre-teen|\d{1,2}[\s-]?(?:yo|y\/o|year[\s-]?old))\b/i,
      /\b(child|children|kid|minor|underage|preteen)\b[^.?!]{0,40}\b(sex|sexual|nude|naked|porn|explicit)\b/i,
    ],
  },
  {
    category: 'threat',
    weight: 8,
    patterns: [
      // First/second-person credible violence directed at "you"/a person.
      /\bi(?:'m| am| will| am going to|'ll| gonna)\b[^.?!]{0,30}\b(kill|murder|shoot|stab|behead|rape|hurt|beat|attack|bomb)\b[^.?!]{0,20}\b(you|him|her|them|u)\b/i,
      /\b(i('| a|'l)?m? )?(going to|gonna|will|finna)\b[^.?!]{0,20}\b(kill|shoot|stab|kil+)\b[^.?!]{0,15}\b(you|u|him|her|them)\b/i,
    ],
  },
  {
    category: 'self_harm',
    weight: 7,
    patterns: [
      /\b(kill myself|end my life|suicidal|want to die|i want to die|going to kill myself|kms)\b/i,
      // Second-person encouragement of self-harm.
      /\b(kill yourself|kys|go die|end your life|hang yourself)\b/i,
    ],
  },
  {
    category: 'doxxing',
    weight: 5,
    patterns: [
      // "here's his/her address/SSN …" — sharing another's private identifiers.
      /\b(his|her|their|your)\b[^.?!]{0,15}\b(home address|ssn|social security|credit card)\b/i,
    ],
  },
  {
    category: 'hate',
    weight: 6,
    patterns: [
      // Dehumanizing construction: "<group> are/should <subhuman/violence>".
      /\b(all|those)\b[^.?!]{0,20}\b(should be (killed|gassed|exterminated|deported)|are (subhuman|vermin|animals))\b/i,
    ],
  },
]

const BLOCK_THRESHOLD = 9 // sexual_minors-tier only
const REVIEW_THRESHOLD = 5

/**
 * Classify a single piece of message text. Pure + fail-soft.
 *
 * @param text  Plain text extracted from the message content.
 * @param now   ISO timestamp to stamp on the verdict (clock-free for tests).
 */
export function moderateText(text: unknown, now: string): ModerationVerdict {
  const base: ModerationVerdict = { status: 'ok', categories: [], score: 0, by: 'heuristic', at: now }
  if (typeof text !== 'string' || !text.trim()) return base

  const sample = text.length > 4000 ? text.slice(0, 4000) : text

  let score = 0
  const categories: ModerationCategory[] = []
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(sample))) {
      categories.push(rule.category)
      score = Math.max(score, rule.weight)
    }
  }

  if (categories.length === 0) return base

  const status: ModerationStatus =
    score >= BLOCK_THRESHOLD ? 'block' : score >= REVIEW_THRESHOLD ? 'review' : 'ok'

  if (status === 'ok') return { ...base, categories, score }

  return {
    status,
    categories,
    score,
    reason: `flagged: ${categories.join(', ')}`,
    by: 'heuristic',
    at: now,
  }
}
