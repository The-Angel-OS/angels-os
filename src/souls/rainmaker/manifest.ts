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
  tier: 'index' | 'status' | 'legal' | 'evidence' | 'contacts' | 'historical'
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
}

export const rainmakerManifest: SoulManifest = {
  id: 'rainmaker',
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
      date: '2026-05-23',
      description: 'Current case status, active contacts, critical-path 7 days',
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
      id: 'addendum25',
      filename: 'v2.5_260524_evidence_addendum.md',
      title: 'Evidence Addendum v2.5',
      date: '2026-05-24',
      description: 'Counts 10–12: cross-building water meter fraud, discriminatory maintenance differential, unsecured laundry room. Class damages revised to $21.5M–$22.5M.',
      badge: '🚨 NEW',
      badgeColor: 'red',
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
