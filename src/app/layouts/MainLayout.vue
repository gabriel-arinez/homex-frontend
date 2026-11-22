<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView } from 'vue-router'
import AlertCenterDrawer from '@/app/components/AlertCenterDrawer.vue'
import AppSidebar from './AppSidebar.vue'
import { useAlertsStore } from '@/app/stores/useAlertsStore'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'
import { useSessionStore } from '@/app/stores/useSessionStore'
import Toast from '@/shared/ui/Toast.vue'

const drawerOpen = ref(false)
const alertsOpen = ref(false)
const preferences = usePreferencesStore()
const session = useSessionStore()
const alerts = useAlertsStore()

onMounted(() => {
  if (session.isAuthenticated) alerts.startPolling()
})

watch(
  () => session.isAuthenticated,
  (authenticated) => {
    if (authenticated) alerts.startPolling()
    else alerts.reset()
  },
)

onBeforeUnmount(() => {
  alerts.stopPolling()
})
</script>

<template>
  <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
  <div class="shell" :class="{ 'shell--compact': preferences.sidebarCompact }">
    <AppSidebar
      :drawer-open="drawerOpen"
      @close="drawerOpen = false"
      @open-alerts="alertsOpen = true"
    />
    <main id="main-content" tabindex="-1">
      <RouterView v-slot="{ Component }"
        ><component :is="Component" @open-menu="drawerOpen = true"
      /></RouterView>
    </main>
    <AlertCenterDrawer :open="alertsOpen" @close="alertsOpen = false" />
    <Toast
      v-if="alerts.liveToast"
      :visible="true"
      :message="alerts.liveToast.message"
      :tone="alerts.liveToast.tone"
      @close="alerts.dismissLiveToast()"
    />
  </div>
</template>

<style scoped>
.skip-link {
  position: fixed;
  z-index: 200;
  top: 0.5rem;
  left: 0.5rem;
  padding: 0.65rem 1rem;
  transform: translateY(-150%);
  color: white;
  border-radius: var(--radius-control);
  background: var(--color-primary);
}
.skip-link:focus {
  transform: translateY(0);
}
.shell {
  min-height: 100dvh;
}
.shell main {
  min-width: 0;
  margin-left: var(--sidebar-expanded);
  padding: var(--space-8);
  transition: margin-left var(--transition-fast);
}
.shell main:focus {
  outline: 0;
}
.shell--compact main {
  margin-left: var(--sidebar-compact);
}
/* La zona de trabajo ocupa todo el espacio libre, incluso con zoom reducido.
   Los límites de lectura, si hacen falta, pertenecen al contenido específico. */
.shell main > :deep(*) {
  width: 100%;
  min-width: 0;
}
@media (min-width: 48rem) and (max-width: 63.99rem) {
  .shell main {
    margin-left: var(--sidebar-compact);
    padding: var(--space-6);
  }
}
@media (max-width: 47.99rem) {
  .shell main {
    margin-left: 0;
    padding: var(--space-4);
  }
}
@media (max-width: 22.5rem) {
  .shell main {
    padding: var(--space-3);
  }
}
</style>
