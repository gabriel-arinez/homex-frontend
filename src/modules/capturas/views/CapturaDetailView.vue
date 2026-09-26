<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { CapturaRevision, ConfirmarCaptura, ValorCatalogoPublico } from '@/generated/api'
import { capturasService } from '../services/capturasService'
import { proformasService } from '@/modules/proformas/services/proformasService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import TextField from '@/shared/ui/TextField.vue'
import Select from '@/shared/ui/Select.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  id = Number(useRoute().params.id),
  capture = ref<CapturaRevision | null>(null),
  loading = ref(true),
  processing = ref(false),
  error = ref(''),
  notice = ref(''),
  confirmOpen = ref(false),
  types = ref<ValorCatalogoPublico[]>([]),
  units = ref<ValorCatalogoPublico[]>([]),
  furniture = ref<ValorCatalogoPublico[]>([]),
  form = ref({
    nombre: '',
    cantidad: '1',
    espesor: '',
    color_principal: '',
    color_secundario: '',
    dimensiones: '',
    accesorios: '',
    observaciones: '',
    tipo_item_id: '',
    unidad_id: '',
    tipo_mueble_id: '',
    modo_calculo: 'TOTAL_NEGOCIADO',
    precio_unitario: '',
    importe_negociado: '',
    descripcion: '',
  })
let poll: number | undefined,
  initialized = false
const terminal = computed(() => ['COMPLETADA', 'ERROR'].includes(capture.value?.estado ?? '')),
  canConfirm = computed(
    () =>
      capture.value?.estado === 'COMPLETADA' &&
      !!capture.value.item_ia &&
      !capture.value.confirmada &&
      !capture.value.incorporada,
  ),
  resultKind = computed(() =>
    capture.value?.estado === 'ERROR'
      ? 'ERROR'
      : capture.value?.estado === 'COMPLETADA' && !capture.value.item_ia
        ? 'NO_PROPOSAL'
        : capture.value?.item_ia
          ? 'REQUIRES_REVIEW'
          : 'PROCESSING',
  )
const json = (v: unknown) => (v == null ? '' : JSON.stringify(v, null, 2))
function initialize() {
  if (initialized || !capture.value?.item_ia) return
  const x = capture.value.item_ia
  form.value = {
    ...form.value,
    nombre: x.nombre ?? '',
    cantidad: String(x.cantidad ?? 1),
    espesor: json(x.espesor),
    color_principal: x.color_principal ?? '',
    color_secundario: x.color_secundario ?? '',
    dimensiones: json(x.dimensiones),
    accesorios: json(x.accesorios),
    observaciones: x.observaciones ?? '',
    importe_negociado: x.precio_total ?? '',
  }
  const t = types.value.find((x) => x.codigo === 'MUEBLE_MEDIDA'),
    u = units.value.find((x) => x.codigo === 'PIEZA')
  form.value.tipo_item_id = String(t?.id ?? '')
  form.value.unidad_id = String(u?.id ?? '')
  initialized = true
}
function parse(value: string, label: string) {
  if (!value.trim()) return null
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${label} debe contener JSON válido.`)
  }
}
async function load(background = false) {
  if (!background) loading.value = true
  try {
    capture.value = await capturasService.get(id)
    initialize()
    if (terminal.value && poll) {
      clearInterval(poll)
      poll = undefined
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo consultar la captura.'
  } finally {
    loading.value = false
  }
}
async function submit() {
  if (!capture.value?.intento_id || !capture.value.item_ia) return
  processing.value = true
  error.value = ''
  try {
    const body: ConfirmarCaptura = {
      intento_id: capture.value.intento_id,
      item_ia_id: capture.value.item_ia.id,
      item_corregido: {
        nombre: form.value.nombre,
        cantidad: Number(form.value.cantidad),
        espesor: parse(form.value.espesor, 'Espesor'),
        color_principal: form.value.color_principal || null,
        color_secundario: form.value.color_secundario || null,
        dimensiones: parse(form.value.dimensiones, 'Dimensiones'),
        accesorios: parse(form.value.accesorios, 'Accesorios'),
        observaciones: form.value.observaciones || null,
      },
      linea_comercial: {
        tipo_item_id: Number(form.value.tipo_item_id),
        unidad_id: Number(form.value.unidad_id),
        tipo_mueble_id: form.value.tipo_mueble_id ? Number(form.value.tipo_mueble_id) : null,
        modo_calculo: form.value.modo_calculo as 'PRECIO_UNITARIO' | 'TOTAL_NEGOCIADO',
        precio_unitario:
          form.value.modo_calculo === 'PRECIO_UNITARIO' ? form.value.precio_unitario : null,
        importe_negociado:
          form.value.modo_calculo === 'TOTAL_NEGOCIADO' ? form.value.importe_negociado : null,
        descripcion: form.value.descripcion || null,
      },
    }
    const r = await capturasService.confirm(id, body)
    notice.value = `Corrección incorporada como línea #${r.detalle_id}. La proforma permanece ${r.proforma_estado}.`
    confirmOpen.value = false
    await load(true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo confirmar la revisión.'
    await load(true)
  } finally {
    processing.value = false
  }
}
onMounted(async () => {
  try {
    ;[types.value, units.value, furniture.value] = await Promise.all([
      proformasService.options('TIPO_ITEM'),
      proformasService.options('UNIDAD_MEDIDA'),
      proformasService.options('TIPO_MUEBLE'),
    ])
  } catch {
    error.value = 'No se pudieron cargar los catálogos de revisión.'
  }
  await load()
  if (!terminal.value) poll = window.setInterval(() => void load(true), 2000)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})
