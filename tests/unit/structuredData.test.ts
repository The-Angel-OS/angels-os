import { describe, expect, it } from 'vitest'
import {
  abs,
  articleJsonLd,
  breadcrumbJsonLd,
  eventJsonLd,
  openingHours,
  organizationJsonLd,
  schemaTypeFor,
  websiteJsonLd,
} from '@/utilities/structuredData'

const ORIGIN = 'https://gracechapel.spacesangels.com'

const church = {
  name: 'Grace Chapel',
  businessType: 'church',
  branding: { siteName: 'Grace Chapel', logo: { url: '/media/logo.png' } },
  storefront: {
    description: 'A congregation in Clearwater.',
    contactPhone: '+1-727-555-0100',
    contactEmail: 'hello@gracechapel.org',
    address: { street: '1401 Gulf to Bay Blvd', city: 'Clearwater', region: 'FL', postalCode: '33755' },
    socialLinks: [
      { platform: 'facebook', url: 'https://facebook.com/gracechapel' },
      { platform: 'website', url: 'not-a-url' },
    ],
    businessHours: [
      { day: 'sunday', open: '09:00', close: '12:00' },
      { day: 'monday', open: '', close: '17:00' },
    ],
  },
}

describe('abs', () => {
  it('makes relative URLs absolute and leaves absolute ones alone', () => {
    // A relative image URL in JSON-LD is silently dropped by every consumer.
    expect(abs(ORIGIN, '/media/x.png')).toBe(`${ORIGIN}/media/x.png`)
    expect(abs(ORIGIN, 'https://cdn.example/x.png')).toBe('https://cdn.example/x.png')
    expect(abs(`${ORIGIN}/`, '/x.png')).toBe(`${ORIGIN}/x.png`)
    expect(abs(ORIGIN, null)).toBeUndefined()
  })
})

describe('schemaTypeFor', () => {
  it('prefers the specific type, then falls back honestly', () => {
    expect(schemaTypeFor('church', true)).toBe('Church')
    expect(schemaTypeFor('gym', false)).toBe('ExerciseGym')
    expect(schemaTypeFor('something-new', true)).toBe('LocalBusiness')
    expect(schemaTypeFor(null, false)).toBe('Organization')
  })
})

describe('openingHours', () => {
  it('skips rows that are missing any part rather than emitting a broken one', () => {
    const hours = openingHours([
      { day: 'sunday', open: '09:00', close: '12:00' },
      { day: 'monday', open: '', close: '17:00' },
      { day: 'notaday', open: '09:00', close: '17:00' },
    ])
    expect(hours).toHaveLength(1)
    expect(hours[0].dayOfWeek).toBe('https://schema.org/Sunday')
  })
})

describe('organizationJsonLd', () => {
  it('builds a Church with an address, hours, and only real social URLs', () => {
    const org = organizationJsonLd(church, ORIGIN) as Record<string, any>
    expect(org['@type']).toBe('Church')
    expect(org['@id']).toBe(`${ORIGIN}/#organization`)
    expect(org.address.addressLocality).toBe('Clearwater')
    expect(org.address.addressCountry).toBe('US')
    expect(org.logo).toBe(`${ORIGIN}/media/logo.png`)
    expect(org.openingHoursSpecification).toHaveLength(1)
    expect(org.sameAs).toEqual(['https://facebook.com/gracechapel'])
  })

  it('omits a half-written address instead of emitting a findable-looking one', () => {
    const org = organizationJsonLd(
      { name: 'X', storefront: { address: { country: 'US' } } },
      ORIGIN,
    ) as Record<string, any>
    expect(org.address).toBeUndefined()
    expect(org['@type']).toBe('Organization') // no place → not a LocalBusiness
  })

  it('returns null rather than a name-only stub', () => {
    expect(organizationJsonLd(null, ORIGIN)).toBeNull()
    expect(organizationJsonLd({ name: '' }, ORIGIN)).toBeNull()
  })
})

