<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'

const drawerOpen = ref(false)
const preferences = usePreferencesStore()
</script>

<template>
  <a class="skip-link" href="#main-content">Saltar al contenido principal</a>
  <div class="shell" :class="{ 'shell--compact': preferences.sidebarCompact }">
    <AppSidebar :drawer-open="drawerOpen" @close="drawerOpen = false" />
    <main id="main-content" tabindex="-1">
      <RouterView v-slot="{ Component }"
        ><component :is="Component" @open-menu="drawerOpen = true"
      /></RouterView>
    </main>
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
.shell main > :deep(*) {
  width: min(100%, var(--content-max));
  margin-inline: auto;
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
