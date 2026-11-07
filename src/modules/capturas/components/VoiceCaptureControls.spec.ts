import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VoiceCaptureControls from './VoiceCaptureControls.vue'

describe('Controles de voz compartidos HOMEX', () => {
  it('ofrece los dos orígenes con el diseño comercial y sin herramientas de grabación', async () => {
    const wrapper = mount(VoiceCaptureControls, {
      props: { recording: false, paused: false },
    })
    expect(wrapper.find('.source-record').exists()).toBe(true)
    expect(wrapper.find('.voice-upload').exists()).toBe(true)
    expect(wrapper.get('.source-record').text()).toContain('Máximo 3 minutos')
    expect(wrapper.get('.voice-upload').text()).toContain('Hasta 20 MB y 5 minutos')
    expect(wrapper.find('.voice-live').exists()).toBe(false)
    await wrapper.get('.source-record').trigger('click')
    await wrapper.get('.voice-upload').trigger('click')
    expect(wrapper.emitted('record')).toHaveLength(1)
    expect(wrapper.emitted('upload')).toHaveLength(1)
    wrapper.unmount()
  })

  it('oculta los botones grandes mientras graba, permite pausar y finalizar', async () => {
    const wrapper = mount(VoiceCaptureControls, {
      props: { recording: true, paused: false },
      slots: { recorder: '<div class="fake-recorder">Grabando 00:07 / 03:00</div>' },
    })
    expect(wrapper.find('.voice-source-actions').exists()).toBe(false)
    expect(wrapper.get('.fake-recorder').text()).toContain('00:07')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('pause')).toHaveLength(1)
    await wrapper.get('button[aria-label="Finalizar grabación"]').trigger('click')
    expect(wrapper.emitted('finish')).toHaveLength(1)
    await wrapper.get('button[aria-label="Cancelar grabación"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    await wrapper.setProps({ paused: true })
    expect(wrapper.text()).toContain('Reanudar')
    expect(wrapper.text()).not.toContain('Pausar')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('resume')).toHaveLength(1)
    wrapper.unmount()
  })

  it('impide iniciar captura o cargar archivos mientras está procesando', () => {
    const wrapper = mount(VoiceCaptureControls, {
      props: { recording: false, paused: false, disabled: true },
    })
    expect(wrapper.get('.source-record').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.voice-upload').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
