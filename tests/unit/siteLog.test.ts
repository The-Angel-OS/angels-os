import { describe, it, expect } from 'vitest'
import {
  parseUserAgent,
  referrerHostOf,
  isVisitPath,
  visitorHashOf,
} from '@/utilities/recordSiteVisit'
import { buildAggregateSql, clampDays, REPORT_TYPES } from '@/endpoints/site-log-report'

describe('isVisitPath — only pages a person read', () => {
  it.each(['/', '/about', '/posts/my-post', '/book'])('records %s', (p) => {
    expect(isVisitPath(p)).toBe(true)
  })

  it.each([
    '/api/health',
    '/admin/collections/posts',
    '/dashboard',
    '/dashboard/admin/site-log',
    '/_next/static/chunk.js',
    '/next/preview',
    '/favicon.ico',
    '/logo.png',
    '/styles.css',
  ])('ignores %s', (p) => {
    expect(isVisitPath(p)).toBe(false)
  })

  it('does not treat a prefix collision as internal', () => {
    // "/apiary" is a page; "/api" is not.
    expect(isVisitPath('/apiary')).toBe(true)
    expect(isVisitPath('/administration')).toBe(true)
  })

  it('rejects anything that is not a path', () => {
    expect(isVisitPath('https://evil.test/x')).toBe(false)
  })
})

describe('parseUserAgent', () => {
  it('reads Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
    expect(parseUserAgent(ua)).toMatchObject({
      browser: 'Chrome',
      os: 'Windows',
      device: 'desktop',
      isBot: false,
    })
  })

  it('does not call Edge "Chrome"', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36 Edg/120.0'
    expect(parseUserAgent(ua).browser).toBe('Edge')
  })

  it('does not call Chrome "Safari"', () => {
    const ua = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
    expect(parseUserAgent(ua)).toMatchObject({ browser: 'Chrome', os: 'macOS' })
  })

  it('reads Safari on iPhone as mobile', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Safari/604.1'
    expect(parseUserAgent(ua)).toMatchObject({ browser: 'Safari', os: 'iOS', device: 'mobile' })
  })

  it('flags crawlers', () => {
    expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)')).toMatchObject({
      isBot: true,
      device: 'bot',
    })
    expect(parseUserAgent('curl/8.0').isBot).toBe(true)
  })
})

describe('referrerHostOf', () => {
  it('keeps only the domain', () => {
    expect(referrerHostOf('https://www.google.com/search?q=x')).toBe('www.google.com')
  })
  it.each([null, undefined, '', 'not a url'])('returns undefined for %j', (r) => {
    expect(referrerHostOf(r as string | null)).toBeUndefined()
  })
})

describe('visitorHashOf — counts people without identifying them', () => {
  const ip = '203.0.113.5'
  const ua = 'Mozilla/5.0'

  it('is stable for the same visitor on the same day', () => {
    const day = new Date('2026-08-20T01:00:00Z')
    expect(visitorHashOf(ip, ua, day)).toBe(visitorHashOf(ip, ua, new Date('2026-08-20T23:00:00Z')))
  })

  it('rotates the next day, so yesterday cannot be linked to today', () => {
    expect(visitorHashOf(ip, ua, new Date('2026-08-20T00:00:00Z'))).not.toBe(
      visitorHashOf(ip, ua, new Date('2026-08-21T00:00:00Z')),
    )
  })

  it('separates two visitors', () => {
    const day = new Date('2026-08-20T00:00:00Z')
    expect(visitorHashOf(ip, ua, day)).not.toBe(visitorHashOf('198.51.100.9', ua, day))
  })

  it('never contains the IP it was built from', () => {
    expect(visitorHashOf(ip, ua)).not.toContain('203')
  })
})

describe('site-log report SQL', () => {
  const aggregates = REPORT_TYPES.filter((t) => t !== 'detail') as Array<
    Exclude<(typeof REPORT_TYPES)[number], 'detail'>
  >

  it.each(aggregates)('%s scopes to one tenant and a date window', (type) => {
    const sql = buildAggregateSql(type, false)
    expect(sql).toContain('tenant_id = $1')
    expect(sql).toContain('created_at >= $2')
    expect(sql).toContain('LIMIT $3')
  })

  it.each(aggregates)('%s hides crawlers by default and shows them on request', (type) => {
    expect(buildAggregateSql(type, false)).toContain('is_bot IS NOT TRUE')
    expect(buildAggregateSql(type, true)).not.toContain('is_bot IS NOT TRUE')
  })

  it('interpolates nothing a caller could supply', () => {
    // Only $1/$2/$3 placeholders carry values — no string concatenation of input.
    for (const type of aggregates) {
      const sql = buildAggregateSql(type, false)
      expect(sql).not.toMatch(/\$\{/)
    }
  })
})

describe('clampDays', () => {
  it('defaults on junk', () => {
    expect(clampDays(null)).toBe(30)
    expect(clampDays('abc')).toBe(30)
    expect(clampDays('-5')).toBe(30)
  })
  it('caps a request for everything', () => {
    expect(clampDays('99999')).toBe(365)
  })
  it('honours a sane value', () => {
    expect(clampDays('7')).toBe(7)
  })
})
