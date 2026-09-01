import { describe, expect, it } from 'vitest'
import {
  MIN_VISITORS_PER_ARM,
  abVerdict,
  assignVariant,
  isAbVariant,
  normalCdf,
  readVariant,
} from '@/utilities/abVariant'
import { buildVariantsSql, parseGoals } from '@/endpoints/site-log-report'

describe('bucket assignment', () => {
  it('splits on the half', () => {
    expect(assignVariant(0)).toBe('a')
    expect(assignVariant(0.4999)).toBe('a')
    expect(assignVariant(0.5)).toBe('b')
    expect(assignVariant(0.9999)).toBe('b')
  })

  it('rejects anything that is not a bucket', () => {
    // A cookie is visitor-editable, so a third arm must never reach the report.
    expect(isAbVariant('a')).toBe(true)
    expect(readVariant('c')).toBeNull()
    expect(readVariant('')).toBeNull()
    expect(readVariant(undefined)).toBeNull()
    expect(readVariant('a; DROP TABLE')).toBeNull()
  })
})

describe('normalCdf', () => {
  it('matches the known values of the standard normal', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3)
    expect(normalCdf(2.576)).toBeCloseTo(0.995, 3)
  })
})

describe('abVerdict', () => {
  it('refuses to call a result on a small sample', () => {
    // 5/20 vs 1/20 is a 5x "lift" and means nothing. Reporting it as a winner
    // is the single most damaging thing a naive A/B feature can do.
    const v = abVerdict([
      { variant: 'a', visitors: 20, conversions: 1 },
      { variant: 'b', visitors: 20, conversions: 5 },
    ])
    expect(v.significant).toBe(false)
    expect(v.pValue).toBeNull()
    expect(v.note).toContain(String(MIN_VISITORS_PER_ARM))
  })

  it('finds a real difference on a large sample', () => {
    const v = abVerdict([
      { variant: 'a', visitors: 2000, conversions: 100 }, // 5%
      { variant: 'b', visitors: 2000, conversions: 200 }, // 10%
    ])
    expect(v.significant).toBe(true)
    expect(v.pValue).toBeLessThan(0.001)
    expect(v.lift).toBeCloseTo(1, 5)
    expect(v.rates.b).toBeCloseTo(0.1, 6)
  })

  it('does not call a coin flip a winner', () => {
    const v = abVerdict([
      { variant: 'a', visitors: 5000, conversions: 500 },
      { variant: 'b', visitors: 5000, conversions: 505 },
    ])
    expect(v.significant).toBe(false)
    expect(v.pValue).toBeGreaterThan(0.05)
  })

  it('says so when only one arm has traffic', () => {
    const v = abVerdict([{ variant: 'a', visitors: 500, conversions: 50 }])
    expect(v.significant).toBe(false)
    expect(v.note).toMatch(/both variants/i)
  })

  it('survives zero conversions without dividing by zero', () => {
    const v = abVerdict([
      { variant: 'a', visitors: 500, conversions: 0 },
      { variant: 'b', visitors: 500, conversions: 0 },
    ])
    expect(v.significant).toBe(false)
    expect(Number.isNaN(v.pValue ?? 0)).toBe(false)
  })
})

describe('variants report SQL', () => {
  it('never interpolates goal paths — they bind as $3', () => {
    const sql = buildVariantsSql(false)
    expect(sql).toContain('$3::text[]')
    expect(sql).toContain('tenant_id = $1')
    expect(sql).toContain('is_bot IS NOT TRUE')
    // A row that cannot be tied to a person biases the rate; it must be excluded.
    expect(sql).toContain('visitor_hash IS NOT NULL')
  })

  it('drops the tenant filter only for platform scope', () => {
    expect(buildVariantsSql(false, true)).not.toContain('tenant_id = $1')
    expect(buildVariantsSql(true)).not.toContain('is_bot IS NOT TRUE')
  })

  it('parses goals and refuses anything that is not a path', () => {
    expect(parseGoals('/thanks,/done/')).toEqual(['/thanks', '/done'])
    expect(parseGoals('/thanks?utm=x')).toEqual(['/thanks'])
    expect(parseGoals('evil.com')).not.toContain('evil.com')
    expect(parseGoals(null).length).toBeGreaterThan(0)
    expect(parseGoals('/a,/b,/c,/d,/e,/f,/g,/h,/i,/j,/k').length).toBe(10)
  })
})
