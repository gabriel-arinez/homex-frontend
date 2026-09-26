<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import TextField from '@/shared/ui/TextField.vue'
const emit = defineEmits<{ openMenu: [] }>(),
  router = useRouter(),
  id = ref('')
function open() {
  if (Number(id.value) > 0) void router.push(`/capturas/${id.value}`)
}
</script>
<template>
  <div>
    <PageHeader
      title="Capturas"
      description="Dicta o escribe una cotización y revisa la propuesta antes de incorporarla."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button @click="router.push('/capturas/nueva')">Nueva captura</Button></template
      ></PageHeader
    >
    <div class="grid">
      <Card
        ><h2>Nueva cotización asistida</h2>
        <p>
          El audio es temporal: se elimina después de obtener la transcripción. La propuesta siempre
          requiere revisión humana.
        </p>
        <Button @click="router.push('/capturas/nueva')">Comenzar captura</Button></Card
      ><Card
        ><h2>Continuar una captura</h2>
        <p>
          El backend todavía no publica un listado histórico. Puedes abrir una captura cuyo número
          conozcas.
        </p>
        <form @submit.prevent="open">
          <TextField
            v-model="id"
            label="Número de captura"
            name="captura-id"
            type="number"
            min="1"
            step="1"
            required
          /><Button type="submit">Abrir revisión</Button>
        </form></Card
      >
    </div>
  </div>
</template>
<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
form {
  display: grid;
  gap: var(--space-3);
}
@media (max-width: 700px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
