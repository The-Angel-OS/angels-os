import { describe, expect, it } from 'vitest'
import { dcfSearchTermFor } from '@/utilities/addressVerification'

/**
 * DCF's search matches provider name / city / ZIP — never a street address.
 * Handing someone their full address to paste returns nothing, which reads
 * exactly like "no daycares nearby". The city is the term that actually lists
 * the in-home providers near them to eyeball.
 */
describe('dcfSearchTermFor', () => {
  it('takes the city out of a full formatted address', () => {
    expect(dcfSearchTermFor('34730 St Joe Rd, Dade City, FL 33525, USA')).toBe('Dade City')
    expect(dcfSearchTermFor('12903 Woodleigh Ave, Tampa, FL 33612, USA')).toBe('Tampa')
  })

  it('falls back to the ZIP when there is no city component', () => {
    expect(dcfSearchTermFor('somewhere 33525')).toBe('33525')
  })

  it('is empty for no address rather than guessing', () => {
    expect(dcfSearchTermFor()).toBe('')
    expect(dcfSearchTermFor('')).toBe('')
  })
})
