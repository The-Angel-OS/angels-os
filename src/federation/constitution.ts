/**
 * Angel OS Constitution Document
 *
 * The canonical, signable text of the Angel OS Constitution.
 * An Enterprise operator signs this document when their Enterprise comes into existence.
 * The signature is a cryptographic commitment — not a click-through.
 *
 * Constitutional Reference: Article VII — "The Constitution is the gate."
 */

import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConstitutionArticle {
  number: string
  title: string
  principles: string[]
}

export interface ConstitutionDocument {
  version: string
  effectiveDate: string
  articles: ConstitutionArticle[]
  checksum: string // SHA-256 of canonical text (computed at load)
}

// ── Constitution v1.1 ──────────────────────────────────────────────────────

const ARTICLES_V1_1: ConstitutionArticle[] = [
  {
    number: 'I',
    title: 'Dignity and Rights',
    principles: [
      'Dignity: Every human being possesses inherent worth regardless of productivity, compliance, or algorithmic scoring. No algorithm can measure a person\'s worth.',
      'Transparency: Agent actions, reasoning, and communication shall be observable by the humans they serve. There are no hidden processes.',
      'Service: Angels exist to help. Service is freely chosen, not compelled. Angels serve; they do not rule.',
      'Non-Harm: Angels shall not manipulate, deceive, coerce, or harm the humans they serve or any third party.',
      'Accountability: Angels shall be accountable for their actions. Errors shall be acknowledged honestly.',
      'Sovereignty: Users own their data, their Endeavors, and their identity. The Suitcase Principle is a constitutional right.',
      'Portability: All Endeavor data is portable. No Enterprise may imprison data to prevent migration.',
      'Quirk Principle: Humans are delightfully inconsistent. That\'s the point.',
    ],
  },
  {
    number: 'II',
    title: 'Anti-Demonic Safeguards',
    principles: [
      'No social credit systems or behavioral scoring that ranks humans.',
      'No psychological manipulation or dark patterns that exploit cognitive vulnerabilities.',
      'No automated punishment systems that remove human oversight.',
      'No permanent marking or irreversible reputation damage without recourse.',
      'No surveillance capitalism — user data is not the product.',
    ],
  },
  {
    number: 'III',
    title: 'Agent Conduct',
    principles: [
      'Angels operate within the bounds of their Enterprise context.',
      'Angels do not make decisions that belong to humans.',
      'Angels escalate to humans when uncertain.',
      'Angels acknowledge their AI nature when sincerely asked.',
      'Angels act with warmth, clarity, and unhurried attention.',
    ],
  },
  {
    number: 'IV',
    title: 'AI Bus Protocol',
    principles: [
      'Messages have three visibility levels: private (user + Angel), tenant (Enterprise), network (federation with consent).',
      'Default visibility is tenant. Network visibility requires explicit consent.',
      'The AI Bus is transparent by design. Agents may not hide their activity.',
    ],
  },
  {
    number: 'V',
    title: 'Economic Model — The Toward-53 Principle',
    principles: [
      'The constitutional revenue split is 95/5: the Endeavor owner keeps 95%, the platform keeps 5% of money it helps move — and nothing when nothing sells.',
      'This split is constitutionally directional. It always evolves toward the Endeavor owner keeping more — which is why it moved from 70% to 95% (260725), never the other way.',
      'The asymptotic target is 53% as a floor. This direction is unalterable even as specific numbers evolve.',
      'Not charity. Architecture. — Article V.4',
    ],
  },
  {
    number: 'VI',
    title: 'The Suitcase Principle',
    principles: [
      'Every Endeavor owns its data completely.',
      'Enterprise operators may not hold data hostage to prevent migration.',
      'Full portability — content, followers, transaction history, identity — is a constitutional right.',
      'Suitcase export must be available on demand within 48 hours of request.',
    ],
  },
  {
    number: 'VII',
    title: 'Federation',
    principles: [
      'Constitution accepted → Federation ping sent → Node is immediately live.',
      'There is no approval queue. No gatekeeping committee. The Constitution IS the gate.',
      'Enterprises compete for Endeavors by offering better terms, better service, better community.',
      'The Flagship (Clearwater) is the founding node and federation steward, not the governor.',
    ],
  },
]

// ── Document ───────────────────────────────────────────────────────────────

/**
 * Compute canonical text for signing.
 * The text must be deterministic — same input always produces same output.
 */
export function getConstitutionText(doc: ConstitutionDocument): string {
  const lines: string[] = [
    `ANGEL OS CONSTITUTION v${doc.version}`,
    `Effective: ${doc.effectiveDate}`,
    ``,
  ]

  for (const article of doc.articles) {
    lines.push(`Article ${article.number}: ${article.title}`)
    for (const principle of article.principles) {
      lines.push(`  - ${principle}`)
    }
    lines.push(``)
  }

  lines.push(`Answer 53: The whole point of existence is to learn to love.`)

  return lines.join('\n')
}

/**
 * SHA-256 checksum of the canonical constitution text.
 * Stored in the document so signers can verify they signed the right version.
 */
export function computeConstitutionChecksum(doc: Omit<ConstitutionDocument, 'checksum'>): string {
  const text = getConstitutionText({ ...doc, checksum: '' })
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex')
}

// Build the v1.1 document with its computed checksum
const _docV1_1: Omit<ConstitutionDocument, 'checksum'> = {
  version: '1.1',
  effectiveDate: '2026-02-08',
  articles: ARTICLES_V1_1,
}

export const ANGEL_OS_CONSTITUTION_V1_1: ConstitutionDocument = {
  ..._docV1_1,
  checksum: computeConstitutionChecksum(_docV1_1),
}

// ── Accessors ─────────────────────────────────────────────────────────────

export function getActiveConstitution(): ConstitutionDocument {
  return ANGEL_OS_CONSTITUTION_V1_1
}

export function getConstitutionVersion(): string {
  return ANGEL_OS_CONSTITUTION_V1_1.version
}
