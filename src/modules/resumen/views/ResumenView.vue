<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { FileText, ClipboardList, AudioLines, PackageOpen, Hammer, RefreshCw } from '@lucide/vue'
import type { ConteoEstado, ResumenTaller } from '../services/resumenService'
import { resumenService } from '../services/resumenService'
import PageHeader from '@/shared/ui/PageHeader.vue'
import KpiCard from '@/shared/ui/KpiCard.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'

const AdminDashboard = defineAsyncComponent(() => import('../components/AdminDashboard.vue'))
const TiendaDashboard = defineAsyncComponent(() => import('../components/TiendaDashboard.vue'))
const TallerDashboard = defineAsyncComponent(() => import('../components/TallerDashboard.vue'))

const emit = defineEmits<{ 'open-menu': [] }>()
const session = useSessionStore()
const rows = ref<ConteoEstado[]>([])
const workshop = ref<ResumenTaller | null>(null)
const loading = ref(true)
const error = ref('')

const isAdmin = computed(() => session.can('comercial.administrar'))
const isCommercial = computed(() => session.can('comercial.operar'))
const isWorkshopOnly = computed(() => !isCommercial.value && session.can('taller.operar'))

const scopeDescription = computed(() => {
  const actor = session.identity?.display_name ?? 'HOMEX'
  if (isAdmin.value) return `Vista operativa de ${actor}. Supervisión global del sistema.`
  if (isWorkshopOnly.value) return `Vista operativa de ${actor}. Operación y seguimiento de taller.`
  return `Vista operativa de ${actor}. Gestión comercial de tienda.`
})

const distributionDescription = computed(() =>
  isAdmin.value
    ? 'Cantidad total de proformas registradas en el sistema, agrupadas por estado en este momento. No representa un período histórico.'
    : 'Cantidad de proformas visibles para tu cuenta, agrupadas por estado en este momento. No representa un período histórico.',
)

const value = (code: string) => {
  const x = rows.value.find((r) => r.estado.codigo === code)
  return x?.conteo == null ? '—' : String(x.conteo)
}

const secondKpi = computed(() => {
  const hasRevision = rows.value.some((r) => r.estado.codigo === 'EN_REVISION')
  const hasEnviada = rows.value.some((r) => r.estado.codigo === 'ENVIADA')
  if (hasRevision && !hasEnviada) {
    return {
      label: 'En revisión',
      value: value('EN_REVISION'),
      detail: 'Proformas en revisión actuales',
    }
  }
  return {
    label: 'Enviadas',
    value: value('ENVIADA'),
    detail: 'Proformas enviadas actuales',
  }
})

const failed = computed(() => rows.value.filter((x) => x.error))
const available = computed(() => rows.value.filter((x) => x.conteo !== null))
const total = computed(() => available.value.reduce((sum, x) => sum + (x.conteo ?? 0), 0))
const totalLabel = computed(() =>
  failed.value.length ? 'Subtotal disponible' : 'Total consultado',
)
const max = computed(() => Math.max(1, ...available.value.map((x) => x.conteo ?? 0)))
const bars = computed(() =>
  rows.value.map((x) => ({
    ...x,
    width:
      x.conteo === null || x.conteo === 0
        ? 0
        : Math.max(2, Math.round((x.conteo / max.value) * 100)),
  })),
)

const workshopMax = computed(() =>
  Math.max(1, ...(workshop.value?.porEstado.map((x) => x.conteo) ?? [0])),
)
const workshopBars = computed(() =>
  (workshop.value?.porEstado ?? []).map((x) => ({
    ...x,
    width: x.conteo === 0 ? 0 : Math.max(2, Math.round((x.conteo / workshopMax.value) * 100)),
  })),
)

