<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import type { ClienteWritable, ValorCatalogoPublico } from '@/generated/api'
import { ApiError } from '@/shared/api'
import { validateClient } from '@/shared/validation/commercialFields'
import { proformasService } from '@/modules/proformas/services/proformasService'
import ClienteFormFields, { type ClienteFormModel } from '../components/ClienteFormFields.vue'
import { clientesService } from '../services/clientesService'
import { useFormChanges } from '@/shared/forms/useFormChanges'
import { ArrowLeft, Info, Phone, UserPlus } from '@lucide/vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'

const emit = defineEmits<{ openMenu: [] }>()
const router = useRouter()
const tipos = ref<ValorCatalogoPublico[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const fields = ref<Record<string, string[]>>({})
const validationAttempted = ref(false)
const allowLeave = ref(false)
const confirmLeave = ref(false)
let pendingLeave: ((allow?: boolean) => void) | null = null
const form = reactive<ClienteFormModel>({
  tipo_cliente: '',
  nombres: '',
  apellidos: '',
  empresa: '',
  celular: '',
  direccion: '',
  observaciones: '',
})

const selectedType = computed(() =>
  tipos.value.find((item) => String(item.id) === form.tipo_cliente),
)
const isCompany = computed(() => selectedType.value?.codigo === 'EMPRESA')
const contactFullName = computed(() =>
  [form.nombres.trim(), form.apellidos.trim()].filter(Boolean).join(' '),
)
const previewName = computed(() => {
  if (isCompany.value) return form.empresa.trim() || contactFullName.value || 'Nueva empresa'
  return contactFullName.value || 'Nuevo cliente'
})
const previewSubtitle = computed(() => {
  const parts: string[] = [
    selectedType.value?.codigo === 'EMPRESA'
      ? 'Empresa'
      : selectedType.value?.nombre || 'Persona natural',
  ]
  if (isCompany.value && contactFullName.value) parts.push(`Contacto: ${contactFullName.value}`)
  return parts.join(' · ')
})
const creationStatus = computed(() => {
  if (saving.value) return 'Registrando en HOMEX…'
  if (dirty.value) return 'Cambios locales sin guardar'
  return 'Nuevo registro sin guardar'
})

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
        tipos.value.find((t) => String(t.id) === String(v))?.nombre ||
        (String(v) ? `Tipo #${v}` : 'Sin valor'),
    },
    { key: 'nombres', label: 'Nombres', get: (s) => s.nombres },
    { key: 'apellidos', label: 'Apellidos', get: (s) => s.apellidos },
    { key: 'empresa', label: 'Empresa', get: (s) => s.empresa },
    { key: 'celular', label: 'Celular', get: (s) => s.celular },
    { key: 'direccion', label: 'Dirección', get: (s) => s.direccion },
    { key: 'observaciones', label: 'Observaciones', get: (s) => s.observaciones },
  ],
)

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value || allowLeave.value) return
  event.preventDefault()
}
onBeforeRouteLeave((_to, _from, next) => {
  if (!dirty.value || allowLeave.value) return next()
  confirmLeave.value = true
  pendingLeave = (allow = false) => next(allow ? undefined : false)
})
function discardAndLeave() {
  allowLeave.value = true
  confirmLeave.value = false
  pendingLeave?.(true)
  pendingLeave = null
}
function stay() {
  confirmLeave.value = false
  pendingLeave?.(false)
  pendingLeave = null
}
async function loadTypes() {
  loading.value = true
  error.value = ''
  try {
    tipos.value = await proformasService.options('TIPO_CLIENTE')
    form.tipo_cliente = tipos.value[0] ? String(tipos.value[0].id) : ''
    captureClientOriginal()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los tipos de cliente.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (saving.value) return
  validationAttempted.value = true
  if (!form.tipo_cliente) {
    fields.value = { tipo_cliente: ['Selecciona el tipo de cliente.'] }
    error.value = 'Selecciona Persona natural o Empresa antes de registrar.'
    return
  }
  const company = isCompany.value
  const validation = validateClient(form, company)
  if (Object.keys(validation).length) {
    fields.value = Object.fromEntries(
      Object.entries(validation).map(([field, message]) => [field, [message]]),
    )
    error.value = 'Revisa los campos señalados antes de registrar el cliente.'
    return
  }
  saving.value = true
  error.value = ''
  fields.value = {}
  const body: ClienteWritable = {
    tipo_cliente: Number(form.tipo_cliente),
    nombres: form.nombres || null,
    apellidos: form.apellidos || null,
    empresa: company ? form.empresa || null : null,
    celular: form.celular || null,
    direccion: form.direccion || null,
    observaciones: form.observaciones || null,
  }
  try {
    const client = await clientesService.create(body)
    allowLeave.value = true
    captureClientOriginal()
    await router.push(`/clientes/${client.id}`)
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo registrar el cliente.'
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
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void loadTypes()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="client-workspace">
    <div class="client-topline" aria-label="Ubicación en el proceso">
      <span>COMERCIAL <span class="client-divider">/</span> CLIENTES</span>
      <div class="client-save-status" role="status" aria-live="polite">
        <Info :size="14" aria-hidden="true" />
        <span>{{ creationStatus }}</span>
      </div>
    </div>

    <PageHeader
      title="Nuevo cliente"
      description="Registra la identidad y los datos de contacto del cliente."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/clientes')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver a clientes
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error && tipos.length === 0" :description="error">
      <button type="button" @click="loadTypes">Reintentar</button>
    </ErrorState>
    <section v-else class="client-panel" aria-labelledby="nuevo-cliente-title">
      <div class="section-title">
        <div class="section-title__identity">
          <span class="section-icon"><UserPlus :size="22" aria-hidden="true" /></span>
          <div>
            <p class="section-kicker">01 · IDENTIDAD Y CONTACTO</p>
            <h2 id="nuevo-cliente-title">Datos del cliente</h2>
            <p>Define el tipo de cliente y completa su información comercial.</p>
          </div>
        </div>
      </div>

      <div class="client-preview-card" aria-label="Vista previa de identidad">
        <div class="client-preview-card__identity">
          <ClientAvatar :name="previewName" :size="42" />
          <div class="client-preview-card__copy">
            <span class="client-preview-card__kicker">VISTA PREVIA EN BANDEJA</span>
            <strong>{{ previewName }}</strong>
            <small>{{ previewSubtitle }}</small>
          </div>
        </div>
        <div v-if="form.celular.trim()" class="client-preview-card__phone">
          <Phone :size="15" aria-hidden="true" />
          <span>{{ form.celular.trim() }}</span>
        </div>
      </div>

      <form @submit.prevent="save">
        <ClienteFormFields
          :model="form"
          :tipos="tipos"
          :errors="fields"
          :validate="validationAttempted"
          prefix="nuevo-cliente"
          @change="updateForm"
        />
        <div v-if="error" class="form-error" role="alert">{{ error }}</div>
        <div class="actions">
          <Button variant="secondary" :disabled="saving" @click="router.push('/clientes')">
            Cancelar
          </Button>
          <Button variant="info" type="submit" :processing="saving" processing-label="Registrando…">
            <UserPlus :size="17" aria-hidden="true" />
            Registrar cliente
          </Button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      :open="confirmLeave"
      title="Descartar cliente"
      description="Los datos ingresados no se guardarán."
      confirm-label="Descartar"
      :changes="formChanges"
      @close="stay"
      @confirm="discardAndLeave"
    />
  </div>
</template>

<style scoped>
.client-workspace {
  display: grid;
  align-content: start;
  gap: 0;
  padding-bottom: var(--space-8);
}
.client-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
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
.client-workspace :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.client-panel {
  display: grid;
  min-width: 0;
  gap: var(--space-5);
  padding: clamp(1rem, 2.5vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  background: var(--color-surface);
  box-shadow: 0 4px 24px rgb(0 0 0 / 4%);
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
  width: 3.15rem;
  height: 3.15rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, transparent);
  border-radius: 0.85rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
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
  color: var(--color-text);
  font-size: 1.35rem;
  letter-spacing: -0.025em;
}
.section-title p:not(.section-kicker) {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
}
.client-preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
}
.client-preview-card__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.client-preview-card__copy {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
.client-preview-card__kicker {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
}
.client-preview-card__copy strong {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.client-preview-card__copy small {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
.client-preview-card__phone {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.client-preview-card__phone svg {
  color: var(--color-primary-accent);
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border);
}
.form-error {
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.9rem;
}
@media (max-width: 47.99rem) {
  .client-preview-card {
    flex-direction: column;
    align-items: flex-start;
  }
  .actions {
    display: grid;
  }
}
</style>
