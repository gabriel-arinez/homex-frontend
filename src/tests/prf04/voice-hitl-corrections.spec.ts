import { reactive } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { PendienteAsistida } from '@/generated/api'
import EspecificacionForm from '@/modules/proformas/components/EspecificacionForm.vue'
import { proformasService } from '@/modules/proformas/services/proformasService'
import { pendienteResuelto } from '@/modules/proformas/services/pendientesAsistencia'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
const pending = (
  codigo: string,
  resolucion?: PendienteAsistida['resolucion'],
): PendienteAsistida => ({
  codigo,
  mensaje: `Revisar ${codigo}`,
  ruta: '',
  ...(resolucion ? { resolucion } : {}),
})
async function form(
  pendientes: PendienteAsistida[],
  datos: object = {},
  studio = false,
  captureId: number | null = 42,
  initialPrice = '100',
) {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const w = mount(EspecificacionForm, {
    attachTo: document.body,
    props: {
      tipos: [],
      studio,
      voiceCaptureId: captureId ?? undefined,
      activeSection: 'revision',
      pendientesAsistencia: pendientes,
      unidades: [{ id: 1, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' }],
      detalle: { nombre: 'Mesa', cantidad: '1', precio_unitario: initialPrice, unidad: 1 },
      especificacion: {
        id: 0,
        proforma_detalle: 0,
        tipo_mueble: null,
        tipo_mueble_info: null,
        observaciones: null,
        datos_tecnicos: datos,
      },
    },
  })
  await flushPromises()
  return w
}
it('does not resolve removed components or invalid typed attribute values', () => {
  const component = pending('CONFLICTING_VALUES', {
    tipo: 'COMPONENTE',
    uid: 'tablero',
    campo: 'material',
  })
  expect(pendienteResuelto(component, [], [], [])).toBe(false)
  const attr = pending('CONFLICTING_VALUES', { tipo: 'ATRIBUTO_GENERAL', clave: 'cantidad' })
  expect(
    pendienteResuelto(attr, [], [], [{ nombre: 'Cantidad', valor: '-1', tipo_entrada: 'entero' }]),
  ).toBe(false)
  expect(
    pendienteResuelto(attr, [], [], [{ nombre: 'Cantidad', valor: '2', tipo_entrada: 'entero' }]),
  ).toBe(true)
})
it('keeps fractional quantities pending and reopens after reverting a correction', async () => {
  const w = await form([pending('NO_QUANTITY')])
  await w.get('[name="mueble-cantidad"]').setValue('1.5')
  expect(w.get('aside.pending-summary').text()).toContain('NO_QUANTITY')
  await w.get('[name="mueble-cantidad"]').setValue('2')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await w.get('[name="mueble-cantidad"]').setValue('0')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})
it('routes missing axes to real dimension controls without resolving by confirmation', async () => {
  const w = await form(
    [pending('MISSING_AXIS', { tipo: 'DIMENSIONES_NUEVAS', cantidad: 2 })],
    {},
    true,
  )
  await w.get('.pending-card__footer button').trigger('click')
  expect(w.emitted('requestSection')?.slice(-1)[0]).toEqual(['general'])
  await w.setProps({ activeSection: 'general' })
  await flushPromises()
  expect(document.activeElement).toBe(w.get('[name="ancho"]').element)
  await w.get('[name="ancho"]').setValue('100')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  await w.get('[name="alto"]').setValue('75')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await w.get('[name="alto"]').setValue('')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})
it('creates a real general conflict control and focuses it in the studio', async () => {
  const w = await form(
    [pending('CONFLICTING_VALUES', { tipo: 'ATRIBUTO_GENERAL', clave: 'material' })],
    {},
    true,
  )
  await w.get('.pending-card__footer button').trigger('click')
  await w.setProps({ activeSection: 'general' })
  await flushPromises()
  const control = w.get('[name="general-0"]')
  expect(document.activeElement).toBe(control.element)
  expect(control.attributes('data-voice-state')).toBe('pending')
  await control.setValue('Melamina')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await control.setValue('')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})
it('routes a component conflict to its actual selected piece', async () => {
  const w = await form(
    [pending('CONFLICTING_VALUES', { tipo: 'COMPONENTE', uid: 'b', campo: 'material' })],
    {
      componentes: [
        { uid: 'a', nombre: 'Pata' },
        { uid: 'b', nombre: 'Tablero' },
      ],
    },
    true,
  )
  await w.get('.pending-card__footer button').trigger('click')
  await w.setProps({ activeSection: 'estructura' })
  await flushPromises()
  expect(document.activeElement).toBe(w.get('[name="componente-material-1"]').element)
  expect(w.get('[name="componente-material-1"]').isVisible()).toBe(true)
  await w.get('[name="componente-material-1"]').setValue('Madera')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  w.unmount()
})
it('allows valid manual saving with informative warnings still visible', async () => {
  const w = await form([pending('INFORMATIVE_NOTE')])
  await w.get('form').trigger('submit')
  expect(w.emitted('save')).toHaveLength(1)
  expect(w.get('aside.pending-summary').text()).toContain('INFORMATIVE_NOTE')
  w.unmount()
})
it('discards only an explicitly selected pending with a nonempty reason and keeps original evidence', async () => {
  const original = pending('CONFLICTING_VALUES')
  const w = await form([
    original,
    pending('MISSING_AXIS', { tipo: 'DIMENSIONES_NUEVAS', cantidad: 1 }),
  ])
  const reason = w.get('[name="descarte-0"]')
  const discard = w.findAll('aside button').find((b) => b.text() === 'Descartar observación')!
  await discard.trigger('click')
  expect(w.get('aside.pending-summary').text()).toContain('CONFLICTING_VALUES')
  await reason.setValue('No corresponde a este mueble')
  await discard.trigger('click')
  expect(w.get('aside.pending-summary').text()).not.toContain('CONFLICTING_VALUES')
  expect(w.get('aside.pending-summary').text()).toContain('MISSING_AXIS')
  expect(original).toEqual(pending('CONFLICTING_VALUES'))
  expect(w.text()).toContain('No corresponde a este mueble')
  w.unmount()
})
it('assigns thickness only to an explicit compatible component and reopens on later edits', async () => {
  const w = await form(
    [pending('ESPESOR_SIN_COMPONENTE', { tipo: 'ESPESOR_SIN_COMPONENTE', valor: '18 mm' })],
    { componentes: [{ uid: 'a', nombre: 'Tablero', espesor: '12 mm' }] },
  )
  await w.get('aside select').setValue('a')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Asignar espesor')!
    .trigger('click')
  expect(w.get('aside.pending-summary').text()).toContain('ESPESOR_SIN_COMPONENTE')
  await w.get('[name="componente-espesor-0"]').setValue('')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Asignar espesor')!
    .trigger('click')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await w.get('[name="componente-espesor-0"]').setValue('12 mm')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})

it('persists the original pending separately from the explicit discard and preserves prior audit', async () => {
  const original = pending('CONFLICTING_VALUES')
  const w = await form([original], { revision_humana_voz: [{ previous: true }] })
  await w.get('[name="descarte-0"]').setValue('No corresponde a este mueble')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Descartar observación')!
    .trigger('click')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')?.[0]?.[0] as { datos_tecnicos: { revision_humana_voz: unknown[] } }
  expect(body.datos_tecnicos.revision_humana_voz).toMatchObject([
    { previous: true },
    {
      captura_asistida_id: 42,
      pendientes_originales: [original],
      asignaciones_espesor: [],
      descartes: [
        {
          indice: 0,
          pendiente_original: original,
          motivo: 'No corresponde a este mueble',
          accion_humana: 'descartado',
        },
      ],
    },
  ])
  w.unmount()
  const reopened = await form([original], body.datos_tecnicos)
  expect(reopened.find('aside.pending-summary').exists()).toBe(false)
  await reopened.setProps({ voiceCaptureId: 43 })
  expect(reopened.find('aside.pending-summary').exists()).toBe(true)
  reopened.unmount()
  const untrusted = await form([original], body.datos_tecnicos, false, null)
  expect(untrusted.find('aside.pending-summary').exists()).toBe(true)
  untrusted.unmount()
  const different = await form(
    [pending('CONFLICTING_VALUES', { tipo: 'DIMENSION', clave: 'ancho' })],
    body.datos_tecnicos,
  )
  expect(different.find('aside.pending-summary').exists()).toBe(true)
  different.unmount()
})
it('creates missing dimension keys from typed backend metadata and keeps invalid prices pending', async () => {
  const w = await form([
    pending('MISSING_UNIT', { tipo: 'DIMENSION', clave: 'largo' }),
    pending('INVALID_PRICE'),
  ])
  expect(w.find('[name="largo"]').exists()).toBe(true)
  await w.get('[name="largo"]').setValue('150')
  await w.get('#unidad-largo').setValue('cm')
  await w.get('[name="mueble-precio"]').setValue('-10')
  expect(w.get('aside.pending-summary').text()).toContain('INVALID_PRICE')
  await w.get('form').trigger('submit')
  expect(w.emitted('save')).toBeUndefined()
  await w.get('[name="mueble-precio"]').setValue('100')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await w.get('form').trigger('submit')
  expect(w.emitted('save')).toHaveLength(1)
  w.unmount()
})

it('keeps actual studio navigation from stealing focus back from the requested field', async () => {
  vi.spyOn(proformasService, 'furnitureAttributes').mockResolvedValue({
    atributos: [],
    limites: { max_conjuntos: 10, max_componentes: 40 },
  })
  const { default: MuebleStudio } = await import('@/modules/proformas/components/MuebleStudio.vue')
  const w = mount(MuebleStudio, {
    attachTo: document.body,
    props: {
      nueva: true,
      initialSection: 'revision',
      formVersion: 1,
      dirty: false,
      sesion: 'test-studio-focus',
      moneda: 'BOB',
      tipos: [],
      unidades: [],
      voiceCaptureId: 42,
      pendientesAsistencia: [
        pending('CONFLICTING_VALUES', { tipo: 'COMPONENTE', uid: 'b', campo: 'material' }),
      ],
      especificacion: {
        id: 0,
        proforma_detalle: 0,
        tipo_mueble_info: null,
        datos_tecnicos: {
          componentes: [
            { uid: 'a', nombre: 'Pata' },
            { uid: 'b', nombre: 'Tablero' },
          ],
        },
      },
    },
    global: { stubs: { ImageGallery: true, CapturaAsistida: true } },
  })
  await flushPromises()
  await w.get('.pending-card__footer button').trigger('click')
  await flushPromises()
  const control = w.get('[name="componente-material-1"]')
  expect(control.isVisible()).toBe(true)
  expect(document.activeElement).toBe(control.element)
  w.unmount()
})

it('discards reactive backend pending metadata without cloning Vue proxies', async () => {
  const original = reactive(pending('CONFLICTING_VALUES', { tipo: 'DIMENSION', clave: 'ancho' }))
  const w = await form([original])
  await w.get('[name="descarte-0"]').setValue('La medida no corresponde a este mueble')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Descartar observación')!
    .trigger('click')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  expect(original.resolucion).toEqual({ tipo: 'DIMENSION', clave: 'ancho' })
  w.unmount()
})
it('deduplicates unchanged saved human decisions after reopening', async () => {
  const original = pending('CONFLICTING_VALUES')
  const w = await form([original])
  await w.get('[name="descarte-0"]').setValue('No corresponde')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Descartar observación')!
    .trigger('click')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as { datos_tecnicos: { revision_humana_voz: unknown[] } }
  w.unmount()
  const reopened = await form([original], body.datos_tecnicos)
  await reopened.get('form').trigger('submit')
  const again = reopened.emitted('save')![0]![0] as typeof body
  expect(again.datos_tecnicos.revision_humana_voz).toEqual(body.datos_tecnicos.revision_humana_voz)
  reopened.unmount()
})
it('records ordinary corrected fields as evidence-linked human decisions', async () => {
  const original = pending('MISSING_UNIT', { tipo: 'DIMENSION', clave: 'ancho' })
  const w = await form([original])
  await w.get('[name="ancho"]').setValue('100')
  await w.get('#unidad-ancho').setValue('cm')
  await w.get('form').trigger('submit')
  const body = w.emitted('save')![0]![0] as {
    datos_tecnicos: { revision_humana_voz: Array<{ decisiones: unknown[] }> }
  }
  expect(
    body.datos_tecnicos.revision_humana_voz[body.datos_tecnicos.revision_humana_voz.length - 1]
      ?.decisiones,
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        review_id: 'pending:0',
        field: 'ancho',
        estado: 'corregido',
        valor_final: { valor: '100', unidad: 'cm' },
      }),
    ]),
  )
  w.unmount()
})
it('requires confirmation or a real correction for an already populated conflict and reopens on reversal', async () => {
  const w = await form(
    [pending('CONFLICTING_VALUES', { tipo: 'COMPONENTE', uid: 'b', campo: 'material' })],
    { componentes: [{ uid: 'b', nombre: 'Tablero', material: 'Madera' }] },
  )
  const control = w.get('[name="componente-material-0"]')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  await control.setValue('Melamina')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await control.setValue('Madera')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})
