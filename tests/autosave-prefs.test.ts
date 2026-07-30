import { describe, it, expect } from 'vitest'
import {
  AUTOSAVE_INTERVAL_OPTIONS,
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  clampAutosaveIntervalMinutes
} from '../src/shared/constants/app'

describe('autosave preference helpers', () => {
  it('defaults to 5 minutes', () => {
    expect(DEFAULT_AUTOSAVE_INTERVAL_MINUTES).toBe(5)
  })

  it('exposes options from 1 minute to 1 hour', () => {
    expect(AUTOSAVE_INTERVAL_OPTIONS[0]).toBe(1)
    expect(AUTOSAVE_INTERVAL_OPTIONS[AUTOSAVE_INTERVAL_OPTIONS.length - 1]).toBe(
      60
    )
  })

  it('clamps invalid values to the nearest allowed interval', () => {
    expect(clampAutosaveIntervalMinutes(5)).toBe(5)
    expect(clampAutosaveIntervalMinutes(1)).toBe(1)
    expect(clampAutosaveIntervalMinutes(60)).toBe(60)
    expect(clampAutosaveIntervalMinutes(7)).toBe(5)
    expect(clampAutosaveIntervalMinutes(12)).toBe(10)
    expect(clampAutosaveIntervalMinutes(NaN)).toBe(5)
  })
})
