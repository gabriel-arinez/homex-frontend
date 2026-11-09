import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentViewerModal from './DocumentViewerModal.vue'
import ProformaDocumentSheet from './ProformaDocumentSheet.vue'

describe('DocumentViewerModal & ProformaDocumentSheet', () => {
  it('renders modal with title and controls when open', async () => {
    const wrapper = mount(DocumentViewerModal, {
      props: {
        open: true,
        title: 'Proforma #578',
        subtitle: 'Vista previa Carta',
      },
      global: {
        stubs: { Teleport: true },
      },
    })

    expect(wrapper.text()).toContain('Proforma #578')
    expect(wrapper.text()).toContain('Vista previa Carta')
    expect(wrapper.text()).toContain('100%')
    expect(wrapper.find('button[aria-label="Cerrar visor de documento"]').exists()).toBe(true)

    // Zoom in
    await wrapper.find('button[aria-label="Aumentar zoom"]').trigger('click')
    expect(wrapper.text()).toContain('110%')

    // Zoom out
    await wrapper.find('button[aria-label="Reducir zoom"]').trigger('click')
    expect(wrapper.text()).toContain('100%')

    // Close button emit
    await wrapper.find('button[aria-label="Cerrar visor de documento"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('renders printable document sheet adaptively with and without images', () => {
    const lineas = [
      {
        id: 1,
        nombre: 'Mesa de reunión',
        descripcion: 'Mesa para 10 personas en melamina nogal',
        tipo_item_label: 'Mueble a medida',
        cantidad: 1,
        unidad_label: 'pza',
        precio_unitario: 7300,
        total_calculado: 7300,
        imagen_url: 'http://localhost:8000/media/mesa.jpg',
        especificacion: {
          datos_tecnicos: {
            caracteristicas_generales: {
              dimensiones: { ancho: '240 cm', alto: '75 cm', profundidad: '120 cm' },
            },
          },
        },
      },
      {
        id: 2,
        nombre: 'Silla ergonómica de oficina',
        descripcion: 'Silla operativa con respaldo de malla',
        tipo_item_label: 'Catálogo',
        cantidad: 10,
        unidad_label: 'unidades',
        precio_unitario: 850,
        descuento: 50,
        total_calculado: 8000,
        imagen_url: null, // Sin imagen -> layout adaptativo 100% ancho
      },
    ]

    const wrapper = mount(ProformaDocumentSheet, {
      props: {
        numero: 578,
        fecha: '2026-11-08',
        titulo: 'Mobiliario para oficinas corporativas',
        monedaCodigo: 'BOB',
        monedaNombre: 'Bolivianos',
        estadoCodigo: 'BORRADOR',
        estadoNombre: 'Borrador',
        cliente: {
          empresa: 'Corporación Andina S.A.',
          celular: '77712345',
          direccion: 'Av. Arce 1234, La Paz',
        },
        condiciones: {
          porcentaje_adelanto: 50,
          plazo_entrega: '15 días hábiles',
          validez_oferta: 30,
          observaciones: 'Incluye flete e instalación en oficinas.',
        },
        lineas,
        subtotal: 15300,
        descuentoTotal: 500,
        total: 14800,
      },
    })

    // Header branding
    expect(wrapper.text()).toContain('HOMEX')
    expect(wrapper.text()).toContain('PROFORMA – COTIZACIÓN')
    expect(wrapper.text()).toContain('Nº 578')

    // Client and conditions
    expect(wrapper.text()).toContain('Corporación Andina S.A.')
    expect(wrapper.text()).toContain('77712345')
    expect(wrapper.text()).toContain('Mobiliario para oficinas corporativas')

    // Items
    expect(wrapper.text()).toContain('Mesa de reunión')
    expect(wrapper.text()).toContain('Silla ergonómica de oficina')
    expect(wrapper.text()).toContain('240 cm')

    // Adaptive classes: Item 1 has image class, Item 2 does NOT
    const cardBodies = wrapper.findAll('.product-card__body')
    expect(cardBodies).toHaveLength(2)
    expect(cardBodies[0]?.classes()).toContain('product-card__body--with-image')
    expect(cardBodies[1]?.classes()).not.toContain('product-card__body--with-image')

    // Commercial totals and conditions
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('15 días hábiles')
    expect(wrapper.text()).toContain('30 días')
    expect(wrapper.text()).toContain('Aceptación y Aprobación del Cliente')
  })
})
