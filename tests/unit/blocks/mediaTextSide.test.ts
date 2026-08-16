/**
 * Side resolution for Media + Text. Three sources feed one decision — the new
 * `side`, the legacy `videoOnRight` column on every pre-existing row, and
 * 'alternate' which depends on position — so this is exactly the logic that
 * flips a whole page's layout without anyone noticing in a diff.
 *
 * Mirrors the expression in Component.tsx; kept in lockstep deliberately rather
 * than exported, because a one-line ternary in a server component is not worth
 * a module boundary.
 */
import { describe, expect, it } from 'vitest'

const mediaRight = (o: {
  side?: 'right' | 'left' | 'alternate' | null
  videoOnRight?: boolean
  blockIndex?: number
}): boolean => {
  const { side, videoOnRight = true, blockIndex = 0 } = o
  return side === 'alternate' ? blockIndex % 2 === 0 : side ? side === 'right' : videoOnRight !== false
}

describe('mediaText side resolution', () => {
  it('honours an explicit side over the legacy column', () => {
    expect(mediaRight({ side: 'left', videoOnRight: true })).toBe(false)
    expect(mediaRight({ side: 'right', videoOnRight: false })).toBe(true)
  })

  it('falls back to videoOnRight for rows written before `side` existed', () => {
    expect(mediaRight({ videoOnRight: true })).toBe(true)
    expect(mediaRight({ videoOnRight: false })).toBe(false)
    // Neither set: the historical default was media on the right.
    expect(mediaRight({})).toBe(true)
  })

  it('alternates on position, ignoring the legacy column entirely', () => {
    const sides = [0, 1, 2, 3].map((blockIndex) =>
      mediaRight({ side: 'alternate', blockIndex, videoOnRight: false }),
    )
    expect(sides).toEqual([true, false, true, false])
  })

  it('treats a null side as unset rather than as a value', () => {
    expect(mediaRight({ side: null, videoOnRight: false })).toBe(false)
  })
})

describe('mediaText playback modes', () => {
  const videoProps = (playback?: string) =>
    playback === 'ambient'
      ? { autoPlay: true, loop: true, muted: true, preload: 'auto' }
      : playback === 'autoplay'
        ? { controls: true, autoPlay: true, muted: true, preload: 'auto' }
        : { controls: true, preload: 'metadata' }

  it('never autoplays with sound', () => {
    for (const mode of ['player', 'autoplay', 'ambient', undefined]) {
      const p = videoProps(mode) as Record<string, unknown>
      if (p.autoPlay) expect(p.muted).toBe(true)
    }
  })

  it('only ambient drops the controls', () => {
    expect(videoProps('ambient')).not.toHaveProperty('controls')
    expect(videoProps('autoplay').controls).toBe(true)
    expect(videoProps('player').controls).toBe(true)
    expect(videoProps(undefined).controls).toBe(true)
  })

  it('defers the file download unless something autoplays', () => {
    expect(videoProps('player').preload).toBe('metadata')
    expect(videoProps('ambient').preload).toBe('auto')
  })
})
