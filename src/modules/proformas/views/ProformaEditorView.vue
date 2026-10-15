<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type {
  ClienteNuevoProforma,
  DetalleIntegralWritable,
  DetalleProforma,
  DetalleProformaWritable,
  EspecificacionMueble,
  EspecificacionMuebleWritable,
  FamiliaProducto,
  Proforma,
  ProformaIntegralWritable,
  ValorCatalogoPublico,
} from '@/generated/api'
import { ApiError } from '@/shared/api'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import Modal from '@/shared/ui/Modal.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Select from '@/shared/ui/Select.vue'
import TextField from '@/shared/ui/TextField.vue'
import ClienteSelector from '../components/ClienteSelector.vue'
import ClienteFormFields from '@/modules/clientes/components/ClienteFormFields.vue'
import DetalleForm from '../components/DetalleForm.vue'
import EspecificacionForm from '../components/EspecificacionForm.vue'
import { proformasService } from '../services/proformasService'

type LineaLocal = DetalleIntegralWritable & { localId: string }
const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const proformaId = computed(() => (route.params.id ? Number(route.params.id) : null))
const steps = ['Productos', 'Cliente', 'Condiciones', 'Revisar'] as const
const currentStep = ref(0)
const loading = ref(Boolean(proformaId.value))
const saving = ref(false)
const referenceLoading = ref(true)
const error = ref('')
const success = ref('')
const fields = ref<Record<string, string[]>>({})
const dirty = ref(false)
const persisted = ref<Proforma | null>(null)
const tipos = ref<ValorCatalogoPublico[]>([])
const unidades = ref<ValorCatalogoPublico[]>([])
const monedas = ref<ValorCatalogoPublico[]>([])
const tiposMueble = ref<ValorCatalogoPublico[]>([])
const tiposCliente = ref<ValorCatalogoPublico[]>([])
const familias = ref<FamiliaProducto[]>([])
const lineModal = ref(false)
const editingLine = ref<number | null>(null)
const specLine = ref<number | null>(null)
const clienteMode = ref<'existente' | 'nuevo' | 'pendiente'>('existente')
const key = ref(crypto.randomUUID())
const header = reactive({
  cliente: '',
  titulo: '',
  moneda_codigo: 'BOB',
  plazo_entrega: '',
  validez_oferta: '',
  porcentaje_adelanto: '',
  observaciones: '',
})
const nuevoCliente = reactive({
  tipo_cliente: '',
  nombres: '',
  apellidos: '',
  empresa: '',
  celular: '',
  direccion: '',
  observaciones: '',
})
function updateNuevoCliente(field: keyof typeof nuevoCliente, value: string) {
  nuevoCliente[field] = value
}
const lineas = ref<LineaLocal[]>([])
const existingProductIds = computed(() =>
  lineas.value.flatMap((line) => (line.producto ? [line.producto] : [])),
)
const totalPreview = computed(() =>
  lineas.value.reduce((sum, line) => {
    const bruto = Number(line.cantidad || 0) * Number(line.precio_unitario || 0)
    return sum + Math.max(0, bruto - Number(line.descuento || 0))
  }, 0),
)
const editableDetail = computed(() => {
  if (editingLine.value === null) return undefined
  return lineas.value[editingLine.value] as unknown as DetalleProforma
})
const editableSpec = computed(() => {
  if (specLine.value === null) return null
  return (lineas.value[specLine.value]?.especificacion ?? null) as EspecificacionMueble | null
})
const canEmit = computed(
  () =>
    lineas.value.length > 0 &&
    (clienteMode.value === 'existente'
      ? Boolean(header.cliente)
      : clienteMode.value === 'nuevo' &&
        Boolean(nuevoCliente.tipo_cliente && nuevoCliente.nombres && nuevoCliente.apellidos)),
)

