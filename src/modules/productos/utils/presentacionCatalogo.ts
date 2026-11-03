import type { Producto } from '@/generated/api'

const cantidadFormatter = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 })
const dineroFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function dineroProducto(valor: string): string {
  const n = Number(valor)
  return Number.isFinite(n) ? dineroFormatter.format(n) : 'Precio no disponible'
}

export function cantidadProducto(valor: string | number): string {
  const n = Number(valor)
  return Number.isFinite(n) ? cantidadFormatter.format(n) : '—'
}

export function unidadProducto(producto: Producto, valor: string | number): string {
  const codigo = producto.unidad_stock_info?.codigo
  const n = Number(valor)
  if (codigo === 'M2') return 'm²'
  if (codigo === 'PIEZA') return n === 1 ? 'pieza' : 'piezas'
  if (codigo === 'JUEGO') return n === 1 ? 'juego' : 'juegos'
  if (codigo === 'BARRA') return n === 1 ? 'barra' : 'barras'
  return producto.unidad_stock_info?.nombre || 'unidades'
}

export function unidadesProducto(producto: Producto, valor: string | number): string {
  return cantidadProducto(valor) + ' ' + unidadProducto(producto, valor)
}

export function categoriaProducto(producto: Producto): string {
  return producto.categoria_info?.nombre || 'Categoría #' + producto.categoria
}

export function pageNumberProducto(value: string): number {
  const number = Number(value)
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 ? number : 1
}

export function catalogoId(value: string): string {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? value
    : ''
}
