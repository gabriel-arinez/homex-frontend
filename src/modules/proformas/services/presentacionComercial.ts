type LineaPresentable = {
  modo_calculo?: string
  cantidad?: string | number
  precio_unitario?: string | number | null
  importe_negociado?: string | number | null
  descuento?: string | number | null
}

export function decimalValido(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function totalEstimadoLinea(linea: LineaPresentable): number | null {
  const descuento = decimalValido(linea.descuento ?? 0)
  if (descuento === null || descuento < 0) return null
  if (linea.modo_calculo === 'TOTAL_NEGOCIADO') {
    const negociado = decimalValido(linea.importe_negociado)
    return negociado !== null && negociado >= descuento ? negociado - descuento : null
  }
  const cantidad = decimalValido(linea.cantidad)
  const unitario = decimalValido(linea.precio_unitario)
  if (cantidad === null || cantidad <= 0 || unitario === null || unitario <= 0) return null
  const total = cantidad * unitario - descuento
  return total >= 0 ? total : null
}

export function totalEstimadoCompleto(lineas: LineaPresentable[]): number | null {
  let total = 0
  for (const linea of lineas) {
    const parcial = totalEstimadoLinea(linea)
    if (parcial === null) return null
    total += parcial
  }
  return lineas.length ? total : null
}
