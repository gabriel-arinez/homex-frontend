import { describe, it, expect } from 'vitest'
import {
  extractSpecSheetData,
  formatDocCurrency,
  formatDocDate,
  formatDocQuantity,
  cleanHangingPhrases,
} from './proformaDocumentFormatters'

describe('proformaDocumentFormatters', () => {
  it('formats currency with Bolivian standard convention (Bs 7.300,00)', () => {
    expect(formatDocCurrency(7300, 'BOB')).toBe('Bs 7.300,00')
    expect(formatDocCurrency(null, 'BOB')).toBe('-')
    expect(formatDocCurrency(120.5, 'USD')).toBe('$us 120,50')
  })

  it('formats calendar dates in spanish full format', () => {
    expect(formatDocDate('2026-11-08')).toBe('8 de noviembre de 2026')
  })

  it('formats integer and fractional quantities according to Bolivian Spanish conventions', () => {
    expect(formatDocQuantity(1, 'pieza')).toBe('1 pieza')
    expect(formatDocQuantity(10, 'pieza')).toBe('10 piezas')
    expect(formatDocQuantity(2.5, 'metro')).toBe('2,50 metros')
  })

  it('cleans truncated and hanging prepositions gracefully', () => {
    expect(cleanHangingPhrases('2 tomacorrientes al centro de')).toBe(
      '2 tomacorrientes al centro',
    )
    expect(cleanHangingPhrases('tapacanto en PVC,')).toBe('tapacanto en PVC')
    expect(cleanHangingPhrases('estructura en')).toBe('estructura')
  })

  it('extracts technical dimensions and attributes adaptively and prevents redundancy', () => {
    const raw = {
      caracteristicas_generales: {
        dimensiones: {
          ancho: { valor: '1.20', unidad: 'm' },
          alto: '0.80 m',
          largo: { valor: '2.4', unidad: 'm' },
        },
        atributos: [
          { nombre: 'Material principal', valor: 'Melamina', unidad: '18 mm' },
          { nombre: 'Color principal', valor: 'Nogal Terracota' },
        ],
      },
      componentes: [
        {
          nombre: 'tablero',
          cantidad_interna: 1,
          material: 'Melamínico',
          espesor: '18 mm',
        },
      ],
      accesorios: ['tapacanto en PVC', '2 tomacorrientes al centro de'],
      advertencias: ['Requiere armado en obra de'],
    }

    const data = extractSpecSheetData(raw, 'Melamínico')
    expect(data.dimensiones).toEqual([
      { label: 'Ancho', value: '1,20 m' },
      { label: 'Alto', value: '0,80 m' },
      { label: 'Largo', value: '2,4 m' },
    ])
    expect(data.materiales).toContain('Melamina 18 mm')
    expect(data.colores).toContain('Nogal Terracota')
    expect(data.componentes).toHaveLength(1)
    expect(data.componentes[0]?.nombre).toBe('Tablero')
    // Accesorios deben estar limpios de conectores colgantes
    expect(data.accesorios).toEqual(['tapacanto en PVC', '2 tomacorrientes al centro'])
    // Observaciones que repiten material ya cubierto ('Melamínico') deben filtrarse, pero advertencias útiles quedan limpias
    expect(data.observaciones).toBe('Requiere armado en obra')
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
