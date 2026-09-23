import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const selector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(container: Ref<HTMLElement | null>, active: Ref<boolean>) {
  let previous: HTMLElement | null = null
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') return
    if (event.key !== 'Tab' || !container.value) return
    const items = [...container.value.querySelectorAll<HTMLElement>(selector)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  watch(
    active,
    async (value) => {
      if (value) {
        previous = document.activeElement as HTMLElement
        await nextTick()
        container.value?.querySelector<HTMLElement>(selector)?.focus()
        document.addEventListener('keydown', onKeydown)
      } else {
        document.removeEventListener('keydown', onKeydown)
        previous?.focus()
      }
    },
    { immediate: true },
  )
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
