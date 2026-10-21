import type {
  DetalleIntegralWritable,
  PropuestaConfigurador,
  ValorCatalogoPublico,
} from '@/generated/api'
import { leerDatosTecnicos, validarDatosTecnicos } from './muebleTecnico'

export function mapearCapturaAsistida(
  propuesta: PropuestaConfigurador,
  tipos: ValorCatalogoPublico[],
  unidades: ValorCatalogoPublico[],
): DetalleIntegralWritable {
  const tipo = tipos.find((x) => x.codigo === 'MUEBLE_MEDIDA')
  const unidad = unidades.find((x) => x.codigo === (propuesta.comercial.unidad_codigo ?? 'PIEZA'))
  if (!tipo || !unidad || !propuesta.comercial.nombre.trim())
    throw new Error('Faltan referencias para aplicar la propuesta.')
  const datos = leerDatosTecnicos(propuesta.especificacion.datos_tecnicos)
  if ('schema_version' in datos || validarDatosTecnicos(datos).length)
    throw new Error('La propuesta técnica no es compatible con el configurador.')
  return {
    tipo_item: tipo.id,
    producto: null,
    familia_producto: null,
    nombre: propuesta.comercial.nombre,
    descripcion: '',
    cantidad: propuesta.comercial.cantidad === null ? '' : String(propuesta.comercial.cantidad),
    unidad: unidad.id,
    modo_calculo: 'PRECIO_UNITARIO',
    precio_unitario: propuesta.comercial.precio_unitario ?? '',
    descuento: propuesta.comercial.descuento ?? '0.00',
    especificacion: { ...propuesta.especificacion, datos_tecnicos: datos },
  }
}
