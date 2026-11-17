import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductoForm from '@/modules/productos/components/ProductoForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'

afterEach(() => vi.restoreAllMocks())

function catalog() {
  vi.spyOn(proformasService, 'families').mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  })
  vi.spyOn(proformasService, 'options').mockImplementation(async (key) => {
    const entries: Record<string, Array<{ id: number; codigo: string; nombre: string }>> = {
      CATEGORIA_PRODUCTO: [
        { id: 1, codigo: 'SILLA', nombre: 'Silla' },
        { id: 2, codigo: 'PISO_FLOTANTE', nombre: 'Piso flotante' },
        { id: 3, codigo: 'OTRO', nombre: 'Otro' },
      ],
      COLOR: [{ id: 46, codigo: 'NEGRO', nombre: 'Negro' }],
      UNIDAD_MEDIDA: [
        { id: 4, codigo: 'PIEZA', nombre: 'Pieza' },
        { id: 5, codigo: 'M2', nombre: 'Metro cuadrado' },
        { id: 6, codigo: 'BARRA', nombre: 'Barra' },
      ],
    }
    return (entries[key] ?? []).map((item) => ({ ...item, concepto_codigo: key }))
  })
}
it('shows accepted commercial price reviews contextually and audits corrections without duplicates', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 42,
    fields: { nombre: 'Silla', precio_lista: '100' },
    text: 'Silla precio 100',
    warnings: ['Verifica el precio'],
    evidence: [
      {
        candidate_id: 'e1',
        label: 'precio_lista',
        start: 13,
        end: 16,
        text: '100',
        decision: 'ACCEPTED',
        normalized_value: '100',
      },
    ],
    field_reviews: [
      {
        review_id: 'price',
        code: 'COMMERCIAL_PRICE_REVIEW',
        severity: 'REVIEW',
        message: 'Verifica el precio',
        field: 'precio_lista',
        evidence_ids: ['e1'],
      },
    ],
  })
  await flushPromises()
  expect(w.get('[name="precio"]').attributes('data-voice-state')).toBe('pending')
  expect(w.text()).toContain('Verifica el precio')
  await w.get('[name="sku"]').setValue('SIL-NEW')
  await w.get('[name="precio"]').setValue('120')
  expect(w.get('[name="precio"]').attributes('data-voice-state')).toBe('edited')
  await w.get('form').trigger('submit')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as { revision_humana_voz: unknown[] }
  expect(body.revision_humana_voz).toEqual(
    (w.emitted('save')![1]![0] as typeof body).revision_humana_voz,
  )
  expect(body.revision_humana_voz).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        captura_asistida_id: 42,
        decisiones: expect.arrayContaining([
          expect.objectContaining({
            review_id: 'price',
            field: 'precio_lista',
            evidence_ids: ['e1'],
            estado: 'corregido',
            valor_original: '100',
            valor_final: '120',
          }),
        ]),
      }),
    ]),
  )
  await w.get('[name="precio"]').setValue('100')
  expect(w.get('[name="precio"]').attributes('data-voice-state')).toBe('pending')
  w.unmount()
})

it('audits nested specification corrections with accepted evidence only', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 43,
    fields: {
      nombre: 'Silla',
      precio_lista: '100',
      especificaciones: { material_respaldo: 'malla', apilable: true },
    },
    text: 'Silla de malla',
    warnings: [],
    field_reviews: [],
    evidence: [
      {
        candidate_id: 'rejected',
        label: 'especificaciones.material_respaldo',
        decision: 'REJECTED',
      },
      { candidate_id: 'bool', label: 'especificaciones.apilable', decision: 'ACCEPTED' },
      {
        candidate_id: 'accepted',
        label: 'especificaciones.material_respaldo',
        decision: 'ACCEPTED',
      },
    ],
  })
  await flushPromises()
  await w.get('[name="sku"]').setValue('NESTED-VOICE')
  const field = w.get('[name="especificaciones.material_respaldo"]')
  await field.setValue('PVC')
  await w.get('[id="voice-status-especificaciones.apilable"] button').trigger('click')
  expect(field.attributes('data-voice-state')).toBe('edited')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    revision_humana_voz: Array<{ decisiones: unknown[] }>
  }
  expect(body.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      review_id: 'field:especificaciones.material_respaldo',
      field: 'especificaciones.material_respaldo',
      evidence_ids: ['accepted'],
      estado: 'corregido',
      valor_original: 'malla',
      valor_final: 'PVC',
    }),
  )
  expect(body.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      field: 'especificaciones.apilable',
      estado: 'confirmado',
      valor_original: true,
      valor_final: true,
    }),
  )
  w.unmount()
})
it('never links rejected same-label candidates to a generic accepted suggestion decision', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 44,
    fields: { nombre: 'Silla', precio_lista: '100' },
    text: 'Silla precio 90 no 100',
    warnings: [],
    field_reviews: [],
    evidence: [
      { candidate_id: 'old', label: 'precio_lista', decision: 'REJECTED' },
      { candidate_id: 'new', label: 'precio_lista', decision: 'ACCEPTED' },
    ],
  })
  await flushPromises()
  await w.get('[name="sku"]').setValue('RECTIFIED-VOICE')
  await w.get('[name="precio"]').setValue('120')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    revision_humana_voz: Array<{ decisiones: Array<{ field: string; evidence_ids: string[] }> }>
  }
  expect(
    body.revision_humana_voz.flatMap((s) => s.decisiones).find((d) => d.field === 'precio_lista')
      ?.evidence_ids,
  ).toEqual(['new'])
  w.unmount()
})
it('confirms and corrects suggested multiline notes through the actual textarea', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'OTRO' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 45,
    fields: { nombre: 'Luminaria Aurora', precio_lista: '100', observaciones: 'Acabado mate' },
    text: 'Luminaria Aurora acabado mate',
    warnings: [],
    field_reviews: [],
    evidence: [],
  })
  await flushPromises()
  await w.get('[name="sku"]').setValue('NOTES-VOICE')
  await w.get('[name="unidad"]').setValue('6')
  const notes = w.get('textarea[name="observaciones"]')
  await w.get('#voice-status-observaciones button').trigger('click')
  expect(notes.attributes('data-voice-state')).toBe('reviewed')
  await notes.setValue('Acabado satinado')
  expect(notes.attributes('data-voice-state')).toBe('edited')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    revision_humana_voz: Array<{ decisiones: unknown[] }>
  }
  expect(body.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      field: 'observaciones',
      estado: 'corregido',
      valor_original: 'Acabado mate',
      valor_final: 'Acabado satinado',
    }),
  )
  w.unmount()
})

