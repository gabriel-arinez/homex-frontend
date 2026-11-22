<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Hammer,
  Info,
  PackageX,
  Receipt,
  RefreshCw,
  ShoppingBag,
  X,
} from '@lucide/vue'
import { useAlertsStore, type DynamicAlert } from '@/app/stores/useAlertsStore'
import { useFocusTrap } from '@/shared/composables/useFocusTrap'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const alerts = useAlertsStore()
const router = useRouter()
const panel = ref<HTMLElement | null>(null)
const tab = ref<'new' | 'all'>('new')

useFocusTrap(
  panel,
  computed(() => props.open),
)

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      tab.value = alerts.unseenCount > 0 ? 'new' : 'all'
      void alerts.refresh()
    }
  },
)

const visibleAlerts = computed(() => (tab.value === 'new' ? alerts.unseenItems : alerts.items))

function categoryIcon(alert: DynamicAlert) {
  if (alert.category === 'taller') return Hammer
  if (alert.category === 'inventario') return PackageX
  if (alert.category === 'finanzas') return Receipt
  if (alert.severity === 'success') return CheckCircle2
  if (alert.severity === 'danger') return AlertTriangle
  if (alert.category === 'comercial') return ShoppingBag
  return Info
}

async function openAlert(alert: DynamicAlert) {
  alerts.markSeen(alert.fingerprint)
  emit('close')
  await router.push(alert.to)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="alerts-backdrop"
      @mousedown.self="emit('close')"
      @keydown.esc="emit('close')"
    >
      <aside
        ref="panel"
        class="alerts-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-drawer-title"
      >
        <header class="alerts-header">
          <div class="alerts-title">
            <span class="alerts-title__icon" aria-hidden="true">
              <Bell :size="18" />
            </span>
            <div>
              <h2 id="alerts-drawer-title">Alertas operativas</h2>
              <p>Cambios dinámicos detectados según tu rol</p>
            </div>
          </div>
          <div class="alerts-header__actions">
            <button
              type="button"
              class="icon-btn"
              aria-label="Actualizar alertas"
              title="Actualizar alertas"
              :disabled="alerts.loading"
              @click="alerts.refresh()"
            >
              <RefreshCw :size="17" :class="{ spin: alerts.loading }" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="icon-btn"
              aria-label="Cerrar alertas"
              @click="emit('close')"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div class="alerts-toolbar">
          <div class="alerts-tabs" role="tablist" aria-label="Filtro de alertas">
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'new'"
              :class="['tab-btn', { 'tab-btn--active': tab === 'new' }]"
              @click="tab = 'new'"
            >
              Nuevos cambios
              <span class="tab-count">{{ alerts.unseenCount }}</span>
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="tab === 'all'"
              :class="['tab-btn', { 'tab-btn--active': tab === 'all' }]"
              @click="tab = 'all'"
            >
              Activas
              <span class="tab-count">{{ alerts.items.length }}</span>
            </button>
          </div>
          <button
            v-if="alerts.unseenCount > 0"
            type="button"
            class="mark-all-btn"
            @click="alerts.markAllSeen()"
          >
            <CheckCheck :size="15" aria-hidden="true" />
            Marcar todo visto
          </button>
        </div>

        <div class="alerts-body">
          <div v-if="visibleAlerts.length === 0" class="alerts-empty">
            <Bell :size="28" aria-hidden="true" />
            <strong>
              {{ tab === 'new' ? 'No hay cambios nuevos sin revisar' : 'Sin alertas activas' }}
            </strong>
            <p>
              {{
                tab === 'new'
                  ? 'Te avisaremos automáticamente cuando taller o tienda registren novedades.'
                  : 'Todo el flujo operativo de tu rol está al día.'
              }}
            </p>
          </div>

          <ul v-else class="alerts-list">
            <li v-for="alert in visibleAlerts" :key="alert.fingerprint">
              <button
                type="button"
                class="alert-card"
                :class="[`alert-card--${alert.severity}`, { 'alert-card--new': alert.isNew }]"
                @click="openAlert(alert)"
              >
                <span class="alert-card__icon" aria-hidden="true">
                  <component :is="categoryIcon(alert)" :size="18" />
                </span>
                <div class="alert-card__content">
                  <div class="alert-card__top">
                    <strong>{{ alert.title }}</strong>
                    <span v-if="alert.isNew" class="new-dot" aria-label="Nuevo">Nuevo</span>
                  </div>
                  <p>{{ alert.message }}</p>
                  <span v-if="alert.meta" class="alert-card__meta">{{ alert.meta }}</span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.alerts-backdrop {
  position: fixed;
  z-index: 110;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: var(--color-overlay);
}

.alerts-drawer {
  display: flex;
  flex-direction: column;
  width: min(27rem, 100vw);
  height: 100dvh;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  box-shadow: -8px 0 32px rgb(0 0 0 / 16%);
}

.alerts-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.alerts-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.alerts-title__icon {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: var(--radius-control);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
  flex: 0 0 auto;
}

.alerts-title h2 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.3;
}

.alerts-title p {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.alerts-header__actions {
  display: flex;
  gap: var(--space-2);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.alerts-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.alerts-tabs {
  display: flex;
  gap: var(--space-2);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.tab-btn--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-accent);
}

.tab-count {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-text) 10%, transparent);
  font-size: 0.72rem;
}

.mark-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-primary-accent);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.mark-all-btn:hover {
  background: var(--color-primary-soft);
}

.alerts-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5);
}

.alerts-empty {
  display: grid;
  place-items: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-secondary);
}

.alerts-empty strong {
  color: var(--color-text);
  font-size: 0.95rem;
}

.alerts-empty p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
}

.alerts-list {
  display: grid;
  gap: var(--space-3);
  list-style: none;
  margin: 0;
  padding: 0;
}

.alert-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast);
}

.alert-card:hover {
  background: var(--color-surface-hover);
}

.alert-card--new {
  background: color-mix(in srgb, var(--color-primary-soft) 45%, var(--color-surface));
}

.alert-card--success {
  border-left-color: var(--color-success);
}

.alert-card--warning {
  border-left-color: var(--color-warning);
}

.alert-card--danger {
  border-left-color: var(--color-danger);
}

.alert-card__icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-control);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  flex: 0 0 auto;
}

.alert-card--success .alert-card__icon {
  color: var(--color-success);
}

.alert-card--warning .alert-card__icon {
  color: var(--color-warning);
}

.alert-card--danger .alert-card__icon {
  color: var(--color-danger);
}

.alert-card__content {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.alert-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.alert-card__top strong {
  font-size: 0.88rem;
  line-height: 1.3;
}

.new-dot {
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background: var(--color-primary);
  color: white;
  font-size: 0.68rem;
  font-weight: 700;
  flex: 0 0 auto;
}

.alert-card__content p {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}

.alert-card__meta {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
</style>
