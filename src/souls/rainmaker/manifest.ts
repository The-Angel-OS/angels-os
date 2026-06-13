// src/souls/rainmaker/manifest.ts
// Rainmaker case file — document manifest for the soul viewer

export interface SoulDoc {
  id: string
  filename: string
  title: string
  date: string
  description: string
  badge?: string
  badgeColor?: string
  tier: 'index' | 'status' | 'legal' | 'evidence' | 'forensics' | 'contacts' | 'historical' | 'action' | 'chapter'
  /** Optional per-section banner — drives this chapter's deep-link OG unfurl. */
  image?: string
}

/**
 * Canonical-root declaration for a Work. When set, this Work is canonical at the
 * publishing endeavor's root — the single indexed source of truth. The reader
 * emits rel=canonical to `origin` even when served from a subscriber's domain, so
 * SEO/authority flow home to the publisher (publish-once-canonical). When unset,
 * the Work falls back to self-canonical at the serving origin (legacy behavior).
 */
export interface SoulCanonical {
  /** Canonical origin, e.g. "https://wheredideveryonego.spacesangels.com" (no trailing slash). */
  origin: string
  /** Owner-of-record: the publishing endeavor's slug (metadata; `origin` drives the URL). */
  endeavor?: string
  /**
   * Author of record — the user (email) credited for this Work, shown as the
   * byline and used for attribution/royalty accounting. This is the manifest
   * DEFAULT; a runtime override may be set per-deployment via the Setting bag
   * (see resolveWorkAttribution). e.g. "billthecat1022@gmail.com".
   */
  creditedTo?: string
}

export interface SoulManifest {
  id: string
  title: string
  subtitle: string
  description: string
  status: string
  statusColor: string
  tags: string[]
  defaultDoc: string
  docs: SoulDoc[]
  links?: { label: string; url: string }[]
  /** Canonical publishing root — see SoulCanonical. Unset ⇒ self-canonical. */
  canonical?: SoulCanonical
  /**
   * If set, this work is a paged book — the reader loads
   * public/library/<bookSlug>/manifest.json and renders <BookReader>
   * (the illustrated-primer reader) instead of the markdown doc viewer.
   */
  bookSlug?: string
}

