import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { audioExtension, capturasService } from '@/modules/capturas/services/capturasService'
import { pythonSpanToUtf16 } from '@/modules/capturas/evidence'
import CapturaDetailView from '@/modules/capturas/views/CapturaDetailView.vue'
import AudioRecorder from '@/modules/capturas/components/AudioRecorder.vue'
import { server } from '@/tests/msw/server'
const item = {
  id: 20,
  nombre: 'Escritorio',
  espesor: { espesor: '18 mm' },
  color_principal: 'Negro',
  color_secundario: null,
  dimensiones: { ancho: '1.20 m' },
  accesorios: ['cajón'],
  cantidad: 3,
  precio_total: '100.00',
  observaciones: null,
}
const capture = (extra = {}) => ({
  id: 1,
  proforma: 4,
  proforma_detalle: null,
  estado: 'COMPLETADA',
  texto_transcrito: 'tres escritorios por cien',
  intento_id: 8,
  item_ia: item,
  incorporada: false,
  confirmada: false,
  ...extra,
})
const opts = {
  TIPO_ITEM: [
    { id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida', concepto_codigo: 'TIPO_ITEM' },
  ],
  UNIDAD_MEDIDA: [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' }],
  TIPO_MUEBLE: [
    { id: 3, codigo: 'ESCRITORIO', nombre: 'Escritorio', concepto_codigo: 'TIPO_MUEBLE' },
  ],
}
function common(value = capture()) {
  server.use(
    http.get('http://localhost:8000/api/v1/catalogo/opciones/', ({ request }) =>
      HttpResponse.json(
        opts[new URL(request.url).searchParams.get('concepto') as keyof typeof opts] ?? [],
      ),
    ),
    http.get('http://localhost:8000/api/v1/capturas/1/', () => HttpResponse.json(value)),
  )
}
async function view() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/capturas/:id', component: CapturaDetailView },
      { path: '/capturas', component: { template: '<div/>' } },
    ],
  })
  await router.push('/capturas/1')
  await router.isReady()
  return mount(CapturaDetailView, { global: { plugins: [router], stubs: { Teleport: true } } })
}
describe('FE06 capturas y HITL', () => {
  it('usa una extensión coherente con el MIME real del grabador', () => {
    expect(audioExtension('audio/ogg;codecs=opus')).toBe('ogg')
    expect(audioExtension('audio/webm;codecs=opus')).toBe('webm')
  })
  it('muestra el estado pendiente mientras continúa el polling', async () => {
    common(capture({ estado: 'PENDIENTE', item_ia: null, intento_id: 8 }))
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('Procesando captura')
    expect(w.text()).toContain('consultando cambios automáticamente')
    w.unmount()
  })
  it('convierte offsets Python a UTF-16 sin alterar evidencia', () => {
    expect(pythonSpanToUtf16('A😀 mesa', 1, 2)).toEqual({ start: 1, end: 3 })
  })
  it('envía audio multipart sin fijar Content-Type manualmente', async () => {
    let init: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
        init = options
        return new Response(
          JSON.stringify({
            id: 1,
            estado: 'PENDIENTE',
            intento_id: 8,
            numero_intento: 1,
            reutilizada: false,
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        )
      }),
    )
    await capturasService.createAudio({
      clave_idempotencia: '11111111-1111-4111-8111-111111111111',
      proforma: 4,
      audio: new Blob(['voice'], { type: 'audio/webm' }),
      filename: 'voz.webm',
    })
    const request = init as RequestInit
    expect(request.body).toBeInstanceOf(FormData)
    expect(new Headers(request.headers).has('Content-Type')).toBe(false)
    expect((request.body as FormData).get('audio')).toBeInstanceOf(File)
    vi.unstubAllGlobals()
  })
  it('representa REQUIRES_REVIEW y conserva original separado del formulario', async () => {
    common()
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('Propuesta IA · requiere revisión')
    expect(w.text()).toContain('tres escritorios por cien')
    expect(w.get('#nombre').element).toHaveProperty('value', 'Escritorio')
  })
  it('representa NO_PROPOSAL sin inventar propuesta', async () => {
    common(capture({ item_ia: null }))
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('Sin propuesta')
    expect(w.find('form').exists()).toBe(false)
  })
  it('representa ERROR y no ofrece reintento inexistente', async () => {
    common(capture({ estado: 'ERROR', item_ia: null }))
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('No se pudo procesar')
    expect(w.text()).toContain('contrato actual no publica una acción de reintento')
  })
  it('confirma sólo corrección humana y total negociado exacto', async () => {
    common()
    let body: Record<string, unknown> = {}
    server.use(
      http.post('http://localhost:8000/api/v1/capturas/1/confirmar/', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          {
            captura_id: 1,
            detalle_id: 30,
            item_humano_id: 31,
            evaluacion_id: 32,
            proforma_estado: 'BORRADOR',
          },
          { status: 201 },
        )
      }),
    )
    const w = await view()
    await flushPromises()
    await w.get('#unitario').setValue('33.34')
    await w.get('form').trigger('submit')
    await w
      .findAll('button')
      .find((x) => x.text() === 'Confirmar revisión')
      ?.trigger('click')
    await flushPromises()
    expect(body).not.toHaveProperty('original_ia')
    expect(body).toMatchObject({
      intento_id: 8,
      item_ia_id: 20,
      linea_comercial: {
        modo_calculo: 'PRECIO_UNITARIO',
        precio_unitario: '33.34',
        datos_tecnicos: {
          componentes: [],
        },
      },
    })
  })
  it('bloquea una captura ya confirmada', async () => {
    common(capture({ confirmada: true, proforma_detalle: 30 }))
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('ya fue confirmada')
    expect(w.find('form').exists()).toBe(false)
  })
  it('explica permiso de micrófono denegado y conserva la alternativa', async () => {
    const getUserMedia = vi
      .fn<() => Promise<MediaStream>>()
      .mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    })
    class Recorder {
      static isTypeSupported() {
        return true
      }
      constructor(_stream: MediaStream) {}
    }
    vi.stubGlobal('MediaRecorder', Recorder)
    const w = mount(AudioRecorder)
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Permiso de micrófono denegado')
    vi.unstubAllGlobals()
  })
  it('cancela una grabación local y detiene sus pistas sin enviar', async () => {
    const stopTrack = vi.fn<() => void>()
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi
          .fn<() => Promise<MediaStream>>()
          .mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream),
      },
      configurable: true,
    })
    class Recorder {
      static isTypeSupported() {
        return true
      }
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable: null | ((e: { data: Blob }) => void) = null
      onstop: null | (() => void) = null
      constructor(_stream: MediaStream) {}
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    vi.stubGlobal('MediaRecorder', Recorder)
    const w = mount(AudioRecorder)
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Grabando')
    await w
      .findAll('button')
      .find((x) => x.text() === 'Cancelar')
      ?.trigger('click')
    expect(stopTrack).toHaveBeenCalled()
    const ready = w.emitted('ready') ?? []
    expect(ready[ready.length - 1]?.[0]).toBeNull()
    vi.unstubAllGlobals()
  })
  it('explica MediaRecorder no soportado', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    const w = mount(AudioRecorder)
    expect(w.get('button').attributes('disabled')).toBeDefined()
    vi.unstubAllGlobals()
  })
})

