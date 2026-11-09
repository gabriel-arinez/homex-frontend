<script setup lang="ts">
import { dateRangeError } from '@/shared/validation/dateRange'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type {
  CamposCatalogo,
  CategoriaEnum,
  FamiliaProducto,
  Producto,
  ProductoWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import CapturaCatalogo from './CapturaCatalogo.vue'
import {
  AlertTriangle,
  Armchair,
  Check,
  FileText,
  Layers,
  Mic,
  Package,
  Save,
  Tag,
  Trash2,
} from '@lucide/vue'
import VoiceDrawer from '@/modules/capturas/components/VoiceDrawer.vue'
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

// Asistente de voz y estado conservado
const voiceOpen = ref(false)
const assistantProcessing = ref(false)
const recordingActive = ref(false)
const recordingPaused = ref(false)
const recordingElapsed = ref(0)
const voiceTranscribedText = ref('')
const voicePendingWarnings = ref<string[]>([])

function updateRecording(active: boolean, paused: boolean, elapsed: number) {
  recordingActive.value = active
  recordingPaused.value = paused
  recordingElapsed.value = elapsed
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

type CampoSilla = { clave: string; valor: string }

function esObjeto(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function camposSimples(value: unknown): CampoSilla[] {
  if (!esObjeto(value)) return []
  return Object.entries(value)
    .filter(([, dato]) => dato === null || typeof dato !== 'object')
    .map(([clave, dato]) => ({
      clave,
      valor: dato === null ? '' : typeof dato === 'boolean' ? (dato ? 'Sí' : 'No') : String(dato),
    }))
}

const camposSilla = ref<CampoSilla[]>(camposSimples(props.initial?.silla?.especificaciones))

function objetoEspecificaciones(): Record<string, unknown> {
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
    const valor = campo.valor.trim()
    if (/^(true|sí|si)$/i.test(valor)) {
      combinado[clave] = true
    } else if (/^(false|no)$/i.test(valor)) {
      combinado[clave] = false
    } else if (valor !== '' && Number.isFinite(Number(valor))) {
      combinado[clave] = Number(valor)
    } else {
      combinado[clave] = valor
    }
  }
  return combinado
}

function agregarCampoSilla() {
  camposSilla.value.push({ clave: '', valor: '' })
  emit('change')
}

function quitarCampoSilla(index: number) {
  camposSilla.value.splice(index, 1)
  emit('change')
}

const quickChairFeatures = [
  { clave: 'Apoyo lumbar', valor: 'Ajustable' },
  { clave: 'Brazos regulables', valor: 'En altura' },
  { clave: 'Mecanismo de inclinación', valor: 'Sincrónico' },
  { clave: 'Asiento', valor: 'Espuma inyectada' },
  { clave: 'Material del respaldo', valor: 'Malla respirable' },
  { clave: 'Suspensión / Altura', valor: 'Pistón a gas' },
  { clave: 'Giro', valor: '360°' },
  { clave: 'Ruedas', valor: '5 ruedas de nylon' },
]

function agregarCampoSillaRapido(clave: string, valor = '') {
  const existente = camposSilla.value.find(
    (c) => c.clave.trim().toLowerCase() === clave.trim().toLowerCase(),
  )
  if (existente) {
    if (!existente.valor && valor) existente.valor = valor
  } else {
    camposSilla.value.push({ clave, valor })
  }
  emit('change')
}

const quickNoteSuggestions = [
  'Garantía de 1 año',
  'Uso en interiores',
  'Requiere armado sencillo',
  'Entrega inmediata',
]

function appendNote(note: string) {
  if (form.observaciones.includes(note)) return
  form.observaciones = form.observaciones.trim()
    ? `${form.observaciones.trim()}. ${note}.`
    : `${note}.`
  emit('change')
}

const categoria = computed(
  () => opciones.CATEGORIA_PRODUCTO?.find((x) => String(x.id) === form.categoria)?.codigo,
)

const categoriaNombre = computed(
  () =>
    opciones.CATEGORIA_PRODUCTO?.find((x) => String(x.id) === form.categoria)?.nombre || 'General',
)

const opts = (key: string, empty = 'Sin seleccionar') => [
  { label: empty, value: '' },
  ...(opciones[key] ?? []).map((x) => ({ label: x.nombre, value: String(x.id) })),
]

function applyProposals(proposals: Array<[string, unknown]>) {
  const current = form as Record<string, unknown>
  for (const [key, value] of proposals) {
    if (key === 'especificaciones') {
      form.especificaciones = JSON.stringify(value)
      camposSilla.value = camposSimples(value)
    } else {
      current[key] = String(value ?? '')
    }
  }
  if (proposals.length) emit('change')
  voiceOpen.value = false
}

// Aplicación directa e inteligente desde el asistente de voz
function onVoiceApplied(payload: { fields: CamposCatalogo; text: string; warnings: string[] }) {
  voiceTranscribedText.value = payload.text || ''
  voicePendingWarnings.value = [...(payload.warnings || [])]

  const suggested = { ...payload.fields }

  // Evitar volcar la transcripción completa en observaciones si el NLP la incluyó por fallback.
  // La transcripción completa se preserva y muestra en la tarjeta lateral.
  if (suggested.observaciones && suggested.observaciones.trim() === (payload.text || '').trim()) {
    delete suggested.observaciones
  }

  // Heurística de precio si no vino en fields pero se dictó en el texto
  if (!suggested.precio_lista && payload.text) {
    const match = payload.text.match(
      /\b(?:precio(?:\s+de\s+lista)?|total|valor|cuesta)\b\s*[,;:]?\s*(?:(?:es\s+de|es|de)\s+)?(?:(?:bs\.?|bob|bolivianos?|bolivios?|d[oó]lares?|usd)\s*)?(\d+(?:[.,]\d+)?)/i,
    )
    if (match?.[1]) {
      const num = match[1].replace(',', '.')
      if (Number(num) > 0) suggested.precio_lista = num
    }
  }

  // Heurística de color para sillas
  if (categoria.value === 'SILLA' && !suggested.color_primario && payload.text) {
    const colorOpts = opciones.COLOR || []
    for (const opt of colorOpts) {
      const reg = new RegExp(`\\b${opt.nombre}\\b`, 'i')
      if (reg.test(payload.text)) {
        suggested.color_primario = opt.id
        break
      }
    }
  }

  applyProposals(Object.entries(suggested))
  voiceOpen.value = false
}

function applyVoice(suggested: CamposCatalogo) {
  applyProposals(Object.entries(suggested))
  voiceOpen.value = false
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
      const cat = opciones.CATEGORIA_PRODUCTO?.find(
        (item) => item.codigo === props.preselectCategory,
      )
      if (cat) {
        form.categoria = String(cat.id)
        const unidadCodigo = cat.codigo === 'PISO_FLOTANTE' ? 'M2' : 'PIEZA'
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
    if (dateRangeError(form.fecha_inicio || '', form.fecha_fin || ''))
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

defineExpose({ submit, hasRecording: () => recordingActive.value })
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
      <div class="category-capsule">
        <Armchair v-if="categoria === 'SILLA'" :size="15" aria-hidden="true" />
        <Layers v-else-if="categoria === 'PISO_FLOTANTE'" :size="15" aria-hidden="true" />
        <Package v-else :size="15" aria-hidden="true" />
        <span>Catálogo comercial · {{ categoriaNombre }}</span>
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

    <button
      v-if="(recordingActive || assistantProcessing) && !voiceOpen"
      type="button"
      class="voice-mini"
      aria-label="Volver al asistente de voz mientras se graba"
      @click="voiceOpen = true"
    >
      <Mic :size="17" aria-hidden="true" />
      {{
        assistantProcessing
          ? 'Interpretando audio'
          : recordingPaused
            ? 'Grabación pausada'
            : 'Grabación en curso'
      }}
      <template v-if="recordingActive">
        · {{ String(Math.floor(recordingElapsed / 60)).padStart(2, '0') }}:{{
          String(recordingElapsed % 60).padStart(2, '0')
        }}
      </template>
      · Volver al asistente
    </button>

    <p v-if="error" class="error-summary" role="alert">{{ error }}</p>
    <p v-if="loading" role="status" class="loading-note">Cargando opciones del catálogo…</p>

    <div class="catalog-layout">
      <div class="form-main">
        <!-- 1. Información General -->
        <section class="catalog-section" aria-labelledby="general-title">
          <div class="section-heading">
            <Package :size="20" aria-hidden="true" />
            <div>
              <h3 id="general-title">Información general</h3>
              <p>Identificación del producto dentro del catálogo HOMEX.</p>
            </div>
          </div>
          <div class="fields-grid">
            <div :class="{ 'full-field': !preselectCategory && !initial }">
              <TextField
                v-model="form.nombre"
                name="nombre"
                label="Nombre comercial *"
                placeholder="Ej. Silla ejecutiva ergonómica de malla"
                :max-length="200"
                :error="fieldError('nombre')"
              />
            </div>

            <!-- Selector de categoría solo cuando no está preseleccionada/fijada -->
            <div v-if="!categoria || (!preselectCategory && !initial)">
              <Select
                v-model="form.categoria"
                name="categoria"
                label="Categoría *"
                :disabled="Boolean(initial)"
                :options="opts('CATEGORIA_PRODUCTO', 'Seleccionar categoría')"
              />
              <small v-if="fieldError('categoria')" class="field-error" role="alert">
                {{ fieldError('categoria') }}
              </small>
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
              <small v-if="fieldError('familia')" class="field-error" role="alert">
                {{ fieldError('familia') }}
              </small>
            </div>

            <div>
              <Select
                v-model="form.unidad_stock"
                name="unidad"
                label="Unidad comercial *"
                :options="opts('UNIDAD_MEDIDA', 'Seleccionar unidad')"
                :disabled="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE'"
              />
              <small v-if="fieldError('unidad_stock')" class="field-error" role="alert">
                {{ fieldError('unidad_stock') }}
              </small>
            </div>
          </div>
        </section>

        <!-- 2. Características de Silla o Piso -->
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
              >
                {{ fieldError('silla.marca') || fieldError('piso.marca') }}
              </small>
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

          <!-- Características adicionales de la silla (Sin selector técnico de tipo de respuesta) -->
          <div v-if="categoria === 'SILLA'" class="extras">
            <div class="extras-heading">
              <div>
                <h4>Características adicionales de la silla</h4>
                <p class="muted">
                  Añade propiedades comerciales y ergonómicas particulares de esta silla.
                </p>
              </div>
            </div>

            <!-- Accesos rápidos de un clic -->
            <div class="quick-feature-chips">
              <span class="quick-chips-label">Atributos frecuentes:</span>
              <button
                v-for="chip in quickChairFeatures"
                :key="chip.clave"
                type="button"
                class="chip-button"
                @click="agregarCampoSillaRapido(chip.clave, chip.valor)"
              >
                + {{ chip.clave }}
              </button>
            </div>

            <div class="extras-list">
              <div v-for="(campo, index) in camposSilla" :key="index" class="extra-row">
                <label class="extra-field-group">
                  <span>Característica</span>
                  <input
                    v-model="campo.clave"
                    list="silla-atributos-sugeridos"
                    class="extra-input"
                    :aria-label="'Característica ' + (index + 1)"
                    placeholder="Ej. Apoyo lumbar"
                  />
                </label>
                <label class="extra-field-group extra-field-group--flex">
                  <span>Detalle o valor</span>
                  <input
                    v-model="campo.valor"
                    class="extra-input"
                    :aria-label="'Valor ' + (index + 1)"
                    placeholder="Ej. Ajustable en altura"
                  />
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
                <option value="Apoyo lumbar" />
                <option value="Brazos regulables" />
                <option value="Material del respaldo" />
                <option value="Asiento inyectado" />
                <option value="Mecanismo de inclinación" />
                <option value="Ruedas de nylon" />
                <option value="Cabecera ajustable" />
                <option value="Base cromada" />
              </datalist>

              <p v-if="!camposSilla.length" class="extras-empty">
                No hay características adicionales aún. Usa los accesos rápidos o añade una
                personalizada.
              </p>

              <Button
                type="button"
                variant="secondary"
                class="add-extra"
                @click="agregarCampoSilla"
              >
                + Añadir característica personalizada
              </Button>
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

        <!-- 3. Precio y Promociones con Jerarquía de 3 Capas -->
        <section class="catalog-section" aria-labelledby="price-title">
          <div class="section-heading">
            <Tag :size="20" aria-hidden="true" />
            <div class="heading-split">
              <div>
                <h3 id="price-title">Precio y promociones</h3>
                <p>
                  Establece el precio normal de venta y, opcionalmente, una campaña de descuento.
                </p>
              </div>
              <span
                class="price-badge"
                :class="{ 'price-badge--ready': Number(form.precio_lista) > 0 }"
              >
                {{ Number(form.precio_lista) > 0 ? 'Precio fijado' : 'Precio obligatorio' }}
              </span>
            </div>
          </div>

          <div class="price-cards-stack">
            <!-- Bloque principal de precio de lista -->
            <div class="price-block-base">
              <div class="price-input-row">
                <TextField
                  v-model="form.precio_lista"
                  name="precio"
                  label="Precio normal de venta (Bs) *"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :error="fieldError('precio_lista')"
                  hint="Importe comercial de lista antes de descuentos o promociones."
                />
                <div v-if="Number(form.precio_lista) > 0" class="price-preview-callout">
                  <span class="preview-label">Precio de lista:</span>
                  <span class="preview-amount">{{ money(form.precio_lista) }}</span>
                </div>
              </div>
            </div>

            <!-- Bloque secundario: Promoción -->
            <div
              class="promotion price-block-promo"
              :class="{ 'price-block-promo--active': form.promo_activa }"
            >
              <label class="toggle-row">
                <span class="toggle-copy">
                  <strong>Configurar promoción</strong>
                  <small
                    >Ofrece un precio temporal de oferta sin alterar el precio de lista de
                    referencia.</small
                  >
                </span>
                <input v-model="form.promo_activa" type="checkbox" class="switch-input" />
                <span class="switch-ui" aria-hidden="true" />
              </label>

              <div v-if="form.promo_activa" class="promotion-fields">
                <p v-if="legacyPromotion && promoUnchanged" class="promotion-legacy">
                  Esta promoción conserva un precio anterior histórico distinto del normal. No
                  cambiará mientras no edites la promoción.
                </p>

                <div class="promo-inputs-grid">
                  <TextField
                    v-model="form.precio_ahora"
                    name="ahora"
                    label="Precio promocional (Bs) *"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                  <TextField
                    v-model="form.fecha_inicio"
                    name="inicio"
                    label="Fecha de inicio"
                    type="date"
                    :max="form.fecha_fin || undefined"
                  />
                  <TextField
                    v-model="form.fecha_fin"
                    name="fin"
                    label="Fecha de finalización"
                    type="date"
                    :min="form.fecha_inicio || undefined"
                  />
                </div>

                <div v-if="discountPercent !== null && discountPercent > 0" class="discount-banner">
                  <span class="discount-pill">-{{ discountPercent }}% OFF</span>
                  <span class="discount-comparison">
                    {{ money(form.precio_lista) }} → <strong>{{ money(form.precio_ahora) }}</strong>
                  </span>
                  <span class="discount-savings">
                    (Ahorro: {{ money(Number(form.precio_lista) - Number(form.precio_ahora)) }})
                  </span>
                </div>

                <div class="promo-status-bar">
                  <span
                    class="status-capsule"
                    :class="'status-capsule--' + promoStatus.toLowerCase()"
                  >
                    Campaña: <strong>{{ promoStatus }}</strong>
                  </span>
                  <label class="toggle-row toggle-row--inline">
                    <span class="toggle-copy">
                      <small><strong>Promoción habilitada</strong></small>
                    </span>
                    <input v-model="form.promo_enabled" type="checkbox" class="switch-input" />
                    <span class="switch-ui" aria-hidden="true" />
                  </label>
                </div>

                <p v-if="fieldError('promocion')" class="field-error" role="alert">
                  {{ fieldError('promocion') }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. Observaciones -->
        <section class="catalog-section" aria-labelledby="notes-title">
          <div class="section-heading">
            <FileText :size="20" aria-hidden="true" />
            <div>
              <h3 id="notes-title">Observaciones comerciales</h3>
              <p>Información complementaria, recomendaciones de uso y detalles de entrega.</p>
            </div>
          </div>
          <div class="notes-container">
            <div class="quick-notes-chips">
              <span class="quick-chips-label">Notas frecuentes:</span>
              <button
                v-for="chip in quickNoteSuggestions"
                :key="chip"
                type="button"
                class="chip-button"
                @click="appendNote(chip)"
              >
                + {{ chip }}
              </button>
            </div>
            <label for="observaciones" class="visually-hidden">Notas del producto (opcional)</label>
            <textarea
              id="observaciones"
              v-model="form.observaciones"
              name="observaciones"
              rows="4"
              class="notes-textarea"
              placeholder="Ej. Garantía de 1 año por defectos de fabricación. Ideal para uso de oficina o home office…"
            />
            <small v-if="fieldError('observaciones')" class="field-error" role="alert">
              {{ fieldError('observaciones') }}
            </small>
          </div>
        </section>
      </div>

      <!-- Barra lateral (Galería + Transcripción original + Alertas + Disponibilidad) -->
      <aside class="form-aside" aria-label="Multimedia y contexto">
        <!-- Galería de imágenes -->
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

        <!-- Tarjeta de Transcripción Original Conservada por Voz -->
        <section
          v-if="voiceTranscribedText"
          class="catalog-section aside-card voice-transcription-card"
          aria-labelledby="transcription-title"
        >
          <div class="aside-heading">
            <Mic :size="18" aria-hidden="true" />
            <div class="heading-split">
              <h3 id="transcription-title">Descripción original por voz</h3>
              <span class="voice-badge-done">Captura procesada</span>
            </div>
          </div>
          <div class="transcription-text-box">
            {{ voiceTranscribedText }}
          </div>
          <div v-if="voicePendingWarnings.length" class="voice-warnings-box">
            <div class="warnings-title">
              <AlertTriangle :size="15" aria-hidden="true" />
              <strong>Datos a revisar</strong>
            </div>
            <ul>
              <li v-for="warning in voicePendingWarnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </div>
        </section>

        <!-- Disponibilidad y existencias -->
        <section class="catalog-section aside-card" aria-labelledby="status-title">
          <div class="aside-heading">
            <Check :size="19" aria-hidden="true" />
            <h3 id="status-title">Disponibilidad</h3>
          </div>
          <label class="toggle-row">
            <span class="toggle-copy">
              <strong>Producto activo</strong>
              <small>{{
                form.activo
                  ? 'Visible para las operaciones comerciales.'
                  : 'El producto quedará inactivo.'
              }}</small>
            </span>
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
        <Button type="button" variant="secondary" :disabled="processing" @click="emit('cancel')">
          Cancelar
        </Button>
        <Button
          variant="success"
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

  <VoiceDrawer
    :open="voiceOpen"
    title="Completar por voz"
    description="Describe tu producto y los datos se completarán automáticamente en el formulario."
    close-label="Cerrar asistente de voz"
    @close="voiceOpen = false"
  >
    <CapturaCatalogo
      v-if="categoria === 'SILLA' || categoria === 'PISO_FLOTANTE' || categoria === 'OTRO'"
      :key="categoria"
      :categoria="categoria as CategoriaEnum"
      :opciones="opciones"
      @apply="applyVoice"
      @applied="onVoiceApplied"
      @recording-state="updateRecording"
      @processing-state="assistantProcessing = $event"
    />
  </VoiceDrawer>
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

.category-capsule {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-pill, 9999px);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 0.35rem;
}

.form-intro h2 {
  margin: 0.15rem 0 0.2rem;
  font-size: clamp(1.2rem, 2vw, 1.55rem);
}

.form-intro p {
  margin: 0;
}

.muted {
  color: var(--color-text-secondary);
}

.voice-trigger {
  white-space: nowrap;
}

.voice-mini {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.45rem 0.85rem;
  background: var(--color-primary-soft, rgba(224, 46, 50, 0.12));
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill, 9999px);
  color: var(--color-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  width: fit-content;
}

.catalog-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.35fr);
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
  margin-top: 0.15rem;
}

.heading-split {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex: 1 1 auto;
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

.unit-field-wrapper {
  display: grid;
  gap: 0.35rem;
}

.unit-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}

.unit-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  min-height: 2.65rem;
}

.unit-card-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.unit-val {
  font-weight: 700;
  font-size: 0.92rem;
  color: var(--color-text);
}

.unit-tag {
  font-size: 0.74rem;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill, 9999px);
  padding: 0.15rem 0.5rem;
}

