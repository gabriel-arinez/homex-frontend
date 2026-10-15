<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import type { Cliente, PatchedClienteWritable } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import ClienteFormFields, { type ClienteFormModel } from '../components/ClienteFormFields.vue'
import { clientesService, nombreCliente } from '../services/clientesService'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import Card from '@/shared/ui/Card.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const session = useSessionStore()
const client = ref<Cliente | null>(null)
const loading = ref(true)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const success = ref('')
const confirmDiscard = ref(false)
const confirmStatus = ref(false)
const fields = ref<Record<string, string[]>>({})
const dirty = ref(false)
const allowLeave = ref(false)
let pendingNavigation: ((allow?: boolean) => void) | null = null
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
const isCompany = computed(() => client.value?.tipo_cliente_info?.codigo === 'EMPRESA')
const typeInfo = computed(
  () =>
    client.value?.tipo_cliente_info ?? {
      id: client.value?.tipo_cliente ?? 0,
      concepto_codigo: 'TIPO_CLIENTE',
      codigo: client.value?.empresa ? 'EMPRESA' : 'PERSONA',
      nombre: client.value?.empresa ? 'Empresa' : 'Persona',
    },
)

function fill(value: Cliente) {
  form.tipo_cliente = String(value.tipo_cliente)
  form.nombres = value.nombres ?? ''
  form.apellidos = value.apellidos ?? ''
  form.empresa = value.empresa ?? ''
  form.celular = value.celular ?? ''
  form.direccion = value.direccion ?? ''
  form.observaciones = value.observaciones ?? ''
  dirty.value = false
}
watch(
  form,
  () => {
    if (editing.value) dirty.value = true
  },
  { deep: true },
)
function beforeUnload(event: BeforeUnloadEvent) {
  if (editing.value && dirty.value && !allowLeave.value) event.preventDefault()
}
onBeforeRouteLeave((_to, _from, next) => {
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
async function load() {
  loading.value = true
  error.value = ''
  try {
    client.value = await clientesService.get(Number(route.params.id))
    fill(client.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar el cliente.'
  } finally {
    loading.value = false
  }
}
async function save() {
  if (!client.value || saving.value) return
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
    client.value = await clientesService.update(client.value.id, body)
    fill(client.value)
    editing.value = false
    success.value = 'Cliente actualizado.'
  } catch (cause) {
    if (cause instanceof ApiError) fields.value = cause.fields
    error.value = cause instanceof Error ? cause.message : 'No se pudo guardar.'
  } finally {
    saving.value = false
  }
}
function updateForm(field: keyof ClienteFormModel, value: string) {
  form[field] = value
}
function cancelEdit() {
  if (dirty.value) confirmDiscard.value = true
  else editing.value = false
}
async function changeStatus() {
  if (!client.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (client.value.activo === false) {
      client.value = await clientesService.update(client.value.id, { activo: true })
    } else {
      await clientesService.deactivate(client.value.id)
      client.value = await clientesService.get(client.value.id)
    }
    fill(client.value)
    success.value = client.value.activo === false ? 'Cliente desactivado.' : 'Cliente reactivado.'
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
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div>
    <PageHeader
      :title="client ? nombreCliente(client) : 'Cliente'"
      description="Identidad y datos comerciales del cliente."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button v-if="client && canEdit && !editing" variant="secondary" @click="editing = true"
          >Editar</Button
        >
        <Button
          v-if="client && canEdit && !editing"
          :variant="client.activo === false ? 'primary' : 'danger'"
          @click="confirmStatus = true"
          >{{ client.activo === false ? 'Reactivar' : 'Desactivar' }}</Button
        >
      </template>
    </PageHeader>
    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error && !client" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <Card v-else-if="client">
      <p v-if="success" class="success" role="status">{{ success }}</p>
      <form v-if="editing" @submit.prevent="save">
        <ClienteFormFields
          :model="form"
          :tipos="[typeInfo]"
          :errors="fields"
          type-readonly
          @change="updateForm"
        />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="actions">
          <Button type="submit" :processing="saving" processing-label="Guardando…">Guardar</Button>
          <Button variant="secondary" :disabled="saving" @click="cancelEdit">Cancelar</Button>
        </div>
      </form>
      <dl v-else>
        <div>
          <dt>Tipo</dt>
          <dd>{{ typeInfo.nombre }}</dd>
        </div>
        <div v-if="isCompany">
          <dt>Empresa</dt>
          <dd>{{ client.empresa }}</dd>
        </div>
        <div>
          <dt>{{ isCompany ? 'Contacto' : 'Nombre completo' }}</dt>
          <dd>{{ [client.nombres, client.apellidos].filter(Boolean).join(' ') }}</dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>{{ client.celular || 'No registrado' }}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{{ client.direccion || 'No registrada' }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ client.activo === false ? 'Inactivo' : 'Activo' }}</dd>
        </div>
        <div>
          <dt>Observaciones</dt>
          <dd>{{ client.observaciones || 'Sin observaciones' }}</dd>
        </div>
      </dl>
      <p v-if="error && client && !editing" class="form-error" role="alert">{{ error }}</p>
    </Card>
    <ConfirmDialog
      :open="confirmDiscard"
      title="Descartar cambios"
      description="Los cambios del cliente no se guardarán."
      confirm-label="Descartar"
      @close="closeDiscard"
      @confirm="discardEdit"
    />
    <ConfirmDialog
      :open="confirmStatus"
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
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
dl div {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
dt {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}
dd {
  margin: 0.25rem 0 0;
}
.actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}
.success {
  color: var(--color-success);
}
.form-error {
  color: var(--color-danger);
}
@media (max-width: 47.99rem) {
  dl {
    grid-template-columns: 1fr;
  }
  .actions {
    display: grid;
  }
}
</style>
