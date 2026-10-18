import { describe, expect, it } from 'vitest'
import { normalizeApiError } from '@/shared/api/errors'

describe('PRF-01 mensajes comerciales del backend', () => {
  it('conserva la ubicación de errores anidados por línea y campo', () => {
    const error = normalizeApiError(400, {
      detalles: [
        { precio_unitario: ['Debe ser mayor que cero.'], descuento: ['Descuento inválido.'] },
        {},
        { cantidad: ['La cantidad debe ser positiva.'] },
      ],
      cliente_nuevo: { nombres: ['El nombre es obligatorio.'] },
    })
    expect(error.fields['detalles[0].precio_unitario']).toEqual(['Debe ser mayor que cero.'])
    expect(error.fields['detalles[0].descuento']).toEqual(['Descuento inválido.'])
    expect(error.fields['detalles[2].cantidad']).toEqual(['La cantidad debe ser positiva.'])
    expect(error.fields['cliente_nuevo.nombres']).toEqual(['El nombre es obligatorio.'])
  })

  it('mantiene errores planos y el estado HTTP original', () => {
    const error = normalizeApiError(409, {
      detail: 'Conflicto de revisión.',
      revision_esperada: ['La cotización fue actualizada.'],
    })
    expect(error.status).toBe(409)
    expect(error.message).toBe('Conflicto de revisión.')
    expect(error.fields.revision_esperada).toEqual(['La cotización fue actualizada.'])
  })
})
