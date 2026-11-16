import { describe, expect, it } from 'vitest'
import {
  MAX_RECORD_SECONDS,
  MIN_AUDIO_SECONDS,
  MAX_TRANSCRIPT_CHARACTERS,
  validateTranscript,
  validateAudioDuration,
} from '@/modules/capturas/audioLimits'

describe('staged voice input bounds', () => {
  it('uses four minutes for recordings and two seconds as the minimum', () => {
    expect(MAX_RECORD_SECONDS).toBe(240)
    expect(MIN_AUDIO_SECONDS).toBe(2)
    expect(validateAudioDuration(1.99)).toBeTruthy()
    expect(validateAudioDuration(2)).toBe('')
    expect(validateAudioDuration(300)).toBe('')
    expect(validateAudioDuration(301)).toBeTruthy()
  })
  it('allows brief commercial text without inventing commercial validation in the browser', () => {
    expect(validateTranscript('silla plegable')).toBe('')
    expect(validateTranscript('hola buenas')).toBe('')
    for (const text of ['', '   ', '123 456', '...']) expect(validateTranscript(text)).toBeTruthy()
    expect(validateTranscript('a'.repeat(MAX_TRANSCRIPT_CHARACTERS))).toBe('')
    expect(validateTranscript('a'.repeat(MAX_TRANSCRIPT_CHARACTERS + 1))).toBeTruthy()
  })
})
