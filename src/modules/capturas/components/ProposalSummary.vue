<script setup lang="ts">
import { computed } from 'vue'
import type { ResultadoAsistida, ResultadoCatalogo, ValorCatalogoPublico } from '@/generated/api'
import type { VoiceEvidence } from '../voiceEvidence'
const props = defineProps<{
  result: ResultadoAsistida | ResultadoCatalogo
  evidence: VoiceEvidence[]
  options?: Record<string, ValorCatalogoPublico[]>
  currency?: string
}>()
type Row = { label: string; value: string; pending: boolean }
type Group = { title: string; rows: Row[] }
const names: Record<string, string> = {
  nombre: 'Producto',
  categoria: 'Categoría seleccionada',
  cantidad: 'Cantidad',
  precio_lista: 'Precio de lista (BOB)',
  precio_unitario: 'Precio unitario',
  descuento: 'Descuento',
  marca: 'Marca',
  modelo: 'Modelo',
  color_primario: 'Color principal',
  color_secundario: 'Color secundario',
  unidad_stock: 'Unidad',
  unidad_codigo: 'Unidad',
  tipo: 'Tipo de piso',
  material: 'Material',
  diseno: 'Diseño',
  acabado: 'Acabado',
  espesor_mm: 'Espesor (mm)',
  largo_mm: 'Largo (mm)',
  ancho_mm: 'Ancho (mm)',
  m2_por_caja: 'm² por caja',
  cantidad_interna: 'Cantidad del componente',
  espesor: 'Espesor',
  color: 'Color',
  dimensiones: 'Medidas',
  observaciones: 'Observaciones',
}
const concepts: Record<string, string> = {
  marca: 'MARCA',
  color_primario: 'COLOR',
  color_secundario: 'COLOR',
  unidad_stock: 'UNIDAD_MEDIDA',
  tipo: 'TIPO_PISO',
  material: 'MATERIAL_PISO',
  diseno: 'DISENO_PISO',
  acabado: 'ACABADO_PISO',
}
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
const present = (value: unknown) => value !== undefined && value !== null && value !== ''
function label(key: string) {
  return names[key] ?? key.replace(/_/g, ' ')
}
function valueText(value: unknown): string {
  if (!present(value)) return ''
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(' · ')
  const record = object(value)
  if (record) {
    if ('valor' in record)
      return [valueText(record.valor), valueText(record.unidad)].filter(Boolean).join(' ')
    if ('nombre' in record)
      return [valueText(record.nombre), valueText(record.cantidad), valueText(record.unidad)]
        .filter(Boolean)
        .join(' · ')
    return Object.entries(record)
      .filter(
        ([key, item]) => !['uid', 'schema_version', 'component_ref'].includes(key) && present(item),
      )
      .map(([key, item]) => `${label(key)}: ${valueText(item)}`)
      .join(' · ')
  }
  return typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)
}
function row(key: string, value: unknown, path = key): Row | null {
  if (!present(value)) return null
  const option = props.options?.[concepts[key] ?? '']?.find((option) => option.id === Number(value))
  let display = option?.nombre ?? valueText(value)
  if (['precio_unitario', 'descuento'].includes(key) && props.currency)
    display += ` ${props.currency}`
  const pending =
    props.evidence.some(
      (item) => item.decision === 'UNRESOLVED' && (item.label === key || item.label === path),
    ) ||
    ('pendientes' in props.result &&
      props.result.pendientes.some(
        (item) =>
          item.ruta === path || item.ruta.endsWith(`.${path}`) || item.ruta.startsWith(`${path}.`),
      ))
  return display ? { label: label(key), value: display, pending } : null
}
function rows(value: Record<string, unknown>, prefix = ''): Row[] {
  return Object.entries(value).flatMap(([key, value]) => {
    const found = row(key, value, prefix ? `${prefix}.${key}` : key)
    return found ? [found] : []
  })
}
const groups = computed<Group[]>(() => {
  if ('propuesta' in props.result) {
    const fields = props.result.propuesta?.fields ?? {}
    const { especificaciones, ...flat } = fields
    const basic = rows(flat)
    if (props.result.categoria)
      basic.unshift({
        label: 'Categoría seleccionada',
        value: { SILLA: 'Silla', PISO_FLOTANTE: 'Piso flotante', OTRO: 'Otro' }[
          props.result.categoria
        ],
        pending: false,
      })
    return [
      { title: 'Producto de catálogo', rows: basic },
      {
        title: 'Características reconocidas',
        rows: rows(object(especificaciones) ?? {}, 'especificaciones'),
      },
    ].filter((group) => group.rows.length)
  }
  const proposal = props.result.propuesta_configurador
  if (!proposal) return []
  const technical = object(proposal.especificacion?.datos_tecnicos) ?? {}
  const general = object(technical.caracteristicas_generales) ?? {}
  const dimensions = object(general.dimensiones) ?? {}
  const result: Group[] = [
    { title: 'Producto y condiciones comerciales', rows: rows(proposal.comercial ?? {}) },
    {
      title: 'Medidas reconocidas',
      rows: rows(dimensions, 'especificacion.datos_tecnicos.caracteristicas_generales.dimensiones'),
    },
  ]
  const attributes = Array.isArray(general.atributos) ? general.atributos : []
  const generalRows = attributes.flatMap((value) => {
    const attr = object(value)
    if (!attr || !present(attr.valor)) return []
    return [
      {
        label: String(attr.nombre ?? attr.codigo ?? 'Característica'),
        value: valueText({ valor: attr.valor, unidad: attr.unidad }),
        pending: false,
      },
    ]
  })
  if (generalRows.length) result.push({ title: 'Materiales y características', rows: generalRows })
  if (Array.isArray(technical.componentes))
    technical.componentes.forEach((value, index) => {
      const component = object(value)
      if (!component) return
      const visible = Object.fromEntries(
        Object.entries(component).filter(
          ([key]) => !['uid', 'conjunto_uid', 'atributos'].includes(key),
        ),
      )
      const list = rows(visible, `especificacion.datos_tecnicos.componentes.${index}`)
      if (component.atributos)
        list.push({
          label: 'Características',
          value: valueText(component.atributos),
          pending: false,
        })
      if (list.length) result.push({ title: `Componente ${index + 1}`, rows: list })
    })
  if (present(technical.accesorios))
    result.push({
      title: 'Accesorios',
      rows: [
        { label: 'Accesorios reconocidos', value: valueText(technical.accesorios), pending: false },
      ],
    })
  return result.filter((group) => group.rows.length)
})
</script>
<template>
  <section class="proposal-summary" aria-label="Atributos comerciales reconocidos">
    <section v-for="group in groups" :key="group.title" class="proposal-group">
      <h4>{{ group.title }}</h4>
      <dl>
        <div
          v-for="(item, index) in group.rows"
          :key="`${item.label}-${index}`"
          :class="{ 'proposal-pending': item.pending }"
        >
          <dt>
            {{ item.label }}
            <span v-if="item.pending" class="pending-badge">Requiere revisión</span>
          </dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>
<style scoped>
.proposal-summary {
  display: grid;
  gap: var(--space-3);
}
.proposal-group {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
h4 {
  margin: 0 0 var(--space-2);
}
dl {
  margin: 0;
  display: grid;
  gap: var(--space-2);
}
dl > div {
  padding: 0.35rem 0;
}
dt {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
dd {
  margin: 0.2rem 0 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-weight: 600;
}
.proposal-pending {
  border-inline-start: 2px dashed var(--color-warning, #947000);
  padding-inline-start: 0.5rem;
}
.pending-badge {
  display: inline-block;
  font-size: 0.75rem;
  margin-inline-start: 0.5rem;
}
</style>
