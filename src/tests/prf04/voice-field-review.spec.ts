import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import {
  vVoiceFields,
  appendVoiceAudit,
  humanVoiceDecision,
  type FieldVoiceReview,
} from '@/modules/capturas/fieldVoiceReview'
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
it('does not confirm invalid controls and reports clearing a reviewed field', async () => {
  const resolve = vi.fn<(field: string, edited: boolean) => void>()
  const component = defineComponent({
    directives: { voiceFields: vVoiceFields },
    setup: () => ({
      resolve,
      fields: [
        { field: 'cantidad', state: 'pending', reason: 'Cantidad inválida', critical: true },
      ],
    }),
    template:
      '<form v-voice-fields="{ fields, resolve }"><label>Cantidad<input name="cantidad" type="number" min="1" step="1" value="-1" /></label></form>',
  })
  const w = mount(component)
  await w.get('button').trigger('click')
  expect(resolve).not.toHaveBeenCalled()
  await w.get('input').setValue('')
  expect(resolve).toHaveBeenLastCalledWith('cantidad', true)
  w.unmount()
})
it('highlights an action without offering a false value confirmation', () => {
  const component = defineComponent({
    directives: { voiceFields: vVoiceFields },
    setup: () => ({
      resolve: vi.fn<(field: string, edited: boolean) => void>(),
      fields: [{ field: 'create', state: 'pending', reason: 'Crear medida', critical: true }],
    }),
    template:
      '<form v-voice-fields="{fields, resolve}"><button id="create" type="button">Agregar medida</button></form>',
  })
  const w = mount(component)
  expect(w.get('#create').attributes('data-voice-state')).toBe('pending')
  expect(w.text()).toContain('Crear medida')
  expect(w.findAll('button')).toHaveLength(1)
  w.unmount()
})

it('records distinct reversions while deduplicating unchanged saves across JSON roundtrips', () => {
  let history: unknown = []
  const save = (value: string, capture = 17) => {
    history = appendVoiceAudit(history, {
      captura_asistida_id: capture,
      decisiones: [
        humanVoiceDecision(capture, {
          review_id: 'price',
          field: 'precio_lista',
          evidence_ids: ['accepted'],
          estado: 'corregido',
          valor_original: 'A',
          valor_final: value,
        }),
      ],
    })
    return JSON.stringify(history)
  }
  const first = save('B')
  expect(save('B')).toBe(first)
  save('C')
  save('B')
  const entries = history as Array<{
    decisiones: Array<{ decision_id: string; valor_final: string }>
  }>
  expect(entries.flatMap((e) => e.decisiones.map((d) => d.valor_final))).toEqual(['B', 'C', 'B'])
  expect(new Set(entries.flatMap((e) => e.decisiones.map((d) => d.decision_id))).size).toBe(3)
  history = JSON.parse(JSON.stringify(history))
  const repeated = JSON.stringify(history)
  expect(save('B')).toBe(repeated)
  save('B', 18)
  expect(history as unknown[]).toHaveLength(4)
})
it('marks completed voice fields in green without confirmation button and preserves pending confirmation controls across blur', async () => {
  const component = defineComponent({
    directives: { voiceFields: vVoiceFields },
    setup() {
      const fields = ref<FieldVoiceReview[]>([
        { field: 'color1', state: 'pending', reason: 'Confirmar color', critical: false },
        { field: 'nombre', state: 'suggested', reason: '', critical: false },
      ])
      return {
        fields,
        refresh: () => {
          fields.value = fields.value.map((field) => ({ ...field }))
        },
        resolve: (fieldName: string) => {
          fields.value = fields.value.map((field) =>
            field.field === fieldName ? { ...field, state: 'reviewed' } : field,
          )
        },
      }
    },
    template:
      '<form v-voice-fields="{fields,resolve}"><input name="price" @change="refresh" /><input name="nombre" value="Silla" /><label>Color<select name="color1"><option value="46">Black</option></select></label></form>',
  })
  const w = mount(component)
  expect(w.get('[name="nombre"]').attributes('data-voice-state')).toBe('suggested')
  expect(w.find('#voice-status-nombre button').exists()).toBe(false)
  const confirmation = w.get('#voice-status-color1 button').element
  await w.get('[name="price"]').trigger('change')
  expect(w.get('#voice-status-color1 button').element).toBe(confirmation)
  await w.get('#voice-status-color1 button').trigger('click')
  expect(w.get('[name="color1"]').attributes('data-voice-state')).toBe('reviewed')
  w.unmount()
})
