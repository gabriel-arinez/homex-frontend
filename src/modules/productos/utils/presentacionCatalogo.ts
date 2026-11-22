import type { Producto } from '@/generated/api'

const cantidadFormatter = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 4 })
const dineroFormatter = new Intl.NumberFormat('es-BO', {
  style: 'currency',
  currency: 'BOB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function dineroProducto(valor: string): string {
  if (!valor.trim()) return 'Precio no disponible'
  const n = Number(valor)
  return Number.isFinite(n) ? dineroFormatter.format(n) : 'Precio no disponible'
}

export function cantidadProducto(valor: string | number): string {
  if (String(valor).trim() === '') return '—'
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

export type DisponibilidadMeta = {
  tone: 'success' | 'warning' | 'danger'
  label: string
  hint: string
}

export function disponibilidadMeta(valor: string | number): DisponibilidadMeta {
  const n = Number(valor)
  if (!Number.isFinite(n) || n > 0) {
    return {
      tone: 'success',
      label: 'Disponible',
      hint: 'Stock actual menos demanda pendiente',
    }
  }
  if (n === 0) {
    return {
      tone: 'warning',
      label: 'Sin margen',
      hint: 'Demanda pendiente iguala al stock actual',
    }
  }
  return {
    tone: 'danger',
    label: 'Déficit referencial',
    hint: 'Demanda superior a existencias (no es stock físico negativo)',
  }
}

export type EstadoStockMeta = {
  tone: 'danger' | 'warning' | 'success' | 'neutral'
  label: string
  showBadge: boolean
}

export function estadoStockMeta(estadoStock?: string): EstadoStockMeta {
  switch (estadoStock) {
    case 'SIN_EXISTENCIAS':
      return { tone: 'danger', label: 'Sin existencias', showBadge: true }
    case 'STOCK_BAJO':
      return { tone: 'warning', label: 'Stock bajo', showBadge: true }
    case 'NORMAL':
      return { tone: 'success', label: 'Por encima del mínimo', showBadge: true }
    default:
      return { tone: 'neutral', label: 'Sin mínimo configurado', showBadge: false }
  }
}
