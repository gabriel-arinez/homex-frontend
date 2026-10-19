import { describe, expect, it } from 'vitest'
import {
  clonarTecnica,
  fusionarDatosTecnicos,
  tecnicaIgual,
  validarDatosTecnicos,
} from '@/modules/proformas/services/muebleTecnico'

describe('PRF-03 configurador técnico', () => {
  it('preserva claves históricas al editar una sección', () => {
    const base = {
      descripcion_original: 'literal',
      desconocido: { legado: true },
      caracteristicas_generales: { color: 'A elección' },
    }
    const merged = fusionarDatosTecnicos(base, {
      caracteristicas_generales: { dimensiones: { alto: { valor: '73', unidad: 'cm' } } },
    })
    expect(merged.desconocido).toEqual({ legado: true })
    expect(merged.caracteristicas_generales).toMatchObject({
      color: 'A elección',
      dimensiones: { alto: { valor: '73', unidad: 'cm' } },
    })
  })
  it('compara JSON con independencia del orden de claves', () => {
    expect(tecnicaIgual({ b: 1, a: { x: 3, y: 2 } }, { a: { y: 2, x: 3 }, b: 1 })).toBe(true)
  })
  it('rechaza cantidades fraccionarias e identificadores repetidos', () => {
    const errores = validarDatosTecnicos({
      conjuntos: [{ uid: 'mismo', nombre: 'Conjunto A' }, { uid: 'mismo', nombre: 'Conjunto B' }],
      componentes: [{ uid: 'pieza', nombre: 'Parte', cantidad_interna: 1.5 }],
    })
    expect(errores.join(' ')).toContain('únicos')
    expect(errores.join(' ')).toContain('positiva')
  })
  it('clona profundamente y detecta diferencias exclusivamente técnicas', () => {
    const original = { componentes: [{ uid: 'a', nombre: 'Tapa', espesor: '18 mm' }] }
    const copia = clonarTecnica(original)
    copia.componentes[0]!.espesor = '25 mm'
    expect(original.componentes[0]!.espesor).toBe('18 mm')
    expect(tecnicaIgual(original, copia)).toBe(false)
  })
  it('valida conjuntos, cantidades y atributos', () => {
    const errores = validarDatosTecnicos({
      conjuntos: [{ uid: 'g', nombre: 'Escritorio' }],
      componentes: [
        {
          uid: 'p',
          nombre: '',
          cantidad_interna: 0,
          atributos: [{ nombre: 'Material', valor: '' }],
        },
      ],
    })
    expect(errores.join(' ')).toContain('necesita un componente')
    expect(errores.join(' ')).toContain('necesita nombre')
    expect(errores.join(' ')).toContain('positiva')
    expect(errores.join(' ')).toContain('atributo vacío')
  })
})
