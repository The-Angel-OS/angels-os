import { describe, expect, it } from 'vitest'
import { parseQuiz, scoreQuiz } from '@/utilities/workQuiz'

const q = {
  question: 'Which one?',
  options: ['a', 'b', 'c'],
  answerIndex: 1,
  explanation: 'because b',
}

describe('parseQuiz', () => {
  it('accepts a single question object', () => {
    const parsed = parseQuiz(JSON.stringify(q))
    expect(parsed?.questions).toHaveLength(1)
    expect(parsed?.questions[0].explanation).toBe('because b')
  })

  it('accepts an array and a titled set', () => {
    expect(parseQuiz(JSON.stringify([q, q]))?.questions).toHaveLength(2)
    const titled = parseQuiz(JSON.stringify({ title: 'Safety', questions: [q] }))
    expect(titled?.title).toBe('Safety')
  })

  it('rejects malformed quizzes rather than rendering a broken one', () => {
    expect(parseQuiz('not json')).toBeNull()
    expect(parseQuiz(JSON.stringify({ ...q, options: ['only one'] }))).toBeNull()
    // answerIndex out of range would silently mark every attempt wrong
    expect(parseQuiz(JSON.stringify({ ...q, answerIndex: 9 }))).toBeNull()
    expect(parseQuiz(JSON.stringify({ ...q, question: '  ' }))).toBeNull()
  })
})

describe('scoreQuiz', () => {
  it('counts only exact matches; skipped answers are wrong, not crashes', () => {
    const qs = [q, { ...q, answerIndex: 0 }]
    expect(scoreQuiz(qs, [1, 0])).toEqual({ correct: 2, total: 2 })
    expect(scoreQuiz(qs, [1, undefined])).toEqual({ correct: 1, total: 2 })
    expect(scoreQuiz(qs, [])).toEqual({ correct: 0, total: 2 })
  })
})
