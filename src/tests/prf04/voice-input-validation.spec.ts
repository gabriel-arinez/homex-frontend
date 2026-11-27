import { describe, expect, it } from 'vitest'
import {
  MAX_RECORD_SECONDS,
  MIN_AUDIO_SECONDS,
  MAX_TRANSCRIPT_CHARACTERS,
  countTranscriptWords,
  validateTranscript,
  validateAudioDuration,
} from '@/modules/capturas/audioLimits'

const words = (n: number) => Array.from({ length: n }, (_, i) => `dato${i}`).join(' ')
describe('commercial voice input bounds', () => {
  it('rejects 14 seconds and accepts 15, 16, 240 and 300 seconds', () => {
    expect(MAX_RECORD_SECONDS).toBe(240)
    expect(MIN_AUDIO_SECONDS).toBe(15)
    expect(validateAudioDuration(14)).toBeTruthy()
    for (const seconds of [15, 16, 240, 300]) expect(validateAudioDuration(seconds)).toBe('')
    expect(validateAudioDuration(301)).toBeTruthy()
    expect(validateAudioDuration(null)).toBeTruthy()
  })
  it('counts commercial numbers and measures but ignores isolated punctuation and spaces', () => {
    expect(countTranscriptWords('  silla  de 18 mm, 1,5 m; 2x3 ... — /  450 Bs. ')).toBe(9)
    expect(countTranscriptWords('  ... —  ')).toBe(0)
  })
  it('accepts partial letter-bearing text without deciding commercial validity', () => {
    for (const text of ['', '   ', '12345', '!!!', '💺'])
      expect(validateTranscript(text)).toBeTruthy()
    for (const text of [
      'á',
      'una mesa',
      'una mesa simple',
      'tres escritorios blancos',
      'un mueble de melamina',
      words(19),
      words(20),
      words(21),
    ])
      expect(validateTranscript(text)).toBe('')
  })
  it('allows 2999/3000 characters but rejects 3001 without changing text', () => {
    expect(MAX_TRANSCRIPT_CHARACTERS).toBe(3000)
    for (const n of [2999, 3000, 3001]) {
      const text = words(20) + 'x'.repeat(n - words(20).length)
      expect(Boolean(validateTranscript(text))).toBe(n > 3000)
      expect(text.length).toBe(n)
    }
  })
})
