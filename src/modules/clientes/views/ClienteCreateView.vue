<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import type { ClienteWritable, ValorCatalogoPublico } from '@/generated/api'
import { ApiError } from '@/shared/api'
import { proformasService } from '@/modules/proformas/services/proformasService'
import ClienteFormFields, { type ClienteFormModel } from '../components/ClienteFormFields.vue'
import { clientesService } from '../services/clientesService'
import Button from '@/shared/ui/Button.vue'
import Card from '@/shared/ui/Card.vue'
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
const dirty = ref(false)
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

watch(form, () => (dirty.value = true), { deep: true })
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
    dirty.value = false
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'No se pudieron cargar los tipos de cliente.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (saving.value || !form.tipo_cliente) return
  saving.value = true
  error.value = ''
  fields.value = {}
  const body: ClienteWritable = {
    tipo_cliente: Number(form.tipo_cliente),
    nombres: form.nombres || null,
    apellidos: form.apellidos || null,
    empresa: form.empresa || null,
    celular: form.celular || null,
    direccion: form.direccion || null,
    observaciones: form.observaciones || null,
  }
  try {
    const client = await clientesService.create(body)
    allowLeave.value = true
    dirty.value = false
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
}
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  void loadTypes()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div>
    <PageHeader
      title="Nuevo cliente"
      description="Registra la identidad y los datos de contacto del cliente."
      show-menu
      @menu="emit('openMenu')"
    />
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error && tipos.length === 0" :description="error">
      <button type="button" @click="loadTypes">Reintentar</button>
    </ErrorState>
    <Card v-else>
      <form @submit.prevent="save">
        <ClienteFormFields
          :model="form"
          :tipos="tipos"
          :errors="fields"
          prefix="nuevo-cliente"
          @change="updateForm"
        />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="actions">
          <Button type="submit" :processing="saving" processing-label="Registrando…"
            >Registrar cliente</Button
          >
          <Button variant="secondary" :disabled="saving" @click="router.push('/clientes')"
            >Cancelar</Button
          >
        </div>
      </form>
    </Card>
    <ConfirmDialog
      :open="confirmLeave"
      title="Descartar cliente"
      description="Los datos ingresados no se guardarán."
      confirm-label="Descartar"
      @close="stay"
      @confirm="discardAndLeave"
    />
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
.form-error {
  color: var(--color-danger);
}
@media (max-width: 47.99rem) {
  .actions {
    display: grid;
  }
}
</style>
