import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PropuestaConfigurador } from '@/generated/api'
import { reviewProjection } from '@/modules/capturas/reviewProjection'

const proposal = (dimensions: Record<string, unknown>) =>
  ({
    comercial: {
      nombre: 'Desk',
      cantidad: 1,
      unidad_codigo: 'PIEZA',
      precio_unitario: '10.00',
      descuento: null,
    },
    especificacion: {
      tipo_mueble: null,
      observaciones: null,
      datos_tecnicos: { componentes: [], caracteristicas_generales: { dimensiones: dimensions } },
    },
    pendientes: [],
  }) as PropuestaConfigurador

describe('lossless review dimensions', () => {
  it.each([
    [
      'metadata',
      { ancho: { valor: '160', unidad: 'cm', tolerancia: '2 mm' } },
      { ancho: { valor: '160', unidad: 'cm', tolerancia: '2 mm' } },
    ],
    [
      'unresolved unit',
      { alto: { valor: '75', unidad: null } },
      { alto: { valor: '75', unidad: null } },
    ],
    ['numeric value', { ancho: { valor: 160, unidad: 'cm' } }, { ancho: '160 cm' }],
    ['unknown shape', { alto: { valor: '75', unidad: 3 } }, { alto: { valor: '75', unidad: 3 } }],
    [
      'existing string and plain object',
      { ancho: '160 cm', alto: { valor: '75', unidad: 'cm' } },
      { ancho: '160 cm', alto: '75 cm' },
    ],
  ])(
    'preserves %s identically in both confirmation representations',
    (_name, original, expected) => {
      const input = proposal(original)
      const before = JSON.stringify(input)
      const result = reviewProjection(input)
      expect(result.dimensions).toEqual(expected)
      expect(
        (result.technical as { caracteristicas_generales: { dimensiones: unknown } })
          .caracteristicas_generales.dimensiones,
      ).toEqual(expected)
      expect(JSON.stringify(input)).toBe(before)
    },
  )
})

it('pins both CI consumers to the coordinated backend while allowing the same explicit override', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  const pin =
    "ref: ${{ inputs.integration_peer_ref || '78f3bd8ed55bf49307399c9946f3eeb19322aed8' }}"
  expect(workflow.split(pin)).toHaveLength(3)
  expect(readFileSync('contracts/backend-ref.txt', 'utf8').trim()).toBe(
    '78f3bd8ed55bf49307399c9946f3eeb19322aed8',
  )
})
