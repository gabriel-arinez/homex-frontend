import type { ResultadoAsistida } from '@/generated/api'

// Equivalente sintético: no es una exportación de datos del laboratorio.
export const captura24: ResultadoAsistida = {
  id: 24,
  estado: 'COMPLETADA',
  intento_id: 24,
  resultado: 'REQUIRES_REVIEW',
  version_proyeccion: 'PRF04_2',
  texto_transcrito_original:
    'Dos escritorios de ancho 120, alto 75 centímetros y profundidad 60 centímetros',
  propuesta_configurador: {
    comercial: {
      nombre: 'Escritorio',
      cantidad: 2,
      unidad_codigo: 'PIEZA',
      precio_unitario: null,
      descuento: null,
    },
    especificacion: {
      tipo_mueble: 30,
      observaciones: null,
      datos_tecnicos: {
        caracteristicas_generales: {
          dimensiones: {
            ancho: { valor: '120' },
            alto: { valor: '75', unidad: 'cm' },
            profundidad: { valor: '60', unidad: 'cm' },
          },
        },
        componentes: [],
      },
    },
    pendientes: [],
  },
  pendientes: [
    {
      codigo: 'MISSING_UNIT',
      ruta: 'especificacion.datos_tecnicos.caracteristicas_generales.dimensiones.ancho.unidad',
      mensaje: 'Falta identificar la unidad del ancho. Seleccione la unidad correcta.',
      resolucion: { tipo: 'DIMENSION', clave: 'ancho' },
    },
  ],
  motor: null,
  error_codigo: null,
}
