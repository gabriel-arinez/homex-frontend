import { describe, it, expect } from 'vitest'
import {
  extractSpecSheetData,
  formatDocCurrency,
  formatDocDate,
} from './proformaDocumentFormatters'

describe('proformaDocumentFormatters', () => {
  it('formats currency with symbol and decimal separator', () => {
    expect(formatDocCurrency(7300, 'BOB')).toContain('7.300')
    expect(formatDocCurrency(null, 'BOB')).toBe('-')
    expect(formatDocCurrency(120.5, 'USD')).toContain('120')
  })

  it('formats calendar dates in spanish full format', () => {
    expect(formatDocDate('2026-11-08')).toBe('8 de noviembre de 2026')
  })

  it('extracts technical dimensions and attributes adaptively', () => {
    const raw = {
      caracteristicas_generales: {
        dimensiones: {
          ancho: { valor: 240, unidad: 'cm' },
          alto: 75,
          profundidad: '120 cm',
        },
        atributos: [
          { nombre: 'Material principal', valor: 'Melamina', unidad: '18 mm' },
          { nombre: 'Color principal', valor: 'Nogal Terracota' },
        ],
      },
      componentes: [
        {
          nombre: 'Tapa de mesa',
          cantidad_interna: 1,
          material: 'Melamina 25mm',
          dimensiones: '240x120 cm',
        },
      ],
      accesorios: ['Pasacables de aluminio', 'Regatones regulables'],
      advertencias: ['Requiere armado en obra'],
    }

    const data = extractSpecSheetData(raw, 'Entrega en piso 3')
    expect(data.dimensiones).toEqual([
      { label: 'Ancho', value: '240 cm' },
      { label: 'Alto', value: '75' },
      { label: 'Profundidad', value: '120 cm' },
    ])
    expect(data.materiales).toContain('Melamina 18 mm')
    expect(data.colores).toContain('Nogal Terracota')
    expect(data.componentes).toHaveLength(1)
    expect(data.componentes[0]?.nombre).toBe('Tapa de mesa')
    expect(data.accesorios).toContain('Pasacables de aluminio')
    expect(data.observaciones).toContain('Entrega en piso 3')
    expect(data.observaciones).toContain('Requiere armado en obra')
  })

  it('handles empty or missing specs gracefully without breaking', () => {
    const data = extractSpecSheetData(null)
    expect(data.dimensiones).toEqual([])
    expect(data.materiales).toEqual([])
    expect(data.colores).toEqual([])
    expect(data.componentes).toEqual([])
    expect(data.accesorios).toEqual([])
    expect(data.observaciones).toBeNull()
  })
})
