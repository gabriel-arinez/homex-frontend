<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  RouterLink,
  useRoute,
  useRouter,
} from 'vue-router'
import type { Cliente, PatchedClienteWritable, ProformaListado } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import { validateClient } from '@/shared/validation/commercialFields'
import { proformasService } from '@/modules/proformas/services/proformasService'
import ClienteFormFields, { type ClienteFormModel } from '../components/ClienteFormFields.vue'
import { clientesService, nombreCliente } from '../services/clientesService'
import { useFormChanges } from '@/shared/forms/useFormChanges'
import {
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileText,
  IdCard,
  Info,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Save,
  StickyNote,
  User,
  UserCheck,
  Users,
} from '@lucide/vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Toast from '@/shared/ui/Toast.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const client = ref<Cliente | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const success = ref('')
const toastMessage = ref('')
const confirmDiscard = ref(false)
const confirmStatus = ref(false)
const fields = ref<Record<string, string[]>>({})
const validationAttempted = ref(false)
const conflicted = ref(false)
let requestId = 0
const allowLeave = ref(false)
let pendingNavigation: ((allow?: boolean) => void) | null = null

const recentQuotes = ref<ProformaListado[]>([])
const quotesCount = ref(0)
const quotesLoading = ref(false)
const quotesError = ref('')

const form = reactive<ClienteFormModel>({
  tipo_cliente: '',
  nombres: '',
  apellidos: '',
  empresa: '',
  celular: '',
  direccion: '',
  observaciones: '',
})
const canEdit = computed(() => session.can('comercial.operar'))
const isCompany = computed(
  () => client.value?.tipo_cliente_info?.codigo === 'EMPRESA' || Boolean(client.value?.empresa),
)
const typeInfo = computed(
  () =>
    client.value?.tipo_cliente_info ?? {
      id: client.value?.tipo_cliente ?? 0,
      concepto_codigo: 'TIPO_CLIENTE',
      codigo: client.value?.empresa ? 'EMPRESA' : 'PERSONA',
      nombre: client.value?.empresa ? 'Empresa' : 'Persona',
    },
)
const contactFullName = computed(() =>
  [client.value?.nombres, client.value?.apellidos].filter(Boolean).join(' ').trim(),
)
const editStatus = computed(() => {
  if (saving.value) return 'Guardando en HOMEX…'
  if (conflicted.value) return 'Conflicto: cambios locales conservados'
  if (editing.value && dirty.value) return 'Cambios locales sin guardar'
  if (editing.value) return 'Editando ficha'
  return client.value?.activo === false ? 'Cliente inactivo' : 'Ficha registrada'
})

