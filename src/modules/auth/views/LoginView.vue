<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { ApiError } from '@/shared/api'
import Button from '@/shared/ui/Button.vue'
import TextField from '@/shared/ui/TextField.vue'
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const session = useSessionStore()
const router = useRouter()
const route = useRoute()
async function submit() {
  if (loading.value) return
  error.value = ''
  loading.value = true
  try {
    await session.login(username.value, password.value)
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/resumen'
    await router.replace(redirect)
  } catch (cause) {
    error.value =
      cause instanceof ApiError && cause.status === 401
        ? 'Usuario o contraseña incorrectos.'
        : cause instanceof Error
          ? cause.message
          : 'No se pudo iniciar sesión.'
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <main class="login-shell">
    <section class="login-card" aria-labelledby="login-title">
      <div class="brand" aria-hidden="true">H</div>
      <p class="eyebrow">HOMEX</p>
      <h1 id="login-title">Iniciar sesión</h1>
      <p>Accede con tus credenciales de trabajo.</p>
      <form :aria-busy="loading" @submit.prevent="submit">
        <TextField v-model="username" name="username" label="Usuario" autocomplete="username" />
        <TextField
          v-model="password"
          name="password"
          label="Contraseña"
          type="password"
          autocomplete="current-password"
        />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <Button
          type="submit"
          :disabled="!username || !password"
          :processing="loading"
          processing-label="Ingresando…"
          >Ingresar</Button
        >
      </form>
    </section>
  </main>
</template>
<style scoped>
.login-shell {
  display: grid;
  min-height: 100dvh;
  padding: var(--space-4);
  place-items: center;
  background: var(--color-background);
}
.login-card {
  width: min(100%, 27rem);
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog);
  background: var(--color-surface);
}
.brand {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  color: white;
  border-radius: var(--radius-control);
  background: var(--color-primary);
  font-weight: 800;
}
.eyebrow {
  margin-block: var(--space-4) var(--space-1);
  color: var(--color-primary-accent);
  font-weight: 800;
  letter-spacing: 0.08em;
}
h1 {
  margin: 0;
}
.login-card > p:last-of-type {
  color: var(--color-text-secondary);
}
form {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-6);
}
.form-error {
  margin: 0;
  color: var(--color-danger);
}
@media (max-width: 24rem) {
  .login-card {
    padding: var(--space-5);
  }
}
</style>
