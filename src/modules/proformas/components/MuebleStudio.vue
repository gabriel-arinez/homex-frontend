<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import VoiceDrawer from '@/modules/capturas/components/VoiceDrawer.vue'
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  Ruler,
  Settings2,
  Wallet,
  ImagePlus,
  Mic,
} from '@lucide/vue'
import type {
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  PendienteAsistida,
  ResultadoAsistida,
  ValorCatalogoPublico,
} from '@/generated/api'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import CapturaAsistida from './CapturaAsistida.vue'
import EspecificacionForm from './EspecificacionForm.vue'
import ImageGallery from '@/shared/media/ImageGallery.vue'
import { galleryService } from '@/shared/media/gallery'
import { leerDatosTecnicos } from '../services/muebleTecnico'

type Seccion = 'general' | 'estructura' | 'accesorios' | 'imagenes' | 'comercial' | 'revision'
type DatosComerciales = {
  nombre: string
  descripcion: string
  cantidad: string
  unidad: number
  precio_unitario: string
  descuento: string
}
const props = defineProps<{
  galeriaId?: string
  detalleId?: number
  nueva: boolean
  formVersion: number
  dirty: boolean
  sesion: string
  moneda: 'BOB' | 'USD'
  proforma?: number | null
  tipos: ValorCatalogoPublico[]
  especificacion?: EspecificacionMueble | null
  detalle?: {
    tipo_item?: number
    descripcion?: string | null
    nombre?: string
    cantidad?: string | number
    unidad?: string | number
    precio_unitario?: string | number | null
    descuento?: string | number
    total?: string | number
  } | null
  unidades: ValorCatalogoPublico[]
  pendientesAsistencia?: PendienteAsistida[]
  processing?: boolean
  externalError?: string
}>()
const emit = defineEmits<{
  gallery: [id: string]
  galleryChanged: []
  save: [body: EspecificacionMuebleWritable, comercial: DatosComerciales]
  cancel: []
  changed: []
  applied: [result: ResultadoAsistida]
  processing: [value: boolean]
  typeCreated: [tipo: ValorCatalogoPublico]
}>()
const voiceOpen = ref(false)
const leaveVoiceConfirm = ref(false)
function requestCloseStudio() {
  if (voiceActive.value) {
    leaveVoiceConfirm.value = true
    return
  }
  emit('cancel')
}
function confirmCloseStudio() {
  leaveVoiceConfirm.value = false
  emit('cancel')
}
const voiceActive = ref(false)
const voiceProcessing = ref(false)
const voicePaused = ref(false)
const voiceElapsed = ref(0)
function onVoiceProcessing(value: boolean) {
  voiceProcessing.value = value
  emit('processing', value)
}
function onVoiceState(active: boolean, paused: boolean, elapsed: number) {
  voiceActive.value = active
  voicePaused.value = paused
  voiceElapsed.value = elapsed
}
const galleryId = ref(props.galeriaId ?? '')
const galleryError = ref('')
const galleryRef = ref<InstanceType<typeof ImageGallery> | null>(null)
const galleryBusy = ref(false)
const galleryStatus = ref({ confirmed: 0, pending: 0, busy: false, error: false })
function onGalleryStatus(value: {
  confirmed: number
  pending: number
  busy: boolean
  error: boolean
}) {
  galleryStatus.value = value
}
const imageStepStatus = computed(() => {
  if (galleryError.value || galleryStatus.value.error) return 'issues' as const
  if (galleryStatus.value.pending > 0 || galleryStatus.value.busy || galleryBusy.value)
    return 'pending' as const
  return galleryStatus.value.confirmed > 0 ? ('complete' as const) : ('pending' as const)
})
function onGalleryChanged() {
  emit('changed')
  emit('galleryChanged')
}
async function ensureGallery() {
  if (galleryId.value) return
  try {
    const result = await galleryService.create(props.sesion, props.detalleId)
    galleryId.value = result.id
    emit('gallery', result.id)
  } catch (e) {
    galleryError.value = e instanceof Error ? e.message : 'No se pudo preparar la galería.'
  }
}
watch(
  () => props.galeriaId,
  (id) => {
    if (id) galleryId.value = id
  },
)
async function saveWithGallery(body: EspecificacionMuebleWritable, comercial: DatosComerciales) {
  if (galleryBusy.value) return
  if (galleryRef.value && !(await galleryRef.value.flush())) {
    seccion.value = 'imagenes'
    return
  }
  emit('save', body, comercial)
}
const secciones = [
  { id: 'general', titulo: 'General', icono: Ruler },
  { id: 'estructura', titulo: 'Estructura', icono: Layers3 },
  { id: 'accesorios', titulo: 'Accesorios', icono: Settings2 },
  { id: 'imagenes', titulo: 'Imágenes', icono: ImagePlus },
  { id: 'comercial', titulo: 'Precio', icono: Wallet },
  { id: 'revision', titulo: 'Revisar', icono: ClipboardCheck },
] as const
const seccion = ref<Seccion>('general')
watch(seccion, (value) => {
  if (value === 'imagenes') void ensureGallery()
})
const tituloSeccion = ref<HTMLElement | null>(null)
const estadoApartados = ref<Record<Seccion, 'pending' | 'complete' | 'issues'>>({
  general: 'pending',
  estructura: 'pending',
  accesorios: 'pending',
  imagenes: 'pending',
  comercial: 'pending',
  revision: 'pending',
})
watch(imageStepStatus, (state) => {
  estadoApartados.value = { ...estadoApartados.value, imagenes: state }
})
const volverARevision = ref(false)
const propuestaPorConfirmar = ref<ResultadoAsistida | null>(null)
const datosPropuestos = computed(() =>
  leerDatosTecnicos(
    propuestaPorConfirmar.value?.propuesta_configurador?.especificacion.datos_tecnicos,
  ),
)
const medidasPropuestas = computed(() => {
  const medidas = datosPropuestos.value.caracteristicas_generales?.dimensiones
  if (!medidas || typeof medidas !== 'object' || Array.isArray(medidas)) return []
  return Object.entries(medidas as Record<string, unknown>).map(([nombre, valor]) => {
    if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
      const m = valor as Record<string, unknown>
      return {
        nombre,
        texto:
          String(m.valor ?? 'Pendiente') +
          (m.unidad ? ' ' + String(m.unidad) : ' · unidad por confirmar'),
      }
    }
    return { nombre, texto: String(valor) }
  })
})
const indice = computed(() => secciones.findIndex((item) => item.id === seccion.value))
const titulo = computed(() => props.detalle?.nombre?.trim() || 'Nuevo mueble a pedido')
watch(seccion, async () => {
  await nextTick()
  tituloSeccion.value?.focus({ preventScroll: true })
  tituloSeccion.value?.scrollIntoView?.({ behavior: 'auto', block: 'start' })
})
async function avanzar() {
  if (seccion.value === 'imagenes' && galleryRef.value && !(await galleryRef.value.flush())) return
  if (volverARevision.value) {
    seccion.value = 'revision'
    volverARevision.value = false
    return
  }
  if (indice.value < secciones.length - 1) seccion.value = secciones[indice.value + 1]!.id
}
function editarDesdeRevision(section: Seccion) {
  volverARevision.value = true
  seccion.value = section
}
function recibirCaptura(result: ResultadoAsistida) {
  voiceOpen.value = false
  propuestaPorConfirmar.value = result
  volverARevision.value = false
  seccion.value = 'revision'
}
function confirmarCaptura() {
  if (!propuestaPorConfirmar.value) return
  emit('applied', propuestaPorConfirmar.value)
  propuestaPorConfirmar.value = null
}
function retroceder() {
  if (indice.value > 0) seccion.value = secciones[indice.value - 1]!.id
}
async function seleccionarApartado(id: typeof seccion.value) {
  if (seccion.value === 'imagenes' && galleryRef.value && !(await galleryRef.value.flush())) return
  seccion.value = id
  volverARevision.value = false
}
</script>

