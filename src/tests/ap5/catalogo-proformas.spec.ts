import { describe, expect, it } from 'vitest'
import {
  consumeEditorDraft,
  duplicateLocalLine,
  removeLocalLine,
  restoreLocalLine,
  saveEditorDraft,
} from '@/modules/proformas/services/editorLocal'

describe('AP5 estado local del editor', () => {
  it('preserva y consume una sola vez el borrador contextual completo', () => {
    const draft = {
      currentStep: 2,
      clienteMode: 'nuevo',
      header: { plazo_entrega: '15 días' },
      lineas: [
        { localId: 'a', nombre: 'Silla', precio_unitario: '100.00' },
        {
          localId: 'b',
          nombre: 'Mueble',
          especificacion: {
            datos_tecnicos: { componentes: [{ nombre: 'Mesón', material: 'melamina' }] },
          },
        },
      ],
    }
    saveEditorDraft('token', draft)
    expect(consumeEditorDraft('token')).toEqual(draft)
    expect(consumeEditorDraft('token')).toBeNull()
  })
  it('duplica profundamente un mueble y conserva recuperación íntegra', () => {
    const original = {
      id: 9,
      localId: 'original',
      nombre: 'Escritorio',
      especificacion: {
        datos_tecnicos: { componentes: [{ nombre: 'Mesón', material: 'melamina' }] },
      },
    }
    const copy = duplicateLocalLine(original, 'copia')
    expect(copy.id).toBeUndefined()
    expect(copy.localId).toBe('copia')
    copy.especificacion.datos_tecnicos.componentes[0]!.material = 'madera'
    expect(original.especificacion.datos_tecnicos.componentes[0]!.material).toBe('melamina')
    const removed = removeLocalLine([original, copy], 0)
    expect(removed.lines).toEqual([copy])
    expect(removed.removed).not.toBeNull()
    expect(restoreLocalLine(removed.lines, removed.removed!)).toEqual([original, copy])
  })
})

import { http, HttpResponse } from 'msw'
import { productosService } from '@/modules/productos/services/productosService'
import { server } from '@/tests/msw/server'

describe('AP5 contrato unificado de catálogo', () => {
  it('envía producto y ficha en una sola operación sin incluir stock', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8000/api/v1/catalogo/productos/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            id: 81,
            ...body,
            precio_vigente: '125.00',
            stock: '0.0000',
            demanda_pendiente: '0',
            disponibilidad_referencial: '0',
            categoria_info: { id: 1, codigo: 'PISO_FLOTANTE', nombre: 'Piso' },
            unidad_stock_info: { id: 2, codigo: 'M2', nombre: 'Metro cuadrado' },
            familia_info: null,
            imagen_principal: null,
            created_by: 1,
            updated_by: 1,
          },
          { status: 201 },
        )
      }),
    )
    await productosService.create({
      categoria: 1,
      familia: null,
      sku: 'PISO-ROBLE',
      nombre: 'Piso roble',
      precio_lista: '125.00',
      unidad_stock: 2,
      activo: true,
      piso: { modelo: 'Roble', m2_por_caja: '2.2000' },
      promocion: { precio_antes: '125.00', precio_ahora: '110.00', activo: true },
    })
    expect(body).toMatchObject({
      sku: 'PISO-ROBLE',
      unidad_stock: 2,
      piso: { m2_por_caja: '2.2000' },
      promocion: { precio_ahora: '110.00' },
    })
    expect(body).not.toHaveProperty('stock')
  })
})
