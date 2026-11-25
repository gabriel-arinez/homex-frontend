import type { DetalleIntegralWritable } from '@/generated/api'
import { formatChangeValue, type FormFieldChange } from '@/shared/forms/useFormChanges'

export type DetalleComparable = DetalleIntegralWritable & {
  total?: string | number | null
  total_negociado?: string | number | null
}

function canonical(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  return JSON.stringify(val)
}

function formatLineSummary(d: DetalleComparable): string {
  const qty = d.cantidad ?? 1
  const price = d.precio_unitario ?? d.total_negociado ?? d.total ?? '0'
  return `Cant. ${qty} · P.U. ${price}`
}

function summarizeSpecChanges(origSpec: unknown, currSpec: unknown): string[] {
  const o = (origSpec && typeof origSpec === 'object' ? origSpec : {}) as Record<string, unknown>
  const c = (currSpec && typeof currSpec === 'object' ? currSpec : {}) as Record<string, unknown>
  const keys = new Set([...Object.keys(o), ...Object.keys(c)])
  const changed: string[] = []
  for (const key of keys) {
    if (canonical(o[key]) !== canonical(c[key])) {
      changed.push(key.replace(/_/g, ' '))
    }
  }
  return changed
}

export function diffProformaDetalles(
  origList: DetalleComparable[],
  currList: DetalleComparable[],
): FormFieldChange[] {
  const changes: FormFieldChange[] = []
  const usedCurrIndices = new Set<number>()

  const findMatchIndex = (orig: DetalleComparable, origIdx: number): number => {
    if (orig.id != null) {
      return currList.findIndex((c, idx) => !usedCurrIndices.has(idx) && c.id === orig.id)
    }
    if (
      origIdx < currList.length &&
      !usedCurrIndices.has(origIdx) &&
      currList[origIdx]?.id == null
    ) {
      return origIdx
    }
    return -1
  }

  const lineFields: Array<{
    key: keyof DetalleIntegralWritable
    label: string
  }> = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'precio_unitario', label: 'Precio unitario' },
    { key: 'descuento', label: 'Descuento' },
    { key: 'descripcion', label: 'Descripción' },
  ]

  origList.forEach((orig, origIdx) => {
    const matchIdx = findMatchIndex(orig, origIdx)
    const itemName = orig.nombre?.trim() || `Ítem #${origIdx + 1}`
    if (matchIdx === -1) {
      changes.push({
        key: `linea-del-${orig.id ?? origIdx}`,
        label: `Eliminado: ${itemName}`,
        before: formatLineSummary(orig),
        after: 'Eliminado',
      })
      return
    }
    usedCurrIndices.add(matchIdx)
    const curr = currList[matchIdx]!
    const currName = curr.nombre?.trim() || itemName

    for (const field of lineFields) {
      const beforeVal = orig[field.key]
      const afterVal = curr[field.key]
      if (canonical(beforeVal) !== canonical(afterVal)) {
        changes.push({
          key: `linea-${curr.id ?? matchIdx}-${String(field.key)}`,
          label: `${currName} · ${field.label}`,
          before: formatChangeValue(beforeVal),
          after: formatChangeValue(afterVal),
        })
      }
    }

    const origTotal = orig.total_negociado ?? orig.total
    const currTotal = curr.total_negociado ?? curr.total
    if (curr.modo_calculo === 'TOTAL_NEGOCIADO' && canonical(origTotal) !== canonical(currTotal)) {
      changes.push({
        key: `linea-${curr.id ?? matchIdx}-total`,
        label: `${currName} · Total negociado`,
        before: formatChangeValue(origTotal),
        after: formatChangeValue(currTotal),
      })
    }

    if (canonical(orig.especificacion) !== canonical(curr.especificacion)) {
      const specKeys = summarizeSpecChanges(orig.especificacion, curr.especificacion)
      changes.push({
        key: `linea-${curr.id ?? matchIdx}-especificacion`,
        label: `${currName} · Especificación técnica`,
        before: specKeys.length ? `Anterior (${specKeys.slice(0, 3).join(', ')})` : 'Anterior',
        after: specKeys.length ? `Actualizada (${specKeys.slice(0, 3).join(', ')})` : 'Actualizada',
      })
    }
  })

  currList.forEach((curr, currIdx) => {
    if (usedCurrIndices.has(currIdx)) return
    const itemName = curr.nombre?.trim() || `Ítem #${currIdx + 1}`
    changes.push({
      key: `linea-add-${curr.id ?? currIdx}`,
      label: `Agregado: ${itemName}`,
      before: 'No incluido',
      after: formatLineSummary(curr),
    })
  })

  return changes
}
