import { describe, expect, it } from 'vitest'
import type { Producto } from '@/generated/api'
import {
  cantidadProducto,
  catalogoId,
  categoriaProducto,
  dineroProducto,
  pageNumberProducto,
  unidadesProducto,
} from '@/modules/productos/utils/presentacionCatalogo'

const base = {
  categoria: 1,
  categoria_info: {
    id: 1,
    codigo: 'SILLA',
    nombre: 'Silla',
    concepto_codigo: 'CATEGORIA_PRODUCTO',
  },
  unidad_stock: 2,
  unidad_stock_info: { id: 2, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' },
} as Producto

describe('Presentación de bandeja de productos', () => {
  it('usa cantidades decimales localizadas y no pierde la unidad', () => {
    expect(cantidadProducto('28.0000')).toBe('28')
    expect(cantidadProducto('16.5000')).toBe('16,5')
    expect(cantidadProducto('0.1234')).toBe('0,1234')
    expect(unidadesProducto(base, '1.0000')).toBe('1 pieza')
    expect(unidadesProducto(base, '28.0000')).toBe('28 piezas')
    expect(
      unidadesProducto(
        {
          ...base,
          unidad_stock_info: {
            id: 3,
            codigo: 'M2',
            nombre: 'Metro cuadrado',
            concepto_codigo: 'UNIDAD_MEDIDA',
          },
        },
        '3.7500',
      ),
    ).toBe('3,75 m²')
  })

  it('mantiene precios vigentes exactos y no inventa valores inválidos', () => {
    expect(dineroProducto('100.00')).toContain('100,00')
    expect(dineroProducto('')).toBe('Precio no disponible')
    expect(dineroProducto('desconocido')).toBe('Precio no disponible')
    expect(cantidadProducto('infinito')).toBe('—')
  })

  it('usa categorías reales, y un fallback si falta la relación', () => {
    expect(categoriaProducto(base)).toBe('Silla')
    expect(categoriaProducto({ ...base, categoria_info: undefined as never })).toBe('Categoría #1')
  })

  it('rechaza identificadores y paginaciones manipuladas en la URL', () => {
    for (const value of ['0', '-1', '1.1', 'NaN', 'Infinity', 'abc', '01x']) {
      expect(catalogoId(value)).toBe('')
      expect(pageNumberProducto(value)).toBe(1)
    }
    expect(catalogoId('25')).toBe('25')
    expect(pageNumberProducto('3')).toBe(3)
  })
})
