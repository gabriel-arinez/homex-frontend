import type { PendienteAsistida } from '@/generated/api'
import type { AtributoTecnico, ComponenteTecnico } from './muebleTecnico'

type Medida = { clave: string; valor: string; unidad: string; original?: unknown }
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
    return !componente || !!String(componente[r.campo ?? ''] ?? '').trim()
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
        !!a.valor.trim(),
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