export const rainmakerManifest: SoulManifest = {
  id: 'rainmaker',
  // Canonical to Clearwater Cruisin (Ken & Ty's endeavor). Adjust origin if a
  // custom domain replaces the spacesangels subdomain.
  canonical: { origin: 'https://clearwater-cruisin.spacesangels.com', endeavor: 'clearwater-cruisin', creditedTo: 'kenneth.courtney@gmail.com' },
  title: 'THE RAINMAKER',
  subtitle: 'Hilkert v. Courtney et al. — Pinellas County, FL',
  description:
    'Class-action case file. A 9-year pattern of utility fraud, habitability violations, and retaliatory eviction against disabled veterans and Section 8 tenants — documented, proven, and filed for restorative justice.',
  status: 'ACTIVE — ASSET FLIGHT RISK',
  statusColor: 'red',
  tags: ['legal', 'housing', 'veteran', 'class-action', 'florida', 'clearwater'],
  defaultDoc: 'readme',
  docs: [
    {
      id: 'readme',
      filename: 'README.md',
      title: 'Case File Index',
      date: '2026-05-03',
      description: 'Overview, parties, primary evidence links, and document index',
      tier: 'index',
    },
    {
      id: 'status',
      filename: 'STATUS.md',
      title: 'Live Status',
      date: '2026-06-01',
      description: 'Current case status. NEW 2026-06-01: City Code Inspector Reid Ito photographed phantom exhaust vent + spare-room ceiling hole; rent escrow filing 06-02; water-economics mechanism; Ken Egan adverse statement.',
      badge: 'LIVE',
      badgeColor: 'green',
      tier: 'status',
    },
    {
      id: 'ownership',
      filename: 'OWNERSHIP_PROVEN.md',
      title: 'Ownership Proven',
      date: '2026-05-23',
      description: 'Public-records proof of LLC/family structure + $2.7M sale listing. Asset flight risk.',
      badge: '🚨 CRITICAL',
      badgeColor: 'red',
      tier: 'legal',
    },
    {
      id: 'counts',
      filename: 'COUNTS_MATRIX.md',
      title: 'Counts Matrix',
      date: '2026-05-21',
      description: 'All 9 counts + 4 adjacent with statutory citations, evidence, and damages vectors',
      tier: 'legal',
    },
    {
      id: 'damages',
      filename: 'DAMAGES_SCHEDULE.md',
      title: 'Damages Schedule',
      date: '2026-05-21',
      description: 'Per-tenant and class-wide damages tally. Unit 13 base $224K+, class total $20.9M-$22M',
      tier: 'legal',
    },
    {
      id: 'evidence',
      filename: 'EVIDENCE_CATALOG.md',
      title: 'Evidence Catalog',
      date: '2026-05-21',
      description: 'Photo/video evidence cross-referenced to counts. 68 photos, chemical inventory, checklist',
      tier: 'evidence',
    },
    {
      id: 'addendum26',
      filename: 'v2.6_260527_evidence_addendum.md',
      title: 'Evidence Addendum v2.6',
      date: '2026-05-27',
      description: 'Counts 13-15: retaliation PERFECTED (26-day timeline May 1 → May 27), building-wide concealment fraud, fraudulent inducement of tenancy. Class damages now $22M-$23.5M / RICO treble $66M-$70.5M.',
      badge: '🚨 BREAKING',
      badgeColor: 'red',
      tier: 'evidence',
    },
    {
      id: 'forensics',
      filename: 'UNIT_FORENSICS.md',
      title: 'Unit Forensics Map',
      date: '2026-05-27',
      description: 'Building-wide unit-by-unit map of in-unit laundry hookup decommissioning. Witness rows: Robert, Charles & Sherry (Vietnam Marine vet), Don & Kathy (Army vet + Native American). Forensic stack: PCPAO, Sunbiz, Building Dept permits.',
      badge: 'LIVE',
      badgeColor: 'orange',
      tier: 'forensics',
    },
    {
      id: 'csc',
      filename: 'CSC_DEMAND_LETTER.md',
      title: 'CSC ServiceWorks Demand',
      date: '2026-05-27',
      description: 'Demand letter to CSC ServiceWorks: service failure, water cost-shifting, 14-day cure window, escalation to FL AG / FTC / BBB / Tampa Bay Times. Names all five Hilkert/Kistner LLCs for revenue-share disclosure.',
      tier: 'action',
    },
    {
      id: 'foia',
      filename: 'FOIA_PINELLAS_PERMITS.md',
      title: 'FOIA — Pinellas Permits',
      date: '2026-05-27',
      description: 'Public records request to Pinellas County Building Dept: original construction permits, renovation history, laundry-room contractor identification, in-unit cover-over permit search. Parallel requests to Clearwater Code Enforcement + Utilities.',
      tier: 'action',
    },
    {
      id: 'witness',
      filename: 'WITNESS_INTAKE.md',
      title: 'Witness Intake Template',
      date: '2026-05-27',
      description: 'Standardized intake form for neighbor witness statements. Consent-first protocol. Protected-class capture with explicit opt-in. Filing protocol with hash-verified evidence preservation.',
      tier: 'action',
    },
    {
      id: 'addendum25',
      filename: 'v2.5_260524_evidence_addendum.md',
      title: 'Evidence Addendum v2.5',
      date: '2026-05-24',
      description: 'Counts 10–12: cross-building water meter fraud (now temporally bounded), discriminatory maintenance differential, unsecured laundry room.',
      tier: 'evidence',
    },
    {
      id: 'addendum',
      filename: 'v2.4_evidence_addendum.md',
      title: 'Evidence Addendum v2.4',
      date: '2026-05-21',
      description: 'Counts 6–9: knob-and-tube electrical, coin-to-app laundry lockout, irrigation diversion, vent decommissioning',
      tier: 'evidence',
    },
    {
      id: 'contacts',
      filename: 'CONTACTS.md',
      title: 'Contacts & Outreach',
      date: '2026-05-23',
      description: 'Legal aid, regulatory agencies, national firms, investigative journalism — tiered by priority',
      tier: 'contacts',
    },
    {
      id: 'rico',
      filename: 'RICO_ADDENDUM.md',
      title: 'RICO & Civil Conspiracy',
      date: '2026-05-23',
      description: 'Federal RICO enterprise mapping, predicate acts (108+ wire fraud), treble damages ($62.7M–$66M), lis pendens timing, and discovery target list.',
      badge: 'FEDERAL',
      badgeColor: 'purple',
      tier: 'legal',
    },
    {
      id: 'brief',
      filename: 'v2.3_260503_master_brief.md',
      title: 'Master Brief v2.3',
      date: '2026-05-03',
      description: 'Original 12-section class-action demand. For counsel intake.',
      tier: 'historical',
    },
    {
      id: 'demand',
      filename: 'v2.3_260504_class_action_demand.md',
      title: 'Class Action Demand v2.3',
      date: '2026-05-04',
      description: 'Class-action demand version with putative class definition',
      tier: 'historical',
    },
  ],
  links: [
    {
      label: 'Google Photos Evidence Album',
      url: 'https://photos.app.goo.gl/bWrXxk1G1eAyxUCT6',
    },
    {
      label: 'YouTube — Mirror Unit 2560 Harn',
      url: 'https://youtu.be/9DQomkBqXAI',
    },
    {
      label: 'Clearwater Cruisin\' Channel',
      url: 'https://www.youtube.com/@ClearwaterCruisin',
    },
  ],
}
