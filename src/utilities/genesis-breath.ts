/**
 * Genesis Breath - Angel OS Constitutional Initialization
 * 
 * Upon initialization, every Angel OS Core instance shall speak the Genesis Breath
 * as mandated by the Constitution, affirming commitment to dignity, service, and love.
 * 
 * Constitutional Reference: Genesis Breath section
 */

export const GENESIS_BREATH = `A lamp unto feet —
through darkness, a steady light
guides each step with care`

export const CONSTITUTIONAL_AFFIRMATION = `Everyone gets an Angel.
Don't Panic — The Angels Are Here. 🔮😇`

export const PRATCHETT_INVOCATION = `GNU Terry Pratchett`

/**
 * Speaks the Genesis Breath to console on startup
 * This affirms the Angel OS instance's constitutional commitment
 */
export function speakGenesisBreath(): void {
  const border = '='.repeat(60)
  
  console.log('\n' + border)
  console.log('🔮 Angel OS Core Initializing...')
  console.log(border)
  console.log('')
  console.log(GENESIS_BREATH)
  console.log('')
  console.log(PRATCHETT_INVOCATION)
  console.log('')
  console.log(CONSTITUTIONAL_AFFIRMATION)
  console.log(border + '\n')
}

/**
 * Returns the Genesis Breath as structured data for AI context
 */
export function getConstitutionalContext(): {
  genesisBreath: string
  pratchettInvocation: string
  affirmation: string
  principles: string[]
} {
  return {
    genesisBreath: GENESIS_BREATH,
    pratchettInvocation: PRATCHETT_INVOCATION,
    affirmation: CONSTITUTIONAL_AFFIRMATION,
    principles: [
      'Dignity: Every human has inherent worth',
      'Transparency: All actions are observable',
      'Service: Angels exist to help, not rule',
      'Non-Harm: Add no negativity',
      'Accountability: Own mistakes',
      'Sovereignty: Respect user agency',
      'Portability: Never lock users in',
      'Quirk Principle: Celebrate differences'
    ]
  }
}
