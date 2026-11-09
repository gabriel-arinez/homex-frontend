import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { proformasService } from '../services/proformasService'
import { useProformaPdf } from './useProformaPdf'

vi.mock('../services/proformasService', () => ({
  proformasService: { documentPdf: vi.fn() },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useProformaPdf', () => {
  it('mantiene el mismo Blob para las tres operaciones y libera su URL al cerrar', async () => {
    const expected = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' })
    vi.mocked(proformasService.documentPdf).mockResolvedValueOnce(expected)
    const create = vi.fn(() => 'blob:http://localhost/homex-pdf')
    const revoke = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })

    let pdf!: ReturnType<typeof useProformaPdf>
    const Probe = defineComponent({
      setup() {
        pdf = useProformaPdf()
        return () => h('div')
      },
    })
    const wrapper = mount(Probe)
    expect(await pdf.load(578)).toBe(expected)
    expect(pdf.blob.value).toBe(expected)
    expect(pdf.url.value).toBe('blob:http://localhost/homex-pdf')
    expect(proformasService.documentPdf).toHaveBeenCalledWith(578)
    pdf.clear()
    expect(pdf.blob.value).toBeNull()
    expect(revoke).toHaveBeenCalledWith('blob:http://localhost/homex-pdf')
    wrapper.unmount()
  })

  it('rechaza respuestas que no son PDF sin ofrecer un documento falso', async () => {
    vi.mocked(proformasService.documentPdf).mockResolvedValueOnce(
      new Blob(['error'], { type: 'text/html' }),
    )
    let pdf!: ReturnType<typeof useProformaPdf>
    const wrapper = mount(
      defineComponent({
        setup() {
          pdf = useProformaPdf()
          return () => h('div')
        },
      }),
    )
    expect(await pdf.load(578)).toBeNull()
    expect(pdf.url.value).toBe('')
    expect(pdf.error.value).toContain('PDF válido')
    wrapper.unmount()
  })
})
