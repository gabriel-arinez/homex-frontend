<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, AudioLines, CheckCircle2, ClipboardCheck, Layers3, Ruler, Settings2, Wallet } from '@lucide/vue'
import type {
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  PendienteAsistida,
  ResultadoAsistida,
  ValorCatalogoPublico,
} from '@/generated/api'
import Button from '@/shared/ui/Button.vue'
import CapturaAsistida from './CapturaAsistida.vue'
import EspecificacionForm from './EspecificacionForm.vue'

type Seccion = 'general' | 'estructura' | 'accesorios' | 'comercial' | 'revision'
type DatosComerciales = {
  nombre: string
  descripcion: string
  cantidad: string
  unidad: number
  precio_unitario: string
  descuento: string
}
const props = defineProps<{
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
  save: [body: EspecificacionMuebleWritable, comercial: DatosComerciales]
  cancel: []
  changed: []
  applied: [result: ResultadoAsistida]
  processing: [value: boolean]
  typeCreated: [tipo: ValorCatalogoPublico]
}>()
const secciones = [
  { id: 'general', titulo: 'General', icono: Ruler },
  { id: 'estructura', titulo: 'Estructura', icono: Layers3 },
  { id: 'accesorios', titulo: 'Accesorios', icono: Settings2 },
  { id: 'comercial', titulo: 'Precio', icono: Wallet },
  { id: 'revision', titulo: 'Revisar', icono: ClipboardCheck },
] as const
const seccion = ref<Seccion>('general')
const vozAbierta = ref(false)
const indice = computed(() => secciones.findIndex((item) => item.id === seccion.value))
const titulo = computed(() => props.detalle?.nombre?.trim() || 'Nuevo mueble a pedido')
function avanzar() {
  if (indice.value < secciones.length - 1) seccion.value = secciones[indice.value + 1]!.id
}
function retroceder() {
  if (indice.value > 0) seccion.value = secciones[indice.value - 1]!.id
}
</script>

<template>
  <main class="furniture-studio" aria-labelledby="furniture-studio-title">
    <div class="studio-breadcrumb">COMERCIAL <span>/</span> PROFORMAS <span>/</span> MUEBLE A PEDIDO</div>
    <header class="studio-header">
      <div>
        <p class="studio-kicker">CONFIGURADOR DE MUEBLES</p>
        <h1 id="furniture-studio-title">{{ titulo }}</h1>
        <p class="studio-subtitle">Completa la ficha técnica y comercial antes de incorporarla a la proforma.</p>
        <p class="studio-status" role="status">
          <span class="studio-status-dot" aria-hidden="true" />
          {{ dirty ? 'Cambios pendientes de incorporar a la proforma' : 'La ficha todavía no se incorporó a la proforma' }}
        </p>
      </div>
      <div class="studio-header-actions">
        <Button
          v-if="nueva"
          variant="secondary"
          type="button"
          :aria-expanded="vozAbierta"
          aria-controls="furniture-voice-panel"
          @click="vozAbierta = !vozAbierta"
        >
          <AudioLines :size="17" aria-hidden="true" />
          {{ vozAbierta ? 'Ocultar asistencia' : 'Asistencia por voz' }}
        </Button>
        <Button variant="secondary" type="button" @click="emit('cancel')">
          <ArrowLeft :size="17" aria-hidden="true" />
          Volver a proforma
        </Button>
      </div>
    </header>

    <section v-if="nueva" id="furniture-voice-panel" v-show="vozAbierta" class="studio-voice" aria-label="Captura asistida del mueble">
      <div class="studio-voice-heading">
        <div>
          <h2>Describe el mueble con tu voz</h2>
          <p>Graba o carga un audio. Revisa la transcripción y los datos propuestos antes de aplicarlos.</p>
        </div>
        <span class="studio-voice-label">ASR + PLN</span>
      </div>
      <CapturaAsistida
        :dirty="dirty"
        :sesion="sesion"
        :moneda="moneda"
        :proforma="proforma"
        @applied="emit('applied', $event)"
        @processing="emit('processing', $event)"
      />
    </section>

    <nav class="studio-steps" aria-label="Apartados del mueble a pedido">
      <button
        v-for="(item, i) in secciones"
        :key="item.id"
        type="button"
        :class="{ 'studio-step--active': seccion === item.id }"
        :aria-current="seccion === item.id ? 'step' : undefined"
        @click="seccion = item.id"
      >
        <span class="studio-step-icon"><component :is="item.icono" :size="18" aria-hidden="true" /></span>
        <span class="studio-step-label"><small>{{ String(i + 1).padStart(2, '0') }}</small>{{ item.titulo }}</span>
        <CheckCircle2 v-if="i < indice" :size="15" class="studio-past" aria-hidden="true" />
      </button>
    </nav>
    <div class="studio-section-heading">
      <div>
        <p class="studio-kicker">PASO {{ String(indice + 1).padStart(2, '0') }} DE 05</p>
        <h2>{{ { general: 'Información general', estructura: 'Estructura y componentes', accesorios: 'Accesorios y observaciones', comercial: 'Datos comerciales', revision: 'Revisión del mueble' }[seccion] }}</h2>
      </div>
      <p v-if="seccion === 'estructura'">Organiza conjuntos y edita las características de cada pieza.</p>
      <p v-else-if="seccion === 'revision'">Verifica lo que se incorporará a la proforma.</p>
    </div>
    <fieldset class="studio-content" :disabled="processing">
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
        :active-section="seccion"
        @save="(body, comercial) => emit('save', body, comercial)"
        @changed="emit('changed')"
        @cancel="emit('cancel')"
        @request-section="seccion = $event"
        @type-created="emit('typeCreated', $event)"
      />
    </fieldset>
    <footer class="studio-page-footer">
      <Button type="button" variant="secondary" :disabled="indice === 0" @click="retroceder">Anterior</Button>
      <span>La incorporación es local; el guardado de la proforma se realiza por separado.</span>
      <Button v-if="indice < secciones.length - 1" type="button" @click="avanzar">Continuar</Button>
      <Button v-else type="button" variant="secondary" @click="seccion = 'general'">Volver al inicio</Button>
    </footer>
  </main>