it('cannot discard mandatory invalid commercial quantities', async () => {
  const w = await form([pending('NO_QUANTITY')])
  await w.get('[name="mueble-cantidad"]').setValue('0')
  await w.get('[name="descarte-0"]').setValue('No corresponde')
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Descartar observación')!
    .trigger('click')
  expect(w.get('aside.pending-summary').text()).toContain('NO_QUANTITY')
  await w.get('form').trigger('submit')
  expect(w.emitted('save')).toBeUndefined()
  w.unmount()
})
it('audits an explicitly corrected custom suggestion and keeps later corrections in history', async () => {
  const w = await form([])
  await w.setProps({ voiceSuggestedFields: ['mueble-precio'] })
  await w.get('[name="mueble-precio"]').setValue('120')
  await w.get('form').trigger('submit')
  await w.get('[name="mueble-precio"]').setValue('130')
  await w.get('form').trigger('submit')
  await w.get('form').trigger('submit')
  const bodies = w.emitted('save')!.map(
    (event) =>
      event[0] as {
        datos_tecnicos: {
          revision_humana_voz: Array<{
            decisiones: Array<{ field: string; valor_final: string }>
          }>
        }
      },
  )
  expect(bodies[0]!.datos_tecnicos.revision_humana_voz[0]!.decisiones[0]).toMatchObject({
    field: 'precio_unitario',
    valor_final: '120',
  })
  expect(bodies[1]!.datos_tecnicos.revision_humana_voz).toHaveLength(2)
  expect(bodies[2]!.datos_tecnicos.revision_humana_voz).toEqual(
    bodies[1]!.datos_tecnicos.revision_humana_voz,
  )
  await w.get('[name="mueble-precio"]').setValue('100')
  expect(w.get('[name="mueble-precio"]').attributes('data-voice-state')).toBe('suggested')
  w.unmount()
})
it('keeps the pending component target after reordering and does not transfer it after removal', async () => {
  const w = await form(
    [pending('CONFLICTING_VALUES', { tipo: 'COMPONENTE', uid: 'b', campo: 'material' })],
    {
      componentes: [
        { uid: 'a', nombre: 'Pata', material: 'Acero' },
        { uid: 'b', nombre: 'Tablero', material: 'Madera' },
      ],
    },
  )
  await w
    .findAll('.component-editor')[1]!
    .findAll('button')
    .find((b) => b.text().includes('Subir'))!
    .trigger('click')
  expect(w.get('[name="componente-material-0"]').attributes('data-voice-state')).toBe('pending')
  expect(w.get('[name="componente-material-1"]').attributes('data-voice-state')).toBeUndefined()
  await w.get('[name="componente-material-0"]').setValue('Melamina')
  expect(w.find('aside.pending-summary').exists()).toBe(false)
  await w
    .findAll('.component-editor')[0]!
    .findAll('button')
    .find((b) => b.text() === 'Quitar')!
    .trigger('click')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  expect(w.get('[name="componente-material-0"]').attributes('data-voice-state')).toBeUndefined()
  expect(w.get('#nuevo-componente').attributes('data-voice-state')).toBe('pending')
  w.unmount()
})
it('focuses the editable creation control when all existing dimensions are already populated', async () => {
  const w = await form([pending('MISSING_AXIS', { tipo: 'DIMENSIONES_NUEVAS', cantidad: 1 })], {
    caracteristicas_generales: {
      dimensiones: {
        ancho: { valor: '100', unidad: 'cm' },
        alto: { valor: '75', unidad: 'cm' },
        profundidad: { valor: '60', unidad: 'cm' },
      },
    },
  })
  await w
    .findAll('aside button')
    .find((b) => b.text() === 'Revisar medidas')!
    .trigger('click')
  expect(document.activeElement).toBe(w.get('[aria-label="Nueva medida"]').element)
  expect(w.get('#agregar-medida').attributes('data-voice-state')).toBe('pending')
  expect(w.find('aside.pending-summary').exists()).toBe(true)
  w.unmount()
})

it('audits a missing negotiated unit price as null, not an empty form placeholder', async () => {
  const w = await form([pending('TOTAL_NEGOCIADO')], {}, false, 42, '')
  await w.get('[name="mueble-precio"]').setValue('100')
  await w.get('form').trigger('submit')
  const saved = w.emitted('save')![0]![0] as {
    datos_tecnicos: { revision_humana_voz: Array<{ decisiones: unknown[] }> }
  }
  expect(saved.datos_tecnicos.revision_humana_voz.flatMap((s) => s.decisiones)).toContainEqual(
    expect.objectContaining({
      field: 'precio_unitario',
      estado: 'corregido',
      valor_original: null,
      valor_final: '100',
    }),
  )
  w.unmount()
})
