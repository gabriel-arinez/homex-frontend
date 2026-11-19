<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Moon,
  PackageOpen,
  ClipboardList,
  Hammer,
  Truck,
  ReceiptText,
  History,
  Sun,
  Users,
  X,
  LogOut,
} from '@lucide/vue'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'
import { useSessionStore } from '@/app/stores/useSessionStore'
import type { Capability } from '@/modules/auth/types/session'
import { useFocusTrap } from '@/shared/composables/useFocusTrap'
import Tooltip from '@/shared/ui/Tooltip.vue'
const props = defineProps<{ drawerOpen: boolean }>()
const emit = defineEmits<{ close: [] }>()
const preferences = usePreferencesStore()
const session = useSessionStore()
const router = useRouter()
function logout() {
  session.logout()
  void router.replace('/login')
}
const panel = ref<HTMLElement | null>(null)
useFocusTrap(
  panel,
  computed(() => props.drawerOpen),
)
const groups: Array<{
  label: string
  items: Array<{
    label: string
    to: string
    icon: unknown
    capabilities?: Capability[]
  }>
}> = [
  {
    label: 'General',
    items: [
      {
        label: 'Resumen',
        to: '/resumen',
        icon: LayoutDashboard,
        capabilities: ['comercial.operar'],
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', to: '/clientes', icon: Users, capabilities: ['comercial.operar'] },
      { label: 'Proformas', to: '/proformas', icon: FileText, capabilities: ['comercial.operar'] },
      {
        label: 'Productos',
        to: '/productos',
        icon: PackageOpen,
        capabilities: ['comercial.operar', 'catalogo.crear_producto'],
      },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Pedidos', to: '/pedidos', icon: ClipboardList, capabilities: ['comercial.operar'] },
      {
        label: 'Órdenes de trabajo',
        to: '/ordenes-trabajo',
        icon: Hammer,
        capabilities: ['comercial.operar', 'taller.operar'],
      },
      {
        label: 'Notas de entrega',
        to: '/notas-entrega',
        icon: Truck,
        capabilities: ['comercial.operar'],
      },
      {
        label: 'Movimientos de stock',
        to: '/movimientos-stock',
        icon: History,
        capabilities: ['comercial.operar'],
      },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { label: 'Recibos', to: '/recibos', icon: ReceiptText, capabilities: ['comercial.operar'] },
    ],
  },
]
const initials = computed(
  () =>
    session.identity?.display_name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'H',
)
const visibleGroups = computed(() =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.capabilities || item.capabilities.some((value) => session.can(value)),
      ),
    }))
    .filter((group) => group.items.length > 0),
)
</script>
<template>
  <div
    class="sidebar-layer"
    :class="{
      'sidebar-layer--open': drawerOpen,
      'sidebar-layer--compact': preferences.sidebarCompact,
    }"
    @mousedown.self="emit('close')"
  >
    <aside
      ref="panel"
      class="sidebar"
      :class="{ 'sidebar--compact': preferences.sidebarCompact }"
      @keydown.esc="emit('close')"
    >
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">H</div>
        <div class="brand__text">
          <strong>HOMEX</strong>
          <small>Gestión operativa</small>
        </div>
        <button type="button" class="close" aria-label="Cerrar navegación" @click="emit('close')">
          <X :size="20" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Navegación principal">
        <section v-for="group in visibleGroups" :key="group.label">
          <h2>{{ group.label }}</h2>
          <Tooltip
            v-for="item in group.items"
            :key="item.to"
            :text="item.label"
            :disabled="!preferences.sidebarCompact"
            block
          >
            <RouterLink
              :to="item.to"
              :aria-label="preferences.sidebarCompact ? item.label : undefined"
              @click="emit('close')"
            >
              <component :is="item.icon" :size="19" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </Tooltip>
        </section>
      </nav>
      <div class="sidebar__footer">
        <div class="user">
          <span class="user__avatar" aria-hidden="true">{{ initials }}</span>
          <div class="user__info">
            <strong>{{ session.identity?.display_name ?? 'Sesión HOMEX' }}</strong>
            <small>{{ session.identity?.username ?? 'Cuenta autenticada' }}</small>
          </div>
          <Tooltip text="Cerrar sesión" :disabled="!preferences.sidebarCompact">
            <button
              type="button"
              class="user__logout"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              @click="logout"
            >
              <LogOut :size="18" aria-hidden="true" />
              <span class="sr-only">Cerrar sesión</span>
            </button>
          </Tooltip>
        </div>
        <div class="sidebar__utils">
          <Tooltip
            :text="preferences.isDark ? 'Tema claro' : 'Tema oscuro'"
            :disabled="!preferences.sidebarCompact"
            block
          >
            <button
              type="button"
              class="util-btn"
              :aria-label="preferences.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
              @click="preferences.toggleTheme"
            >
              <Sun v-if="preferences.isDark" :size="18" aria-hidden="true" />
              <Moon v-else :size="18" aria-hidden="true" />
              <span>{{ preferences.isDark ? 'Tema claro' : 'Tema oscuro' }}</span>
            </button>
          </Tooltip>
          <Tooltip
            :text="preferences.sidebarCompact ? 'Expandir navegación' : 'Compactar navegación'"
            :disabled="!preferences.sidebarCompact"
            block
          >
            <button
              type="button"
              class="util-btn compact"
              :aria-label="
                preferences.sidebarCompact ? 'Expandir navegación' : 'Compactar navegación'
              "
              @click="preferences.toggleSidebar"
            >
              <ChevronRight v-if="preferences.sidebarCompact" :size="18" aria-hidden="true" />
              <ChevronLeft v-else :size="18" aria-hidden="true" />
              <span class="sr-only">{{
                preferences.sidebarCompact ? 'Expandir' : 'Compactar'
              }}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  </div>
