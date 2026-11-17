import { describe, expect, it } from 'vitest'
import { asignarEspesorPendiente } from '@/modules/proformas/services/pendientesAsistencia'
import type { PendienteAsistida } from '@/generated/api'

const pending: PendienteAsistida = {
  codigo: 'ESPESOR_SIN_COMPONENTE',
  ruta: 'componentes',
  mensaje: 'Associate thickness',
  resolucion: { tipo: 'ESPESOR_SIN_COMPONENTE', valor: '18 mm' },
}
describe('thickness integrity', () => {
  it.each(['1.8 cm', '0,018 m', '18.000 milímetros'])('accepts equivalent %s', (espesor) => {
    const components = [{ uid: 'top', nombre: 'Top', espesor }]
    expect(asignarEspesorPendiente(pending, 'top', components)).toBe(true)
    expect(components[0]!.espesor).toBe(espesor)
  })
  it('does not assign a different existing value', () => {
    const components = [{ uid: 'top', nombre: 'Top', espesor: '25 mm' }]
    expect(asignarEspesorPendiente(pending, 'top', components)).toBe(false)
    expect(components[0]!.espesor).toBe('25 mm')
  })
})