<template>
  <section class="furniture-studio" aria-labelledby="furniture-studio-title">
    <header class="studio-header">
      <div>
        <div class="studio-breadcrumb">PROFORMAS <span>/</span> MUEBLE A PEDIDO</div>
        <h1 id="furniture-studio-title">{{ titulo }}</h1>
      </div>
      <div class="studio-header-actions">
        <Button v-if="nueva" type="button" class="studio-voice-launch" @click="voiceOpen = true">
          <Mic :size="18" aria-hidden="true" /> Completar por voz
        </Button>
        <Button type="button" variant="secondary" @click="requestCloseStudio">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a proforma
        </Button>
      </div>
    </header>
    <button
      v-if="(voiceActive || voiceProcessing) && !voiceOpen"
      type="button"
      class="studio-voice-mini"
      aria-label="Reabrir asistente de voz del mueble"
      @click="voiceOpen = true"
    >
      <Mic :size="17" aria-hidden="true" />
      {{
        voiceProcessing
          ? 'Interpretando audio'
          : voicePaused
            ? 'Grabación pausada'
            : 'Grabación en curso'
      }}
      <template v-if="voiceActive">
        · {{ String(Math.floor(voiceElapsed / 60)).padStart(2, '0') }}:{{
          String(voiceElapsed % 60).padStart(2, '0')
        }}
      </template>
      · Volver al asistente
    </button>
    <VoiceDrawer
      :open="voiceOpen"
      title="Completar mueble por voz"
      description="Describe el mueble y revisa la propuesta antes de incorporarla."
      @close="voiceOpen = false"
    >
      <CapturaAsistida
        v-if="nueva"
        class="studio-voice-workflow"
        :dirty="dirty"
        :sesion="sesion"
        :moneda="moneda"
        :proforma="proforma"
        review-before-apply
        @proposed="recibirCaptura"
        @processing="onVoiceProcessing"
        @recording-state="onVoiceState"
      />
    </VoiceDrawer>
    <nav class="studio-steps" aria-label="Apartados del mueble a pedido">
      <button
        v-for="(item, i) in secciones"
        :key="item.id"
        type="button"
        :class="{ 'studio-step--active': seccion === item.id }"
        :aria-current="seccion === item.id ? 'step' : undefined"
        @click="seleccionarApartado(item.id)"
      >
        <span class="studio-step-icon"
          ><component :is="item.icono" :size="18" aria-hidden="true"
        /></span>
        <span class="studio-step-label"
          ><small>{{ String(i + 1).padStart(2, '0') }}</small
          >{{ item.titulo
          }}<small v-if="item.id === 'imagenes' && imageStepStatus === 'pending'">
            · Opcional</small
          ></span
        >
        <AlertCircle
          v-if="estadoApartados[item.id] === 'issues'"
          :size="16"
          class="studio-issue"
          aria-label="Requiere atención"
        />
        <CheckCircle2
          v-else-if="estadoApartados[item.id] === 'complete'"
          :size="16"
          class="studio-complete"
          aria-label="Datos completos"
        />
      </button>
    </nav>
    <div class="studio-section-heading">
      <div>
        <p class="studio-index">PASO {{ String(indice + 1).padStart(2, '0') }} DE 06</p>
        <h2 ref="tituloSeccion" tabindex="-1">
          {{
            {
              general: 'Información general',
              estructura: 'Estructura y componentes',
              accesorios: 'Accesorios y observaciones',
              imagenes: 'Imágenes de referencia',
              comercial: 'Datos comerciales',
              revision: 'Revisión del mueble',
            }[seccion]
          }}
        </h2>
      </div>
      <p class="studio-section-description">
        {{
          {
            general: 'Identifica el mueble y registra sus medidas y características principales.',
            estructura: 'Organiza los conjuntos y componentes que forman el mueble.',
            accesorios: 'Añade los accesorios e indicaciones necesarias para su fabricación.',
            imagenes: 'Adjunta imágenes de referencia si están disponibles.',
            comercial: 'Define la cantidad, el precio y el descuento de la cotización.',
            revision: 'Comprueba los detalles antes de añadir el mueble a la proforma.',
          }[seccion]
        }}
      </p>
    </div>
    <section
      v-if="propuestaPorConfirmar && seccion === 'revision'"
      class="studio-proposal"
      aria-label="Propuesta de voz por confirmar"
    >
      <div class="studio-proposal-heading">
        <div>
          <h3>Propuesta obtenida por voz</h3>
          <p>Comprueba estos datos antes de reemplazar la información que hayas introducido.</p>
        </div>
        <span class="studio-proposal-pill">Pendiente de aceptación</span>
      </div>
      <div class="studio-proposal-facts">
        <div>
          <span>Nombre reconocido</span
          ><strong>{{
            propuestaPorConfirmar.propuesta_configurador?.comercial?.nombre || 'No especificado'
          }}</strong>
        </div>
        <div>
          <span>Cantidad reconocida</span
          ><strong>{{
            propuestaPorConfirmar.propuesta_configurador?.comercial?.cantidad ?? 'Sin confirmar'
          }}</strong>
        </div>
        <div>
          <span>Precio unitario propuesto</span
          ><strong
            >{{
              propuestaPorConfirmar.propuesta_configurador?.comercial?.precio_unitario ??
              'Pendiente'
            }}
            {{ moneda }}</strong
          >
        </div>
      </div>
      <div class="studio-proposal-technical">
        <div class="studio-proposal-tech-header">
          <h4>Características técnicas interpretadas</h4>
          <span>{{
            props.tipos.find(
              (t) =>
                t.id === propuestaPorConfirmar?.propuesta_configurador?.especificacion.tipo_mueble,
            )?.nombre || 'Tipo de mueble sin especificar'
          }}</span>
        </div>
        <div v-if="medidasPropuestas.length" class="studio-proposal-measures">
          <div v-for="medida in medidasPropuestas" :key="medida.nombre">
            <span>{{ medida.nombre.replace(/_/g, ' ') }}</span
            ><strong>{{ medida.texto }}</strong>
          </div>
        </div>
        <p v-else>No se identificaron medidas generales.</p>
        <div v-if="datosPropuestos.componentes?.length" class="studio-proposal-pieces">
          <h4>Componentes reconocidos ({{ datosPropuestos.componentes.length }})</h4>
          <ul>
            <li v-for="(pieza, index) in datosPropuestos.componentes" :key="pieza.uid || index">
              <strong>{{ pieza.nombre }}</strong> · {{ pieza.cantidad_interna ?? 1 }} por mueble
              <span v-if="pieza.material">· {{ pieza.material }}</span>
              <span v-if="pieza.espesor">· Espesor {{ pieza.espesor }}</span>
            </li>
          </ul>
        </div>
        <p v-else>No se identificaron componentes individuales.</p>
        <div v-if="datosPropuestos.accesorios?.length" class="studio-proposal-pieces">
          <h4>Accesorios identificados</h4>
          <ul>
            <li v-for="(acc, index) in datosPropuestos.accesorios" :key="index">{{ acc }}</li>
          </ul>
        </div>
        <p v-if="propuestaPorConfirmar.propuesta_configurador?.especificacion.observaciones">
          Observaciones:
          {{ propuestaPorConfirmar.propuesta_configurador.especificacion.observaciones }}
        </p>
      </div>
      <details
        v-if="propuestaPorConfirmar.texto_transcrito_original"
        class="studio-proposal-transcript"
      >
        <summary>Ver texto reconocido</summary>
        <p>{{ propuestaPorConfirmar.texto_transcrito_original }}</p>
      </details>
      <div v-if="propuestaPorConfirmar.pendientes.length" class="studio-proposal-pending">
        <h4>{{ propuestaPorConfirmar.pendientes.length }} datos que requieren revisión</h4>
        <ul>
          <li
            v-for="(p, i) in propuestaPorConfirmar.pendientes"
            :key="p.codigo + ':' + p.ruta + ':' + i"
          >
            {{ p.mensaje }}
          </li>
        </ul>
      </div>
      <p class="studio-proposal-disclaimer">
        La ficha que aparece debajo todavía contiene los datos anteriores. Al aplicar la propuesta
        se reemplazarán los datos de este mueble, pero no los demás ítems de la proforma.
      </p>
      <div class="studio-proposal-actions">
        <Button type="button" variant="secondary" @click="propuestaPorConfirmar = null"
          >Descartar propuesta</Button
        >
        <Button type="button" @click="confirmarCaptura">Aplicar propuesta al mueble</Button>
      </div>
    </section>
    <!-- La ficha anterior no debe mostrar validaciones mientras se revisa una propuesta sin aplicar. -->
    <div
      v-if="!propuestaPorConfirmar"
      class="studio-body"
      :class="{ 'studio-review-layout': seccion === 'revision' }"
    >
      <section
        v-show="seccion === 'imagenes' || seccion === 'revision'"
        class="studio-review-gallery"
        :class="{ 'studio-review-gallery--editing': seccion === 'imagenes' }"
      >
        <p v-if="galleryError" role="alert">
          {{ galleryError }}
          <Button type="button" variant="secondary" @click="ensureGallery">Reintentar</Button>
        </p>
        <ImageGallery
          v-if="galleryId"
          ref="galleryRef"
          :class="{
            'studio-gallery--editing': seccion === 'imagenes',
            'studio-gallery--has-images':
              seccion === 'imagenes' && galleryStatus.confirmed + galleryStatus.pending > 0,
          }"
          preserve-pending
          :streamlined="seccion === 'imagenes'"
          :endpoint="`/api/v1/galerias/${galleryId}/imagenes/`"
          :editable="seccion === 'imagenes'"
          title="Imágenes del mueble"
          @changed="onGalleryChanged"
          @status="onGalleryStatus"
          @busy="galleryBusy = $event"
        />
        <p v-else class="studio-review-gallery__empty">Sin imágenes de referencia.</p>
        <Button
          v-if="seccion === 'revision'"
          type="button"
          variant="secondary"
          @click="seccion = 'imagenes'"
          ><ImagePlus :size="16" aria-hidden="true" />Gestionar imágenes</Button
        >
      </section>
      <fieldset
        v-show="seccion !== 'imagenes' || Boolean(externalError)"
        class="studio-content"
        :disabled="processing"
      >
        <EspecificacionForm
          :key="formVersion"
          :tipos="tipos"
          :especificacion="especificacion"
          :detalle="detalle"
          :unidades="unidades"
          :pendientes-asistencia="pendientesAsistencia"
          :moneda="moneda"
          :processing="processing"
          :external-error="externalError"
          studio
          :active-section="seccion === 'imagenes' ? 'imagenes' : seccion"
          @save="saveWithGallery"
          @changed="emit('changed')"
          @cancel="requestCloseStudio"
          @request-section="editarDesdeRevision($event)"
          @section-status="estadoApartados = { ...$event, imagenes: imageStepStatus }"
          @type-created="emit('typeCreated', $event)"
        />
      </fieldset>
    </div>
    <footer v-if="!propuestaPorConfirmar" class="studio-page-footer">
      <Button type="button" variant="secondary" :disabled="indice === 0" @click="retroceder"
        >Anterior</Button
      >
      <span v-if="seccion === 'revision'">Revisa cada apartado antes de incorporar el mueble.</span>
      <span v-else>Los cambios se conservan mientras configuras el mueble.</span>
      <Button v-if="seccion !== 'revision'" type="button" @click="avanzar">
        {{ volverARevision ? 'Volver a revisar' : 'Continuar a ' + secciones[indice + 1]!.titulo }}
      </Button>
    </footer>
    <ConfirmDialog
      :open="leaveVoiceConfirm"
      title="Descartar grabación"
      description="Hay una grabación activa. Si vuelves a la proforma perderás el audio que todavía no finalizaste."
      confirm-label="Descartar grabación y volver"
      @close="leaveVoiceConfirm = false"
      @confirm="confirmCloseStudio"
    />
  </section>
