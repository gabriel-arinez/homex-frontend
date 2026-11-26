<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  UserRound,
} from '@lucide/vue'
import { exportTrayExcel } from '@/shared/download/exportExcel'
import type { Cliente, ValorCatalogoPublico } from '@/generated/api'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { clientesService, nombreCliente } from '../services/clientesService'
import ClientActionsMenu from '../components/ClientActionsMenu.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import ClientAvatar from '@/shared/ui/ClientAvatar.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import SearchField from '@/shared/ui/SearchField.vue'
import Select from '@/shared/ui/Select.vue'
import Toast from '@/shared/ui/Toast.vue'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const canEdit = computed(() => session.can('comercial.operar'))
const clients = ref<Cliente[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const toastMessage = ref('')
const exportingExcel = ref(false)
async function exportExcel() {
  if (exportingExcel.value) return
  exportingExcel.value = true
  try {
    const statusLabel =
      status.value === 'activos' ? 'Activos' : status.value === 'inactivos' ? 'Inactivos' : ''
    const typeLabel =
      type.value === 'todos'
        ? ''
        : types.value.find((t) => String(t.id) === type.value || t.codigo === type.value)?.nombre ||
          type.value
    await exportTrayExcel({
      endpoint: '/api/v1/clientes/exportar-excel/',
      query: {
        search: search.value.trim() || undefined,
        activo: status.value === 'todos' ? undefined : status.value === 'activos',
        tipo_cliente: type.value === 'todos' ? undefined : type.value,
      },
      prefix: 'clientes',
      filenameSegments: [statusLabel, typeLabel, search.value.trim()],
    })
  } catch (err) {
    toastMessage.value = err instanceof Error ? err.message : 'No pudimos exportar el Excel.'
  } finally {
    exportingExcel.value = false
  }
}
const clientToToggle = ref<Cliente | null>(null)
const statusUpdating = ref(false)
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const status = ref(typeof route.query.estado === 'string' ? route.query.estado : 'todos')
const type = ref(typeof route.query.tipo === 'string' ? route.query.tipo : 'todos')
const types = ref<ValorCatalogoPublico[]>([])
const page = ref(Math.max(1, Number(route.query.pagina) || 1))
const pageSize = 10
let requestId = 0
let debounce: ReturnType<typeof setTimeout> | undefined
let restoringRoute = false
let mounted = false

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const fromItem = computed(() => (page.value - 1) * pageSize + 1)
const toItem = computed(() => Math.min(total.value, page.value * pageSize))
const hasFilters = computed(
  () => Boolean(search.value.trim()) || status.value !== 'todos' || type.value !== 'todos',
)

function isCompany(client: Cliente) {
  return client.tipo_cliente_info?.codigo === 'EMPRESA' || Boolean(client.empresa?.trim())
}
function clientTypeName(client: Cliente) {
  return (
    client.tipo_cliente_info?.nombre ??
    (isCompany(client) ? 'Empresa' : `Tipo #${client.tipo_cliente}`)
  )
}
function clientSubtitle(client: Cliente) {
  const contact = [client.nombres, client.apellidos].filter(Boolean).join(' ').trim()
  if (isCompany(client)) return contact ? `Contacto: ${contact}` : `Empresa · Cliente #${client.id}`
  return `Persona natural · Cliente #${client.id}`
}

function clearFilters() {
  search.value = ''
  status.value = 'todos'
  type.value = 'todos'
}

function activeFilter() {
  if (status.value === 'activos') return true
  if (status.value === 'inactivos') return false
  return undefined
}

function syncRoute() {
  void router.replace({
    query: {
      q: search.value || undefined,
      estado: status.value === 'todos' ? undefined : status.value,
      pagina: page.value > 1 ? page.value : undefined,
      tipo: type.value === 'todos' ? undefined : type.value,
    },
  })
}

async function load() {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const response = await clientesService.list({
      search: search.value.trim() || undefined,
      activo: activeFilter(),
      page: page.value,
      page_size: pageSize,
      tipo_cliente: type.value === 'todos' ? undefined : Number(type.value),
    })
    if (currentRequest !== requestId) return
    clients.value = response.results
    total.value = response.count
    if (total.value > 0 && page.value > totalPages.value) {
      page.value = totalPages.value
      return
    }
  } catch (cause) {
    if (currentRequest !== requestId) return
    clients.value = []
    total.value = 0
    error.value = cause instanceof Error ? cause.message : 'No se pudieron cargar los clientes.'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function scheduleLoad(delay = 0) {
  ++requestId
  if (debounce) clearTimeout(debounce)
  if (delay > 0) {
    debounce = setTimeout(() => {
      syncRoute()
      void load()
    }, delay)
  } else {
    syncRoute()
    void load()
  }
}

watch([search, status, type], (_newValues, oldValues) => {
  if (restoringRoute || !mounted) return
  if (page.value !== 1) page.value = 1
  const onlySearchChanged =
    oldValues && status.value === oldValues[1] && type.value === oldValues[2]
  scheduleLoad(onlySearchChanged ? 300 : 0)
})
watch(page, () => {
  if (restoringRoute || !mounted) return
  scheduleLoad(0)
})
watch(
  () => route.fullPath,
  async () => {
    if (!mounted) return
    const q = typeof route.query.q === 'string' ? route.query.q : ''
    const estado = typeof route.query.estado === 'string' ? route.query.estado : 'todos'
    const tipo = typeof route.query.tipo === 'string' ? route.query.tipo : 'todos'
    const pagina = Math.max(1, Number(route.query.pagina) || 1)
    if (
      q === search.value &&
      estado === status.value &&
      tipo === type.value &&
      pagina === page.value
    )
      return
    restoringRoute = true
    search.value = q
    status.value = estado
    type.value = tipo
    page.value = pagina
    if (debounce) clearTimeout(debounce)
    await nextTick()
    restoringRoute = false
    void load()
  },
)
function handleToggleStatus(clientId: number) {
  const target = clients.value.find((c) => c.id === clientId)
  if (target) clientToToggle.value = target
}

async function confirmToggleStatus() {
  if (!clientToToggle.value || statusUpdating.value) return
  const target = clientToToggle.value
  statusUpdating.value = true
  try {
    if (target.activo === false) {
      await clientesService.update(target.id, { activo: true }, target.revision)
      toastMessage.value = `Cliente "${nombreCliente(target)}" reactivado.`
    } else {
      await clientesService.deactivate(target.id, target.revision)
      toastMessage.value = `Cliente "${nombreCliente(target)}" desactivado.`
    }
    clientToToggle.value = null
    void load()
  } catch (cause) {
    toastMessage.value = ''
    error.value =
      cause instanceof Error ? cause.message : 'No se pudo cambiar el estado del cliente.'
    clientToToggle.value = null
  } finally {
    statusUpdating.value = false
  }
}

onMounted(() => {
  mounted = true
  void load()
  void proformasService
    .options('TIPO_CLIENTE')
    .then((value) => (types.value = value))
    .catch(() => (types.value = []))
})
onBeforeUnmount(() => {
  mounted = false
  ++requestId
  if (debounce) clearTimeout(debounce)
})
</script>

<template>
  <div class="clientes-list">
    <PageHeader
      title="Clientes"
      description="Consulta y administra los clientes registrados."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button
          variant="secondary"
          :processing="exportingExcel"
          :disabled="exportingExcel"
          @click="exportExcel"
        >
          <FileSpreadsheet :size="16" aria-hidden="true" />
          {{ exportingExcel ? 'Exportando…' : 'Exportar Excel' }}
        </Button>
        <Button @click="router.push('/clientes/nuevo')">
          <Plus :size="18" aria-hidden="true" /> Nuevo cliente
        </Button>
      </template>
    </PageHeader>

    <section class="client-filters" aria-label="Buscar y filtrar clientes">
      <div class="client-filters__main">
        <div class="client-search">
          <SearchField v-model="search" label="Buscar por nombre, empresa o celular" />
        </div>
        <div class="client-filter-select">
          <Select
            v-model="status"
            name="estado-cliente"
            label="Estado"
            :active="status !== 'todos'"
            :options="[
              { label: 'Todos', value: 'todos' },
              { label: 'Activos', value: 'activos' },
              { label: 'Inactivos', value: 'inactivos' },
            ]"
          />
        </div>
        <div class="client-filter-select">
          <Select
            v-model="type"
            name="tipo-cliente"
            label="Tipo de cliente"
            :active="type !== 'todos'"
            :options="[
              { label: 'Todos', value: 'todos' },
              ...types.map((item) => ({ label: item.nombre, value: String(item.id) })),
            ]"
          />
        </div>
        <Button
          v-if="hasFilters"
          variant="danger"
          class="filter-clear-btn"
          aria-label="Limpiar filtros"
          title="Limpiar filtros"
          @click="clearFilters"
        >
          <RotateCcw :size="16" aria-hidden="true" />
        </Button>
      </div>
    </section>

    <LoadingSkeleton v-if="loading" :lines="6" />
    <ErrorState v-else-if="error" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <EmptyState
      v-else-if="clients.length === 0"
      :title="hasFilters ? 'Sin resultados' : 'Sin clientes'"
      :description="
        hasFilters
          ? 'No hay clientes que coincidan con la búsqueda y los filtros.'
          : 'No hay clientes registrados para mostrar.'
      "
    >
      <Button v-if="hasFilters" variant="secondary" @click="clearFilters">Limpiar filtros</Button>
      <Button v-else @click="router.push('/clientes/nuevo')">
        <Plus :size="17" aria-hidden="true" /> Registrar primer cliente
      </Button>
    </EmptyState>
    <template v-else>
      <div class="client-results">
        <p>{{ total }} cliente{{ total === 1 ? '' : 's' }}</p>
        <span>Registro comercial HOMEX</span>
      </div>
      <div class="client-table">
        <table>
          <caption class="sr-only">
            Listado de clientes
          </caption>
          <colgroup>
            <col class="col-client" />
            <col class="col-type" />
            <col class="col-contact" />
            <col class="col-status" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Tipo</th>
              <th scope="col">Contacto y ubicación</th>
              <th scope="col">Estado</th>
              <th scope="col" class="actions-heading">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="client in clients" :key="client.id">
              <td class="client-cell">
                <div class="client-content">
                  <ClientAvatar :name="nombreCliente(client)" />
                  <div class="client-info">
                    <strong :title="nombreCliente(client)">{{ nombreCliente(client) }}</strong>
                    <span :title="clientSubtitle(client)">{{ clientSubtitle(client) }}</span>
                  </div>
                </div>
              </td>
              <td class="type-cell" data-label="Tipo">
                <span class="type-chip">
                  <Building2 v-if="isCompany(client)" :size="15" aria-hidden="true" />
                  <UserRound v-else :size="15" aria-hidden="true" />
                  <span>{{ clientTypeName(client) }}</span>
                </span>
              </td>
              <td class="contact-cell" data-label="Contacto">
                <div class="contact-stack">
                  <div class="contact-phone">
                    <Phone :size="14" aria-hidden="true" />
                    <span>{{ client.celular || 'Sin celular' }}</span>
                  </div>
                  <div
                    class="contact-address"
                    :title="client.direccion?.trim() || 'Dirección no registrada'"
                  >
                    <MapPin :size="13" aria-hidden="true" />
                    <span>{{ client.direccion?.trim() || 'Dirección no registrada' }}</span>
                  </div>
                </div>
              </td>
              <td class="status-cell" data-label="Estado">
                <Badge :tone="client.activo === false ? 'danger' : 'success'">
                  {{ client.activo === false ? 'Inactivo' : 'Activo' }}
                </Badge>
              </td>
              <td class="actions-cell">
                <ClientActionsMenu
                  :id="client.id"
                  :nombre="nombreCliente(client)"
                  :activo="client.activo !== false"
                  :can-edit="canEdit"
                  @toggle-status="handleToggleStatus"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <nav class="client-pagination" aria-label="Paginación de clientes">
        <p>Mostrando {{ fromItem }}–{{ toItem }} de {{ total }} registros</p>
        <div v-if="totalPages > 1" class="client-pagination__buttons">
          <button type="button" :disabled="page <= 1" @click="page--">
            <ChevronLeft :size="17" aria-hidden="true" /> Anterior
          </button>
          <span>Página {{ page }} de {{ totalPages }}</span>
          <button type="button" :disabled="page >= totalPages" @click="page++">
            Siguiente <ChevronRight :size="17" aria-hidden="true" />
          </button>
        </div>
      </nav>
    </template>

    <Toast
      :visible="Boolean(toastMessage)"
      :message="toastMessage"
      tone="success"
      @close="toastMessage = ''"
    />

    <ConfirmDialog
      :open="Boolean(clientToToggle)"
      :variant="clientToToggle?.activo === false ? 'success' : 'danger'"
      :title="
        clientToToggle?.activo === false
          ? 'Reactivar cliente comercial'
          : 'Desactivar cliente comercial'
      "
      :description="
        clientToToggle?.activo === false
          ? `¿Deseas reactivar al cliente &quot;${clientToToggle ? nombreCliente(clientToToggle) : ''}&quot; para permitir nuevas proformas y pedidos?`
          : `¿Deseas desactivar al cliente &quot;${clientToToggle ? nombreCliente(clientToToggle) : ''}&quot;? No podrá ser seleccionado en nuevas proformas hasta ser reactivado.`
      "
      :confirm-label="clientToToggle?.activo === false ? 'Reactivar cliente' : 'Desactivar cliente'"
      @close="clientToToggle = null"
      @confirm="confirmToggleStatus"
    />
  </div>
