import { expect, it } from 'vitest'
import { evidenceSegments } from '@/modules/capturas/voiceEvidence'
it('highlights only exact evidence spans and preserves all transcript characters', () => {
  const text = 'Silla azul, no roja'
  const parts = evidenceSegments(text, [
    { start: 6, end: 10, text: 'azul', decision: 'ACCEPTED' },
    { start: 15, end: 19, text: 'roja', decision: 'REJECTED' },
    { start: 0, end: 5, text: 'Mesa', decision: 'ACCEPTED' },
  ])
  expect(parts.map((p) => p.text).join('')).toBe(text)
  expect(parts.filter((p) => p.decision)).toEqual([
    { text: 'azul', decision: 'ACCEPTED', reason: '' },
    { text: 'roja', decision: 'REJECTED', reason: '' },
  ])
})
