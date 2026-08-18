import { describe, it, expect } from 'vitest'
import { buildTenantCss, readableOn } from '@/components/TenantStyles'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const branding = (over: Record<string, unknown> = {}): any => ({
  primaryColor: '#10B981',
  ...over,
})

describe('buildTenantCss', () => {
  it('remaps the shadcn brand tokens so unmodified blocks inherit tenant colour', () => {
    const css = buildTenantCss(branding({ primaryColor: '#C8A16B' }))
    expect(css).toContain('--primary: #C8A16B')
    expect(css).toContain('--ring: #C8A16B')
    expect(css).toContain('--tenant-primary: #C8A16B')
  })

  it('emits the mapping under the dark selector too', () => {
    // globals.css redefines --primary under [data-theme='dark'], so a :root-only
    // rule loses and every dark portal silently keeps the stock palette.
    const css = buildTenantCss(branding({ primaryColor: '#C8A16B' }))
    const dark = css.slice(css.indexOf("[data-theme='dark']"))
    expect(dark).toContain('--primary: #C8A16B')
  })

  it('leaves --secondary and --accent alone (they are surface tokens, not brand)', () => {
    const css = buildTenantCss(branding({ secondaryColor: '#0078D4', accentColor: '#FF6B35' }))
    expect(css).not.toMatch(/^\s*--secondary:/m)
    expect(css).not.toMatch(/^\s*--accent:/m)
    expect(css).toContain('--tenant-secondary: #0078D4')
  })

  it('drops a branding value that is not a plain hex colour', () => {
    const css = buildTenantCss(branding({ primaryColor: 'red; } body { display: none' }))
    expect(css).not.toContain('display: none')
    expect(css).toContain('--primary: #10B981')
  })

  it('picks a foreground that is actually readable on the brand colour', () => {
    expect(readableOn('#FFFFFF')).toBe('#111111')
    expect(readableOn('#000000')).toBe('#FFFFFF')
    expect(readableOn('#C8A16B')).toBe('#111111') // mid gold cannot carry white
    expect(readableOn('#1F2937')).toBe('#FFFFFF') // the slate trades pair with
    // #0078D4 lands at L 0.1815, a hair over the 0.179 crossover — 4.63:1 on
    // black vs 4.54:1 on white. Genuinely a coin flip; pinned so a threshold
    // change is a deliberate one.
    expect(readableOn('#0078D4')).toBe('#111111')
    expect(readableOn('#fff')).toBe('#111111') // 3-digit shorthand
  })
})