.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
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

/* Extras / Características de la silla */
.extras {
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
  display: grid;
  gap: var(--space-4);
}

.extras-heading h4 {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 700;
}

.quick-feature-chips,
.quick-notes-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.quick-chips-label {
  font-size: 0.77rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  margin-right: 0.25rem;
}

.chip-button {
  padding: 0.25rem 0.65rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill, 9999px);
  color: var(--color-text);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-button:hover {
  background: var(--color-surface-raised);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.extras-list {
  display: grid;
  gap: var(--space-3);
}

.extra-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.extra-field-group {
  display: grid;
  gap: 0.25rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  flex: 1 1 35%;
}

.extra-field-group--flex {
  flex: 2 1 60%;
}

.extra-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface-raised, #18181b);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font-size: 0.86rem;
}

.icon-remove {
  background: none;
  border: none;
  color: var(--color-danger);
  padding: 0.55rem;
  border-radius: var(--radius-control);
  cursor: pointer;
  display: grid;
  place-items: center;
}

.icon-remove:hover {
  background: rgba(239, 68, 68, 0.15);
}

.extras-empty {
  font-size: 0.84rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin: var(--space-2) 0;
}

.add-extra {
  width: fit-content;
}

/* Precio y Promociones */
.price-cards-stack {
  display: grid;
  gap: var(--space-4);
}