async function load() {
  if (isAdmin.value || isCommercial.value || isWorkshopOnly.value) {
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (isWorkshopOnly.value) {
      workshop.value = await resumenService.resumenTaller()
      rows.value = []
      return
    }
    const states = await resumenService.estados()
    rows.value = await resumenService.distribucion(states)
    if (isAdmin.value && session.can('taller.operar')) {
      try {
        workshop.value = await resumenService.resumenTaller()
      } catch {
        workshop.value = null
      }
    } else {
      workshop.value = null
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el resumen.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
<template>
  <AdminDashboard v-if="isAdmin" @open-menu="emit('open-menu')" />
  <TiendaDashboard v-else-if="isCommercial" @open-menu="emit('open-menu')" />
  <TallerDashboard v-else-if="isWorkshopOnly" @open-menu="emit('open-menu')" />
  <div v-else>
    <PageHeader title="Resumen" :description="scopeDescription" show-menu @menu="emit('open-menu')">
      <template #actions>
        <Button variant="secondary" :disabled="loading" @click="load">
          <RefreshCw />Actualizar
        </Button>
      </template>
    </PageHeader>
    <LoadingSkeleton v-if="loading" :lines="8" />
    <ErrorState v-else-if="error" :description="error">
      <button @click="load">Reintentar</button>
    </ErrorState>

    <template v-else-if="isWorkshopOnly && workshop">
      <section class="kpis" aria-label="Indicadores operativos de taller">
        <KpiCard
          label="Órdenes de trabajo"
          :value="String(workshop.total)"
          detail="Órdenes registradas para seguimiento de taller"
        />
        <KpiCard
          label="Con fabricación a medida"
          :value="String(workshop.conFabricacion)"
          detail="Órdenes con ficha técnica de mueble a medida"
        />
        <KpiCard
          label="Solo catálogo"
          :value="String(workshop.soloCatalogo)"
          detail="Órdenes de preparación y verificación de catálogo"
        />
      </section>

      <div class="layout">
        <Card>
          <h2>Distribución actual de órdenes de trabajo</h2>
          <p class="description">
            Cantidad de órdenes de trabajo agrupadas por estado operativo actual en el taller.
          </p>
          <EmptyState
            v-if="!workshop.porEstado.length"
            title="Sin órdenes registradas"
            description="No hay órdenes de trabajo activas en este momento."
          />
          <template v-else>
            <div class="bars" aria-hidden="true">
              <div v-for="row in workshopBars" :key="row.codigo" class="bar-row">
                <span>{{ row.nombre }}</span>
                <div><i :style="{ width: `${row.width}%` }"></i></div>
                <strong>{{ row.conteo }}</strong>
              </div>
            </div>
            <table>
              <caption>
                Conteos actuales de órdenes de trabajo por estado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Estado</th>
                  <th scope="col">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in workshop.porEstado" :key="row.codigo">
                  <th scope="row">{{ row.nombre }}</th>
                  <td>{{ row.conteo }}</td>
                </tr>
                <tr>
                  <th scope="row">Total consultado</th>
                  <td>{{ workshop.total }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </Card>
        <Card>
          <h2>Accesos operativos</h2>
          <nav aria-label="Accesos desde el resumen">
            <RouterLink to="/ordenes-trabajo"> <Hammer />Consultar órdenes de trabajo </RouterLink>
            <RouterLink to="/ordenes-trabajo?tipo=fabricacion">
              <FileText />Ver fabricación a medida
            </RouterLink>
          </nav>
          <p class="description">
            Acceso exclusivo de taller a órdenes de trabajo y especificaciones técnicas de
            fabricación.
          </p>
        </Card>
      </div>
    </template>

    <template v-else>
      <section class="kpis" aria-label="Indicadores actuales de proformas">
        <KpiCard
          label="Borradores"
          :value="value('BORRADOR')"
          detail="Proformas editables actuales"
        />
        <KpiCard :label="secondKpi.label" :value="secondKpi.value" :detail="secondKpi.detail" />
        <KpiCard
          label="Aprobadas"
          :value="value('APROBADA')"
          detail="Proformas aprobadas actuales"
        />
      </section>
      <p v-if="failed.length" class="partial" role="status">
        {{ failed.length }} indicador{{ failed.length === 1 ? '' : 'es' }} no
        {{ failed.length === 1 ? 'pudo' : 'pudieron' }} actualizarse. Los demás datos siguen
        disponibles.
      </p>
      <div class="layout">
        <Card>
          <h2>Distribución actual de proformas</h2>
          <p class="description">
            {{ distributionDescription }}
          </p>
          <EmptyState
            v-if="!available.length"
            title="Sin métricas disponibles"
            description="No fue posible obtener los conteos por estado."
          />
          <template v-else>
            <div class="bars" aria-hidden="true">
              <div v-for="row in bars" :key="row.estado.codigo" class="bar-row">
                <span>{{ row.estado.nombre }}</span>
                <div><i :style="{ width: `${row.width}%` }"></i></div>
                <strong>{{ row.conteo ?? '—' }}</strong>
              </div>
            </div>
            <table>
              <caption>
                Conteos actuales de proformas por estado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Estado</th>
                  <th scope="col">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.estado.codigo">
                  <th scope="row">{{ row.estado.nombre }}</th>
                  <td>{{ row.conteo ?? 'No disponible' }}</td>
                </tr>
                <tr>
                  <th scope="row">{{ totalLabel }}</th>
                  <td>{{ total }}</td>
                </tr>
              </tbody>
            </table>
          </template>
        </Card>
        <Card>
          <h2>Accesos operativos</h2>
          <nav aria-label="Accesos desde el resumen">
            <RouterLink to="/proformas"><FileText />Revisar proformas</RouterLink>
            <RouterLink to="/pedidos"><ClipboardList />Consultar pedidos</RouterLink>
            <RouterLink to="/capturas"><AudioLines />Nueva captura asistida</RouterLink>
            <RouterLink v-if="isAdmin" to="/productos">
              <PackageOpen />Administrar catálogo
            </RouterLink>
          </nav>
          <p class="description">
            Los módulos y datos visibles respetan las capacidades y el alcance que aplica el backend
            a tu cuenta.
          </p>
        </Card>
      </div>
    </template>
  </div>
</template>
<style scoped>
.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(17rem, 0.7fr);
  gap: var(--space-5);
  align-items: start;
}
.description {
  color: var(--color-text-secondary);
}
.partial {
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
}
h2 {
  margin-top: 0;
}
.bars {
  display: grid;
  gap: var(--space-3);
  margin: var(--space-5) 0;
}
.bar-row {
  display: grid;
  grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 2fr) 3rem;
  align-items: center;
  gap: var(--space-3);
}
.bar-row > div {
  height: 0.8rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}
.bar-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}
table {
  width: 100%;
  border-collapse: collapse;
}
caption {
  text-align: left;
  font-weight: 700;
  margin-bottom: var(--space-2);
}
th,
td {
  padding: 0.6rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
td {
  text-align: right;
}
nav {
  display: grid;
  gap: var(--space-3);
}
nav a {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem;
  color: var(--color-primary-accent);
  font-weight: 700;
  text-decoration: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}
nav svg,
.page-header :deep(svg) {
  width: 1.1rem;
}
@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .kpis {
    grid-template-columns: 1fr;
  }
  .bar-row {
    grid-template-columns: minmax(6rem, 1fr) minmax(5rem, 1.5fr) 2rem;
    font-size: 0.85rem;
  }
}
</style>