describe('websiteJsonLd', () => {
  it('only claims a SearchAction when a search route exists to honour it', () => {
    const bare = websiteJsonLd(church, ORIGIN) as Record<string, any>
    expect(bare.potentialAction).toBeUndefined()
    const withSearch = websiteJsonLd(church, ORIGIN, { searchPath: '/search' }) as Record<string, any>
    expect(withSearch.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}')
  })
})

describe('articleJsonLd', () => {
  it('carries dates, an author, and a publisher reference', () => {
    const a = articleJsonLd(
      {
        title: 'A Sunday Note',
        publishedOn: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
        meta: { description: 'Notes', image: { url: '/media/a.jpg' } },
        populatedAuthors: [{ name: 'Ken' }],
      },
      ORIGIN,
      '/posts/a-sunday-note',
    ) as Record<string, any>
    expect(a['@type']).toBe('Article')
    expect(a.image).toBe(`${ORIGIN}/media/a.jpg`)
    expect(a.datePublished).toBe('2026-08-01T10:00:00.000Z')
    expect(a.author[0].name).toBe('Ken')
    expect(a.publisher['@id']).toBe(`${ORIGIN}/#organization`)
  })

  it('falls back to the organisation when a post has no named author', () => {
    const a = articleJsonLd({ title: 'T' }, ORIGIN, '/posts/t') as Record<string, any>
    expect(a.author['@id']).toBe(`${ORIGIN}/#organization`)
  })

  it('truncates a headline past what Google will show', () => {
    const a = articleJsonLd({ title: 'x'.repeat(300) }, ORIGIN, '/posts/x') as Record<string, any>
    expect(a.headline.length).toBe(110)
  })
})

describe('eventJsonLd', () => {
  const base = {
    title: 'Sunday Service',
    startDateTime: '2026-09-06T13:00:00.000Z',
    location: { type: 'physical', venueName: 'Grace Chapel', address: '1401 Gulf to Bay Blvd' },
    pricing: { isFree: true },
  }

  it('emits a valid offline Event with a free Offer', () => {
    const e = eventJsonLd(base, ORIGIN, '/events/sunday-service') as Record<string, any>
    expect(e['@type']).toBe('Event')
    expect(e.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
    expect(e.location['@type']).toBe('Place')
    expect(e.offers.price).toBe('0')
    expect(e.offers.priceCurrency).toBe('USD')
  })

  it('uses a VirtualLocation for an online event', () => {
    const e = eventJsonLd(
      { ...base, location: { type: 'online', remoteLink: 'https://meet.example/x' } },
      ORIGIN,
      '/events/x',
    ) as Record<string, any>
    expect(e.location['@type']).toBe('VirtualLocation')
    expect(e.location.url).toBe('https://meet.example/x')
  })

  it('always has a location, because Google requires one', () => {
    const e = eventJsonLd({ ...base, location: null }, ORIGIN, '/events/x') as Record<string, any>
    expect(e.location).toEqual({ '@id': `${ORIGIN}/#organization` })
  })

  it('returns null without a start date rather than an invalid graph', () => {
    expect(eventJsonLd({ title: 'T' }, ORIGIN, '/events/t')).toBeNull()
  })

  it('marks a cancelled event cancelled', () => {
    const e = eventJsonLd({ ...base, status: 'cancelled' }, ORIGIN, '/events/x') as Record<string, any>
    expect(e.eventStatus).toBe('https://schema.org/EventCancelled')
  })
})

describe('breadcrumbJsonLd', () => {
  it('numbers the trail from one', () => {
    const b = breadcrumbJsonLd(ORIGIN, [
      { name: 'Posts', path: '/posts' },
      { name: 'A Note', path: '/posts/a-note' },
    ]) as Record<string, any>
    expect(b.itemListElement[0].position).toBe(1)
    expect(b.itemListElement[1].item).toBe(`${ORIGIN}/posts/a-note`)
  })

  it('is null for a trail of one', () => {
    expect(breadcrumbJsonLd(ORIGIN, [{ name: 'Home', path: '/' }])).toBeNull()
  })
})
