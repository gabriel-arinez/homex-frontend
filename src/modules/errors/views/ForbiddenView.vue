<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/app/stores/useSessionStore'
import Button from '@/shared/ui/Button.vue'
import ForbiddenState from '@/shared/ui/ForbiddenState.vue'

const session = useSessionStore()
const router = useRouter()

const hasOperationalHome = computed(() => session.defaultRouteName !== 'forbidden')
const description = computed(() =>
  hasOperationalHome.value
    ? 'Tu cuenta no tiene permiso para ver esta sección.'
    : 'Tu cuenta autenticada no tiene un rol operativo asignado. Solicita la asignación de permisos al administrador.',
)

function goHome() {
  void router.push({ name: session.defaultRouteName })
}
</script>
<template>
  <ForbiddenState title="Acceso restringido" :description="description">
    <Button v-if="hasOperationalHome" variant="secondary" @click="goHome">
      Ir a mi panel operativo
    </Button>
  </ForbiddenState>
</template>
