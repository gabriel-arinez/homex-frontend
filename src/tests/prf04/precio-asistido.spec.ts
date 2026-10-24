import { describe, expect, it } from 'vitest'
import {
  calcularUnitarioExacto,
  totalComercialCoincide,
} from '@/modules/proformas/services/precioAsistido'

describe('precio total dictado PRF-04', () => {
  it('calcula sin redondear sólo cuando la división es exacta', () => {
    expect(calcularUnitarioExacto('7300.00', '2', '0.00')).toBe('3650.00')
    expect(calcularUnitarioExacto('7300.00', '1', '0.00')).toBe('7300.00')
    expect(calcularUnitarioExacto('100.00', '3', '0.00')).toBeNull()
    expect(calcularUnitarioExacto('7300.00', '', '0.00')).toBeNull()
    expect(calcularUnitarioExacto('7300.00', '2', '10.00')).toBeNull()
  })
  it('valida coherencia del total y descuento sin asumir unidad', () => {
    expect(totalComercialCoincide('7300.00', '2', '3650.00', '0.00')).toBe(true)
    expect(totalComercialCoincide('7300.00', '2', '3600.00', '0.00')).toBe(false)
    expect(totalComercialCoincide('7300.00', '2', '3700.00', '100.00')).toBe(true)
  })
})
