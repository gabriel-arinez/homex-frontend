import { describe, expect, it } from 'vitest'
import { pendienteResuelto } from '@/modules/proformas/services/pendientesAsistencia'
import type { PendienteAsistida } from '@/generated/api'
const aviso = (resolucion: PendienteAsistida['resolucion']): PendienteAsistida => ({
  codigo: 'MISSING_AXIS',
  ruta: 'dimensiones',
  mensaje: 'Complete',
  resolucion,
})
describe('corrección manual de avisos asistidos', () => {
  it('exige valor y unidad válidos en el eje indicado', () => {
    const p = aviso({ tipo: 'DIMENSION', clave: 'ancho' })
    expect(pendienteResuelto(p, [{ clave: 'ancho', valor: '120', unidad: '' }], [], [])).toBe(false)
    expect(pendienteResuelto(p, [{ clave: 'ancho', valor: '120', unidad: 'cm' }], [], [])).toBe(
      true,
    )
  })
  it('conserva la ambigüedad hasta completar dos medidas nuevas', () => {
    const p = aviso({ tipo: 'DIMENSIONES_NUEVAS', cantidad: 2 })
    const medidas = [
      { clave: 'alto', valor: '90', unidad: 'cm', original: { valor: 90, unidad: 'cm' } },
      { clave: 'ancho', valor: '140', unidad: 'cm' },
    ]
    expect(pendienteResuelto(p, medidas, [], [])).toBe(false)
    expect(
      pendienteResuelto(
        p,
        [...medidas, { clave: 'profundidad', valor: '140', unidad: 'cm' }],
        [],
        [],
      ),
    ).toBe(true)
  })
  it('sigue el componente por UID incluso al renombrarlo y permite quitarlo', () => {
    const p = aviso({ tipo: 'COMPONENTE', uid: 'pieza', campo: 'espesor' })
    expect(pendienteResuelto(p, [], [{ uid: 'pieza', nombre: 'Renombrado' }], [])).toBe(false)
    expect(
      pendienteResuelto(p, [], [{ uid: 'pieza', nombre: 'Renombrado', espesor: '18 mm' }], []),
    ).toBe(true)
    expect(pendienteResuelto(p, [], [], [])).toBe(true)
  })
  it('retira un conflicto general al completar su atributo visible', () => {
    const p = aviso({ tipo: 'ATRIBUTO_GENERAL', clave: 'material' })
    expect(pendienteResuelto(p, [], [], [{ nombre: 'Material', valor: '' }])).toBe(false)
    expect(pendienteResuelto(p, [], [], [{ nombre: 'Material', valor: 'MDP' }])).toBe(true)
  })
})
