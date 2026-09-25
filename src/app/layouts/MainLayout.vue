<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'

const drawerOpen = ref(false)
const preferences = usePreferencesStore()
</script>
<template>
  <div class="shell" :class="{ 'shell--compact': preferences.sidebarCompact }">
    <AppSidebar :drawer-open="drawerOpen" @close="drawerOpen = false" />
    <main id="main-content">
      <RouterView v-slot="{ Component }"
        ><component :is="Component" @open-menu="drawerOpen = true"
      /></RouterView>
    </main>
  </div>
</template>
<style scoped>
.shell {
  min-height: 100dvh;
}
.shell main {
  min-width: 0;
  margin-left: var(--sidebar-expanded);
  padding: var(--space-8);
  transition: margin-left var(--transition-fast);
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
