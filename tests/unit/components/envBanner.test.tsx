import { afterEach, describe, expect, it } from 'vitest'

import { EnvBanner } from '@/components/EnvBanner'

afterEach(() => {
  delete process.env.ENV_LABEL
  delete process.env.ENV_LABEL_COLOR
})

describe('EnvBanner', () => {
  it('renders nothing when ENV_LABEL is unset — production stays unlabelled', () => {
    expect(EnvBanner()).toBeNull()
    process.env.ENV_LABEL = '   '
    expect(EnvBanner()).toBeNull()
  })

  it('renders the label, and the colour is overridable', () => {
    process.env.ENV_LABEL = 'Local laptop'
    const el = EnvBanner() as { props: { children: string; style: { background: string } } }
    expect(el.props.children).toBe('Local laptop')
    expect(el.props.style.background).toBe('#b45309')

    process.env.ENV_LABEL_COLOR = '#7c3aed'
    const purple = EnvBanner() as { props: { style: { background: string } } }
    expect(purple.props.style.background).toBe('#7c3aed')
  })
})