</template>

<style scoped>
.furniture-studio {
  display: grid;
  gap: var(--space-5);
  width: 100%;
  min-width: 0;
  padding-bottom: var(--space-7);
}
.studio-header-actions {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  align-items: center;
}
.studio-voice-launch {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.studio-voice-mini {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: start;
  padding: 0.7rem 1rem;
  min-height: 2.75rem;
  background: var(--color-primary-soft);
  color: var(--color-text);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-control);
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}
.studio-voice-workflow {
  padding: var(--space-5);
}
.studio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.studio-breadcrumb {
  display: flex;
  gap: 0.7rem;
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.09em;
  color: var(--color-text-secondary);
}
.studio-breadcrumb span {
  color: var(--color-text-secondary);
}
.studio-header h1 {
  margin: 0.55rem 0 0;
  font-size: clamp(1.6rem, 2.35vw, 2.25rem);
  line-height: 1.18;
  letter-spacing: -0.035em;
}
.studio-steps {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.5rem;
}
.studio-steps button {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  min-width: 0;
  min-height: 4.25rem;
  text-align: left;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 0.75rem;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  cursor: pointer;
}
.studio-steps button:hover {
  border-color: var(--color-border-strong);
}
.studio-steps button:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.studio-steps .studio-step--active {
  background: color-mix(in srgb, var(--color-primary-soft) 55%, var(--color-surface));
  color: var(--color-text);
  border-color: var(--color-primary);
  box-shadow: inset 0 -3px 0 var(--color-primary);
}
.studio-steps .studio-step--active .studio-step-icon {
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}
.studio-steps .studio-step--active .studio-step-label small {
  color: var(--color-text-secondary);
}
.studio-step-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: var(--color-surface-muted);
}
.studio-step-label {
  display: grid;
  font-size: 0.81rem;
  font-weight: 700;
  gap: 0.15rem;
  min-width: 0;
}
.studio-step-label small {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
}
.studio-complete,
.studio-issue {
  flex-shrink: 0;
  margin-left: auto;
}
.studio-complete {
  color: var(--color-success);
}
.studio-issue {
  color: var(--color-danger);
}
.studio-section-heading {
  display: grid;
  justify-items: start;
  gap: 0.35rem;
}
.studio-index {
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  color: var(--color-primary-accent);
  margin: 0 0 0.25rem;
}
.studio-section-heading h2:focus {
  outline: none;
}
.studio-section-heading h2 {
  font-size: clamp(1.2rem, 1.55vw, 1.5rem);
  margin: 0;
}
.studio-section-heading > p {
  margin: 0;
  color: var(--color-text-secondary);
  max-width: 46rem;
  text-align: left;
  font-size: 0.85rem;
  line-height: 1.45;
}
.studio-content {
  min-width: 0;
  margin: 0;
  border: 0;
  padding: 0;
}
.studio-body {
  display: contents;
}
.studio-review-layout {
  display: grid;
  grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
  min-width: 0;
}
.studio-review-layout > .studio-review-gallery {
  position: sticky;
  top: 1rem;
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
.studio-review-layout > .studio-review-gallery :deep(h3) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.96rem;
}
.studio-review-layout > .studio-review-gallery :deep(h3 small) {
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.studio-review-layout > .studio-review-gallery :deep(.hero) {
  height: 15rem;
  padding: var(--space-2);
  background: var(--color-surface-muted);
  border-color: var(--color-border);
}
.studio-review-layout > .studio-review-gallery :deep(.hero:hover) {
  border-color: var(--color-border-strong);
}
.studio-review-layout > .studio-review-gallery :deep(.empty),
.studio-review-gallery__empty {
  margin: 0;
  padding: var(--space-4);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  line-height: 1.45;
  text-align: center;
}
.studio-review-layout > .studio-review-gallery :deep(.thumbs:empty) {
  display: none;
}
.studio-review-layout > .studio-review-gallery :deep(.thumbs) {
  padding-bottom: var(--space-1);
}
.studio-review-layout > .studio-review-gallery :deep(.thumbs button) {
  padding: 0.2rem;
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}
.studio-review-layout > .studio-review-gallery > button {
  justify-self: stretch;
  width: 100%;
  justify-content: center;
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}
@media (max-width: 60rem) {
  .studio-review-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .studio-review-layout > .studio-review-gallery {
    position: static;
  }
  .studio-review-layout > .studio-review-gallery :deep(.hero) {
    height: min(40vh, 16rem);
  }
}
.studio-review-gallery--editing {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
  padding: clamp(1rem, 2vw, 1.35rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}
:deep(.studio-gallery--editing) {
  grid-template-columns: minmax(0, 1fr) minmax(16.5rem, 20rem);
  grid-template-rows: auto auto auto auto auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-4);
}
:deep(.studio-gallery--editing > h3) {
  grid-column: 1 / -1;
  grid-row: 1;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
:deep(.studio-gallery--editing > .hero),
:deep(.studio-gallery--editing > .empty) {
  grid-column: 1;
  grid-row: 2 / 7;
  min-width: 0;
}
:deep(.studio-gallery--editing > .hero) {
  height: clamp(19rem, 42vh, 26rem);
}
:deep(.studio-gallery--editing > .empty) {
  align-self: stretch;
  min-height: 16.5rem;
}
:deep(.studio-gallery--editing > .thumbs) {
  grid-column: 1;
  grid-row: 7;
}
:deep(.studio-gallery--editing > .actions) {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
:deep(.studio-gallery--editing > .actions > .button--secondary) {
  background: var(--color-surface-raised);
  border-color: var(--color-border-strong);
}
:deep(.studio-gallery--editing > .actions > .button--secondary:hover:not(:disabled)) {
  background: var(--color-surface-hover);
}
:deep(.studio-gallery--editing > .hint) {
  grid-column: 2;
  grid-row: 3;
}
:deep(.studio-gallery--editing > [role='alert']) {
  grid-column: 2;
  grid-row: 4;
}
:deep(.studio-gallery--editing > .pending) {
  grid-column: 2;
  grid-row: 5;
  display: grid;
  justify-items: start;
  gap: var(--space-2);
}
:deep(.studio-gallery--editing > [role='status']) {
  grid-column: 2;
  grid-row: 6;
}
:deep(.studio-gallery--editing.studio-gallery--has-images) {
  grid-template-columns: 4.5rem minmax(0, 1fr) minmax(16.5rem, 20rem);
}
:deep(.studio-gallery--has-images > .hero) {
  grid-column: 2;
}
:deep(.studio-gallery--has-images > .thumbs) {
  grid-column: 1;
  grid-row: 2 / 7;
  flex-direction: column;
  max-height: clamp(19rem, 42vh, 26rem);
  overflow-x: hidden;
  overflow-y: auto;
}
:deep(.studio-gallery--has-images > .thumbs button) {
  width: 4rem;
}
:deep(.studio-gallery--has-images > .actions),
:deep(.studio-gallery--has-images > .hint),
:deep(.studio-gallery--has-images > .pending),
:deep(.studio-gallery--has-images > [role='alert']),
:deep(.studio-gallery--has-images > [role='status']) {
  grid-column: 3;
}
@media (max-width: 48rem) {
  :deep(.studio-gallery--editing) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  :deep(.studio-gallery--editing > .hero) {
    height: 16rem;
  }
  :deep(.studio-gallery--editing > .empty) {
    min-height: 12rem;
  }
  :deep(.studio-gallery--has-images > .thumbs) {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
  }
}
.studio-page-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
  padding: 0.65rem 0;
  border-top: 1px solid var(--color-border);
}
.studio-page-footer span {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
@media (max-width: 65rem) {
  .studio-step-icon {
    display: none;
  }
}
@media (max-width: 48rem) {
  .studio-steps {
    display: flex;
    overflow-x: auto;
    padding-bottom: 0.4rem;
  }
  .studio-steps button {
    flex: 0 0 auto;
    min-height: 3.2rem;
  }
  .studio-section-heading {
    display: grid;
  }
  .studio-section-heading > p {
    text-align: left;
  }
  .studio-page-footer span {
    order: 3;
    flex-basis: 100%;
  }
}
.studio-proposal {
  display: grid;
  gap: 1rem;
  border: 1px solid var(--color-border-strong);
  padding: clamp(1rem, 2vw, 1.5rem);
  background: var(--color-surface);
  border-radius: var(--radius-card);
}
.studio-proposal-heading {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.8rem;
  align-items: start;
}
.studio-proposal-heading h3 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}
.studio-proposal-heading p,
.studio-proposal-disclaimer {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.55;
  color: var(--color-text-secondary);
}
.studio-proposal-pill {
  border-radius: 999px;
  padding: 0.4rem 0.7rem;
  color: var(--color-text);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  font-size: 0.71rem;
  font-weight: 700;
}
.studio-proposal-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
.studio-proposal-facts div {
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.studio-proposal-facts span {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
}
.studio-proposal-facts strong {
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
.studio-proposal-transcript {
  padding: 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.studio-proposal-transcript summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 700;
}
.studio-proposal-transcript p {
  font-size: 0.82rem;
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.studio-proposal-technical {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
.studio-proposal-technical p {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.studio-proposal-tech-header {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.studio-proposal-tech-header h4,
.studio-proposal-pieces h4 {
  font-size: 0.86rem;
  margin: 0;
}
.studio-proposal-tech-header span {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
.studio-proposal-measures {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}
.studio-proposal-measures div {
  display: grid;
  gap: 0.3rem;
  padding: 0.75rem;
  background: var(--color-surface-muted);
  border-radius: var(--radius-control);
}
.studio-proposal-measures span {
  font-size: 0.73rem;
  color: var(--color-text-secondary);
}
.studio-proposal-measures strong {
  font-size: 0.86rem;
}
.studio-proposal-pieces {
  display: grid;
  gap: 0.5rem;
}
.studio-proposal-pieces ul {
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.81rem;
  line-height: 1.65;
}
.studio-proposal-pending {
  padding: 0.9rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
}
.studio-proposal-pending h4 {
  font-size: 0.86rem;
  margin: 0;
}
.studio-proposal-pending li {
  font-size: 0.78rem;
  line-height: 1.5;
  margin-top: 0.3rem;
}
.studio-proposal-actions {
  display: flex;
  gap: 0.7rem;
  flex-wrap: wrap;
  justify-content: end;
}
@media (max-width: 38rem) {
  .studio-proposal-facts,
  .studio-proposal-measures {
    grid-template-columns: 1fr;
  }
}
</style>