</script>
<template>
  <div>
    <PageHeader
      :title="`Captura #${id}`"
      description="Procesamiento y revisión humana de la propuesta."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions><RouterLink to="/capturas">Volver</RouterLink></template></PageHeader
    ><LoadingSkeleton v-if="loading" :lines="8" /><ErrorState
      v-else-if="error && !capture"
      :description="error"
      ><button @click="load()">Reintentar</button></ErrorState
    ><template v-else-if="capture"
      ><p class="status" role="status">
        <strong>Estado:</strong> {{ capture.estado
        }}<span v-if="!terminal"> · consultando cambios automáticamente</span>
      </p>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <Card v-if="resultKind === 'PROCESSING'"
        ><h2>Procesando captura</h2>
        <p>
          El audio se transcribe y elimina en el backend. Puedes permanecer aquí mientras se
          actualiza el resultado.
        </p></Card
      ><Card v-else-if="resultKind === 'ERROR'"
        ><h2>No se pudo procesar</h2>
        <p>
          El backend cerró el intento con error. El contrato actual no publica una acción de
          reintento; crea otra captura para volver a procesar el texto.
        </p>
        <Button @click="$router.push('/capturas/nueva')">Nueva captura</Button></Card
      ><Card v-else-if="resultKind === 'NO_PROPOSAL'"
        ><h2>Sin propuesta</h2>
        <p>
          La captura terminó sin una propuesta utilizable. Revisa la transcripción y crea una nueva
          captura con un solo mueble a medida.
        </p>
        <blockquote v-if="capture.texto_transcrito">
          {{ capture.texto_transcrito }}
        </blockquote></Card
      ><template v-else
        ><div class="review">
          <Card class="evidence"
            ><h2>Evidencia del servidor</h2>
            <p class="tag">Propuesta IA · requiere revisión</p>
            <h3>Transcripción</h3>
            <blockquote>{{ capture.texto_transcrito ?? 'Sin transcripción publicada' }}</blockquote>
            <h3>Propuesta original</h3>
            <dl>
              <div>
                <dt>Nombre</dt>
                <dd>{{ capture.item_ia?.nombre ?? 'Falta' }}</dd>
              </div>
              <div>
                <dt>Cantidad</dt>
                <dd>{{ capture.item_ia?.cantidad ?? 'Falta' }}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{{ capture.item_ia?.color_principal ?? 'Falta' }}</dd>
              </div>
              <div>
                <dt>Precio total</dt>
                <dd>{{ capture.item_ia?.precio_total ?? 'Falta' }}</dd>
              </div>
            </dl>
            <p class="hint">
              El original IA es inmutable y se recupera del servidor. Este contrato no publica spans
              ni advertencias detalladas.
            </p></Card
          ><Card
            ><h2>Corrección humana final</h2>
            <p v-if="capture.confirmada">Esta captura ya fue confirmada.</p>
            <p v-else-if="capture.incorporada">
              La captura ya está vinculada a una línea comercial y no puede confirmarse otra vez.
            </p>
            <form v-else @submit.prevent="confirmOpen = true">
              <TextField
                v-model="form.nombre"
                label="Nombre del mueble"
                name="nombre"
                required
              /><TextField
                v-model="form.cantidad"
                label="Cantidad"
                name="cantidad"
                type="number"
                min="1"
                step="1"
                required
              /><TextField
                v-model="form.color_principal"
                label="Color principal"
                name="color-principal"
              /><TextField
                v-model="form.color_secundario"
                label="Color secundario"
                name="color-secundario"
              /><label
                >Espesor JSON<textarea
                  v-model="form.espesor"
                  rows="3"
                  placeholder='{"espesor":"18 mm"}'
                /></label
              ><label
                >Dimensiones JSON<textarea
                  v-model="form.dimensiones"
                  rows="4"
                  placeholder='{"ancho":"1.20 m"}'
                /></label
              ><label
                >Accesorios JSON<textarea
                  v-model="form.accesorios"
                  rows="3"
                  placeholder='["cajones"]'
                /></label
              ><TextField
                v-model="form.observaciones"
                label="Observaciones"
                name="observaciones"
              /><Select
                v-model="form.tipo_item_id"
                name="tipo-item"
                label="Tipo de ítem"
                :options="
                  types
                    .filter((x) => x.codigo === 'MUEBLE_MEDIDA')
                    .map((x) => ({ label: x.nombre, value: String(x.id) }))
                "
              /><Select
                v-model="form.unidad_id"
                name="unidad"
                label="Unidad"
                :options="
                  units
                    .filter((x) => x.codigo === 'PIEZA')
                    .map((x) => ({ label: x.nombre, value: String(x.id) }))
                "
              /><Select
                v-model="form.tipo_mueble_id"
                name="tipo-mueble"
                label="Tipo de mueble"
                :options="[
                  { label: 'Sin clasificar', value: '' },
                  ...furniture.map((x) => ({ label: x.nombre, value: String(x.id) })),
                ]"
              /><Select
                v-model="form.modo_calculo"
                name="modo"
                label="Forma comercial"
                :options="[
                  { label: 'Total negociado', value: 'TOTAL_NEGOCIADO' },
                  { label: 'Precio unitario', value: 'PRECIO_UNITARIO' },
                ]"
              /><TextField
                v-if="form.modo_calculo === 'TOTAL_NEGOCIADO'"
                v-model="form.importe_negociado"
                label="Total negociado"
                name="total"
                type="number"
                min="0"
                step="0.01"
                required
              /><TextField
                v-else
                v-model="form.precio_unitario"
                label="Precio unitario"
                name="unitario"
                type="number"
                min="0"
                step="0.01"
                required
              /><TextField
                v-model="form.descripcion"
                label="Descripción comercial"
                name="descripcion"
              /><Button type="submit" :disabled="processing || !canConfirm"
                >Revisar y confirmar</Button
              >
            </form></Card
          >
        </div></template
      ><ConfirmDialog
        :open="confirmOpen"
        title="Confirmar corrección humana"
        description="Se incorporará una línea a la proforma. Esta acción no aprueba la proforma y no puede repetirse."
        confirm-label="Confirmar revisión"
        @close="confirmOpen = false"
        @confirm="submit"
    /></template>
  </div>
