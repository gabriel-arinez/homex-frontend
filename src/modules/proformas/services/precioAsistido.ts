/** Cálculo comercial conservador: enteros de centavos y sin redondear. */
function centavos(valor: string): number | null {
  const match = /^(0|[1-9]\d{0,11})(?:\.(\d{1,2}))?$/.exec(valor.trim())
  if (!match) return null
  const value = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(value) ? value : null
}

export function calcularUnitarioExacto(
  total: string,
  cantidad: string,
  descuento: string,
): string | null {
  const totalCentavos = centavos(total)
  const qty = Number(cantidad)
  if (
    totalCentavos === null ||
    totalCentavos <= 0 ||
    !Number.isSafeInteger(qty) ||
    qty <= 0 ||
    centavos(descuento) !== 0 ||
    totalCentavos % qty !== 0
  )
    return null
  const unit = totalCentavos / qty
  return `${Math.floor(unit / 100)}.${String(unit % 100).padStart(2, '0')}`
}

export function totalComercialCoincide(
  total: string,
  cantidad: string,
  precioUnitario: string,
  descuento: string,
): boolean {
  const esperado = centavos(total)
  const unit = centavos(precioUnitario)
  const rebaja = centavos(descuento)
  const qty = Number(cantidad)
  return (
    esperado !== null &&
    unit !== null &&
    rebaja !== null &&
    Number.isSafeInteger(qty) &&
    qty > 0 &&
    Number.isSafeInteger(unit * qty - rebaja) &&
    unit * qty - rebaja === esperado
  )
}
