import { describe, expect, it } from 'vitest'
import { presentarCreacion } from '@/modules/proformas/utils/fechaCreacion'

const fecha = '2026-10-15'
const hora = '2026-10-15T13:40:00Z' // 09:40 de Bolivia
const ahora = Date.parse('2026-10-15T13:45:00Z')

describe('Fecha de creación de proformas', () => {
  it('muestra minutos, hora exacta y fecha en Bolivia', () => {
    const vista = presentarCreacion(hora, fecha, ahora)
    expect(vista.principal).toBe('Hace 5 minutos')
    expect(vista.hora).toBe('09:40 a. m.')
    expect(vista.fecha).toBe('15 de oct de 2026')
    expect(vista.mostrarFechaSeparada).toBe(true)
    expect(vista.reciente).toBe(true)
  })

  it('resuelve singular, horas y días sin confundir la zona horaria local', () => {
    expect(presentarCreacion(hora, fecha, ahora - 4 * 60_000).principal).toBe('Hace 1 minuto')
    expect(presentarCreacion(hora, fecha, ahora - 6 * 60_000).principal).toBe('Hace un momento')
    expect(presentarCreacion(hora, fecha, ahora + 3 * 60 * 60_000).principal).toBe('Hace 3 horas')
    expect(presentarCreacion(hora, fecha, ahora + 2 * 24 * 60 * 60_000).principal).toBe('Hace 2 días')
  })

  it('no atribuye horas falsas a proformas históricas o timestamps sin zona', () => {
    for (const value of [null, undefined, '', '2026-10-15T09:40:00', 'incorrecto']) {
      const vista = presentarCreacion(value, fecha, ahora)
      expect(vista.principal).toBe('15 de oct de 2026')
      expect(vista.hora).toBeNull()
      expect(vista.historica).toBe(true)
      expect(vista.reciente).toBe(false)
    }
  })

  it('no inventa antigüedad para fechas futuras o de más de siete días', () => {
    const futura = presentarCreacion('2026-10-16T13:40:00Z', fecha, ahora)
    expect(futura.principal).toBe('16 de oct de 2026')
    expect(futura.hora).toBe('09:40 a. m.')

    const vieja = presentarCreacion(hora, fecha, ahora + 10 * 24 * 60 * 60_000)
    expect(vieja.principal).toBe('15 de oct de 2026')
    expect(vieja.mostrarFechaSeparada).toBe(false)
    expect(vieja.hora).toBe('09:40 a. m.')
  })

  it('interpreta correctamente zona +00:00 y paso de medianoche', () => {
    const vista = presentarCreacion('2026-10-15T01:30:00+00:00', fecha, Date.parse('2026-10-15T01:34:00Z'))
    expect(vista.fecha).toBe('14 de oct de 2026')
    expect(vista.hora).toBe('09:30 p. m.')
    expect(vista.principal).toBe('Hace 4 minutos')
  })
})