</template>
<style scoped>
.sidebar-layer {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  width: var(--sidebar-expanded);
  transition: width var(--transition-fast);
}
.sidebar-layer--compact {
  width: var(--sidebar-compact);
}
.sidebar {
  display: flex;
  width: var(--sidebar-expanded);
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
  transition: width var(--transition-fast);
}
.brand {
  display: flex;
  min-height: 4.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 75%, transparent);
}
.brand__mark {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  font-size: 1.05rem;
  font-weight: 800;
  border-radius: 0.65rem;
  background: var(--color-primary);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 1px 2px rgb(0 0 0 / 12%);
}
.brand__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}
.brand__text strong {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.1;
}
.brand__text small {
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 500;
  line-height: 1.1;
}
.close {
  display: none;
  margin-left: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
}
.close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}
nav {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 0.75rem 0.5rem;
}
nav section {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 1.15rem;
}
nav h2 {
  margin: 0 0 0.3rem;
  padding: 0 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
nav a {
  position: relative;
  display: flex;
  min-height: 2.65rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  text-decoration: none;
  border-radius: var(--radius-control);
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}
nav a svg {
  flex: 0 0 auto;
  opacity: 0.85;
  transition: opacity var(--transition-fast);
}
nav a span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
nav a:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}
nav a:hover svg {
  opacity: 1;
}
nav a.router-link-active {
  color: var(--color-primary-accent);
  font-weight: 650;
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent);
}
nav a.router-link-active svg {
  opacity: 1;
}
nav a.router-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.45rem;
  bottom: 0.45rem;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--color-primary-accent);
}
.sidebar__footer {
  display: grid;
  gap: 0.6rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}
.user {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface-muted);
}
.user__avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 15%);
}
.user__info {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}
.user__info strong {
  color: var(--color-text);
  font-size: 0.84rem;
  font-weight: 650;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user__info small {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.user__logout {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.user__logout:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
}
.sidebar__utils {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.sidebar__utils > :first-child {
  flex: 1;
  min-width: 0;
}
.util-btn {
  display: flex;
  width: 100%;
  min-height: 2.4rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.45rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.util-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.util-btn span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compact {
  width: 2.4rem;
  padding: 0;
  flex: 0 0 auto;
}
.sidebar--compact {
  width: var(--sidebar-compact);
}
.sidebar--compact .brand {
  justify-content: center;
  padding-inline: 0.5rem;
}
.sidebar--compact .brand__text,
.sidebar--compact nav h2,
.sidebar--compact nav a span,
.sidebar--compact .user__info,
.sidebar--compact .util-btn span {
  display: none;
}
.sidebar--compact nav section {
  margin-bottom: 0;
}
.sidebar--compact nav section + section {
  margin-top: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}
.sidebar--compact nav a {
  justify-content: center;
  padding-inline: 0;
}
.sidebar--compact .user {
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.45rem 0.25rem;
}
.sidebar--compact .sidebar__utils {
  flex-direction: column;
  align-items: stretch;
}
.sidebar--compact .util-btn,
.sidebar--compact .compact {
  width: 100%;
  padding-inline: 0;
}
@media (min-width: 48rem) and (max-width: 63.99rem) {
  .sidebar-layer,
  .sidebar {
    width: var(--sidebar-compact);
  }
  .sidebar:not(.sidebar--compact) {
    width: var(--sidebar-expanded);
    box-shadow: 0 0 0 100vmax var(--color-overlay);
  }
}
@media (max-width: 47.99rem) {
  .sidebar-layer {
    width: 100vw;
    background: var(--color-overlay);
    visibility: hidden;
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .sidebar-layer--open {
    visibility: visible;
    opacity: 1;
  }
  .sidebar,
  .sidebar--compact {
    width: min(20rem, calc(100vw - 2rem));
    transform: translateX(-100%);
    transition: transform var(--transition-fast);
  }
  .sidebar-layer--open .sidebar {
    transform: translateX(0);
  }
  .sidebar--compact .brand {
    justify-content: flex-start;
    padding-inline: 1rem;
  }
  .sidebar--compact .brand__text,
  .sidebar--compact nav h2,
  .sidebar--compact .user__info {
    display: grid;
  }
  .sidebar--compact nav a span,
  .sidebar--compact .util-btn span {
    display: initial;
  }
  .sidebar--compact nav section {
    margin-bottom: 1.15rem;
  }
  .sidebar--compact nav section + section {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
  .sidebar--compact nav a {
    justify-content: flex-start;
    padding-inline: 0.75rem;
  }
  .sidebar--compact .user {
    flex-direction: row;
    gap: 0.65rem;
    padding: 0.55rem 0.65rem;
  }
  .sidebar--compact .sidebar__utils {
    flex-direction: row;
  }
  .close {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
  }
  .compact {
    display: none !important;
  }
}
</style>