function quoteTone(code: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (code === 'APROBADA') return 'success'
  if (code === 'EN_REVISION') return 'warning'
  if (code === 'ENVIADA') return 'info'
  if (code === 'NO_CONCRETADA' || code === 'CANCELADA' || code === 'ANULADA') return 'danger'
  return 'neutral'
}
function money(value: string, code: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 'Importe pendiente'
  try {
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: code }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

const {
  captureOriginal: captureClientOriginal,
  changes: formChanges,
  hasChanges: dirty,
} = useFormChanges(
  () => ({ ...form }),
  [
    {
      key: 'tipo_cliente',
      label: 'Tipo de cliente',
      get: (s) => s.tipo_cliente,
      format: (v) =>
        String(v) === String(client.value?.tipo_cliente)
          ? typeInfo.value.nombre
          : String(v)
            ? `Tipo #${v}`
            : 'Sin valor',
    },
    { key: 'nombres', label: 'Nombres', get: (s) => s.nombres },
    { key: 'apellidos', label: 'Apellidos', get: (s) => s.apellidos },
    { key: 'empresa', label: 'Empresa', get: (s) => s.empresa },
    { key: 'celular', label: 'Celular', get: (s) => s.celular },
    { key: 'direccion', label: 'Dirección', get: (s) => s.direccion },
    { key: 'observaciones', label: 'Observaciones', get: (s) => s.observaciones },
  ],
)

function fill(value: Cliente) {
  form.tipo_cliente = String(value.tipo_cliente)
  form.nombres = value.nombres ?? ''
  form.apellidos = value.apellidos ?? ''
  form.empresa = value.empresa ?? ''
  form.celular = value.celular ?? ''
  form.direccion = value.direccion ?? ''
  form.observaciones = value.observaciones ?? ''
  captureClientOriginal()
  validationAttempted.value = false
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (editing.value && dirty.value && !allowLeave.value) event.preventDefault()
}
onBeforeRouteLeave((_to, _from, next) => {
  if (saving.value) return next(false)
  if (!editing.value || !dirty.value || allowLeave.value) return next()
  confirmDiscard.value = true
  pendingNavigation = (allow = false) => next(allow ? undefined : false)
})
onBeforeRouteUpdate((to, from, next) => {
  if (to.params.id === from.params.id) return next()
  if (saving.value) return next(false)
  if (!editing.value || !dirty.value || allowLeave.value) return next()
  confirmDiscard.value = true
  pendingNavigation = (allow = false) => next(allow ? undefined : false)
})
function closeDiscard() {
  confirmDiscard.value = false
  pendingNavigation?.(false)
  pendingNavigation = null
}
function discardEdit() {
  confirmDiscard.value = false
  editing.value = false
  if (client.value) fill(client.value)
  if (pendingNavigation) {
    allowLeave.value = true
    pendingNavigation(true)
    pendingNavigation = null
  }
}
async function loadRecentQuotes(clientId: number, currentRequest: number) {
  quotesLoading.value = true
  quotesError.value = ''
  try {
    const response = await proformasService.list({ cliente: clientId, page_size: 5 })
    if (currentRequest !== requestId) return
    recentQuotes.value = response.results
    quotesCount.value = response.count
  } catch {
    if (currentRequest !== requestId) return
    recentQuotes.value = []
    quotesCount.value = 0
    quotesError.value = 'No se pudieron consultar las proformas asociadas.'
  } finally {
    if (currentRequest === requestId) quotesLoading.value = false
  }
}
async function load() {
  const currentRequest = ++requestId
  const id = Number(route.params.id)
  loading.value = true
  error.value = ''
  conflicted.value = false
  success.value = ''
  confirmStatus.value = false
  confirmDiscard.value = false
  pendingNavigation = null
  client.value = null
  recentQuotes.value = []
  quotesCount.value = 0
  quotesError.value = ''
  editing.value = false
  allowLeave.value = false
  try {
    const value = await clientesService.get(id)
    if (currentRequest !== requestId) return
    client.value = value
    fill(value)
    if (route.query.editar === '1' && canEdit.value) {
      editing.value = true
    }
    void loadRecentQuotes(value.id, currentRequest)
  } catch (cause) {
    if (currentRequest !== requestId) return
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el cliente.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}
async function save() {
  if (!client.value || saving.value) return
  validationAttempted.value = true
  const validation = validateClient(form, isCompany.value, client.value ?? undefined)
  if (Object.keys(validation).length) {
    fields.value = Object.fromEntries(
      Object.entries(validation).map(([field, message]) => [field, [message]]),
    )
    error.value = 'Revisa los campos señalados antes de guardar.'
    return
  }
  saving.value = true
  fields.value = {}
  success.value = ''
  error.value = ''
  const body: PatchedClienteWritable = {
    nombres: form.nombres || null,
    apellidos: form.apellidos || null,
    empresa: isCompany.value ? form.empresa || null : null,
    celular: form.celular || null,
    direccion: form.direccion || null,
    observaciones: form.observaciones || null,
  }
  try {
    client.value = await clientesService.update(client.value.id, body, client.value.revision)
    fill(client.value)
    editing.value = false
    success.value = 'Cliente actualizado.'
    toastMessage.value = 'Cliente actualizado.'
  } catch (cause) {
    if (cause instanceof ApiError) {
      fields.value = cause.fields
      if (cause.status === 409) conflicted.value = true
    }
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar.'
    if (conflicted.value) error.value += ' Tus cambios se conservaron; revisa antes de recargar.'
  } finally {
    saving.value = false
  }
}
function updateForm(field: keyof ClienteFormModel, value: string) {
  form[field] = value
  if (fields.value[field]) {
    const remaining = { ...fields.value }
    delete remaining[field]
    fields.value = remaining
  }
  if (error.value.startsWith('Revisa los campos señalados')) error.value = ''
}
function cancelEdit() {
  if (dirty.value) confirmDiscard.value = true
  else editing.value = false
}
async function saveAndConfirmDiscard() {
  confirmDiscard.value = false
  await save()
  if (!editing.value && pendingNavigation) {
    allowLeave.value = true
    pendingNavigation(true)
    pendingNavigation = null
  }
}
async function changeStatus() {
  if (!client.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (client.value.activo === false) {
      client.value = await clientesService.update(
        client.value.id,
        { activo: true },
        client.value.revision,
      )
    } else {
      await clientesService.deactivate(client.value.id, client.value.revision)
      client.value = await clientesService.get(client.value.id)
    }
    fill(client.value)
    const msg = client.value.activo === false ? 'Cliente desactivado.' : 'Cliente reactivado.'
    success.value = msg
    toastMessage.value = msg
    confirmStatus.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cambiar el estado.'
  } finally {
    saving.value = false
  }
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void load()
})
watch(
  () => route.params.id,
  () => void load(),
)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="client-detail">
    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      tone="success"
      @close="toastMessage = ''"
    />

    <div class="client-topline" aria-label="Ubicación en el proceso">
      <span>
        COMERCIAL <span class="client-divider">/</span> CLIENTES
        <template v-if="client">
          <span class="client-divider">/</span> FICHA #{{ client.id }}
        </template>
      </span>
      <div
        v-if="client"
        class="client-save-status"
        :class="{
          'client-save-status--saved': !editing && !conflicted,
          'client-save-status--warning': conflicted,
        }"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 v-if="!editing && !conflicted" :size="14" aria-hidden="true" />
        <CircleAlert v-else-if="conflicted" :size="14" aria-hidden="true" />
        <Info v-else :size="14" aria-hidden="true" />
        <span>{{ editStatus }}</span>
      </div>
    </div>

    <PageHeader
      :title="client ? nombreCliente(client) : 'Cliente'"
      description="Identidad, datos de contacto y seguimiento comercial."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/clientes')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a clientes
        </Button>
        <Button v-if="client && canEdit && !editing" variant="warning" @click="editing = true">
          <Pencil :size="17" aria-hidden="true" /> Editar
        </Button>
        <Button
          v-if="client && canEdit && !editing"
          :variant="client.activo === false ? 'primary' : 'danger'"
          @click="confirmStatus = true"
        >
          <RotateCcw v-if="client.activo === false" :size="17" aria-hidden="true" />
          <Ban v-else :size="17" aria-hidden="true" />
          {{ client.activo === false ? 'Reactivar' : 'Desactivar' }}
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error && !client" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="client">
      <div v-if="success" class="notice notice--success" role="status">{{ success }}</div>
      <div v-if="error && !editing" class="notice notice--error" role="alert">{{ error }}</div>

      <section v-if="editing" class="quote-panel" aria-labelledby="edit-client-title">
        <div class="section-title">
          <div class="section-title__identity">
            <span class="section-icon"><Pencil :size="20" aria-hidden="true" /></span>
            <div>
              <p class="section-kicker">EDICIÓN DE FICHA</p>
              <h2 id="edit-client-title">Editar datos del cliente</h2>
              <p>Actualiza los datos de contacto o notas comerciales.</p>
            </div>
          </div>
        </div>

        <form @submit.prevent="save">
          <ClienteFormFields
            :model="form"
            :tipos="[typeInfo]"
            :errors="fields"
            :validate="validationAttempted"
            :original="client || undefined"
            type-readonly
            @change="updateForm"
          />
          <div v-if="error" class="form-error" role="alert">{{ error }}</div>
          <div v-if="conflicted" class="conflict-actions">
            <Button type="button" variant="secondary" @click="load">
              Descartar cambios y recargar ficha
            </Button>
          </div>
          <div class="actions">
            <Button variant="secondary" :disabled="saving" @click="cancelEdit">Cancelar</Button>
            <Button
              variant="success"
              type="submit"
              :processing="saving"
              processing-label="Guardando…"
            >
              <Save :size="17" aria-hidden="true" />
              Guardar
            </Button>
          </div>
        </form>
      </section>

      <template v-else>
        <section class="summary" aria-label="Resumen del cliente">
          <div class="stat">
            <span class="stat__icon">
              <Building2 v-if="isCompany" :size="18" aria-hidden="true" />
              <UserCheck v-else :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Tipo de cliente</span>
              <strong>{{ typeInfo.nombre }}</strong>
            </div>
          </div>
          <div class="stat">
            <span
              class="stat__icon"
              :class="client.activo === false ? 'stat__icon--danger' : 'stat__icon--success'"
            >
              <Ban v-if="client.activo === false" :size="18" aria-hidden="true" />
              <CheckCircle2 v-else :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Estado comercial</span>
              <div>
                <Badge :tone="client.activo === false ? 'danger' : 'success'">
                  {{ client.activo === false ? 'Inactivo' : 'Activo' }}
                </Badge>
              </div>
            </div>
          </div>
          <div class="stat">
            <span class="stat__icon">
              <FileText :size="18" aria-hidden="true" />
            </span>
            <div class="stat__body">
              <span>Proformas vinculadas</span>
              <strong class="stat__count">
                {{ quotesCount }} {{ quotesCount === 1 ? 'cotización' : 'cotizaciones' }}
              </strong>
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="client-data-title">
          <div class="section-heading">
            <div class="section-heading__identity">
              <span class="section-icon section-icon--compact">
                <IdCard :size="18" aria-hidden="true" />
              </span>
              <div>
                <h2 id="client-data-title">Datos registrados del cliente</h2>
                <p>Información comercial almacenada en HOMEX para futuras proformas y pedidos.</p>
              </div>
            </div>
          </div>

          <div class="client-fields-grid">
            <template v-if="isCompany">
              <div class="client-field-card">
                <span class="client-field-card__icon">
                  <Building2 :size="17" aria-hidden="true" />
                </span>
                <div class="client-field-card__body">
                  <span class="client-field-card__label">Razón social</span>
                  <strong class="client-field-card__value">{{ client.empresa }}</strong>
                </div>
              </div>
              <div class="client-field-card">
                <span class="client-field-card__icon">
                  <UserCheck :size="17" aria-hidden="true" />
                </span>
                <div class="client-field-card__body">
                  <span class="client-field-card__label">Contacto responsable</span>
                  <strong
                    class="client-field-card__value"
                    :class="{ 'client-field-card__value--muted': !contactFullName }"
                  >
                    {{ contactFullName || 'No registrado' }}
                  </strong>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="client-field-card">
                <span class="client-field-card__icon">
                  <User :size="17" aria-hidden="true" />
                </span>
                <div class="client-field-card__body">
                  <span class="client-field-card__label">Nombres</span>
                  <strong
                    class="client-field-card__value"
                    :class="{ 'client-field-card__value--muted': !client.nombres }"
                  >
                    {{ client.nombres || 'No registrado' }}
                  </strong>
                </div>
              </div>
              <div class="client-field-card">
                <span class="client-field-card__icon">
                  <Users :size="17" aria-hidden="true" />
                </span>
                <div class="client-field-card__body">
                  <span class="client-field-card__label">Apellidos</span>
                  <strong
                    class="client-field-card__value"
                    :class="{ 'client-field-card__value--muted': !client.apellidos }"
                  >
                    {{ client.apellidos || 'No registrado' }}
                  </strong>
                </div>
              </div>
            </template>

            <div class="client-field-card">
              <span class="client-field-card__icon">
                <Phone :size="17" aria-hidden="true" />
              </span>
              <div class="client-field-card__body">
                <span class="client-field-card__label">Celular</span>
                <a
                  v-if="client.celular"
                  :href="`tel:${client.celular}`"
                  class="client-field-card__value client-field-card__link"
                >
                  {{ client.celular }}
                </a>
                <strong v-else class="client-field-card__value client-field-card__value--muted">
                  No registrado
                </strong>
              </div>
            </div>

            <div class="client-field-card">
              <span class="client-field-card__icon">
                <MapPin :size="17" aria-hidden="true" />
              </span>
              <div class="client-field-card__body">
                <span class="client-field-card__label">Dirección</span>
                <strong
                  class="client-field-card__value"
                  :class="{ 'client-field-card__value--muted': !client.direccion }"
                >
                  {{ client.direccion || 'No registrada' }}
                </strong>
              </div>
            </div>

            <div class="client-field-card client-field-card--full">
              <span class="client-field-card__icon">
                <StickyNote :size="17" aria-hidden="true" />
              </span>
              <div class="client-field-card__body">
                <span class="client-field-card__label">Observaciones</span>
                <p
                  class="client-field-card__text"
                  :class="{ 'client-field-card__value--muted': !client.observaciones }"
                >
                  {{ client.observaciones || 'Sin observaciones' }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="panel" aria-labelledby="client-quotes-title">
          <div class="section-heading">
            <div>
              <h2 id="client-quotes-title">
                <FileText :size="20" aria-hidden="true" /> Actividad comercial y proformas
              </h2>
              <p>Cotizaciones recientes vinculadas a este cliente.</p>
            </div>
            <div class="section-heading__actions">
              <Button
                variant="secondary"
                @click="router.push({ path: '/proformas', query: { cliente: String(client.id) } })"
              >
                Ver proformas ({{ quotesCount }})
              </Button>
              <Button
                v-if="client.activo !== false"
                @click="
                  router.push({ path: '/proformas/nueva', query: { cliente: String(client.id) } })
                "
              >
                <Plus :size="17" aria-hidden="true" /> Nueva proforma
              </Button>
            </div>
          </div>

          <LoadingSkeleton v-if="quotesLoading" :lines="3" />
          <p v-else-if="quotesError" class="quotes-note">{{ quotesError }}</p>
          <EmptyState
            v-else-if="!recentQuotes.length"
            title="Sin proformas registradas"
            description="Este cliente todavía no tiene cotizaciones asociadas."
          />
          <div v-else class="quotes-list">
            <RouterLink
              v-for="quote in recentQuotes"
              :key="quote.id"
              :to="`/proformas/${quote.id}/editar`"
              class="quote-row"
            >
              <div class="quote-row__identity">
                <strong>#{{ quote.numero }}</strong>
                <span>{{ quote.titulo?.trim() || 'Sin título' }}</span>
              </div>
              <div class="quote-row__meta">
                <Badge :tone="quoteTone(quote.estado_info.codigo)">{{
                  quote.estado_info.nombre
                }}</Badge>
                <strong class="quote-row__total">{{
                  money(quote.total, quote.moneda_info.codigo)
                }}</strong>
              </div>
            </RouterLink>
          </div>
        </section>
      </template>
    </template>

    <ConfirmDialog
      :open="confirmDiscard"
      title="Descartar cambios"
      description="Los cambios del cliente no se guardarán."
      confirm-label="Descartar"
      save-label="Guardar cambios"
      :changes="formChanges"
      @close="closeDiscard"
      @confirm="discardEdit"
      @save="saveAndConfirmDiscard"
    />
    <ConfirmDialog
      :open="confirmStatus"
      :variant="client?.activo === false ? 'info' : 'danger'"
      :title="client?.activo === false ? 'Reactivar cliente' : 'Desactivar cliente'"
      :description="
        client?.activo === false
          ? 'El cliente volverá a estar disponible para nuevas operaciones.'
          : 'El cliente se conservará en el historial y dejará de estar disponible para nuevas operaciones.'
      "
      :confirm-label="client?.activo === false ? 'Reactivar' : 'Desactivar'"
      @close="confirmStatus = false"
      @confirm="changeStatus"
    />
  </div>
</template>

<style scoped>
.client-detail {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.client-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.11em;
}
.client-divider {
  padding: 0 var(--space-2);
  color: var(--color-border-strong);
}
.client-save-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  font-size: 0.76rem;
  font-weight: 600;
  letter-spacing: normal;
}
.client-save-status svg {
  flex-shrink: 0;
  color: var(--color-text-muted);
}
.client-save-status--saved svg {
  color: var(--color-success);
}
.client-save-status--warning,
.client-save-status--warning svg {
  color: var(--color-danger);
}
.client-detail :deep(.page-header) {
  margin-bottom: var(--space-2);
}
.summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel,
.quote-panel {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.quote-panel {
  display: grid;
  gap: var(--space-5);
  padding: clamp(1rem, 2.5vw, 2rem);
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.stat__icon--success {
  border-color: color-mix(in srgb, var(--color-success) 25%, transparent);
  color: var(--color-success);
  background: var(--color-success-soft);
}
.stat__icon--danger {
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.stat__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__count {
  font-variant-numeric: tabular-nums;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}
.section-title__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-4);
}
.section-icon {
  display: grid;
  width: 3rem;
  height: 3rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-radius: 0.85rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-icon--compact {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
}
.section-kicker {
  margin: 0;
  color: var(--color-primary-accent);
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.12em;
}
.section-title h2 {
  margin: 0.1rem 0 0;
  font-size: 1.25rem;
}
.section-title p:not(.section-kicker) {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.section-heading__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.section-heading h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.section-heading__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.client-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.client-field-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.95rem 1.05rem;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  min-width: 0;
}
.client-field-card--full {
  grid-column: 1 / -1;
}
.client-field-card__icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.65rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.client-field-card__body {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.client-field-card__label {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.client-field-card__value {
  color: var(--color-text);
  font-size: 0.98rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.client-field-card__link {
  color: var(--color-text);
  text-decoration: none;
  font-variant-numeric: tabular-nums;
}
.client-field-card__link:hover {
  color: var(--color-primary-accent);
  text-decoration: underline;
}
.client-field-card__value--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.client-field-card__text {
  margin: 0;
  color: var(--color-text);
  font-size: 0.92rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.client-field-card__text.client-field-card__value--muted {
  color: var(--color-text-secondary);
}
.quotes-note {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
}
.quotes-list {
  display: grid;
  gap: var(--space-2);
}
.quote-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text);
  text-decoration: none;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast);
}
.quote-row:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-hover);
}
.quote-row__identity {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}
.quote-row__identity strong {
  font-size: 0.92rem;
  flex: none;
}
.quote-row__identity span {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote-row__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex: none;
}
.quote-row__total {
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--error,
.form-error {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  background: var(--color-danger-soft);
}
.form-error {
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  border-radius: var(--radius-control);
}
.notice--success {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
  background: var(--color-success-soft);
}
.conflict-actions {
  margin-top: var(--space-3);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 47.99rem) {
  .summary,
  .client-fields-grid {
    grid-template-columns: 1fr;
  }
  .quote-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .actions {
    display: grid;
  }
}
</style>