</template>

<style scoped>
.clientes-list {
  min-width: 0;
}
.clientes-list :deep(.page-header) {
  margin-bottom: var(--space-6);
}
.clientes-list :deep(.page-header__actions button) {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.client-filters {
  display: grid;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  margin-bottom: 1rem;
}
.client-filters__main {
  display: grid;
  grid-template-columns: minmax(14rem, 2.2fr) minmax(10rem, 1fr) minmax(10rem, 1fr) auto;
  align-items: end;
  gap: 0.85rem;
}
.client-search {
  min-width: 0;
}
.client-search :deep(.search) {
  width: 100%;
}
.client-search :deep(.search input) {
  min-width: 0;
  width: 100%;
  min-height: 2.6rem;
  font-size: 0.89rem;
}
.client-filter-select {
  min-width: 0;
}
.client-filter-select :deep(.select select) {
  width: 100%;
}
.filter-clear-btn {
  width: 2.75rem;
  min-width: 2.75rem;
  height: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  flex: none;
}
.client-results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.1rem 0 0.8rem;
}
.client-results p {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 650;
}
.client-results > span {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.client-table {
  min-width: 0;
  border: 1px solid var(--color-table-border);
  border-top: 1px solid var(--color-table-header-bg);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-table-row-odd);
}
.client-table table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}
.client-table thead {
  background: var(--color-table-header-bg);
}
.col-client {
  width: 36%;
}
.col-type {
  width: 15%;
}
.col-contact {
  width: 28%;
}
.col-status {
  width: 11%;
}
.col-actions {
  width: 10%;
}
.client-table th,
.client-table td {
  text-align: left;
  padding: 0.8rem 1rem;
  border-bottom: 1px solid var(--color-table-border);
  border-left: 0;
  border-right: 0;
  vertical-align: middle;
}
.client-table th {
  background: var(--color-table-header-bg);
  color: var(--color-table-header-text);
  font-size: 0.76rem;
  font-weight: 650;
  border-top: 0;
}
.client-table thead th:first-child {
  border-top-left-radius: calc(var(--radius-card) - 1px);
  box-shadow: -1px 0 0 var(--color-table-header-bg);
}
.client-table thead th:last-child {
  border-top-right-radius: calc(var(--radius-card) - 1px);
  box-shadow: 1px 0 0 var(--color-table-header-bg);
}
.client-table tbody tr:nth-child(odd) {
  background-color: var(--color-table-row-odd);
}
.client-table tbody tr:nth-child(even) {
  background-color: var(--color-table-row-even);
}
.client-table tbody tr:hover {
  background-color: var(--color-table-row-hover);
}
.client-table tbody tr:last-child td {
  border-bottom: 0;
}
.client-table tbody tr:last-child td:first-child {
  border-bottom-left-radius: calc(var(--radius-card) - 1px);
}
.client-table tbody tr:last-child td:last-child {
  border-bottom-right-radius: calc(var(--radius-card) - 1px);
}
.client-cell,
.contact-cell {
  min-width: 0;
}
.client-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}
.client-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.client-cell strong {
  display: block;
  font-weight: 700;
  font-size: 0.89rem;
  line-height: 1.3;
  white-space: normal;
  overflow-wrap: anywhere;
}
.client-cell span {
  display: block;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  margin-top: 0.2rem;
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.type-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}
.type-chip svg {
  flex: none;
  color: var(--color-text-secondary);
}
.contact-stack {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}
.contact-phone,
.contact-address {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.contact-phone {
  font-size: 0.84rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}
.contact-address {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.contact-phone svg,
.contact-address svg {
  flex: none;
  color: var(--color-text-secondary);
}
.contact-phone span,
.contact-address span {
  line-height: 1.35;
  white-space: normal;
  overflow-wrap: anywhere;
}
.client-table td.actions-cell,
.client-table th.actions-heading {
  text-align: right;
  padding-right: 1rem;
}
.client-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}
.client-action-icon {
  display: inline-grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  text-decoration: none;
}
.client-action-icon:hover {
  background: var(--color-surface-hover);
  color: var(--color-primary-accent);
  border-color: var(--color-border-strong);
}
.client-detail-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.35rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-primary-accent);
  font-size: 0.82rem;
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}
.client-detail-link:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.client-action-icon:focus-visible,
.client-detail-link:focus-visible,
.client-pagination button:focus-visible {
  outline: 2px solid var(--color-primary-accent);
  outline-offset: 2px;
}
.client-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
.client-pagination p {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
}
.client-pagination__buttons {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}
.client-pagination__buttons span {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.client-pagination button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem 0.85rem;
  min-height: 2.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 650;
  cursor: pointer;
}
.client-pagination button:not(:disabled):hover {
  background: var(--color-surface-hover);
}
.client-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 72rem) {
  .client-table th,
  .client-table td {
    padding: 0.75rem 0.65rem;
  }
  .col-client {
    width: 34%;
  }
  .col-type {
    width: 15%;
  }
  .col-contact {
    width: 27%;
  }
  .col-status {
    width: 12%;
  }
  .col-actions {
    width: 12%;
  }
}
@media (max-width: 53rem) {
  .client-filters__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .client-search {
    grid-column: 1 / -1;
  }
  .client-table {
    background: transparent;
    border: 0;
  }
  .client-table colgroup,
  .client-table thead {
    display: none;
  }
  .client-table tbody {
    display: grid;
    gap: 0.75rem;
  }
  .client-table tbody tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem 1rem;
    padding: 1rem;
    border: 1px solid var(--color-table-border);
    border-radius: var(--radius-card);
  }
  .client-table tbody tr:nth-child(odd) {
    background-color: var(--color-table-row-odd);
  }
  .client-table tbody tr:nth-child(even) {
    background-color: var(--color-table-row-even);
  }
  .client-table tbody td {
    display: block;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  .client-cell {
    grid-column: 1 / -1;
  }
  .type-cell {
    grid-column: 1;
  }
  .status-cell {
    grid-column: 2;
    text-align: right;
  }
  .contact-cell {
    grid-column: 1 / -1;
    padding-top: 0.35rem;
    border-top: 1px solid var(--color-border);
  }
  .client-table td.actions-cell {
    grid-column: 1 / -1;
    padding-right: 0;
    text-align: right;
  }
  .client-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
@media (max-width: 36rem) {
  .client-filters__main {
    grid-template-columns: 1fr;
  }
  .client-search {
    grid-column: auto;
  }
  .client-results > span {
    display: none;
  }
  .client-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
  .client-pagination__buttons {
    width: 100%;
    justify-content: space-between;
    gap: 0.4rem;
  }
  .client-pagination button {
    padding: 0.55rem 0.6rem;
  }
}
</style>
