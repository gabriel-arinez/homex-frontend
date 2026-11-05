<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type {
  CamposCatalogo,
  FamiliaProducto,
  Producto,
  ProductoWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import CapturaCatalogo from './CapturaCatalogo.vue'
import { Armchair, Check, FileText, Layers, Mic, Package, Save, Tag, Trash2, X } from '@lucide/vue'
import { useFocusTrap } from '@/shared/composables/useFocusTrap'
import Modal from '@/shared/ui/Modal.vue'
import ImageGallery from '@/shared/media/ImageGallery.vue'
import type { LocalImage } from '@/shared/media/gallery'
import Button from '@/shared/ui/Button.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
const props = defineProps<{
  initial?: Producto
  processing?: boolean
  preselectCategory?: string
  serverErrors?: Record<string, string[]>
  canUploadImage?: boolean
}>()
const emit = defineEmits<{
  save: [body: ProductoWritable, images: LocalImage[]]
  cancel: []
  change: []
}>()
const opciones = reactive<Record<string, ValorCatalogoPublico[]>>({})
const familias = ref<FamiliaProducto[]>([])
const loading = ref(true)
const error = ref('')
const fields = ref<Record<string, string[]>>({})
const images = ref<LocalImage[]>([])
const voiceOpen = ref(false)
const voicePanel = ref<HTMLElement | null>(null)
useFocusTrap(voicePanel, voiceOpen)
const voiceCandidates = ref<Array<[string, unknown]>>([])
const voiceConflicts = ref<
  Array<{ key: string; current: string; suggested: string; selected: boolean }>
>([])
const voiceLabels: Record<string, string> = {
  nombre: 'Nombre comercial',
  observaciones: 'Observaciones',
  precio_lista: 'Precio de lista',
  unidad_stock: 'Unidad comercial',
  marca: 'Marca',
  modelo: 'Modelo',
  color_primario: 'Color primario',
  color_secundario: 'Color secundario',
  especificaciones: 'Características',
  tipo: 'Tipo de piso',
  material: 'Material',
  diseno: 'Diseño',
  acabado: 'Acabado',
  espesor_mm: 'Espesor',
  largo_mm: 'Largo',
  ancho_mm: 'Ancho',
  m2_por_caja: 'm² por caja',
}
const fieldError = (name: string) => fields.value[name]?.[0] ?? props.serverErrors?.[name]?.[0]
const money = (value: string | number) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value) || 0)
const discountPercent = computed(() => {
  const before = Number(form.precio_lista)
  const after = Number(form.precio_ahora)
  return before > 0 && after >= 0 && after <= before
    ? Math.round(((before - after) / before) * 100)
    : null
})
const form = reactive({
  categoria: String(props.initial?.categoria ?? ''),
  familia: String(props.initial?.familia ?? ''),
  sku: props.initial?.sku ?? '',
  nombre: props.initial?.nombre ?? '',
  precio_lista: props.initial?.precio_lista ?? '',
  unidad_stock: String(props.initial?.unidad_stock ?? ''),
  observaciones: props.initial?.observaciones ?? '',
  activo: props.initial?.activo !== false,
  marca: String(props.initial?.silla?.marca ?? props.initial?.piso?.marca ?? ''),
  modelo: props.initial?.silla?.modelo ?? props.initial?.piso?.modelo ?? '',
  color_primario: String(props.initial?.silla?.color_primario ?? ''),
  color_secundario: String(props.initial?.silla?.color_secundario ?? ''),
  especificaciones: props.initial?.silla?.especificaciones
    ? JSON.stringify(props.initial.silla.especificaciones)
    : '',
  tipo: String(props.initial?.piso?.tipo ?? ''),
  material: String(props.initial?.piso?.material ?? ''),
  diseno: String(props.initial?.piso?.diseno ?? ''),
  acabado: String(props.initial?.piso?.acabado ?? ''),
  espesor_mm: props.initial?.piso?.espesor_mm ?? '',
  largo_mm: props.initial?.piso?.largo_mm ?? '',
  ancho_mm: props.initial?.piso?.ancho_mm ?? '',
  m2_por_caja: props.initial?.piso?.m2_por_caja ?? '',
  promo_activa: Boolean(props.initial?.promocion),
  promo_enabled: props.initial?.promocion?.activo ?? true,
  precio_ahora: props.initial?.promocion?.precio_ahora ?? '',
  fecha_inicio: props.initial?.promocion?.fecha_inicio ?? '',
  fecha_fin: props.initial?.promocion?.fecha_fin ?? '',
})
const promoStatus = computed(() => {
  if (!form.promo_activa || !form.promo_enabled) return 'Desactivada'
  const today = new Date().toLocaleDateString('sv-SE')
  if (form.fecha_inicio && form.fecha_inicio > today) return 'Programada'
  if (form.fecha_fin && form.fecha_fin < today) return 'Finalizada'
  return 'Vigente'
})
const promoUnchanged = computed(() => {
  const previous = props.initial?.promocion
  if (!previous || !form.promo_activa) return false
  return (
    Number(form.precio_lista) === Number(props.initial?.precio_lista) &&
    Number(form.precio_ahora) === Number(previous.precio_ahora) &&
    (form.fecha_inicio || null) === (previous.fecha_inicio || null) &&
    (form.fecha_fin || null) === (previous.fecha_fin || null) &&
    form.promo_enabled === previous.activo
  )
})
const legacyPromotion = computed(() => {
  const previous = props.initial?.promocion
  return Boolean(previous && Number(previous.precio_antes) !== Number(props.initial?.precio_lista))
})
type TipoCampo = 'texto' | 'numero' | 'booleano' | 'nulo'
type CampoSilla = { clave: string; valor: string; tipo: TipoCampo }
function esObjeto(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function camposSimples(value: unknown): CampoSilla[] {
  if (!esObjeto(value)) return []
  return Object.entries(value)
    .filter(([, dato]) => dato === null || typeof dato !== 'object')
    .map(([clave, dato]) => ({
      clave,
      valor: dato === null ? '' : String(dato),
      tipo:
        dato === null
          ? 'nulo'
          : typeof dato === 'number'
            ? 'numero'
            : typeof dato === 'boolean'
              ? 'booleano'
              : 'texto',
    }))
}
const camposSilla = ref<CampoSilla[]>(camposSimples(props.initial?.silla?.especificaciones))
function objetoEspecificaciones(): unknown {
  const datos: unknown = form.especificaciones.trim() ? JSON.parse(form.especificaciones) : {}
  if (!esObjeto(datos)) {
    throw new Error('Las características guardadas requieren revisión técnica para conservarlas.')
  }
  const combinado: Record<string, unknown> = { ...datos }
  for (const campo of camposSimples(datos)) delete combinado[campo.clave]
  const claves = new Set<string>()
  for (const campo of camposSilla.value) {
    const clave = campo.clave.trim()
    if (!clave) throw new Error('Cada característica debe tener un nombre.')
    if (claves.has(clave)) throw new Error('No se puede repetir una característica de la silla.')
    if (clave in combinado) throw new Error('Ya existe una característica avanzada con ese nombre.')
    claves.add(clave)
    if (campo.tipo === 'numero') {
      if (!campo.valor.trim() || !Number.isFinite(Number(campo.valor))) {
        throw new Error('Las características numéricas requieren un número válido.')
      }
      combinado[clave] = Number(campo.valor)
    } else if (campo.tipo === 'booleano') combinado[clave] = campo.valor === 'true'
    else if (campo.tipo === 'nulo') combinado[clave] = null
    else combinado[clave] = campo.valor
  }
  return combinado
}
function agregarCampoSilla() {
  camposSilla.value.push({ clave: '', valor: '', tipo: 'texto' })
  emit('change')
}
function quitarCampoSilla(index: number) {
  camposSilla.value.splice(index, 1)
  emit('change')
}
const categoria = computed(
  () => opciones.CATEGORIA_PRODUCTO?.find((x) => String(x.id) === form.categoria)?.codigo,
)
const opts = (key: string, empty = 'Sin seleccionar') => [
  { label: empty, value: '' },
  ...(opciones[key] ?? []).map((x) => ({ label: x.nombre, value: String(x.id) })),
]
function describeVoice(key: string, value: unknown): string {
  const groups: Record<string, string> = {
    unidad_stock: 'UNIDAD_MEDIDA',
    marca: 'MARCA',
    color_primario: 'COLOR',
    color_secundario: 'COLOR',
    tipo: 'TIPO_PISO',
    material: 'MATERIAL_PISO',
    diseno: 'DISENO_PISO',
    acabado: 'ACABADO_PISO',
  }
  const match = groups[key]
  if (match)
    return (
      opciones[match]?.find((item) => String(item.id) === String(value))?.nombre ?? String(value)
    )
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value ?? '')
}
function applyProposals(proposals: Array<[string, unknown]>) {
  const current = form as Record<string, unknown>
  for (const [key, value] of proposals) {
    if (key === 'especificaciones') {
      form.especificaciones = JSON.stringify(value)
      camposSilla.value = camposSimples(value)
    } else current[key] = String(value)
  }
  if (proposals.length) emit('change')
  voiceOpen.value = false
}
function applyVoice(suggested: CamposCatalogo) {
  const allowed = new Set([
    'nombre',
    'observaciones',
    'precio_lista',
    'unidad_stock',
    ...(categoria.value === 'SILLA'
      ? ['marca', 'modelo', 'color_primario', 'color_secundario', 'especificaciones']
      : []),
    ...(categoria.value === 'PISO_FLOTANTE'
      ? [
          'marca',
          'modelo',
          'tipo',
          'material',
          'diseno',
          'acabado',
          'espesor_mm',
          'largo_mm',
          'ancho_mm',
          'm2_por_caja',
        ]
      : []),
  ])
  const concepts: Record<string, string> = {
    unidad_stock: 'UNIDAD_MEDIDA',
    marca: 'MARCA',
    color_primario: 'COLOR',
    color_secundario: 'COLOR',
    tipo: 'TIPO_PISO',
    material: 'MATERIAL_PISO',
    diseno: 'DISENO_PISO',
    acabado: 'ACABADO_PISO',
  }
  const candidates = Object.entries(suggested).filter(
    ([key, value]) =>
      allowed.has(key) &&
      value != null &&
      (!concepts[key] ||
        opciones[concepts[key]]?.some((item) => String(item.id) === String(value))),
  )
  const current = form as Record<string, unknown>
  const collisions = candidates.filter(([key, value]) => {
    if (key === 'especificaciones')
      return camposSilla.value.length > 0 || Boolean(form.especificaciones)
    return current[key] !== '' && current[key] != null && String(current[key]) !== String(value)
  })
  if (!collisions.length) {
    applyProposals(candidates)
    return
  }
  voiceCandidates.value = candidates
  voiceConflicts.value = collisions.map(([key, value]) => ({
    key,
    current: describeVoice(key, key === 'especificaciones' ? form.especificaciones : current[key]),
    suggested: describeVoice(key, value),
    selected: false,
  }))
  voiceOpen.value = false
}
function rejectVoice() {
  voiceCandidates.value = []
  voiceConflicts.value = []
}
function acceptVoice() {
  const conflictKeys = new Set(voiceConflicts.value.map((item) => item.key))
  const accepted = new Set(
    voiceConflicts.value.filter((item) => item.selected).map((item) => item.key),
  )
  applyProposals(
    voiceCandidates.value.filter(([key]) => !conflictKeys.has(key) || accepted.has(key)),
  )
  rejectVoice()
}
async function load() {
  loading.value = true
  try {
    const keys = [
      'CATEGORIA_PRODUCTO',
      'UNIDAD_MEDIDA',
      'MARCA',
      'COLOR',
      'TIPO_PISO',
      'MATERIAL_PISO',
      'DISENO_PISO',
      'ACABADO_PISO',
    ] as const
    const [f, ...values] = await Promise.all([
      proformasService.families(),
      ...keys.map((k) => proformasService.options(k)),
    ])
    familias.value = f.results
    keys.forEach((k, i) => (opciones[k] = values[i] as ValorCatalogoPublico[]))
    if (!props.initial && props.preselectCategory) {
      const categoria = opciones.CATEGORIA_PRODUCTO?.find(
        (item) => item.codigo === props.preselectCategory,
      )
      if (categoria) {
        form.categoria = String(categoria.id)
        const unidadCodigo = categoria.codigo === 'PISO_FLOTANTE' ? 'M2' : 'PIEZA'
        const unidad = opciones.UNIDAD_MEDIDA?.find((item) => item.codigo === unidadCodigo)
        if (unidad) form.unidad_stock = String(unidad.id)
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se cargaron los catálogos.'
  } finally {
    loading.value = false
  }
}
watch(
  () => form.categoria,
  () => {
    if (props.initial || loading.value) return
    voiceOpen.value = false
    const code = categoria.value
    const unit = code === 'SILLA' ? 'PIEZA' : code === 'PISO_FLOTANTE' ? 'M2' : ''
    const match = opciones.UNIDAD_MEDIDA?.find((item) => item.codigo === unit)
    form.unidad_stock = match ? String(match.id) : ''
  },
)
function focusInvalidField() {
  void nextTick(() => {
    document.querySelector<HTMLInputElement>('.product-form [aria-invalid="true"]')?.focus()
  })
}
function nullable(value: string) {
  return value ? Number(value) : null
}
function submit(): boolean {
  if ((loading.value && !props.initial) || props.processing) return false
  error.value = ''
  fields.value = {}
  if (!form.categoria) fields.value.categoria = ['Selecciona una categoría.']
  if (!form.nombre.trim()) fields.value.nombre = ['El nombre comercial es obligatorio.']
  if (!form.sku.trim()) fields.value.sku = ['Ingresa un SKU.']
  if (!form.unidad_stock) fields.value.unidad_stock = ['Selecciona una unidad comercial.']
  if (
    form.precio_lista === '' ||
    !Number.isFinite(Number(form.precio_lista)) ||
    Number(form.precio_lista) < 0
  )
    fields.value.precio_lista = ['Ingresa un precio válido.']
  if (form.promo_activa) {
    const before = Number(form.precio_lista)
    const after = Number(form.precio_ahora)
    if (
      form.precio_ahora === '' ||
      !Number.isFinite(before) ||
      !Number.isFinite(after) ||
      before < 0 ||
      after < 0 ||
      after > before
    ) {
      fields.value.promocion = [
        'Revisa los precios de la promoción. El promocional no puede superar al anterior.',
      ]
    }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio)
      fields.value.promocion = ['La fecha final no puede ser anterior al inicio.']
  }
  if (Object.keys(fields.value).length) {
    error.value = 'Revisa los campos señalados antes de guardar.'
    focusInvalidField()
    return false
  }
  let especificaciones: unknown = null
  try {
    if (categoria.value === 'SILLA') {
      especificaciones = objetoEspecificaciones()
    }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Revisa las características adicionales de la silla.'
    return false
  }
  const body: ProductoWritable = {
    categoria: Number(form.categoria),
    familia: nullable(form.familia),
    sku: form.sku,
    nombre: form.nombre,
    precio_lista: form.precio_lista,
    unidad_stock: Number(form.unidad_stock),
    observaciones: form.observaciones || null,
    activo: form.activo,
  }
  if (categoria.value === 'SILLA')
    body.silla = {
      marca: nullable(form.marca),
      modelo: form.modelo || null,
      color_primario: nullable(form.color_primario),
      color_secundario: nullable(form.color_secundario),
      especificaciones,
    }
  if (categoria.value === 'PISO_FLOTANTE')
    body.piso = {
      marca: nullable(form.marca),
      modelo: form.modelo || null,
      tipo: nullable(form.tipo),
      material: nullable(form.material),
      diseno: nullable(form.diseno),
      acabado: nullable(form.acabado),
      espesor_mm: form.espesor_mm || null,
      largo_mm: form.largo_mm || null,
      ancho_mm: form.ancho_mm || null,
      m2_por_caja: form.m2_por_caja || null,
    }
  if (!form.promo_activa && props.initial?.promocion) body.promocion = null
  // Conservar promociones históricas intactas si no se editaron.
  if (form.promo_activa && !promoUnchanged.value)
    body.promocion = {
      precio_antes: form.precio_lista,
      precio_ahora: form.precio_ahora,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      activo: form.promo_enabled,
    }
  emit('save', body, images.value)
  return true
}
defineExpose({ submit })
onMounted(load)
</script>
<template>
  <form
    class="product-form"
    :aria-busy="loading || processing"
    @input="emit('change')"
    @change="emit('change')"
    @submit.prevent="submit"
  >
    <header class="form-intro">
      <div>
        <p class="eyebrow">CATÁLOGO COMERCIAL</p>
        <h2>
          {{
            initial
              ? 'Editar producto'
              : categoria === 'SILLA'
                ? 'Nueva silla'
                : categoria === 'PISO_FLOTANTE'
                  ? 'Nuevo piso flotante'
                  : 'Datos del producto'
          }}
        </h2>
        <p class="muted">
          Organiza los datos comerciales. Los campos marcados con * son obligatorios.
        </p>
      </div>
      <Button
        v-if="!initial && categoria"
        class="voice-trigger"
        :disabled="loading || processing"
        @click="voiceOpen = true"
      >
        <Mic :size="18" aria-hidden="true" /> Completar por voz
      </Button>
    </header>
    <p v-if="error" class="error-summary" role="alert">{{ error }}</p>
    <p v-if="loading" role="status" class="loading-note">Cargando opciones del catálogo…</p>
    <div class="catalog-layout">
      <div class="form-main">
        <section class="catalog-section" aria-labelledby="general-title">
          <div class="section-heading">
            <Package :size="20" aria-hidden="true" />
            <div>
              <h3 id="general-title">Información general</h3>
              <p>Identificación del producto dentro del catálogo HOMEX.</p>
            </div>
          </div>
          <div class="fields-grid">
            <div class="full-field">
              <TextField
                v-model="form.nombre"
                name="nombre"
                label="Nombre comercial *"
                placeholder="Ej. Silla ejecutiva ergonómica"
                :max-length="200"
                :error="fieldError('nombre')"
              />
            </div>
            <div>
              <Select
                v-model="form.categoria"
                name="categoria"
                label="Categoría *"
                :disabled="Boolean(initial)"
                :options="opts('CATEGORIA_PRODUCTO', 'Seleccionar categoría')"
              />
              <small v-if="fieldError('categoria')" class="field-error" role="alert">{{
                fieldError('categoria')
              }}</small>
            </div>
            <div>
              <Select
                v-model="form.familia"
                name="familia"
                label="Familia del producto (opcional)"
                :options="[
                  { label: 'Sin familia', value: '' },
                  ...familias
                    .filter((f) => f.activo !== false || String(f.id) === form.familia)
                    .map((f) => ({ label: f.nombre, value: String(f.id) })),
                ]"
              />
              <small v-if="fieldError('familia')" class="field-error" role="alert">{{
                fieldError('familia')
              }}</small>
            </div>
            <TextField
              v-model="form.sku"
              name="sku"
              label="Código SKU *"
              placeholder="Ej. SIL-001"
              :max-length="80"
              :error="fieldError('sku')"
              hint="Código único utilizado para identificar el producto."
            />
            <div>
              <Select
                v-model="form.unidad_stock"
                name="unidad"
                label="Unidad comercial *"
                :disabled="
                  Boolean(initial) || categoria === 'SILLA' || categoria === 'PISO_FLOTANTE'
                "
                :options="opts('UNIDAD_MEDIDA', 'Seleccionar unidad')"
              />
              <small v-if="fieldError('unidad_stock')" class="field-error" role="alert">{{
                fieldError('unidad_stock')
              }}</small>
              <small
                v-else-if="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE'"
                class="field-hint"
                >Unidad fijada por la categoría.</small
              >
            </div>
          </div>
        </section>

        <section
          v-if="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE'"
          class="catalog-section"
          aria-labelledby="features-title"
        >
          <div class="section-heading">
            <Armchair v-if="categoria === 'SILLA'" :size="20" aria-hidden="true" />
            <Layers v-else :size="20" aria-hidden="true" />
            <div>
              <h3 id="features-title">
                {{
                  categoria === 'SILLA'
                    ? 'Características de la silla'
                    : 'Características del piso flotante'
                }}
              </h3>
              <p>Detalles técnicos y comerciales para identificar correctamente el artículo.</p>
            </div>
          </div>
          <div class="fields-grid">
            <div>
              <Select v-model="form.marca" name="marca" label="Marca" :options="opts('MARCA')" />
              <small
                v-if="fieldError('silla.marca') || fieldError('piso.marca')"
                class="field-error"
                role="alert"
                >{{ fieldError('silla.marca') || fieldError('piso.marca') }}</small
              >
            </div>
            <TextField
              v-model="form.modelo"
              name="modelo"
              label="Modelo"
              placeholder="Ej. Ejecutivo X1"
            />
            <template v-if="categoria === 'SILLA'">
              <Select
                v-model="form.color_primario"
                name="color1"
                label="Color primario"
                :options="opts('COLOR')"
              />
              <Select
                v-model="form.color_secundario"
                name="color2"
                label="Color secundario"
                :options="opts('COLOR')"
              />
            </template>
            <template v-else>
              <Select
                v-model="form.tipo"
                name="tipo-piso"
                label="Tipo"
                :options="opts('TIPO_PISO')"
              />
              <Select
                v-model="form.material"
                name="material"
                label="Material"
                :options="opts('MATERIAL_PISO')"
              />
              <Select
                v-model="form.diseno"
                name="diseno"
                label="Diseño"
                :options="opts('DISENO_PISO')"
              />
              <Select
                v-model="form.acabado"
                name="acabado"
                label="Acabado"
                :options="opts('ACABADO_PISO')"
              />
              <TextField
                v-model="form.espesor_mm"
                name="espesor"
                label="Espesor (mm)"
                type="number"
                min="0"
                step="0.01"
                :error="fieldError('piso.espesor_mm')"
              />
              <TextField
                v-model="form.largo_mm"
                name="largo"
                label="Largo descriptivo (mm)"
                type="number"
                min="0"
                step="0.01"
              />
              <TextField
                v-model="form.ancho_mm"
                name="ancho"
                label="Ancho descriptivo (mm)"
                type="number"
                min="0"
                step="0.01"
              />
              <TextField
                v-model="form.m2_por_caja"
                name="m2-caja"
                label="m² por caja"
                type="number"
                min="0"
                step="0.0001"
                hint="Dato informativo; no calcula existencias."
              />
            </template>
          </div>
          <div v-if="categoria === 'SILLA'" class="extras">
            <div class="extras-heading">
              <div>
                <h4>Características adicionales de la silla</h4>
                <p class="muted">Añade propiedades particulares de esta silla.</p>
              </div>
            </div>
            <div class="extras-list">
              <div v-for="(campo, index) in camposSilla" :key="index" class="extra-row">
                <label
                  >Característica
                  <input
                    v-model="campo.clave"
                    list="silla-atributos-sugeridos"
                    :aria-label="'Característica ' + (index + 1)"
                    placeholder="Ej. Apoyabrazos"
                  />
                </label>
                <label
                  >Valor
                  <input
                    v-model="campo.valor"
                    :aria-label="'Valor ' + (index + 1)"
                    :disabled="campo.tipo === 'nulo' || campo.tipo === 'booleano'"
                    placeholder="Ej. Ajustables"
                  />
                </label>
                <label
                  >Tipo de respuesta
                  <select v-model="campo.tipo" :aria-label="'Tipo de respuesta ' + (index + 1)">
                    <option value="texto">Texto</option>
                    <option value="numero">Número</option>
                    <option value="booleano">Sí / No</option>
                    <option v-if="campo.tipo === 'nulo'" value="nulo">Sin valor</option>
                  </select>
                </label>
                <label v-if="campo.tipo === 'booleano'"
                  >Valor lógico
                  <select v-model="campo.valor" :aria-label="'Valor lógico ' + (index + 1)">
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <button
                  type="button"
                  class="icon-remove"
                  :aria-label="'Quitar característica ' + (index + 1)"
                  @click="quitarCampoSilla(index)"
                >
                  <Trash2 :size="17" aria-hidden="true" />
                </button>
              </div>
              <datalist id="silla-atributos-sugeridos">
                <option value="Apoyabrazos" />
                <option value="Altura regulable" />
                <option value="Material del asiento" />
                <option value="Soporte lumbar" />
                <option value="Reposacabezas" />
              </datalist>
              <p v-if="!camposSilla.length" class="extras-empty">
                No hay características adicionales. Puedes añadirlas cuando sean necesarias.
              </p>
              <Button type="button" variant="secondary" class="add-extra" @click="agregarCampoSilla"
                >+ Añadir característica</Button
              >
            </div>
            <p
              v-if="fieldError('silla') || fieldError('silla.especificaciones')"
              class="field-error"
              role="alert"
            >
              {{ fieldError('silla') || fieldError('silla.especificaciones') }}
            </p>
          </div>
        </section>

        <section class="catalog-section" aria-labelledby="price-title">
          <div class="section-heading">
            <Tag :size="20" aria-hidden="true" />
            <div>
              <h3 id="price-title">Precio y promociones</h3>
              <p>Establece el precio normal de venta y, opcionalmente, una promoción.</p>
            </div>
          </div>
          <div class="price-field">
            <TextField
              v-model="form.precio_lista"
              name="precio"
              label="Precio normal de venta (Bs) *"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              :error="fieldError('precio_lista')"
            />
          </div>
          <div class="promotion">
            <label class="toggle-row">
              <span class="toggle-copy"
                ><strong>Configurar promoción</strong>
                <small
                  >Ofrece un precio temporal sin cambiar el precio normal de venta.</small
                ></span
              >
              <input v-model="form.promo_activa" type="checkbox" class="switch-input" />
              <span class="switch-ui" aria-hidden="true" />
            </label>
            <div v-if="form.promo_activa" class="promotion-fields">
              <p v-if="legacyPromotion && promoUnchanged" class="promotion-legacy">
                Esta promoción conserva un precio anterior histórico distinto del normal.
                No cambiará mientras no edites la promoción.
              </p>
              <p class="promotion-base">
                Precio de referencia: <strong>{{ money(form.precio_lista) }}</strong>
                (precio normal de venta).
              </p>
              <div class="fields-grid">
                <TextField
                  v-model="form.precio_ahora"
                  name="ahora"
                  label="Precio promocional (Bs)"
                  type="number"
                  min="0"
                  step="0.01"
                />
                <TextField
                  v-model="form.fecha_inicio"
                  name="inicio"
                  label="Fecha de inicio"
                  type="date"
                />
                <TextField
                  v-model="form.fecha_fin"
                  name="fin"
                  label="Fecha de finalización"
                  type="date"
                />
              </div>
              <p v-if="fieldError('promocion')" class="field-error" role="alert">
                {{ fieldError('promocion') }}
              </p>
              <div v-if="discountPercent !== null" class="discount-preview">
                <strong>{{ discountPercent }} % de descuento</strong>
                <span>{{ money(form.precio_lista) }} → {{ money(form.precio_ahora) }}</span>
              </div>
              <p class="promotion-status" role="status">Estado de la promoción: <strong>{{ promoStatus }}</strong></p>
              <label class="toggle-row">
                <span class="toggle-copy"
                  ><strong>Promoción habilitada</strong>
                  <small
                    >La promoción se aplica solo si está habilitada y dentro del período
                    indicado.</small
                  ></span
                >
                <input v-model="form.promo_enabled" type="checkbox" class="switch-input" />
                <span class="switch-ui" aria-hidden="true" />
              </label>
            </div>
          </div>
        </section>

        <section class="catalog-section" aria-labelledby="notes-title">
          <div class="section-heading">
            <FileText :size="20" aria-hidden="true" />
            <div>
              <h3 id="notes-title">Observaciones</h3>
              <p>Información complementaria que no forma parte de la ficha técnica.</p>
            </div>
          </div>
          <label class="notes-label" for="observaciones">Notas del producto (opcional)</label>
          <textarea
            id="observaciones"
            v-model="form.observaciones"
            name="observaciones"
            rows="4"
            placeholder="Ej. Recomendaciones de uso, detalles comerciales o aclaraciones…"
          />
          <small v-if="fieldError('observaciones')" class="field-error" role="alert">{{
            fieldError('observaciones')
          }}</small>
        </section>
      </div>

      <aside class="form-aside" aria-label="Imagen y disponibilidad">
        <section class="catalog-section aside-card" aria-labelledby="image-title">
          <p v-if="canUploadImage === false" class="muted tiny">
            La gestión de imágenes requiere permiso comercial.
          </p>
          <ImageGallery
            v-model="images"
            :endpoint="initial ? `/api/v1/catalogo/productos/${initial.id}/imagenes/` : undefined"
            :editable="!initial && canUploadImage !== false"
            @changed="emit('change')"
          />
          <p v-if="initial && canUploadImage !== false" class="muted tiny">
            Gestiona las imágenes desde la ficha del producto. Los cambios de la galería se guardan
            al instante, independientemente de los datos comerciales.
          </p>
        </section>
        <section class="catalog-section aside-card" aria-labelledby="status-title">
          <div class="aside-heading">
            <Check :size="19" aria-hidden="true" />
            <h3 id="status-title">Disponibilidad</h3>
          </div>
          <label class="toggle-row">
            <span class="toggle-copy"
              ><strong>Producto activo</strong>
              <small>{{
                form.activo
                  ? 'Visible para las operaciones comerciales.'
                  : 'El producto quedará inactivo.'
              }}</small></span
            >
            <input v-model="form.activo" type="checkbox" class="switch-input" />
            <span class="switch-ui" aria-hidden="true" />
          </label>
          <div class="stock-note">
            <strong>Control de existencias</strong>
            <p>
              El stock inicial es cero. Las existencias se modifican únicamente mediante movimientos
              autorizados.
            </p>
          </div>
        </section>
      </aside>
    </div>

    <footer class="sticky-actions">
      <p class="muted">Revisa la información antes de guardar el producto.</p>
      <div class="actions">
        <Button type="button" variant="secondary" :disabled="processing" @click="emit('cancel')"
          >Cancelar</Button
        >
        <Button
          type="submit"
          :processing="processing"
          processing-label="Guardando producto…"
          :disabled="loading"
        >
          <Save :size="17" aria-hidden="true" />
          {{ initial ? 'Guardar cambios' : 'Guardar producto' }}
        </Button>
      </div>
    </footer>
  </form>

  <Teleport to="body">
    <div v-if="voiceOpen" class="voice-backdrop" @mousedown.self="voiceOpen = false">
      <aside
        ref="voicePanel"
        class="voice-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-title"
        @keydown.esc="voiceOpen = false"
      >
        <header class="drawer-header">
          <div>
            <p class="eyebrow">ASISTENCIA COMERCIAL</p>
            <h2 id="voice-title">Completar por voz</h2>
            <p class="muted">Describe tu producto y revisa la propuesta antes de aplicarla.</p>
          </div>
          <button
            type="button"
            class="drawer-close"
            aria-label="Cerrar asistente de voz"
            @click="voiceOpen = false"
          >
            <X :size="20" aria-hidden="true" />
          </button>
        </header>
        <CapturaCatalogo
          v-if="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE' || categoria === 'OTRO'"
          :key="categoria"
          :categoria="categoria"
          :opciones="opciones"
          @apply="applyVoice"
        />
      </aside>
    </div>
  </Teleport>
  <Modal
    :open="voiceConflicts.length > 0"
    title="Revisar cambios sugeridos"
    description="Selecciona qué valores manuales quieres sustituir. Los campos vacíos se completarán automáticamente."
    wide
    @close="rejectVoice"
  >
    <div class="conflict-list">
      <label v-for="item in voiceConflicts" :key="item.key" class="conflict-item">
        <input
          v-model="item.selected"
          type="checkbox"
          :aria-label="'Reemplazar ' + (voiceLabels[item.key] || item.key)"
        />
        <span class="conflict-copy"
          ><strong>{{ voiceLabels[item.key] || item.key }}</strong>
          <span>Actual: {{ item.current }}</span
          ><span>Sugerido: {{ item.suggested }}</span></span
        >
      </label>
    </div>
    <template #footer>
      <Button variant="secondary" @click="rejectVoice">Conservar valores actuales</Button>
      <Button @click="acceptVoice">Aplicar selección</Button>
    </template>
  </Modal>
