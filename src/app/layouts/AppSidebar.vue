<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RouterLink } from 'vue-router'
import {
  BookOpen,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  LayoutDashboard,
  Moon,
  PackageCheck,
  PackageOpen,
  Receipt,
  Sparkles,
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
  items: Array<{ label: string; to: string; icon: unknown; capability?: Capability }>
}> = [
  {
    label: 'General',
    items: [
      { label: 'Resumen', to: '/resumen', icon: LayoutDashboard, capability: 'comercial.operar' },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', to: '/clientes', icon: Users, capability: 'comercial.operar' },
      { label: 'Proformas', to: '/proformas', icon: FileText, capability: 'comercial.operar' },
      { label: 'Productos', to: '/productos', icon: PackageOpen, capability: 'comercial.operar' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { label: 'Pedidos', to: '/pedidos', icon: PackageCheck, capability: 'comercial.operar' },
      {
        label: 'Órdenes de trabajo',
        to: '/ordenes-trabajo',
        icon: ClipboardList,
        capability: 'comercial.operar',
      },
      {
        label: 'Notas de entrega',
        to: '/notas-entrega',
        icon: FileCheck2,
        capability: 'comercial.operar',
      },
    ],
  },
  {
    label: 'Stock',
    items: [
      {
        label: 'Movimientos de stock',
        to: '/movimientos-stock',
        icon: Boxes,
        capability: 'comercial.administrar',
      },
    ],
  },
  {
    label: 'Finanzas',
    items: [{ label: 'Recibos', to: '/recibos', icon: Receipt, capability: 'comercial.operar' }],
  },
  {
    label: 'Inteligencia',
    items: [{ label: 'Capturas', to: '/capturas', icon: Sparkles, capability: 'comercial.operar' }],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Catálogos', to: '/catalogos', icon: BookOpen, capability: 'comercial.administrar' },
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
      items: group.items.filter((item) => session.can(item.capability)),
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
        <strong>H</strong><span>HOMEX</span
        ><button type="button" class="close" aria-label="Cerrar navegación" @click="emit('close')">
          <X />
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
              <component :is="item.icon" :size="20" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </RouterLink>
          </Tooltip>
        </section>
      </nav>
      <div class="sidebar__footer">
        <button type="button" @click="preferences.toggleTheme">
          <Sun v-if="preferences.isDark" :size="20" /><Moon v-else :size="20" /><span>{{
            preferences.isDark ? 'Tema claro' : 'Tema oscuro'
          }}</span>
        </button>
        <div class="user">
          <span aria-hidden="true">{{ initials }}</span>
          <div>
            <strong>{{ session.identity?.display_name ?? 'Sesión HOMEX' }}</strong
            ><small>{{ session.identity?.username ?? 'Cuenta autenticada' }}</small>
          </div>
          <button type="button" aria-label="Cerrar sesión" @click="logout">
            <LogOut :size="20" /><span>Cerrar sesión</span>
          </button>
        </div>
        <button
          type="button"
          class="compact"
          :aria-label="preferences.sidebarCompact ? 'Expandir navegación' : 'Compactar navegación'"
          @click="preferences.toggleSidebar"
        >
          <ChevronRight v-if="preferences.sidebarCompact" /><ChevronLeft v-else /><span
            >Compactar</span
          >
        </button>
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
  padding: 1rem;
}
.brand > strong {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  border-radius: 0.6rem;
  background: var(--color-primary);
}
.brand > span {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
.close {
  display: none;
  margin-left: auto;
  border: 0;
  background: transparent;
}
nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 0.75rem;
}
nav section {
  margin-bottom: 1rem;
}
nav h2 {
  margin: 0 0.75rem 0.35rem;
  color: var(--color-text-secondary);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
nav a,
.sidebar__footer button {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  text-decoration: none;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: pointer;
}
nav a:hover,
.sidebar__footer button:hover,
nav a.router-link-active {
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.sidebar__footer {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
  border-top: 1px solid var(--color-border);
}
.user {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
}
.user > span {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  color: white;
  border-radius: 50%;
  background: var(--color-primary);
  font-size: 0.7rem;
}
.user div {
  display: grid;
}
.user small {
  color: var(--color-text-secondary);
}
.compact {
  width: 100%;
}
.sidebar--compact {
  width: var(--sidebar-compact);
}
.sidebar--compact .brand > span,
.sidebar--compact nav h2,
.sidebar--compact nav a span,
.sidebar--compact .sidebar__footer button span,
.sidebar--compact .user div {
  display: none;
}
.sidebar--compact nav a,
.sidebar--compact .sidebar__footer button,
.sidebar--compact .user {
  justify-content: center;
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
  .sidebar--compact .brand > span,
  .sidebar--compact nav h2,
  .sidebar--compact nav a span,
  .sidebar--compact .sidebar__footer button span,
  .sidebar--compact .user div {
    display: initial;
  }
  .sidebar--compact nav a,
  .sidebar--compact .sidebar__footer button,
  .sidebar--compact .user {
    justify-content: flex-start;
    padding-inline: 0.75rem;
  }
  .close {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
  }
  .compact {
    display: none !important;
  }
}
</style>
