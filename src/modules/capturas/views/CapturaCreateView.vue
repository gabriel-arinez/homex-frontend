<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/shared/ui/PageHeader.vue'
import Card from '@/shared/ui/Card.vue'
import Button from '@/shared/ui/Button.vue'
import TextField from '@/shared/ui/TextField.vue'
import AudioRecorder from '../components/AudioRecorder.vue'
import { audioExtension, capturasService } from '../services/capturasService'
const emit = defineEmits<{ openMenu: [] }>(),
  router = useRouter(),
  mode = ref<'text' | 'audio'>('audio'),
  proforma = ref(''),
  texto = ref(''),
  audio = ref<Blob | null>(null),
  key = ref(crypto.randomUUID()),
  processing = ref(false),
  error = ref('')
const valid = computed(
  () =>
    Number(proforma.value) > 0 &&
    (mode.value === 'text' ? texto.value.trim().length > 0 : !!audio.value),
)
async function submit() {
  if (!valid.value || processing.value) return
  processing.value = true
  error.value = ''
  try {
    const result =
      mode.value === 'text'
        ? await capturasService.createText({
            clave_idempotencia: key.value,
            proforma: Number(proforma.value),
            texto: texto.value,
          })
        : await capturasService.createAudio({
            clave_idempotencia: key.value,
            proforma: Number(proforma.value),
            audio: audio.value!,
            filename: `captura-${key.value}.${audioExtension(audio.value!.type)}`,
          })
    await router.push(`/capturas/${result.id}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo enviar la captura.'
  } finally {
    processing.value = false
  }
}
</script>
<template>
  <div>
    <PageHeader
      title="Nueva captura"
      description="Entrada temporal por voz o texto para una proforma existente."
      show-menu
      @menu="emit('openMenu')"
      ><template #actions
        ><Button variant="secondary" @click="router.push('/capturas')">Volver</Button></template
      ></PageHeader
    ><Card
      ><form @submit.prevent="submit">
        <TextField
          v-model="proforma"
          label="Proforma"
          name="proforma"
          type="number"
          min="1"
          step="1"
          required
        />
        <fieldset>
          <legend>Tipo de entrada</legend>
          <label><input v-model="mode" type="radio" value="audio" /> Voz</label
          ><label><input v-model="mode" type="radio" value="text" /> Texto</label>
        </fieldset>
        <AudioRecorder v-if="mode === 'audio'" @ready="audio = $event" /><label
          v-else
          class="textarea"
          ><span>Texto dictado o escrito</span
          ><textarea v-model="texto" rows="7" required></textarea>
        </label>
        <p class="hint">
          Clave idempotente de esta captura: <code>{{ key }}</code
          >. Reintentar el mismo envío reutiliza la operación.
        </p>
        <p v-if="error" role="alert" class="error">{{ error }}</p>
        <Button type="submit" :disabled="!valid || processing">{{
          processing ? 'Enviando…' : 'Enviar a procesamiento'
        }}</Button>
      </form></Card
    >
  </div>
</template>
<style scoped>
form,
.textarea {
  display: grid;
  gap: var(--space-4);
}
fieldset {
  display: flex;
  gap: var(--space-5);
  border: 0;
  padding: 0;
}
fieldset label {
  display: flex;
  gap: 0.5rem;
}
.textarea span,
legend {
  font-weight: 700;
}
textarea {
  padding: 0.75rem;
  color: var(--color-text);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.hint {
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.error {
  color: var(--color-danger-text);
  background: var(--color-danger-soft);
  padding: var(--space-3);
}
</style>