.price-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-pill, 9999px);
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger-text);
  border: 1px solid var(--color-danger);
}

.price-badge--ready {
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success, #22c55e);
  border-color: var(--color-success, #22c55e);
}

.price-block-base {
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.price-input-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.price-input-row > :first-child {
  flex: 1 1 16rem;
}

.price-preview-callout {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding: 0.5rem 1rem;
  background: var(--color-surface-raised, #18181b);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.preview-label {
  font-size: 0.74rem;
  color: var(--color-text-secondary);
}

.preview-amount {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.price-block-promo {
  padding: var(--space-4);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  transition: all 0.2s ease;
}

.price-block-promo--active {
  border-color: var(--color-primary-soft, #e02e32);
}

.promotion-fields {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px dashed var(--color-border);
  display: grid;
  gap: var(--space-4);
}

.promo-inputs-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

@media (max-width: 768px) {
  .promo-inputs-grid {
    grid-template-columns: 1fr;
  }
}

.discount-banner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0.65rem 1rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: var(--radius-control);
}

.discount-pill {
  padding: 0.2rem 0.55rem;
  background: var(--color-success, #22c55e);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  border-radius: var(--radius-pill, 9999px);
}

.discount-comparison {
  font-size: 0.88rem;
  color: var(--color-text);
}

.discount-savings {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}

.promo-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

.status-capsule {
  font-size: 0.78rem;
  padding: 0.25rem 0.7rem;
  border-radius: var(--radius-pill, 9999px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.status-capsule--vigente {
  border-color: rgba(34, 197, 94, 0.5);
  color: var(--color-success, #22c55e);
}

.status-capsule--programada {
  border-color: rgba(234, 179, 8, 0.5);
  color: #eab308;
}

.status-capsule--finalizada,
.status-capsule--desactivada {
  color: var(--color-text-secondary);
}

.toggle-row--inline {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.promotion-legacy {
  margin: 0;
  padding: var(--space-3);
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid #eab308;
  border-radius: var(--radius-control);
  font-size: 0.82rem;
}

/* Observaciones */
.notes-container {
  display: grid;
  gap: var(--space-3);
}

.notes-textarea {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-surface-raised, #18181b);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.88rem;
  line-height: 1.6;
  resize: vertical;
}

/* Barra Lateral */
.aside-card {
  display: grid;
  gap: var(--space-4);
}

.voice-transcription-card {
  border-color: var(--color-primary-soft, #e02e32);
}

.voice-badge-done {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill, 9999px);
  background: var(--color-primary-soft, rgba(224, 46, 50, 0.15));
  color: var(--color-primary);
  font-weight: 700;
}

.transcription-text-box {
  padding: 0.85rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--color-text);
  max-height: 14rem;
  overflow-y: auto;
  white-space: pre-wrap;
}

.voice-warnings-box {
  padding: 0.75rem;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: var(--radius-control);
  display: grid;
  gap: 0.35rem;
}

.warnings-title {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #eab308;
}

.voice-warnings-box ul {
  margin: 0;
  padding-left: 1.15rem;
  font-size: 0.78rem;
  color: var(--color-text);
  line-height: 1.5;
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
  gap: 0.15rem;
}

.toggle-copy strong {
  font-size: 0.9rem;
}

.toggle-copy small {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.switch-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch-ui {
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  background: var(--color-border-strong);
  border-radius: var(--radius-pill, 9999px);
  transition: background 0.2s;
  flex: 0 0 auto;
}

.switch-ui::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1.25rem;
  height: 1.25rem;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch-input:checked + .switch-ui {
  background: var(--color-primary);
}

.switch-input:checked + .switch-ui::after {
  transform: translateX(1.25rem);
}

.stock-note {
  padding: var(--space-3);
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.stock-note strong {
  color: var(--color-text);
  display: block;
  margin-bottom: 0.2rem;
}

.sticky-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  position: sticky;
  bottom: var(--space-4);
  z-index: 10;
  box-shadow: var(--shadow-elevated, 0 8px 24px rgba(0, 0, 0, 0.4));
}

.actions {
  display: flex;
  gap: var(--space-3);
}

@media (max-width: 900px) {
  .catalog-layout {
    grid-template-columns: 1fr;
  }
}
</style>
