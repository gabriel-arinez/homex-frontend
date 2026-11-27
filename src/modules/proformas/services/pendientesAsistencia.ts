import type { PendienteAsistida } from '@/generated/api'
import type { AtributoTecnico, ComponenteTecnico } from './muebleTecnico'

/** Positive exact millimetres: integer arithmetic avoids floating-point equivalence drift. */
export function normalizedThickness(value: unknown): string | null {
  if (value && typeof value === 'object' && 'valor' in value && 'unidad' in value)
    value = `${value.valor} ${value.unidad}`
  if (typeof value !== 'string') return null
  const match = value.match(
    /^\s*(\d+(?:[.,]\d+)?)\s*(mm|mil[ií]metros?|cm|cent[ií]metros?|m|metros?|pulgadas?)\s*$/i,
  )
  if (!match) return null
  const [whole, fraction = ''] = match[1]!.replace(',', '.').split('.')
  const number = BigInt(whole! + fraction)
  if (number <= 0n) return null
  const unit = match[2]!.toLowerCase()
  const factor = unit.startsWith('pulg')
    ? 254n
    : unit === 'mm' || unit.startsWith('mil')
      ? 10n
      : unit === 'cm' || unit.startsWith('cent')
        ? 100n
        : 10000n
  let numerator = number * factor
  let scale = fraction.length + 1
  while (scale && numerator % 10n === 0n) {
    numerator /= 10n
    scale--
  }
  return `${numerator}:${scale}`
}

export function sameThickness(a: unknown, b: unknown): boolean {
  const canonical = normalizedThickness(a)
  return canonical !== null && canonical === normalizedThickness(b)
}

type Medida = { clave: string; valor: string; unidad: string; original?: unknown }
export function asignarEspesorPendiente(
  pendiente: PendienteAsistida,
  uid: string,
  componentes: ComponenteTecnico[],
): boolean {
  const resolucion = pendiente.resolucion
  if (resolucion?.tipo !== 'ESPESOR_SIN_COMPONENTE') return false

  const valor = resolucion.valor?.trim()
  if (!valor || normalizedThickness(valor) === null) return false

  const componente = componentes.find((item) => item.uid === uid)
  if (!componente) return false

  const existente = componente.espesor?.trim()
  if (existente && !sameThickness(existente, valor)) return false

  if (!existente) componente.espesor = valor
  return true
}

export function pendienteResuelto(
  pendiente: PendienteAsistida,
  medidas: Medida[],
  componentes: ComponenteTecnico[],
  atributos: AtributoTecnico[],
): boolean {
  const r = pendiente.resolucion
  if (!r) return false
  const completa = (m: Medida) =>
    Number.isFinite(Number(m.valor)) &&
    Number(m.valor) > 0 &&
    ['mm', 'cm', 'm', 'pulgadas'].includes(m.unidad)
  if (r.tipo === 'DIMENSION') return medidas.some((m) => m.clave === r.clave && completa(m))
  if (r.tipo === 'COMPONENTE') {
    const componente = componentes.find((c) => c.uid === r.uid)
    if (!componente) return false
    const valor = componente[r.campo ?? '']
    if (r.campo === 'cantidad_interna') return Number.isInteger(Number(valor)) && Number(valor) > 0
    // Optional axis markers prevent another complete axis from resolving an inferred one.
    // Legacy component requests without a marker retain their existing behavior.
    if (r.campo === 'dimensiones' && r.valor) {
      if (!['ancho', 'alto', 'largo', 'profundidad', 'diametro'].includes(r.valor)) return false
      if (typeof valor !== 'string') return false
      const axis = r.valor === 'diametro' ? 'di[aá]metro' : r.valor
      const match = valor.match(
        new RegExp(
          `(?:^|;)\\s*${axis}\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm|m|pulgadas)\\s*(?:;|$)`,
          'i',
        ),
      )
      return !!match && Number(match[1]!.replace(',', '.')) > 0
    }
    return !!String(valor ?? '').trim()
  }
  const normalizar = (valor: string) =>
    valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  if (r.tipo === 'ATRIBUTO_GENERAL')
    return atributos.some(
      (a) =>
        (normalizar(a.codigo ?? '') === normalizar(r.clave ?? '') ||
          normalizar(a.nombre) === normalizar(r.clave ?? '')) &&
        !!a.valor.trim() &&
        (a.tipo_entrada !== 'entero' || (/^\d+$/.test(a.valor.trim()) && Number(a.valor) >= 0)) &&
        (a.tipo_entrada !== 'numero_unidad' ||
          (Number.isFinite(Number(a.valor)) && !!a.unidad?.trim())),
    )
  if (r.tipo === 'DIMENSIONES_NUEVAS')
    return (
      medidas.filter((m) => {
        if (!completa(m)) return false
        const original = m.original as { valor?: unknown; unidad?: unknown } | undefined
        return !original || String(original.valor) !== m.valor || original.unidad !== m.unidad
      }).length >= (r.cantidad ?? 1)
    )
  return false
}
