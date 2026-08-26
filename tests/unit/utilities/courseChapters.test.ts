/**
 * A lesson is a chapter with a video; a module is a text field on the row.
 * Flat storage, two-level rail — the round trip has to survive that.
 */
import { describe, it, expect } from 'vitest'
import { courseFromChapters, chaptersFromCourse } from '@/utilities/courseChapters'

describe('courseChapters', () => {
  it('groups consecutive chapters sharing a module', () => {
    const course = courseFromChapters([
      { order: 0, module: 'Basics', title: 'One' },
      { order: 1, module: 'Basics', title: 'Two', video: 'https://v/2' },
      { order: 2, module: 'Advanced', title: 'Three', body: '# three' },
    ])
    expect(course.modules.map((m) => m.title)).toEqual(['Basics', 'Advanced'])
    expect(course.modules[0].lessons).toHaveLength(2)
    expect(course.modules[0].lessons[1].video).toBe('https://v/2')
    expect(course.modules[1].lessons[0].body).toBe('# three')
  })

  it('sorts by order, not by arrival', () => {
    const course = courseFromChapters([
      { order: 2, module: 'A', title: 'Third' },
      { order: 0, module: 'A', title: 'First' },
      { order: 1, module: 'A', title: 'Second' },
    ])
    expect(course.modules[0].lessons.map((l) => l.title)).toEqual(['First', 'Second', 'Third'])
  })

  it('numbers order sequentially across the WHOLE course, not per module', () => {
    const rows = chaptersFromCourse({
      modules: [
        { title: 'A', lessons: [{ title: 'a1' }, { title: 'a2' }] },
        { title: 'B', lessons: [{ title: 'b1' }] },
      ],
    })
    expect(rows.map((r) => r.order)).toEqual([0, 1, 2])
    expect(rows.map((r) => r.module)).toEqual(['A', 'A', 'B'])
  })

  it('round-trips a course through rows unchanged', () => {
    const course = {
      modules: [
        { title: 'Basics', lessons: [{ title: 'One' }, { title: 'Two', video: 'https://v/2' }] },
        { title: 'Advanced', lessons: [{ title: 'Three', body: '# three' }] },
      ],
    }
    expect(courseFromChapters(chaptersFromCourse(course))).toEqual(course)
  })

  it('files chapters with no module under one default module', () => {
    const course = courseFromChapters([{ order: 0, title: 'Only' }])
    expect(course.modules).toHaveLength(1)
    expect(course.modules[0].title).toBe('Course')
  })

  it('is empty, not broken, for a Work with no chapters', () => {
    expect(courseFromChapters([])).toEqual({ modules: [] })
  })
})
