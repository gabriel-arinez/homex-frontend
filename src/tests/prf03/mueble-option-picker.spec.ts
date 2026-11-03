import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MuebleOptionPicker from '@/modules/proformas/components/MuebleOptionPicker.vue'

const opciones = [
  { value: '1', label: 'Escritorio' },
  { value: '2', label: 'Mesa de reuniones' },
  { value: '3', label: 'Cómoda' },
]

describe('Furniture Studio: buscadores accesibles', () => {
  it('filtra sin distinguir mayúsculas ni acentos y selecciona un valor existente', async () => {
    const wrapper = mount(MuebleOptionPicker, {
      props: {
        modelValue: '',
        name: 'tipo',
        label: 'Tipo de mueble',
        options: opciones,
        allowCreate: true,
      },
      attachTo: document.body,
    })
    const input = wrapper.get('input[role="combobox"]')
    await input.trigger('focus')
    await input.setValue('comoda')
    expect(wrapper.findAll('[role="option"]')).toHaveLength(1)
    await wrapper.get('[role="option"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['3'])
    wrapper.unmount()
  })

  it('crea solo una opción inexistente y evita duplicados equivalentes', async () => {
    const wrapper = mount(MuebleOptionPicker, {
      props: {
        modelValue: '',
        name: 'medida',
        label: 'Agregar medida',
        options: opciones,
        allowCreate: true,
      },
      attachTo: document.body,
    })
    await wrapper.get('input').trigger('focus')
    await wrapper.get('input').setValue('Cómoda')
    expect(wrapper.find('.mueble-picker__create').exists()).toBe(false)
    await wrapper.get('input').setValue('Altura total')
    await wrapper.get('.mueble-picker__create').trigger('click')
    expect(wrapper.emitted('create')?.[0]).toEqual(['Altura total'])
    wrapper.unmount()
  })
})
