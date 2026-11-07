import { describe, expect, it } from 'vitest'
import { dateRangeError, isValidDate, localToday } from './dateRange'

describe('date range validation', () => {
  it('validates real calendar dates and local today', () => {
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(localToday(new Date(2026, 10, 6, 23))).toBe('2026-11-06')
  })
  it('rejects reversed and future historical ranges but allows scheduled promotions', () => {
    expect(dateRangeError('2026-11-07', '', '2026-11-06')).toContain('futura')
    expect(dateRangeError('2026-11-05', '2026-11-04')).toContain('posterior')
    expect(dateRangeError('2026-11-07', '2026-11-08')).toBe('')
    expect(dateRangeError('', '2026-11-06', '2026-11-06')).toBe('')
  })
})
