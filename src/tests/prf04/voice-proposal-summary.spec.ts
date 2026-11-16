import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import ProposalSummary from '@/modules/capturas/components/ProposalSummary.vue'
import type { ResultadoCatalogo } from '@/generated/api'
import { captura24 } from '../fixtures/captura24'
it('shows commercial catalog attributes and real option names, not JSON or invented empty attributes', () => {
  const result = {
    categoria: 'SILLA',
    propuesta: {
      fields: {
        nombre: 'Silla plegable',
        marca: 7,
        precio_lista: '450.00',
        modelo: null,
        especificaciones: { respaldo: 'Malla' },
      },
      evidence: [],
      warnings: [],
    },
  } as unknown as ResultadoCatalogo
  const w = mount(ProposalSummary, {
    props: {
      result,
      evidence: [{ label: 'precio_lista', start: 0, end: 3, text: '450', decision: 'UNRESOLVED' }],
      options: { MARCA: [{ id: 7, nombre: 'Marca real' } as never] },
    },
  })
  expect(w.text()).toContain('Marca real')
  expect(w.text()).toContain('Silla plegable')
  expect(w.text()).toContain('Malla')
  expect(w.find('pre').exists()).toBe(false)
  expect(w.text()).toContain('Requiere revisión')
  expect(w.findAll('dt').map((dt) => dt.text())).not.toContain('Modelo')
})
it('groups furniture quantities and measurements and marks an actual missing unit', () => {
  const w = mount(ProposalSummary, { props: { result: captura24, evidence: [], currency: 'BOB' } })
  expect(w.text()).toContain('Producto y condiciones comerciales')
  expect(w.text()).toContain('Escritorio')
  expect(w.text()).toContain('Medidas reconocidas')
  expect(w.text()).toContain('120')
  expect(w.text()).toContain('75 cm')
  expect(w.text()).toContain('Requiere revisión')
  expect(w.text()).not.toContain('tipo_mueble')
  expect(w.find('pre').exists()).toBe(false)
})
