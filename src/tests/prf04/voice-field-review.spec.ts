import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import { vVoiceFields, type FieldVoiceReview } from '@/modules/capturas/fieldVoiceReview'
it('marks the actual observed field and resolves only a nonempty correction or confirmation', async () => {
  const component = defineComponent({
    directives: { voiceFields: vVoiceFields },
    setup() {
      const fields = ref<FieldVoiceReview[]>([
        { field: 'precio', state: 'pending', reason: 'Conflicto de moneda', critical: true },
      ])
      return {
        fields,
        resolve(field: string, edited: boolean) {
          fields.value = fields.value.map((f) =>
            f.field === field ? { ...f, state: edited ? 'edited' : 'reviewed' } : f,
          )
        },
      }
    },
    template:
      '<form v-voice-fields="{fields, resolve}"><label>Precio<input name="precio" /></label><input name="nombre" /></form>',
  })
  const wrapper = mount(component)
  expect(wrapper.get('[name="precio"]').attributes('data-voice-state')).toBe('pending')
  expect(wrapper.get('[name="nombre"]').attributes('data-voice-state')).toBeUndefined()
  expect(wrapper.get('label').text()).toBe('Precio')
  expect(wrapper.text()).toContain('Conflicto de moneda')
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('[name="precio"]').attributes('data-voice-state')).toBe('pending')
  await wrapper.get('[name="precio"]').setValue('450')
  expect(wrapper.get('[name="precio"]').attributes('data-voice-state')).toBe('edited')
  expect(wrapper.text()).not.toContain('Conflicto de moneda')
  wrapper.unmount()
})
