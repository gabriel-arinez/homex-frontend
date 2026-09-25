import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Theme = 'light' | 'dark'
const THEME_KEY = 'homex.theme'
const SIDEBAR_KEY = 'homex.sidebar.compact'

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<Theme>(initialTheme())
  const sidebarCompact = ref(localStorage.getItem(SIDEBAR_KEY) === 'true')
  const isDark = computed(() => theme.value === 'dark')

  function applyTheme() {
    document.documentElement.dataset.theme = theme.value
    localStorage.setItem(THEME_KEY, theme.value)
  }
  function toggleTheme() {
    theme.value = isDark.value ? 'light' : 'dark'
    applyTheme()
  }
  function toggleSidebar() {
    sidebarCompact.value = !sidebarCompact.value
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCompact.value))
  }
  applyTheme()
  return { theme, sidebarCompact, isDark, applyTheme, toggleTheme, toggleSidebar }
})