function markDirty() {
  dirty.value = true
}
function money(value: number) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: header.moneda_codigo,
  }).format(value)
}
function localId() {
  return crypto.randomUUID()
}
function normalizeLine(line: Proforma['detalles'][number]): LineaLocal {
  return {
    id: line.id,
    localId: localId(),
    tipo_item: line.tipo_item,
    producto: line.producto,
    familia_producto: line.familia_producto,
    nombre: line.nombre,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    unidad: line.unidad,
    modo_calculo: line.modo_calculo,
    precio_unitario: line.precio_unitario,
    importe_negociado: line.importe_negociado,
    descuento: line.descuento,
    especificacion: line.especificacion
      ? {
          tipo_mueble: line.especificacion.tipo_mueble,
          datos_tecnicos: line.especificacion.datos_tecnicos,
          observaciones: line.especificacion.observaciones,
        }
      : null,
  }
}
function fill(value: Proforma) {
  persisted.value = value
  header.cliente = value.cliente ? String(value.cliente) : ''
  header.titulo = value.titulo ?? ''
  header.moneda_codigo = value.moneda_info.codigo
  header.plazo_entrega = value.plazo_entrega ?? ''
  header.validez_oferta = value.validez_oferta ? String(value.validez_oferta) : ''
  header.porcentaje_adelanto = value.porcentaje_adelanto ?? ''
  header.observaciones = value.observaciones ?? ''
  clienteMode.value = value.cliente ? 'existente' : 'pendiente'
  lineas.value = value.detalles.map(normalizeLine)
  dirty.value = false
}
async function load() {
  if (!proformaId.value) return
  loading.value = true
  try {
    const value = await proformasService.get(proformaId.value)
    if (!['BORRADOR', 'EN_REVISION'].includes(value.estado_info.codigo)) {
      await router.replace({ name: 'proforma-readonly', params: { id: value.id } })
      return
    }
    fill(value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la proforma.'
  } finally {
    loading.value = false
  }
}
async function loadReferences() {
  referenceLoading.value = true
  try {
    const [a, b, c, d, e, f] = await Promise.all([
      proformasService.options('TIPO_ITEM'),
      proformasService.options('UNIDAD_MEDIDA'),
      proformasService.options('MONEDA'),
      proformasService.options('TIPO_MUEBLE'),
      proformasService.options('TIPO_CLIENTE'),
      proformasService.families(),
    ])
    tipos.value = a
    unidades.value = b
    monedas.value = c
    tiposMueble.value = d
    tiposCliente.value = e
    familias.value = f.results
    if (!nuevoCliente.tipo_cliente && e[0]) nuevoCliente.tipo_cliente = String(e[0].id)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se cargaron los datos auxiliares.'
  } finally {
    referenceLoading.value = false
  }
}
function saveLine(body: DetalleProformaWritable) {
  const line: LineaLocal = { ...body, localId: localId(), especificacion: null }
  if (editingLine.value === null) lineas.value.push(line)
  else {
    const previous = lineas.value[editingLine.value]
    if (!previous) return
    lineas.value[editingLine.value] = {
      ...line,
      id: previous.id,
      localId: previous.localId,
      especificacion: previous.especificacion,
    }
  }
  lineModal.value = false
  editingLine.value = null
  markDirty()
}
function saveSpec(body: EspecificacionMuebleWritable) {
  if (specLine.value !== null) {
    const line = lineas.value[specLine.value]
    if (line) line.especificacion = body
  }
  specLine.value = null
  markDirty()
}
function removeLine(index: number) {
  lineas.value.splice(index, 1)
  markDirty()
}
function openLine(index: number | null = null) {
  editingLine.value = index
  lineModal.value = true
}
function body(emitir: boolean): ProformaIntegralWritable {
  const detalles = lineas.value.map((line) => {
    const detalle: Partial<LineaLocal> = { ...line }
    delete detalle.localId
    return detalle as DetalleIntegralWritable
  })
  return {
    clave_idempotencia: key.value,
    emitir,
    cliente: clienteMode.value === 'existente' && header.cliente ? Number(header.cliente) : null,
    cliente_nuevo:
      clienteMode.value === 'nuevo'
        ? ({
            ...nuevoCliente,
            tipo_cliente: Number(nuevoCliente.tipo_cliente),
          } satisfies ClienteNuevoProforma)
        : null,
    titulo: header.titulo || null,
    moneda_codigo: header.moneda_codigo as 'BOB' | 'USD',
    plazo_entrega: header.plazo_entrega || null,
    validez_oferta: header.validez_oferta ? Number(header.validez_oferta) : null,
    porcentaje_adelanto: header.porcentaje_adelanto || null,
    observaciones: header.observaciones || null,
    detalles,
  }
}
async function persist(emitir: boolean) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  fields.value = {}
  try {
    const result = proformaId.value
      ? await proformasService.updateIntegral(proformaId.value, body(emitir))
      : await proformasService.saveIntegral(body(emitir))
    fill(result)
    key.value = crypto.randomUUID()
    success.value = emitir ? 'Proforma emitida para revisión.' : 'Borrador guardado.'
    if (!proformaId.value) await router.replace(`/proformas/${result.id}/editar`)
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar la proforma.'
    if (cause instanceof ApiError && cause.status === 409 && proformaId.value) await load()
  } finally {
    saving.value = false
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
}
onBeforeRouteLeave(() => !dirty.value || window.confirm('Hay cambios sin guardar. ¿Deseas salir?'))
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void Promise.all([loadReferences(), load()])
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div @input="markDirty" @change="markDirty">
    <PageHeader
      :title="persisted ? `Editar proforma #${persisted.numero}` : 'Nueva proforma'"
      description="Prepara productos, cliente y condiciones antes de guardar."
      show-menu
      @menu="emit('openMenu')"
    />
    <LoadingSkeleton v-if="loading || referenceLoading" :lines="8" />
    <ErrorState v-else-if="error && !tipos.length" :description="error">
      <button @click="loadReferences">Reintentar</button>
    </ErrorState>
    <template v-else>
      <nav class="steps" aria-label="Apartados de la proforma">
        <button
          v-for="(step, index) in steps"
          :key="step"
          :class="{ active: currentStep === index }"
          :aria-current="currentStep === index ? 'step' : undefined"
          @click="currentStep = index"
        >
          <span>{{ index + 1 }}</span
          >{{ step }}
        </button>
      </nav>
      <p v-if="success" role="status" class="success">{{ success }}</p>
      <p v-if="persisted" class="persisted-state">
        Estado: <strong>{{ persisted.estado_info.nombre }}</strong> · Número {{ persisted.numero }}
      </p>
      <p v-if="error" role="alert" class="error">{{ error }}</p>

      <section v-show="currentStep === 0" aria-labelledby="productos-title">
        <div class="section-title">
          <div>
            <h2 id="productos-title">Productos</h2>
            <p>Agrega productos antes o después de elegir cliente.</p>
          </div>
          <Button @click="openLine()">Agregar producto</Button>
        </div>
        <Card v-for="(line, index) in lineas" :key="line.localId" class="line-card">
          <div>
            <strong>{{ line.nombre }}</strong>
            <p>{{ line.cantidad }} × {{ money(Number(line.precio_unitario || 0)) }}</p>
          </div>
          <strong>{{
            money(
              Math.max(
                0,
                Number(line.cantidad) * Number(line.precio_unitario || 0) -
                  Number(line.descuento || 0),
              ),
            )
          }}</strong>
          <div class="actions">
            <Button variant="secondary" @click="openLine(index)">Editar</Button>
            <Button
              v-if="tipos.find((x) => x.id === line.tipo_item)?.codigo === 'MUEBLE_MEDIDA'"
              variant="secondary"
              @click="specLine = index"
              >Ficha técnica</Button
            >
            <Button variant="secondary" @click="removeLine(index)">Eliminar</Button>
          </div>
        </Card>
        <p v-if="!lineas.length" class="empty">Aún no agregaste productos.</p>
      </section>

      <section v-show="currentStep === 1" aria-labelledby="cliente-title">
        <h2 id="cliente-title">Cliente</h2>
        <div class="mode" role="radiogroup" aria-label="Origen del cliente">
          <label><input v-model="clienteMode" type="radio" value="pendiente" /> Pendiente</label>
          <label><input v-model="clienteMode" type="radio" value="existente" /> Existente</label>
          <label><input v-model="clienteMode" type="radio" value="nuevo" /> Registrar nuevo</label>
        </div>
        <ClienteSelector
          v-if="clienteMode === 'existente'"
          v-model="header.cliente"
          label="Cliente existente"
        />
        <Card v-if="clienteMode === 'nuevo'">
          <ClienteFormFields
            :model="nuevoCliente"
            :tipos="tiposCliente"
            prefix="proforma-cliente"
            @change="updateNuevoCliente"
          />
        </Card>
        <p v-if="clienteMode === 'pendiente'">
          Puedes guardar el borrador sin cliente. Para emitir deberás definirlo.
        </p>
      </section>

      <section v-show="currentStep === 2" aria-labelledby="condiciones-title">
        <h2 id="condiciones-title">Condiciones</h2>
        <div class="form-grid">
          <TextField v-model="header.titulo" name="titulo" label="Título" />
          <Select
            v-model="header.moneda_codigo"
            name="moneda"
            label="Moneda"
            :options="monedas.map((x) => ({ label: `${x.nombre} (${x.codigo})`, value: x.codigo }))"
          />
          <TextField v-model="header.plazo_entrega" name="plazo" label="Plazo de entrega" />
          <TextField
            v-model="header.validez_oferta"
            name="validez"
            label="Validez de la oferta (días)"
            type="number"
            min="1"
          />
          <TextField
            v-model="header.porcentaje_adelanto"
            name="adelanto"
            label="Adelanto (%)"
            type="number"
            min="0"
            max="100"
            step="0.01"
          />
          <TextField v-model="header.observaciones" name="observaciones" label="Observaciones" />
        </div>
      </section>

      <section v-show="currentStep === 3" aria-labelledby="revisar-title">
        <h2 id="revisar-title">Revisar</h2>
        <div class="review-grid">
          <Card
            ><h3>Productos</h3>
            <p>{{ lineas.length }} línea(s)</p>
            <button @click="currentStep = 0">Corregir productos</button></Card
          >
          <Card
            ><h3>Cliente</h3>
            <p>
              {{
                clienteMode === 'pendiente'
                  ? 'Pendiente'
                  : clienteMode === 'nuevo'
                    ? `${nuevoCliente.nombres} ${nuevoCliente.apellidos}`
                    : `Cliente #${header.cliente}`
              }}
            </p>
            <button @click="currentStep = 1">Corregir cliente</button></Card
          >
          <Card
            ><h3>Condiciones</h3>
            <p>{{ header.plazo_entrega || 'Plazo pendiente' }} · {{ header.moneda_codigo }}</p>
            <button @click="currentStep = 2">Corregir condiciones</button></Card
          >
        </div>
        <div class="totals">
          <span>Total estimado</span><strong>{{ money(totalPreview) }}</strong
          ><small>El total definitivo lo calcula y protege PostgreSQL.</small>
        </div>
        <p v-if="!canEmit" class="warning">
          Para emitir necesitas un cliente válido y al menos una línea.
        </p>
      </section>

      <footer class="editor-actions">
        <Button variant="secondary" :disabled="currentStep === 0" @click="currentStep--"
          >Anterior</Button
        >
        <Button v-if="currentStep < 3" @click="currentStep++">Continuar</Button>
        <Button variant="secondary" :processing="saving" @click="persist(false)"
          >Guardar borrador</Button
        >
        <Button :disabled="!canEmit" :processing="saving" @click="persist(true)"
          >Emitir proforma</Button
        >
      </footer>
    </template>

    <Modal
      :open="lineModal"
      :title="editingLine === null ? 'Agregar producto' : 'Editar producto'"
      @close="lineModal = false"
    >
      <DetalleForm
        :key="editableDetail?.id ?? editingLine ?? lineas.length"
        :tipos
        :unidades
        :familias
        :moneda="header.moneda_codigo"
        :detail="editableDetail"
        :existing-product-ids="existingProductIds"
        :processing="saving"
        @save="saveLine"
        @cancel="lineModal = false"
      />
    </Modal>
    <Modal :open="specLine !== null" title="Ficha técnica" @close="specLine = null">
      <EspecificacionForm
        :key="specLine ?? -1"
        :tipos="tiposMueble"
        :especificacion="editableSpec"
        @save="saveSpec"
        @cancel="specLine = null"
      />
    </Modal>
  </div>
</template>

<style scoped>
.steps {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}
.steps button {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
.steps button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 700;
}
.steps span {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--color-surface-muted);
}
section {
  display: grid;
  gap: var(--space-4);
}
.section-title,
.line-card,
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.line-card {
  margin-bottom: var(--space-3);
}
.actions,
.mode {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.form-grid,
.client-grid,
.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}
.review-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.totals {
  display: grid;
  justify-items: end;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}
.totals strong {
  font-size: 1.5rem;
}
.editor-actions {
  position: sticky;
  bottom: 0;
  margin-top: var(--space-6);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-background);
}
.error,
.warning {
  color: var(--color-danger);
}
.success {
  color: var(--color-success);
}
.persisted-state {
  color: var(--color-text-secondary);
}
.empty {
  padding: var(--space-6);
  text-align: center;
  border: 1px dashed var(--color-border);
}
@media (max-width: 48rem) {
  .steps {
    grid-template-columns: repeat(2, 1fr);
  }
  .review-grid {
    grid-template-columns: 1fr;
  }
  .editor-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 35rem) {
  .steps,
  .form-grid,
  .client-grid,
  .editor-actions {
    grid-template-columns: 1fr;
  }
  .line-card,
  .section-title {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
