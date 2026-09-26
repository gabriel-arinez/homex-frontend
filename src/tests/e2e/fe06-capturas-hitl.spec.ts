import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const options = {
  TIPO_ITEM: [
    { id: 1, codigo: 'MUEBLE_MEDIDA', nombre: 'Mueble a medida', concepto_codigo: 'TIPO_ITEM' },
  ],
  UNIDAD_MEDIDA: [{ id: 2, codigo: 'PIEZA', nombre: 'Pieza', concepto_codigo: 'UNIDAD_MEDIDA' }],
  TIPO_MUEBLE: [
    { id: 3, codigo: 'ESCRITORIO', nombre: 'Escritorio', concepto_codigo: 'TIPO_MUEBLE' },
  ],
}
const item = {
  id: 20,
  nombre: 'Escritorio ejecutivo',
  espesor: { espesor: '18 mm' },
  color_principal: 'Negro',
  color_secundario: null,
  dimensiones: { ancho: '1.20 m' },
  accesorios: ['cajón'],
  cantidad: 3,
  precio_total: '100.00',
  observaciones: null,
}
const completed = {
  id: 1,
  proforma: 4,
  proforma_detalle: null,
  estado: 'COMPLETADA',
  texto_transcrito: 'tres escritorios por cien',
  intento_id: 8,
  item_ia: item,
  incorporada: false,
  confirmada: false,
}
async function auth(page: Page) {
  await page.addInitScript(
    ({ access }) =>
      sessionStorage.setItem('homex.session.v1', JSON.stringify({ access, refresh: 'refresh' })),
    { access },
  )
  await page.route('**/api/v1/auth/token/refresh/', (r) =>
    r.fulfill({ json: { access, refresh: 'refresh' } }),
  )
  await page.route('**/api/v1/auth/me/', (r) =>
    r.fulfill({
      json: {
        id: 7,
        username: 'vendedor',
        display_name: 'María Vendedora',
        capabilities: ['comercial.operar'],
      },
    }),
  )
  await page.route('**/api/v1/catalogo/opciones/**', (r) =>
    r.fulfill({
      json:
        options[new URL(r.request().url()).searchParams.get('concepto') as keyof typeof options] ??
        [],
    }),
  )
}
async function backend(page: Page, result: Record<string, unknown> = completed) {
  await auth(page)
  await page.route('**/api/v1/capturas/1/', (r) => r.fulfill({ json: result }))
  await page.route('**/api/v1/capturas/1/confirmar/', (r) =>
    r.fulfill({
      status: 201,
      json: {
        captura_id: 1,
        detalle_id: 30,
        item_humano_id: 31,
        evaluacion_id: 32,
        proforma_estado: 'BORRADOR',
      },
    }),
  )
  await page.route('**/api/v1/capturas/', (r) =>
    r.fulfill({
      status: 202,
      json: { id: 1, estado: 'PENDIENTE', intento_id: 8, numero_intento: 1, reutilizada: false },
    }),
  )
}
test('FE06 crea captura de texto, procesa y confirma sin aprobar', async ({ page }) => {
  await backend(page)
  await page.goto('/capturas/nueva')
  await page.getByLabel('Proforma').fill('4')
  await page.getByLabel('Texto').check()
  await page.getByLabel('Texto dictado o escrito').fill('tres escritorios por cien')
  await page.getByRole('button', { name: 'Enviar a procesamiento' }).click()
  await expect(page.getByRole('heading', { name: 'Captura #1' })).toBeVisible()
  await expect(page.getByText('Propuesta IA · requiere revisión')).toBeVisible()
  await page.getByRole('button', { name: 'Revisar y confirmar' }).click()
  await page.getByRole('button', { name: 'Confirmar revisión' }).click()
  await expect(page.getByText(/La proforma permanece BORRADOR/)).toBeVisible()
})
test('FE06 representa NO_PROPOSAL y ERROR sin score o reintento ficticio', async ({ page }) => {
  await backend(page, { ...completed, item_ia: null })
  await page.goto('/capturas/1')
  await expect(page.getByRole('heading', { name: 'Sin propuesta' })).toBeVisible()
  await expect(page.getByText(/confianza/i)).toHaveCount(0)
  await page.unroute('**/api/v1/capturas/1/')
  await page.route('**/api/v1/capturas/1/', (r) =>
    r.fulfill({ json: { ...completed, estado: 'ERROR', item_ia: null } }),
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'No se pudo procesar' })).toBeVisible()
})
test('FE06 muestra conflicto de idempotencia sin crear éxito aparente', async ({ page }) => {
  await auth(page)
  await page.route('**/api/v1/capturas/', (r) =>
    r.fulfill({ status: 409, json: { detail: 'La clave ya fue usada con otro contenido.' } }),
  )
  await page.goto('/capturas/nueva')
  await page.getByLabel('Proforma').fill('4')
  await page.getByLabel('Texto').check()
  await page.getByLabel('Texto dictado o escrito').fill('mesa')
  await page.getByRole('button', { name: 'Enviar a procesamiento' }).click()
  await expect(page.getByRole('alert')).toContainText('otro contenido')
  await expect(page).toHaveURL(/capturas\/nueva/)
})
test('FE06 informa MediaRecorder ausente y mantiene alternativa texto', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'MediaRecorder', { value: undefined })
  })
  await auth(page)
  await page.goto('/capturas/nueva')
  await expect(page.getByRole('button', { name: 'Grabar' })).toBeDisabled()
  await page.getByLabel('Texto').check()
  await expect(page.getByLabel('Texto dictado o escrito')).toBeVisible()
})
for (const width of [360, 390, 768, 1024, 1440])
  test(`@a11y FE06 revisión operable ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 920 })
    await backend(page)
    await page.goto('/capturas/1')
    await expect(page.getByRole('heading', { name: 'Captura #1' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
