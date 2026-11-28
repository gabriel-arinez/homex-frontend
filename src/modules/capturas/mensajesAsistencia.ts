import type { PendienteAsistida } from '@/generated/api'

const INTERNAL_PATTERNS = [
  /\{.*\}/,
  /→/,
  /\bUNRESOLVED\b/,
  /\bcomponent_ref\b/,
  /\bcoating_or_board_description\b/,
  /\bConfirm\s+contextual\s+interpretation\b/i,
  /\bExplicit\s+atypical\s+dimension\b/i,
  /\bAccessory\s+quantity\s+requires\s+review\b/i,
  /\bInternal\s+parser\b/i,
]

const FALLBACK_POR_CODIGO: Record<string, string> = {
  GEOMETRIA: 'Mueble en L: confirma la orientación y los ejes de las medidas.',
  RANGO_DIMENSIONAL: 'Rango dimensional detectado; confirma la medida final en Observaciones.',
  DISTRIBUCION: 'Distribución por lado detectada; indica la cantidad total en el componente.',
  RECUPERACION_LEXICA: 'Se propuso una interpretación de término; confirma si es correcto.',
  ESPECIFICACION: 'Detalle adicional detectado; revísalo en Observaciones.',
  SELECCION_COLOR: 'Color a elección: selecciona o confirma el color cuando esté definido.',
  COLOR_NO_RESUELTO: 'Color no reconocido automáticamente; selecciona o aclara el color.',
  CONFLICTING_VALUES: 'Hay valores por aclarar; revísalos antes de confirmar.',
  UNKNOWN_TERM: 'Se detectó un término por confirmar; revisa la interpretación.',
}

export function esPendienteRuidoHistorico(p: Pick<PendienteAsistida, 'codigo'>): boolean {
  return p.codigo === 'ROL_MATERIAL'
}

export function limpiarMensajeAsistencia(mensaje: string, codigo?: string): string {
  const texto = String(mensaje ?? '').trim()
  if (!texto) return ''
  if (INTERNAL_PATTERNS.some((re) => re.test(texto))) {
    return (codigo && FALLBACK_POR_CODIGO[codigo]) || 'Revisa este dato antes de confirmar.'
  }
  return texto
}