</template>

<style scoped>
.furniture-studio { width: 100%; min-width: 0; display: grid; gap: var(--space-5); padding-bottom: var(--space-8); }
.studio-breadcrumb { display: flex; gap: var(--space-3); color: var(--color-text-muted); font-size: .69rem; font-weight: 750; letter-spacing: .09em; }
.studio-breadcrumb span { color: var(--color-border-strong); }
.studio-header { display: flex; gap: var(--space-5); align-items: start; justify-content: space-between; }
.studio-header h1 { font-size: clamp(1.65rem,2.5vw,2.45rem); letter-spacing: -.035em; line-height: 1.15; margin: .2rem 0 .5rem; }
.studio-kicker { color: var(--color-primary-accent); font-size: .7rem; font-weight: 750; letter-spacing: .09em; margin: 0; }
.studio-subtitle { color: var(--color-text-secondary); font-size: .89rem; margin: 0; }
.studio-status { display: inline-flex; gap: .5rem; align-items: center; color: var(--color-text-secondary); font-size: .78rem; margin: .9rem 0 0; }
.studio-status-dot { width: .48rem; height: .48rem; border-radius: 50%; background: var(--color-primary); }
.studio-header-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: end; }
.studio-voice { display: grid; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-card); background: var(--color-surface); padding: var(--space-5); }
.studio-voice-heading { display: flex; justify-content: space-between; gap: var(--space-4); }
.studio-voice-heading h2 { margin: 0 0 .35rem; font-size: 1.1rem; }
.studio-voice-heading p { margin: 0; color: var(--color-text-secondary); font-size: .85rem; }
.studio-voice-label { align-self: start; white-space: nowrap; border-radius: 999px; padding: .35rem .6rem; background: var(--color-primary-soft); color: var(--color-primary-accent); font-weight: 750; font-size: .7rem; }
.studio-steps { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: var(--space-2); }
.studio-steps button { display: flex; align-items: center; text-align: left; gap: var(--space-3); min-width: 0; min-height: 4.35rem; padding: var(--space-3); color: var(--color-text-secondary); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); font: inherit; font-weight: 700; cursor: pointer; }
.studio-steps button:hover { border-color: var(--color-border-strong); }
.studio-steps button:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 2px; }
.studio-steps .studio-step--active { color: var(--color-primary-accent); border-color: var(--color-primary); background: var(--color-primary-soft); }
.studio-step-icon { display: grid; place-items: center; flex: 0 0 2.2rem; height: 2.2rem; border-radius: .65rem; background: var(--color-surface-muted); }
.studio-step--active .studio-step-icon { background: var(--color-surface); }
.studio-step-label { display: grid; min-width: 0; gap: .15rem; font-size: .82rem; }
.studio-step-label small { font-size: .65rem; opacity: .7; }
.studio-past { margin-left: auto; color: var(--color-success); }
.studio-section-heading { display: flex; justify-content: space-between; align-items: end; gap: var(--space-3); }
.studio-section-heading h2 { margin: .3rem 0 0; font-size: clamp(1.18rem,1.5vw,1.5rem); }
.studio-section-heading > p { color: var(--color-text-secondary); font-size: .8rem; text-align: right; max-width: 20rem; margin: 0; }
.studio-content { border: 0; margin: 0; padding: 0; min-width: 0; }
.studio-page-footer { display: flex; gap: var(--space-3); align-items: center; justify-content: space-between; }
.studio-page-footer span { color: var(--color-text-secondary); font-size: .73rem; }
@media (max-width: 73rem) {
  .studio-steps button { gap: var(--space-2); padding: var(--space-2); }
  .studio-step-icon { display: none; }
}
@media (max-width: 48rem) {
  .studio-header, .studio-section-heading { align-items: stretch; flex-direction: column; }
  .studio-header-actions { justify-content: start; }
  .studio-steps { overflow-x: auto; display: flex; padding-bottom: var(--space-2); }
  .studio-steps button { flex: 0 0 auto; min-height: 3.4rem; padding: var(--space-2) var(--space-3); }
  .studio-section-heading > p { text-align: left; }
  .studio-page-footer { flex-wrap: wrap; }
  .studio-page-footer span { order: 3; flex-basis: 100%; }
}
</style>
