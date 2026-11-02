<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowLeft,
  AudioLines,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  Ruler,
  Settings2,
  Wallet,
} from '@lucide/vue'
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
const estadoApartados = ref<Record<Seccion, 'pending' | 'complete' | 'issues'>>({ general: 'pending', estructura: 'pending', accesorios: 'pending', comercial: 'pending', revision: 'pending' })
const volverARevision = ref(false)
const indice = computed(() => secciones.findIndex((item) => item.id === seccion.value))
const titulo = computed(() => props.detalle?.nombre?.trim() || 'Nuevo mueble a pedido')
function avanzar() {
  if (volverARevision.value) { seccion.value = 'revision'; volverARevision.value = false; return }
  if (indice.value < secciones.length - 1) seccion.value = secciones[indice.value + 1]!.id
}
function editarDesdeRevision(section: Seccion) { volverARevision.value = true; seccion.value = section }
function recibirCaptura(result: ResultadoAsistida) { emit('applied', result); volverARevision.value = false; seccion.value = 'revision' }
function retroceder() {
  if (indice.value > 0) seccion.value = secciones[indice.value - 1]!.id
}
</script>

<template>
  <section class="furniture-studio" aria-labelledby="furniture-studio-title">
    <header class="studio-header">
      <div>
        <div class="studio-breadcrumb">PROFORMAS <span>/</span> MUEBLE A PEDIDO</div>
        <h1 id="furniture-studio-title">{{ titulo }}</h1>
      </div>
      <Button type="button" variant="secondary" @click="emit('cancel')"><ArrowLeft :size="17" aria-hidden="true" /> Volver a proforma</Button>
    </header>
    <CapturaAsistida
      v-if="nueva" :dirty="dirty" :sesion="sesion" :moneda="moneda" :proforma="proforma"
      @applied="recibirCaptura" @processing="emit('processing', $event)"
    />
    <nav class="studio-steps" aria-label="Apartados del mueble a pedido">
      <button
        v-for="(item, i) in secciones" :key="item.id" type="button"
        :class="{ 'studio-step--active': seccion === item.id }"
        :aria-current="seccion === item.id ? 'step' : undefined"
        @click="seccion = item.id; volverARevision = false"
      >
        <span class="studio-step-icon"><component :is="item.icono" :size="18" aria-hidden="true" /></span>
        <span class="studio-step-label"><small>{{ String(i + 1).padStart(2, '0') }}</small>{{ item.titulo }}</span>
        <AlertCircle v-if="estadoApartados[item.id] === 'issues'" :size="16" class="studio-issue" aria-label="Requiere atención" />
        <CheckCircle2 v-else-if="estadoApartados[item.id] === 'complete'" :size="16" class="studio-complete" aria-label="Datos completos" />
      </button>
    </nav>
    <div class="studio-section-heading">
      <div>
        <p class="studio-index">PASO {{ String(indice + 1).padStart(2, '0') }} DE 05</p>
        <h2>{{ { general: 'Información general', estructura: 'Estructura y componentes', accesorios: 'Accesorios y observaciones', comercial: 'Datos comerciales', revision: 'Revisión del mueble' }[seccion] }}</h2>
      </div>
      <p v-if="seccion === 'revision'">Comprueba los detalles antes de añadir el mueble a la proforma.</p>
    </div>
    <fieldset class="studio-content" :disabled="processing">
      <EspecificacionForm
        :key="formVersion" :tipos="tipos" :especificacion="especificacion" :detalle="detalle"
        :unidades="unidades" :pendientes-asistencia="pendientesAsistencia" :moneda="moneda"
        :processing="processing" :external-error="externalError" studio :active-section="seccion"
        @save="(body, comercial) => emit('save', body, comercial)"
        @changed="emit('changed')" @cancel="emit('cancel')"
        @request-section="editarDesdeRevision($event)"
        @section-status="estadoApartados = $event"
        @type-created="emit('typeCreated', $event)"
      />
    </fieldset>
    <footer class="studio-page-footer">
      <Button type="button" variant="secondary" :disabled="indice === 0" @click="retroceder">Anterior</Button>
      <span v-if="seccion === 'revision'">Revisa cada apartado antes de incorporar el mueble.</span>
      <span v-else>Los cambios se conservan mientras configuras el mueble.</span>
      <Button v-if="seccion !== 'revision'" type="button" @click="avanzar">
        {{ volverARevision ? 'Volver a revisar' : 'Continuar a ' + secciones[indice + 1]!.titulo }}
      </Button>
    </footer>
  </section>
</template>

<style scoped>
.furniture-studio { display:grid; gap:var(--space-5); width:100%; min-width:0; padding-bottom:var(--space-7); }
.studio-header { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; }
.studio-breadcrumb { display:flex; gap:.7rem; font-size:.67rem; font-weight:750; letter-spacing:.09em; color:var(--color-text-muted); }
.studio-breadcrumb span { color:var(--color-border-strong); }
.studio-header h1 { margin:.55rem 0 0; font-size:clamp(1.6rem,2.35vw,2.25rem); line-height:1.18; letter-spacing:-.035em; }
.studio-steps { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:.5rem; }
.studio-steps button { display:flex; gap:.65rem; align-items:center; min-width:0; min-height:3.65rem; text-align:left; border:1px solid var(--color-border); border-radius:var(--radius-control); padding:.75rem; background:var(--color-surface); color:var(--color-text-secondary); font:inherit; cursor:pointer; }
.studio-steps button:hover { border-color:var(--color-border-strong); }
.studio-steps button:focus-visible { outline:2px solid var(--color-primary-accent); outline-offset:2px; }
.studio-steps .studio-step--active { background:var(--color-primary-soft); color:var(--color-primary-accent); border-color:var(--color-primary); }
.studio-step-icon { flex-shrink:0; display:grid; place-items:center; width:2rem; height:2rem; border-radius:.5rem; background:var(--color-surface-muted); }
.studio-step-label { display:grid; font-size:.81rem; font-weight:700; gap:.15rem; min-width:0; }
.studio-step-label small { font-size:.65rem; color:var(--color-text-muted); }
.studio-complete,.studio-issue { flex-shrink:0; margin-left:auto; }
.studio-complete { color:var(--color-success); }
.studio-issue { color:var(--color-danger); }
.studio-section-heading { display:flex; align-items:end; justify-content:space-between; gap:1rem; }
.studio-index { font-size:.7rem; font-weight:750; letter-spacing:.08em; color:var(--color-primary-accent); margin:0 0 .4rem; }
.studio-section-heading h2 { font-size:clamp(1.15rem,1.5vw,1.5rem); margin:0; }
.studio-section-heading > p { color:var(--color-text-secondary); max-width:23rem; text-align:right; font-size:.82rem; }
.studio-content { min-width:0; margin:0; border:0; padding:0; }
.studio-page-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:.8rem; padding:.65rem 0; border-top:1px solid var(--color-border); }
.studio-page-footer span { color:var(--color-text-secondary); font-size:.75rem; }
@media(max-width:65rem) { .studio-step-icon { display:none; } }
@media(max-width:48rem) { .studio-steps { display:flex; overflow-x:auto; padding-bottom:.4rem; } .studio-steps button { flex:0 0 auto; min-height:3.2rem; } .studio-section-heading { display:grid; } .studio-section-heading>p { text-align:left; } .studio-page-footer span { order:3; flex-basis:100%; } }
</style>