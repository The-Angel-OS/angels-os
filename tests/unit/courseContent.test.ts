import { describe, expect, it } from 'vitest'
import { coursePercent, flattenLessons, normalizeCourse } from '@/utilities/courseContent'

const raw = {
  modules: [
    { title: 'Intro', lessons: [{ title: 'Welcome', video: ' https://x/v.mp4 ' }, { body: '# hi' }] },
    { lessons: [{ title: 'Last' }] },
  ],
}

describe('normalizeCourse', () => {
  it('always yields a usable course — a half-written one must still open', () => {
    expect(normalizeCourse(null)).toEqual({ modules: [] })
    expect(normalizeCourse('not json')).toEqual({ modules: [] })
    expect(normalizeCourse({ modules: 'nope' })).toEqual({ modules: [] })
  })

  it('names the unnamed and trims stored values', () => {
    const c = normalizeCourse(raw)
    expect(c.modules[1].title).toBe('Module 2')
    expect(c.modules[0].lessons[1].title).toBe('Lesson 2')
    expect(c.modules[0].lessons[0].video).toBe('https://x/v.mp4')
    // Empty strings are dropped, not stored as '' — the player tests truthiness.
    expect(c.modules[0].lessons[0].body).toBeUndefined()
  })

  it('parses a JSON string as well as an object', () => {
    expect(normalizeCourse(JSON.stringify(raw)).modules).toHaveLength(2)
  })
})

describe('flattenLessons / coursePercent', () => {
  it('numbers lessons across modules', () => {
    const flat = flattenLessons(normalizeCourse(raw))
    expect(flat).toHaveLength(3)
    expect(flat[2]).toMatchObject({ title: 'Last', moduleIdx: 1, lessonIdx: 0 })
  })

  it('is 0 rather than NaN for an empty course or an unknown position', () => {
    expect(coursePercent({ modules: [] }, 0, 0)).toBe(0)
    expect(coursePercent(normalizeCourse(raw), 9, 9)).toBe(0)
    expect(coursePercent(normalizeCourse(raw), 1, 0)).toBe(100)
  })
})
