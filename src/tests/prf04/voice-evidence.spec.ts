import { expect, it } from 'vitest'
import {
  buildFurnitureTranscriptEvidence,
  evidenceSegments,
} from '@/modules/capturas/voiceEvidence'

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

it('does not mark unidentified context words as REJECTED', () => {
  const transcript = 'Necesito cotizar un escritorio ejecutivo de melamina blanca para gerencia'
  const evidence = buildFurnitureTranscriptEvidence(transcript, {
    comercial: { nombre: 'Escritorio ejecutivo', cantidad: 1, precio_unitario: null, descuento: 0 },
    especificacion: {
      datos_tecnicos: {
        componentes: [{ nombre: 'Estructura', material: 'melamina', color: 'blanca' }],
      },
    },
  } as never)
  expect(evidence.some((e) => e.decision === 'REJECTED')).toBe(false)
  const segments = evidenceSegments(transcript, evidence)
  expect(segments.find((s) => s.text.includes('gerencia'))?.decision).toBeUndefined()
  expect(segments.find((s) => s.text.toLowerCase() === 'melamina')?.category).toBe('structure')
})

it('prioritizes original NLP candidate positions and updates highlights on human review', () => {
  const transcript = '2 escritorios de 180 cm con 2 puertas en 1500 bs'
  const candidatos = [
    {
      candidate_id: 'c1',
      label: 'CANTIDAD',
      start: 0,
      end: 1,
      text: '2',
      decision: 'ACCEPTED',
    },
    {
      candidate_id: 'c2',
      label: 'ANCHO',
      start: 17,
      end: 23,
      text: '180 cm',
      decision: 'ACCEPTED',
    },
    {
      candidate_id: 'c3',
      label: 'PRECIO_UNITARIO',
      start: 41,
      end: 48,
      text: '1500 bs',
      decision: 'UNRESOLVED',
      reason: 'Confirmar precio unitario',
    },
  ]
  const unresolved = buildFurnitureTranscriptEvidence(transcript, null, [], candidatos, [])
  expect(unresolved.find((e) => e.text === '1500 bs')?.category).toBe('conflict')
  expect(unresolved.find((e) => e.text === '180 cm')?.category).toBe('dimensions')
  // Bare '2' inside '2 puertas' must not be falsely claimed as CANTIDAD
  expect(unresolved.filter((e) => e.text === '2')).toHaveLength(1)

  const resolved = buildFurnitureTranscriptEvidence(transcript, null, [], candidatos, [
    { field: 'precio_unitario', state: 'reviewed' },
  ])
  expect(resolved.find((e) => e.text === '1500 bs')?.category).toBe('commercial')
  expect(resolved.find((e) => e.text === '1500 bs')?.resolved).toBe(true)
})