const scopedProjection = () => ({
  comercial: {
    nombre: 'Escritorios',
    cantidad: 2,
    unidad_codigo: 'PIEZA',
    precio_unitario: '1900.00' as string | null,
    descuento: null as string | null,
  },
  especificacion: {
    tipo_mueble: null,
    observaciones: null,
    datos_tecnicos: {
      componentes: [
        {
          uid: 'sideboard',
          nombre: 'Credencia integrada',
          dimensiones: 'ancho: 110 cm; alto: 65 cm',
          material: 'MDF',
        },
      ],
      caracteristicas_generales: { dimensiones: { ancho: { valor: '160', unidad: 'cm' } } },
    },
  },
  pendientes: [
    {
      codigo: 'MISSING_UNIT',
      ruta: 'dimensiones',
      mensaje: 'Complete la unidad de 45 de profundidad.',
    },
  ],
})

describe('commercial scoped legacy review', () => {
  it('retains component dimensions and explicit unit price without flattening them into the desk', async () => {
    common(capture({ proyeccion_configurador: scopedProjection(), proyeccion_error: false }))
    const w = await view()
    await flushPromises()
    expect(w.get('input[name="unitario"]').element).toHaveProperty('value', '1900.00')
    const dimensions = w
      .findAll('textarea')
      .find((x) => x.attributes('placeholder') === '{"ancho":"1.20 m"}')!
    expect(JSON.parse((dimensions.element as HTMLTextAreaElement).value)).toEqual({
      ancho: '160 cm',
    })
    const technical = JSON.parse(
      (w.get('textarea[aria-describedby="datos-tecnicos-ayuda"]').element as HTMLTextAreaElement)
        .value,
    )
    expect(technical.componentes[0]).toMatchObject({
      nombre: 'Credencia integrada',
      dimensiones: 'ancho: 110 cm; alto: 65 cm',
    })
    expect(technical.caracteristicas_generales.dimensiones).toEqual({ ancho: '160 cm' })
    expect(w.text()).toContain('Complete la unidad de 45 de profundidad.')
    expect((w.findAll('textarea')[0]!.element as HTMLTextAreaElement).value).not.toContain('18 mm')
    w.unmount()
  })
  it('does not turn an explicit negotiated total into a unit price', async () => {
    const projection = scopedProjection()
    projection.comercial.precio_unitario = null
    projection.pendientes = [
      {
        codigo: 'TOTAL_NEGOCIADO',
        ruta: 'comercial.precio_unitario',
        mensaje: 'Total negociado; revise el precio unitario.',
      },
    ]
    common(capture({ proyeccion_configurador: projection, proyeccion_error: false }))
    const w = await view()
    await flushPromises()
    expect(w.get('input[name="unitario"]').element).toHaveProperty('value', '')
    expect(w.text()).toContain('Total negociado; revise el precio unitario.')
    w.unmount()
  })
  it('shows projection errors rather than claiming structured evidence was recovered', async () => {
    common(capture({ proyeccion_configurador: null, proyeccion_error: true }))
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('No se pudo recuperar la propuesta estructurada')
    w.unmount()
  })
})