it('confirms an accepted mapped color select and persists its real evidence', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 46,
    fields: { nombre: 'Silla', precio_lista: '100', color_primario: 46 },
    text: 'Silla negra',
    warnings: [],
    field_reviews: [],
    evidence: [{ candidate_id: 'color', label: 'color_primario', decision: 'ACCEPTED' }],
  })
  await flushPromises()
  const color = w.get<HTMLSelectElement>('#color1')
  expect(color.element.value).toBe('46')
  expect(color.element.checkValidity()).toBe(true)
  await w.get('#voice-status-color1 button').trigger('click')
  expect(color.attributes('data-voice-state')).toBe('reviewed')
  await w.get('[name="sku"]').setValue('COLOR-VOICE')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    revision_humana_voz: Array<{ decisiones: unknown[] }>
  }
  expect(body.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      field: 'color_primario',
      estado: 'confirmado',
      evidence_ids: ['color'],
      valor_original: 46,
      valor_final: 46,
    }),
  )
  w.unmount()
})
it('preserves an absent NLP value as null when a seller completes the missing name', async () => {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 47,
    fields: { precio_lista: '100' },
    text: 'color negro precio 100',
    warnings: [],
    evidence: [],
    field_reviews: [
      {
        review_id: 'name',
        code: 'MISSING_NAME',
        severity: 'REVIEW',
        message: 'Completa el nombre',
        field: 'nombre',
        evidence_ids: [],
      },
    ],
  })
  await flushPromises()
  await w.get('[name="sku"]').setValue('MISSING-NAME-VOICE')
  await w.get('[name="nombre"]').setValue('  Silla ergonómica  ')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    revision_humana_voz: Array<{ decisiones: unknown[] }>
  }
  expect(body.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      review_id: 'name',
      field: 'nombre',
      estado: 'corregido',
      valor_original: null,
      valor_final: 'Silla ergonómica',
    }),
  )
  w.unmount()
})

async function legacyPriceReview() {
  catalog()
  const w = mount(ProductoForm, {
    props: { preselectCategory: 'SILLA' },
    global: { stubs: { CapturaCatalogo: true } },
  })
  await flushPromises()
  await w.get('.voice-trigger').trigger('click')
  w.findComponent({ name: 'CapturaCatalogo' }).vm.$emit('applied', {
    capture_id: 48,
    fields: { nombre: 'Silla', precio_lista: '100' },
    text: 'Silla precio 100',
    warnings: ['Confirmar precio comercial', 'Aviso informativo general'],
    evidence: [
      {
        candidate_id: 'price-legacy',
        label: 'precio_lista',
        decision: 'UNRESOLVED',
        reason: 'Confirmar precio comercial',
      },
    ],
  })
  await flushPromises()
  return w
}
it('maps legacy warning strings only once to their actual evidence field', async () => {
  const w = await legacyPriceReview()
  expect(w.text().split('Confirmar precio comercial').length - 1).toBe(1)
  await w.get('#voice-status-precio button').trigger('click')
  expect(w.text()).not.toContain('Confirmar precio comercial')
  expect(w.text()).toContain('Aviso informativo general')
  w.unmount()
})
it('clears the voice-only blocking alert immediately after the last critical field is resolved', async () => {
  const w = await legacyPriceReview()
  await w.get('form').trigger('submit')
  expect(w.get('[role="alert"]').text()).toContain('antes de guardar el producto')
  await w.get('#voice-status-precio button').trigger('click')
  expect(
    w
      .findAll('[role="alert"]')
      .some((alert) => alert.text().includes('antes de guardar el producto')),
  ).toBe(false)
  expect(w.get('[name="precio"]').attributes('data-voice-state')).toBe('reviewed')
  w.unmount()
})
