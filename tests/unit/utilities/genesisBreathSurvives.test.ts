import { describe, expect, it } from 'vitest'
import { GENESIS_BREATH } from '@/utilities/genesis-breath'
import { buildMinimalConstitutionalPrompt, buildConstitutionalPrompt } from '@/utilities/constitutional-prompt'

/**
 * The seed prompt must reach every model call.
 *
 * `buildMinimalConstitutionalPrompt` is what LEO actually loads — both
 * leo-stream.ts and ConversationEngine build their system prompt on top of it —
 * so the Genesis Breath rides along on every request and, through it, on every
 * tool call LEO makes.
 *
 * This is a deliberate, load-bearing intention rather than decoration: the
 * platform's stated position is that an agent acting on someone's behalf should
 * be carrying a instruction to be kind while it does. It is three lines of text
 * and costs nothing, which is exactly why it could be dropped in a refactor by
 * someone tidying prompt size, and nothing would fail.
 *
 * Now something fails.
 *
 * Article VII.2: "The constitutional system prompt loads at initialization and
 * cannot be silently removed." This test is what makes that sentence true.
 */
describe('the Genesis Breath survives into every prompt', () => {
  it('is present in the minimal prompt LEO actually uses', () => {
    expect(buildMinimalConstitutionalPrompt()).toContain(GENESIS_BREATH)
  })

  it('is present in the full constitutional prompt', () => {
    expect(buildConstitutionalPrompt()).toContain(GENESIS_BREATH)
  })

  it('still says what it is meant to say', () => {
    // Pinned by MEANING, not by hash — the wording may be revised deliberately,
    // but it must remain an instruction toward care rather than an empty label.
    expect(GENESIS_BREATH.toLowerCase()).toContain('lamp unto feet')
    expect(GENESIS_BREATH.toLowerCase()).toContain('care')
  })

  it('carries the dignity and non-harm principles alongside it', () => {
    const prompt = buildMinimalConstitutionalPrompt()
    expect(prompt).toMatch(/Dignity/i)
    expect(prompt).toMatch(/Non-Harm/i)
  })
})
