import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '@/app/stores/useSessionStore'
import { mount } from '@vue/test-utils'
import { proformasService } from '../services/proformasService'
import { useProformaPdf } from './useProformaPdf'

vi.mock('../services/proformasService', () => ({
  proformasService: { documentPdf: vi.fn<(id: number) => Promise<Blob>>() },
}))

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useProformaPdf', () => {
  it('mantiene el mismo Blob para las tres operaciones y libera su URL al cerrar', async () => {
    const expected = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' })
    vi.mocked(proformasService.documentPdf).mockResolvedValueOnce(expected)
    const create = vi.fn<() => string>(() => 'blob:http://localhost/homex-pdf')
    const revoke = vi.fn<(url: string) => void>()
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

describe('session-scoped proforma PDF', () => {
  it('revokes the previous seller document immediately when the session changes', async () => {
    const session = useSessionStore()
    session.identity = { id: 1, username: 'a', display_name: 'Seller A' }
    const expected = new Blob(['%PDF A'], { type: 'application/pdf' })
    vi.mocked(proformasService.documentPdf).mockResolvedValueOnce(expected)
    const revoke = vi.fn<(url: string) => void>()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: () => 'blob:seller-a',
    })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
    let pdf!: ReturnType<typeof useProformaPdf>
    const wrapper = mount(
      defineComponent({
        setup() {
          pdf = useProformaPdf()
          return () => h('div')
        },
      }),
    )
    await pdf.load(578)
    session.identity = { id: 2, username: 'b', display_name: 'Seller B' }
    expect(pdf.blob.value).toBeNull()
    expect(pdf.url.value).toBe('')
    expect(revoke).toHaveBeenCalledWith('blob:seller-a')
    wrapper.unmount()
  })

  it('discards a response from a logged-out session even before the view unmounts', async () => {
    const session = useSessionStore()
    session.identity = { id: 1, username: 'a', display_name: 'Seller A' }
    let resolve!: (blob: Blob) => void
    vi.mocked(proformasService.documentPdf).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
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
    const pending = pdf.load(578)
    session.logout()
    resolve(new Blob(['%PDF A'], { type: 'application/pdf' }))
    expect(await pending).toBeNull()
    expect(pdf.url.value).toBe('')
    wrapper.unmount()
  })
})
