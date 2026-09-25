import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authService } from '@/modules/auth/services/authService'
import { isCapability, type Capability, type SessionIdentity } from '@/modules/auth/types/session'
import { configureApiAuth } from '@/shared/api'

const STORAGE_KEY = 'homex.session.v1'
type StoredSession = { access: string; refresh: string }

function readStored(): StoredSession | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const value = parsed as Record<string, unknown>
    return typeof value.access === 'string' && typeof value.refresh === 'string'
      ? { access: value.access, refresh: value.refresh }
      : null
  } catch {
    return null
  }
}

export const useSessionStore = defineStore('session', () => {
  const stored = readStored()
  const accessToken = ref(stored?.access ?? null)
  const refreshToken = ref(stored?.refresh ?? null)
  const identity = ref<SessionIdentity | null>(null)
  const capabilities = ref<Capability[]>([])
  const initialized = ref(false)
  let refreshPromise: Promise<string | null> | null = null

  const isAuthenticated = computed(() =>
    Boolean(accessToken.value && identity.value && initialized.value),
  )

  function persist() {
    if (accessToken.value && refreshToken.value)
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ access: accessToken.value, refresh: refreshToken.value }),
      )
    else sessionStorage.removeItem(STORAGE_KEY)
  }

  function establishTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    persist()
  }

  async function loadIdentity() {
    const current = await authService.me()
    identity.value = {
      id: current.id,
      username: current.username,
      display_name: current.display_name,
    }
    capabilities.value = current.capabilities.filter(isCapability)
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    identity.value = null
    capabilities.value = []
    persist()
  }

  async function refreshAccess() {
    if (!refreshToken.value) return null
    if (!refreshPromise)
      refreshPromise = authService
        .refresh({ refresh: refreshToken.value })
        .then((tokens) => {
          establishTokens(tokens.access, tokens.refresh || refreshToken.value!)
          return tokens.access
        })
        .catch(() => {
          logout()
          return null
        })
        .finally(() => (refreshPromise = null))
    return refreshPromise
  }

  async function initialize() {
    if (initialized.value) return
    try {
      if (refreshToken.value && (await refreshAccess())) await loadIdentity()
    } catch (error) {
      logout()
      throw error
    } finally {
      initialized.value = true
    }
  }

  async function login(username: string, password: string) {
    try {
      const tokens = await authService.login({ username, password })
      establishTokens(tokens.access, tokens.refresh)
      await loadIdentity()
      initialized.value = true
    } catch (error) {
      logout()
      throw error
    }
  }

  const can = (capability?: Capability) => !capability || capabilities.value.includes(capability)

  configureApiAuth({
    accessToken: () => accessToken.value,
    refresh: refreshAccess,
    unauthorized: logout,
  })

  return {
    accessToken,
    identity,
    capabilities,
    initialized,
    isAuthenticated,
    initialize,
    login,
    logout,
    can,
    refreshAccess,
  }
})
