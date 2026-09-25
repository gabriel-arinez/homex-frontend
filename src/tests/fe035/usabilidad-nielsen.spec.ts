import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ActiveFilters from '@/shared/ui/ActiveFilters.vue'
import Button from '@/shared/ui/Button.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import TextField from '@/shared/ui/TextField.vue'

describe('FE03.5 baseline de usabilidad Nielsen', () => {
  it('comunica procesamiento y bloquea una segunda acción', async () => {
    const action = vi.fn<() => void>()
    const wrapper = mount(Button, {
      props: { processing: true, processingLabel: 'Guardando…', onClick: action },
      slots: { default: 'Guardar' },
    })
    expect(wrapper.get('button').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button').attributes()).toHaveProperty('disabled')
    expect(wrapper.text()).toBe('Guardando…')
    await wrapper.get('button').trigger('click')
    expect(action).not.toHaveBeenCalled()
  })
  it('asocia ayuda o error al campo sin borrar el valor introducido', async () => {
    const wrapper = mount(TextField, {
      props: {
        modelValue: 'dato conservado',
        name: 'nombre',
        label: 'Nombre',
        hint: 'Ayuda breve',
      },
    })
    expect(wrapper.get('input').element.value).toBe('dato conservado')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('nombre-hint')
    await wrapper.setProps({ error: 'Corrige este campo' })
    expect(wrapper.get('input').element.value).toBe('dato conservado')
    expect(wrapper.get('input').attributes('aria-describedby')).toBe('nombre-error')
  })
  it('hace reconocibles y removibles los filtros activos', async () => {
    const wrapper = mount(ActiveFilters, {
      props: { filters: [{ key: 'search', label: 'Búsqueda: silla' }] },
    })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['search']])
    expect(wrapper.text()).toContain('Filtros activos')
  })
  it('no ejecuta una acción destructiva antes de confirmarla', async () => {
    const confirm = vi.fn<() => void>()
    const wrapper = mount(ConfirmDialog, {
      props: {
        open: true,
        title: 'Descartar cambios',
        description: 'Los cambios no se guardarán.',
        onConfirm: confirm,
      },
      attachTo: document.body,
    })
    expect(confirm).not.toHaveBeenCalled()
    await document.querySelector<HTMLButtonElement>('[role="dialog"] .button--danger')?.click()
    expect(confirm).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('distingue carga de error recuperable', () => {
    const loading = mount(LoadingSkeleton)
    const error = mount(ErrorState, {
      props: { description: 'No se pudo conectar.' },
      slots: { default: '<button>Reintentar</button>' },
    })
    expect(loading.get('[role="status"]').attributes('aria-busy')).toBe('true')
    expect(error.get('[role="alert"]').text()).toContain('Reintentar')
  })
})