describe('unsupported projected discounts', () => {
  it.each(['50.00', '0.00'])(
    'retains and blocks explicit discount %s instead of confirming without it',
    async (discount) => {
      const projection = scopedProjection()
      projection.comercial.descuento = discount
      common(capture({ proyeccion_configurador: projection, proyeccion_error: false }))
      const confirm = vi.fn<() => void>()
      server.use(
        http.post('http://localhost:8000/api/v1/capturas/1/confirmar/', () => {
          confirm()
          return HttpResponse.json({}, { status: 201 })
        }),
      )
      const w = await view()
      await flushPromises()
      expect(w.text()).toContain('Esta revisión no admite el descuento propuesto')
      expect(w.text()).toContain(discount)
      expect(
        w
          .findAll('button')
          .find((b) => b.text().includes('Revisar y confirmar'))
          ?.attributes('disabled'),
      ).toBeDefined()
      await w.get('form').trigger('submit')
      const dialog = w.findComponent({ name: 'ConfirmDialog' })
      dialog.vm.$emit('confirm')
      await flushPromises()
      expect(confirm).not.toHaveBeenCalled()
      w.unmount()
    },
  )
})

describe('unsupported legacy dimension shapes', () => {
  it.each([
    { valor: '160', unidad: 'cm', tolerancia: '2 mm' },
    { valor: '160', unidad: null },
  ])('keeps rich evidence visible and blocks unsupported confirmation', async (dimension) => {
    const projection = scopedProjection()
    const original = projection.especificacion.datos_tecnicos.caracteristicas_generales
      .dimensiones as Record<string, unknown>
    original.ancho = dimension
    common(capture({ proyeccion_configurador: projection, proyeccion_error: false }))
    const confirm = vi.fn<() => void>()
    server.use(
      http.post('http://localhost:8000/api/v1/capturas/1/confirmar/', () => {
        confirm()
        return HttpResponse.json({}, { status: 201 })
      }),
    )
    const w = await view()
    await flushPromises()
    expect(w.text()).toContain('Las dimensiones conservan datos que este contrato no admite')
    const dimensions = w
      .findAll('textarea')
      .find((x) => x.attributes('placeholder') === '{"ancho":"1.20 m"}')!
    expect(JSON.parse((dimensions.element as HTMLTextAreaElement).value)).toEqual({
      ancho: dimension,
    })
    expect(
      w
        .findAll('button')
        .find((b) => b.text().includes('Revisar y confirmar'))
        ?.attributes('disabled'),
    ).toBeDefined()
    w.findComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    // Only explicit operator resolution changes the representation; no unit is inferred.
    await dimensions.setValue(JSON.stringify({ ancho: '160 cm' }))
    const technical = w.get('textarea[aria-describedby="datos-tecnicos-ayuda"]')
    const data = JSON.parse((technical.element as HTMLTextAreaElement).value)
    data.caracteristicas_generales.dimensiones = { ancho: '160 cm' }
    if ('tolerancia' in dimension)
      data.caracteristicas_generales.atributos = [
        { nombre: 'Tolerancia ancho', valor: dimension.tolerancia },
      ]
    await technical.setValue(JSON.stringify(data))
    expect(
      w
        .findAll('button')
        .find((b) => b.text().includes('Revisar y confirmar'))
        ?.attributes('disabled'),
    ).toBeUndefined()
    w.unmount()
  })
})
