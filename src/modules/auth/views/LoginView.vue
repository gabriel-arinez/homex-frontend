<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Eye, EyeOff, LogIn, Moon, Sun } from '@lucide/vue'
import { usePreferencesStore } from '@/app/stores/usePreferencesStore'
import { useSessionStore } from '@/app/stores/useSessionStore'
import logoBrand from '@/assets/branding/logo-on-light.svg'
import showroomDark from '@/assets/branding/login-showroom-dark.png'
import showroomLight from '@/assets/branding/login-showroom-light.png'
import { ApiError } from '@/shared/api'
import Button from '@/shared/ui/Button.vue'
import TextField from '@/shared/ui/TextField.vue'

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const error = ref('')
const loading = ref(false)
const preferences = usePreferencesStore()
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
    <div class="login-visual" aria-hidden="true">
      <img
        :src="preferences.isDark ? showroomDark : showroomLight"
        alt=""
        class="login-visual__image"
      />
    </div>

    <div class="login-panel">
      <header class="login-panel__topbar">
        <button
          type="button"
          class="theme-toggle"
          :aria-label="preferences.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
          :title="preferences.isDark ? 'Tema claro' : 'Tema oscuro'"
          @click="preferences.toggleTheme"
        >
          <Sun v-if="preferences.isDark" :size="18" aria-hidden="true" />
          <Moon v-else :size="18" aria-hidden="true" />
        </button>
      </header>

      <section class="login-card" aria-labelledby="login-title">
        <div class="login-brand">
          <img :src="logoBrand" alt="HOMEX - Un estilo de vida" class="login-logo" />
        </div>

        <div class="login-heading">
          <h1 id="login-title">Iniciar sesión</h1>
          <p class="login-subtitle">Accede con tus credenciales de trabajo.</p>
        </div>

        <form :aria-busy="loading" @submit.prevent="submit">
          <TextField
            v-model="username"
            name="username"
            label="Usuario"
            autocomplete="username"
            placeholder="Ingresa tu usuario"
          />

          <div class="password-field">
            <TextField
              v-model="password"
              name="password"
              label="Contraseña"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="Ingresa tu contraseña"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? 'Ocultar clave' : 'Mostrar clave'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
              <Eye v-else :size="18" aria-hidden="true" />
            </button>
          </div>

          <div v-if="error" class="form-error" role="alert">
            <AlertCircle :size="18" aria-hidden="true" />
            <span>{{ error }}</span>
          </div>

          <Button
            type="submit"
            class="login-submit"
            :disabled="!username || !password"
            :processing="loading"
            processing-label="Ingresando…"
          >
            <LogIn :size="18" aria-hidden="true" />
            Ingresar
          </Button>
        </form>
      </section>

      <footer class="login-panel__footer">
        <p>Acceso exclusivo para personal autorizado · HOMEX</p>
      </footer>
    </div>
  </main>
</template>

<style scoped>
.login-shell {
  display: grid;
  grid-template-columns: 1fr minmax(25rem, 34rem);
  width: 100%;
  min-height: 100dvh;
  background: var(--color-surface);
}

.login-visual {
  position: sticky;
  top: 0;
  height: 100dvh;
  background: var(--color-surface-muted);
  overflow: hidden;
}

.login-visual__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
}

.login-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-6);
  min-height: 100dvh;
  padding: clamp(1.5rem, 3vw, 2.75rem);
  background: var(--color-surface);
  min-width: 0;
}

.login-panel__topbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.theme-toggle {
  display: grid;
  width: 2.4rem;
  height: 2.4rem;
  place-items: center;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.theme-toggle:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.login-card {
  display: grid;
  gap: var(--space-5);
  width: 100%;
  max-width: 23rem;
  margin-inline: auto;
}

.login-brand {
  display: flex;
  align-items: center;
}

.login-logo {
  display: block;
  width: auto;
  height: 2.85rem;
  max-width: 100%;
}

.login-heading {
  display: grid;
  gap: var(--space-1);
}

.login-heading h1 {
  margin: 0;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.login-subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

form {
  display: grid;
  gap: var(--space-4);
}

.password-field {
  position: relative;
}

.password-field :deep(input) {
  padding-right: 2.75rem;
}

.password-toggle {
  position: absolute;
  right: 0.35rem;
  bottom: 0.3rem;
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  place-items: center;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.password-toggle:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.form-error {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  padding: 0.65rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  border-radius: var(--radius-control);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.84rem;
  font-weight: 600;
}

.form-error svg {
  flex: 0 0 auto;
}

.login-submit {
  width: 100%;
  min-height: 2.85rem;
  justify-content: center;
  margin-top: var(--space-1);
}

.login-panel__footer {
  text-align: center;
}

.login-panel__footer p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

@media (max-width: 53.99rem) {
  .login-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .login-visual {
    position: static;
    height: 11.5rem;
  }

  .login-panel {
    min-height: auto;
    gap: var(--space-5);
    padding: 1.5rem;
  }
}

@media (max-width: 24rem) {
  .login-visual {
    height: 9.5rem;
  }

  .login-panel {
    padding: var(--space-4);
  }
}
</style>