</template>
<style scoped>
.product-form {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}
.form-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}
.form-intro h2 {
  margin: 0.15rem 0 0.2rem;
  font-size: clamp(1.2rem, 2vw, 1.55rem);
}
.form-intro p {
  margin: 0;
}
.eyebrow {
  color: var(--color-primary);
  font-size: 0.71rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.muted {
  color: var(--color-text-secondary);
}
.voice-trigger {
  white-space: nowrap;
}
.catalog-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.35fr);
  align-items: start;
  gap: var(--space-5);
}
.form-main,
.form-aside {
  min-width: 0;
  display: grid;
  gap: var(--space-5);
}
.catalog-section {
  min-width: 0;
  padding: clamp(1rem, 2vw, 1.5rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.section-heading,
.aside-heading {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.section-heading > svg,
.aside-heading > svg {
  flex: 0 0 auto;
  color: var(--color-primary);
}
.section-heading h3,
.aside-heading h3 {
  font-size: 1.07rem;
  margin: 0;
}
.section-heading p {
  margin: 0.35rem 0 0;
  color: var(--color-text-secondary);
  font-size: 0.87rem;
}
.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--space-4);
  row-gap: var(--space-5);
}
.fields-grid > * {
  min-width: 0;
}
.full-field {
  grid-column: 1 / -1;
}
.field-hint,
.field-error {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.8rem;
}
.field-hint {
  color: var(--color-text-secondary);
}
.field-error,
.error-summary {
  color: var(--color-danger-text);
}
.error-summary {
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
}
.loading-note {
  padding: var(--space-6);
  color: var(--color-text-secondary);
}
.extras {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.extras-heading h4 {
  margin: 0;
  font-size: 0.96rem;
}
.extras-heading p {
  margin: 0.3rem 0 var(--space-4);
  font-size: 0.83rem;
}
.extras-list {
  display: grid;
  gap: var(--space-3);
}
.extra-row {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--space-3);
}
.extra-row label {
  min-width: 0;
  flex: 1 1 9rem;
  display: grid;
  gap: var(--space-2);
  font-size: 0.86rem;
  font-weight: 600;
}
.extra-row input,
.extra-row select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
}
.extra-row input:disabled {
  opacity: 0.55;
}
.icon-remove {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.icon-remove:hover,
.icon-remove:focus-visible {
  background: var(--color-danger-soft);
}
.extras-empty {
  color: var(--color-text-secondary);
  font-size: 0.83rem;
}
.promotion-status {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-secondary);
}
.promotion-status strong {
  color: var(--color-text);
}
.promotion-legacy {
  padding: var(--space-3);
  border-left: 3px solid var(--color-warning);
  background: var(--color-surface-soft);
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  margin: 0;
}
.promotion-base {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-secondary);
}
.add-extra {
  justify-self: start;
}
.price-field {
  max-width: 22rem;
}
.promotion {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  cursor: pointer;
}
.toggle-copy {
  display: grid;
  gap: 0.3rem;
}
.toggle-copy strong {
  font-size: 0.93rem;
}
.toggle-copy small {
  color: var(--color-text-secondary);
  font-size: 0.81rem;
  font-weight: 400;
  line-height: 1.5;
}
.switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.switch-ui {
  position: relative;
  display: block;
  flex: 0 0 2.7rem;
  width: 2.7rem;
  height: 1.6rem;
  border-radius: 2rem;
  background: var(--color-border-strong);
  transition: background 0.16s ease;
}
.switch-ui::after {
  position: absolute;
  content: '';
  top: 0.2rem;
  left: 0.2rem;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 50%;
  background: white;
  transition: transform 0.16s ease;
  box-shadow: 0 1px 3px #0003;
}
.switch-input:checked + .switch-ui {
  background: var(--color-primary);
}
.switch-input:checked + .switch-ui::after {
  transform: translateX(1.1rem);
}
.switch-input:focus-visible + .switch-ui {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}
.promotion-fields {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-5);
}
.discount-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-soft);
  border-radius: var(--radius-control);
}
.discount-preview strong {
  color: var(--color-success);
}
.notes-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: var(--space-2);
}
textarea {
  display: block;
  min-height: 7rem;
  resize: vertical;
}
.aside-heading {
  margin-bottom: var(--space-4);
}
.image-preview {
  aspect-ratio: 4/3;
  width: 100%;
  overflow: hidden;
  display: grid;
  place-items: center;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.image-preview :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.image-empty {
  display: grid;
  place-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-4);
}
.image-empty p {
  margin: 0;
  font-size: 0.84rem;
}
.file-hidden {
  position: absolute;
  height: 1px;
  width: 1px;
  opacity: 0;
}
.image-button {
  width: 100%;
  margin-top: var(--space-3);
}
.text-action {
  border: 0;
  background: transparent;
  color: var(--color-danger-text);
  text-decoration: underline;
  cursor: pointer;
  padding: 0.5rem 0;
}
.tiny {
  font-size: 0.77rem;
  line-height: 1.5;
  margin: 0.6rem 0 0;
}
.stock-note {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}
.stock-note strong {
  font-size: 0.85rem;
}
.stock-note p {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  line-height: 1.55;
  margin: 0.5rem 0 0;
}
.sticky-actions {
  position: sticky;
  z-index: 5;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  box-shadow: 0 -3px 15px #0001;
}
.sticky-actions p {
  font-size: 0.79rem;
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.voice-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  justify-content: flex-end;
  background: var(--color-overlay);
}
.voice-drawer {
  display: flex;
  flex-direction: column;
  width: min(44rem, 100%);
  height: 100dvh;
  overflow-y: auto;
  background: var(--color-surface-raised);
  border-left: 1px solid var(--color-border);
}
.drawer-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}
.drawer-header h2 {
  margin: 0.2rem 0;
  font-size: 1.45rem;
}
.drawer-header p {
  margin: 0;
  font-size: 0.85rem;
}
.drawer-close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: transparent;
  cursor: pointer;
}
.conflict-list {
  display: grid;
  gap: var(--space-3);
}
.conflict-item {
  display: flex;
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
}
.conflict-item input {
  margin-top: 0.25rem;
}
.conflict-copy {
  min-width: 0;
  display: grid;
  gap: 0.35rem;
  overflow-wrap: anywhere;
}
.conflict-copy span {
  color: var(--color-text-secondary);
  font-size: 0.84rem;
}
@media (max-width: 73rem) {
  .catalog-layout {
    grid-template-columns: minmax(0, 1fr) 17rem;
  }
}
@media (max-width: 60rem) {
  .catalog-layout {
    grid-template-columns: 1fr;
  }
  .form-aside {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 42rem) {
  .fields-grid,
  .form-aside {
    grid-template-columns: 1fr;
  }
  .full-field {
    grid-column: auto;
  }
  .form-intro {
    align-items: start;
  }
  .voice-trigger,
  .actions,
  .actions > :deep(button) {
    width: 100%;
  }
  .sticky-actions {
    align-items: stretch;
  }
  .sticky-actions p {
    display: none;
  }
  .voice-drawer {
    width: 100%;
  }
  .extra-row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .switch-ui,
  .switch-ui::after {
    transition: none;
  }
}
</style>