</template>
<style scoped>
.review {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: var(--space-5);
  align-items: start;
}
.status,
.notice,
.error {
  padding: var(--space-3);
  border-radius: var(--radius-control);
}
.status {
  background: var(--color-info-soft);
}
.notice {
  background: var(--color-success-soft);
}
.error {
  color: var(--color-danger-text);
  background: var(--color-danger-soft);
}
form {
  display: grid;
  gap: var(--space-4);
}
label {
  display: grid;
  gap: var(--space-2);
  font-weight: 700;
}
textarea {
  padding: 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
blockquote {
  margin: 0;
  padding: var(--space-4);
  border-left: 4px solid var(--color-primary);
  background: var(--color-surface-soft);
  white-space: pre-wrap;
}
.tag {
  display: inline-block;
  padding: 0.3rem 0.55rem;
  border-radius: 999px;
  background: var(--color-warning-soft);
  font-weight: 700;
}
.hint,
dt {
  color: var(--color-text-secondary);
}
dl {
  display: grid;
  gap: 0.5rem;
}
dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
dd {
  margin: 0;
  font-weight: 700;
}
a {
  color: var(--color-primary-accent);
  font-weight: 700;
}
@media (max-width: 850px) {
  .review {
    grid-template-columns: 1fr;
  }
  .evidence {
    order: 0;
  }
}
@media (max-width: 480px) {
  dl div {
    display: grid;
    gap: 0.2rem;
  }
}
</style>
