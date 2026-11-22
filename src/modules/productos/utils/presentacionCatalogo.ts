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

export type EspecificacionItem = {
  label: string
  value: string
  group?: string
}

function formatearClaveEspecificacion(key: string): string {
  const mapa: Record<string, string> = {
    tapizado: 'Tapizado',
    resistencia: 'Resistencia',
    configuracion: 'Configuración',
    brazos: 'Brazos',
    altura: 'Altura',
    base: 'Base',
    ruedas: 'Ruedas',
    mecanismo: 'Mecanismo',
    material: 'Material',
    color: 'Color',
    acabado: 'Acabado',
    asiento: 'Asiento',
    respaldo: 'Respaldo',
    suspension: 'Suspensión',
    giro: 'Giro',
    apoyo_lumbar: 'Apoyo lumbar',
  }
  return (
    mapa[key] ??
    key.replace(/[_-]+/g, ' ').replace(/\b\p{L}/gu, (letra) => letra.toLocaleUpperCase('es'))
  )
}

function aplanarEspecificaciones(valor: unknown, prefijo = ''): EspecificacionItem[] {
  if (valor === null || valor === undefined || valor === '') return []
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
    return [
      {
        label: prefijo ? formatearClaveEspecificacion(prefijo) : 'Detalle',
        value: typeof valor === 'boolean' ? (valor ? 'Sí' : 'No') : String(valor),
        group: 'Características adicionales',
      },
    ]
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item, idx) =>
      aplanarEspecificaciones(item, `${prefijo || 'Elemento'} ${idx + 1}`),
    )
  }
  if (typeof valor !== 'object') return []
  const registro = valor as Record<string, unknown>
  if ('valor' in registro) {
    const monto = String(registro.valor ?? '')
    const unidad = typeof registro.unidad === 'string' ? registro.unidad : ''
    return monto
      ? [
          {
            label: formatearClaveEspecificacion(prefijo || 'Valor'),
            value: `${monto}${unidad ? ` ${unidad}` : ''}`,
            group: 'Características adicionales',
          },
        ]
      : []
  }
  return Object.entries(registro).flatMap(([clave, hijo]) => {
    if (clave === 'uid') return []
    return aplanarEspecificaciones(hijo, clave)
  })
}

export function resumenFichaProducto(producto: Producto): string {
  const partes: string[] = []
  if (producto.silla) {
    if (producto.silla.marca_nombre) partes.push(producto.silla.marca_nombre)
    if (producto.silla.modelo) partes.push(producto.silla.modelo)
    if (producto.silla.color_primario_nombre) partes.push(producto.silla.color_primario_nombre)
  } else if (producto.piso) {
    if (producto.piso.marca_nombre) partes.push(producto.piso.marca_nombre)
    if (producto.piso.modelo) partes.push(producto.piso.modelo)
    if (producto.piso.espesor_mm) partes.push(`${cantidadProducto(producto.piso.espesor_mm)} mm`)
  }
  return partes.join(' · ')
}

export function especificacionesLegiblesProducto(producto: Producto): EspecificacionItem[] {
  const items: EspecificacionItem[] = []
  if (producto.silla) {
    if (producto.silla.marca_nombre)
      items.push({ label: 'Marca', value: producto.silla.marca_nombre, group: 'Ficha de silla' })
    if (producto.silla.modelo)
      items.push({ label: 'Modelo', value: producto.silla.modelo, group: 'Ficha de silla' })
    if (producto.silla.color_primario_nombre)
      items.push({
        label: 'Color principal',
        value: producto.silla.color_primario_nombre,
        group: 'Ficha de silla',
      })
    if (producto.silla.color_secundario_nombre)
      items.push({
        label: 'Color secundario',
        value: producto.silla.color_secundario_nombre,
        group: 'Ficha de silla',
      })
    items.push(...aplanarEspecificaciones(producto.silla.especificaciones))
  }
  if (producto.piso) {
    if (producto.piso.marca_nombre)
      items.push({ label: 'Marca', value: producto.piso.marca_nombre, group: 'Ficha de piso' })
    if (producto.piso.modelo)
      items.push({ label: 'Modelo', value: producto.piso.modelo, group: 'Ficha de piso' })
    if (producto.piso.tipo_nombre)
      items.push({ label: 'Tipo', value: producto.piso.tipo_nombre, group: 'Ficha de piso' })
    if (producto.piso.material_nombre)
      items.push({
        label: 'Material',
        value: producto.piso.material_nombre,
        group: 'Ficha de piso',
      })
    if (producto.piso.diseno_nombre)
      items.push({ label: 'Diseño', value: producto.piso.diseno_nombre, group: 'Ficha de piso' })
    if (producto.piso.acabado_nombre)
      items.push({ label: 'Acabado', value: producto.piso.acabado_nombre, group: 'Ficha de piso' })
    if (producto.piso.espesor_mm)
      items.push({
        label: 'Espesor',
        value: `${cantidadProducto(producto.piso.espesor_mm)} mm`,
        group: 'Dimensiones y empaque',
      })
    if (producto.piso.ancho_mm)
      items.push({
        label: 'Ancho',
        value: `${cantidadProducto(producto.piso.ancho_mm)} mm`,
        group: 'Dimensiones y empaque',
      })
    if (producto.piso.largo_mm)
      items.push({
        label: 'Largo',
        value: `${cantidadProducto(producto.piso.largo_mm)} mm`,
        group: 'Dimensiones y empaque',
      })
    if (producto.piso.m2_por_caja)
      items.push({
        label: 'm² por caja',
        value: cantidadProducto(producto.piso.m2_por_caja),
        group: 'Dimensiones y empaque',
      })
  }
  return items
}
