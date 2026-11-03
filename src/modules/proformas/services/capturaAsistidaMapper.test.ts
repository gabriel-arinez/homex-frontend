import { describe, expect, it } from 'vitest'
import type { PropuestaConfigurador, ValorCatalogoPublico } from '@/generated/api'
import { mapearCapturaAsistida } from './capturaAsistidaMapper'

const tipos: ValorCatalogoPublico[] = [
  { id: 10, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida', concepto_codigo: 'TIPO_ITEM' },
]
const unidades: ValorCatalogoPublico[] = [
  { id: 20, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' },
]

function propuestaCredenza(): PropuestaConfigurador {
  return {
    comercial: {
      nombre: 'credenza',
      cantidad: 1,
      unidad_codigo: 'PIEZA',
      precio_unitario: '2600.00',
      descuento: null,
    },
    especificacion: {
      tipo_mueble: 28540,
      observaciones: null,
      datos_tecnicos: {
        caracteristicas_generales: {
          atributos: [
            { valor: 'melamina', codigo: 'MATERIAL', nombre: 'Material', tipo_entrada: 'texto' },
          ],
          dimensiones: {
            alto: { valor: '0.75', unidad: 'm' },
            ancho: { valor: '1.45', unidad: 'm' },
            profundidad: { valor: '0.45', unidad: 'm' },
          },
        },
        componentes: [
          { uid: 'cajones', nombre: 'cajones', cantidad_interna: 2 },
          { uid: 'puertas', nombre: 'puertas abatibles', cantidad_interna: 2, color: 'nogal' },
        ],
        accesorios: [],
        conjuntos: [],
      },
    },
    pendientes: [
      {
        codigo: 'ESPESOR_SIN_COMPONENTE',
        ruta: 'especificacion.datos_tecnicos.componentes',
        mensaje: 'El espesor 18 milímetros no tiene una pieza identificada de forma confiable.',
        resolucion: { tipo: 'ESPESOR_SIN_COMPONENTE', valor: '18 mm' },
      },
    ],
  }
}

describe('captura asistida PRF04_2 - intento 230', () => {
  it('mantiene nombre, cantidad, precio y dimensiones al aplicar la propuesta', () => {
    const linea = mapearCapturaAsistida(propuestaCredenza(), tipos, unidades)
    expect(linea.nombre).toBe('credenza')
    expect(linea.cantidad).toBe('1')
    expect(linea.precio_unitario).toBe('2600.00')
    expect(linea.unidad).toBe(20)
    expect(linea.descuento).toBe('0.00')
    expect(linea.especificacion?.tipo_mueble).toBe(28540)
    const datos = linea.especificacion?.datos_tecnicos as {
      caracteristicas_generales: { dimensiones: Record<string, { valor: string; unidad: string }> }
      componentes: Array<{ nombre: string; cantidad_interna: number }>
    }
    expect(datos.caracteristicas_generales.dimensiones.ancho).toEqual({
      valor: '1.45',
      unidad: 'm',
    })
    expect(datos.componentes).toHaveLength(2)
    expect(datos.componentes[0]?.cantidad_interna).toBe(2)
  })

  it('no inventa un precio unitario cuando el dictado no lo incluye', () => {
    const propuesta = propuestaCredenza()
    propuesta.comercial.precio_unitario = null
    const linea = mapearCapturaAsistida(propuesta, tipos, unidades)
    expect(linea.precio_unitario).toBe('')
  })

  it('rechaza una propuesta sin referencias comerciales, sin modificarla', () => {
    const propuesta = propuestaCredenza()
    propuesta.comercial.nombre = ''
    expect(() => mapearCapturaAsistida(propuesta, tipos, unidades)).toThrow(
      'Faltan referencias para aplicar la propuesta.',
    )
    expect(propuesta.comercial.nombre).toBe('')
  })
})
