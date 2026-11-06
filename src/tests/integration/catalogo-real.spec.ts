import { expect, test, type APIResponse } from '@playwright/test'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { ResultadoCatalogo } from '@/generated/api'

const directory = process.env.HOMEX_CATALOGO_AUDIO_DIR
const password = process.env.HOMEX_CATALOGO_PASSWORD
const samples = [
  ['SILLA', 'silla'],
  ['PISO_FLOTANTE', 'piso'],
  ['OTRO', 'otro'],
] as const
for (const [category, file] of samples) {
  test.describe(category, () => {
    for (const mode of ['upload', 'record'] as const) {
      test(`${mode}: ASR → propuesta → formulario → guardado manual`, async ({
        playwright,
      }, testInfo) => {
        if (!directory || !password || !existsSync(join(directory, file + '.wav')))
          throw new Error(
            'Faltan HOMEX_CATALOGO_AUDIO_DIR, HOMEX_CATALOGO_PASSWORD o fixtures WAV.',
          )
        const browser = await playwright.chromium.launch({
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${join(directory!, file + '.wav')}`,
          ],
        })
        const context = await browser.newContext({
          baseURL: testInfo.project.use.baseURL,
          permissions: ['microphone'],
        })
        const page = await context.newPage()
        page.on('dialog', (dialog) => dialog.accept())
        try {
          const writes: string[] = []
          page.on('request', (request) => {
            if (
              request.method() === 'POST' &&
              new URL(request.url()).pathname.endsWith('/catalogo/productos/')
            )
              writes.push(request.url())
          })
          await page.goto('/login')
          await page.getByLabel('Usuario').fill(process.env.HOMEX_CATALOGO_USERNAME ?? 'demo-admin')
          await page.getByLabel('Contraseña').fill(password!)
          await page.getByRole('button', { name: 'Ingresar' }).click()
          await page.waitForURL((url) => !url.pathname.endsWith('/login'))
          const inventoryResponse = page.waitForResponse(
            (r) =>
              r.request().method() === 'GET' &&
              new URL(r.url()).pathname.endsWith('/catalogo/productos/') &&
              r.status() === 200,
          )
          await page.goto('/productos')
          const inventory = await inventoryResponse
          const headers = { authorization: inventory.request().headers()['authorization']! }
          const readInventory = async () => {
            let url: string | null = inventory.url()
            let count = 0
            const stocks: [number, string | number][] = []
            while (url) {
              const response: APIResponse = await context.request.get(url, { headers })
              expect(response.status()).toBe(200)
              const data: {
                count: number
                next: string | null
                results: { id: number; stock: string | number }[]
              } = await response.json()
              count = data.count
              stocks.push(
                ...data.results.map(
                  (p: { id: number; stock: string | number }): [number, string | number] => [
                    p.id,
                    p.stock,
                  ],
                ),
              )
              url = data.next
            }
            return { count, stocks: stocks.sort((a, b) => a[0] - b[0]) }
          }
          const before = await readInventory()
          // Las acciones de creación ya son botones directos, sin menú intermedio.
          const labels = { SILLA: 'Silla', PISO_FLOTANTE: 'Piso', OTRO: 'Otro' }
          await page
            .getByRole('group', { name: 'Crear producto por categoría' })
            .getByRole('button', { name: labels[category], exact: true })
            .click()
          await expect(page).toHaveURL(new RegExp(`/productos/nuevo\\?categoria=${category}`))
          await page.getByRole('button', { name: 'Completar por voz' }).click()
          const assistant = page.getByRole('dialog', { name: 'Completar por voz' })
          await expect(assistant).toBeVisible()
          await expect(
            assistant.getByRole('heading', { name: 'Descripción por voz' }),
          ).toBeVisible()

          // La carga/grabación inicia la interpretación automáticamente: escuchar antes
          // del evento para no perder una respuesta de ASR ya completada.
          const completed = page.waitForResponse(
            async (response) => {
              if (
                !response.url().includes('/capturas/catalogo/') ||
                response.request().method() !== 'GET' ||
                response.status() !== 200
              )
                return false
              return (await response.json()).estado === 'COMPLETADA'
            },
            { timeout: 150_000 },
          )
          if (mode === 'upload') {
            const chooser = page.waitForEvent('filechooser')
            await assistant.getByRole('button', { name: 'Seleccionar archivo' }).click()
            await (await chooser).setFiles(join(directory!, file + '.wav'))
          } else {
            await assistant.getByRole('button', { name: 'Grabar descripción' }).click()
            await expect(
              assistant.getByRole('status').filter({ hasText: 'Grabando' }),
            ).toBeVisible()
            await page.waitForTimeout(16000)
            await assistant.getByRole('button', { name: 'Finalizar grabación' }).click()
          }
          const proposal = (await (await completed).json()) as ResultadoCatalogo
          await expect(page.getByRole('heading', { name: 'Campos detectados' })).toBeVisible()
          const text = page.getByRole('textbox', { name: 'Transcripción / texto corregido' })
          expect((await text.inputValue()).trim().length).toBeGreaterThan(4)
          expect(writes).toEqual([])
          await page.getByRole('button', { name: 'Aplicar al formulario', exact: true }).click()
          expect(writes).toEqual([])
          expect(await readInventory()).toEqual(before)
          const fields = proposal.propuesta!.fields
          const controls = {
            nombre: 'Nombre comercial *',
            precio_lista: 'Precio normal de venta (Bs) *',
            unidad_stock: 'Unidad comercial *',
            observaciones: 'Notas del producto (opcional)',
            modelo: 'Modelo',
            marca: 'Marca',
            color_primario: 'Color primario',
            color_secundario: 'Color secundario',
            espesor_mm: 'Espesor (mm)',
            largo_mm: 'Largo descriptivo (mm)',
            ancho_mm: 'Ancho descriptivo (mm)',
            m2_por_caja: 'm² por caja',
            material: 'Material',
            tipo: 'Tipo',
            diseno: 'Diseño',
            acabado: 'Acabado',
          }
          expect(Object.keys(fields).some((field) => field in controls)).toBe(true)
          const selects = new Set([
            'unidad_stock',
            'marca',
            'color_primario',
            'color_secundario',
            'material',
            'tipo',
            'diseno',
            'acabado',
          ])
          for (const field of Object.keys(controls) as (keyof typeof controls)[]) {
            if (fields[field] != null) {
              const control = selects.has(field)
                ? page.getByRole('combobox', { name: controls[field], exact: true })
                : page.getByLabel(controls[field], { exact: false })
              await expect(control).toHaveValue(String(fields[field]))
            }
          }
          expect(fields).not.toHaveProperty('sku')
          expect(fields).not.toHaveProperty('stock')
          // OTRO no tiene unidad obligatoria fija. El encargado elige la adecuada
          // cuando el dictado no aporta una unidad reconocida por el catálogo.
          if (category === 'OTRO') {
            const unit = page.getByRole('combobox', { name: 'Unidad comercial *' })
            if (!(await unit.inputValue())) await unit.selectOption({ label: 'Barra' })
          }
          expect(fields.precio_lista).toBeDefined()
          if (category === 'SILLA') expect(fields.especificaciones).toBeDefined()
          if (category === 'PISO_FLOTANTE') expect(fields.espesor_mm).toBeDefined()
          if (category === 'OTRO') expect(fields.observaciones).toBeDefined()
          // Required SKU remains a deliberate manual choice.
          await page
            .getByLabel('Código SKU *', { exact: false })
            .fill(`VOICE-${category}-${mode}-${Date.now()}`)
          const name = page.getByLabel('Nombre comercial *', { exact: true })
          if (!(await name.inputValue())) await name.fill(`Prueba voz ${category}`)
          await page.getByLabel('Precio normal de venta (Bs) *', { exact: true }).fill('100')
          const savedResponse = page.waitForResponse(
            (r) =>
              r.request().method() === 'POST' &&
              new URL(r.url()).pathname.endsWith('/catalogo/productos/'),
          )
          await page.getByRole('button', { name: 'Guardar producto', exact: true }).click()
          await expect(page).toHaveURL(/\/productos(?:\?|$)/)
          expect(writes).toHaveLength(1)
          const saved = await (await savedResponse).json()
          expect(Number(saved.stock)).toBe(0)
          if (category === 'SILLA')
            expect(saved.silla.especificaciones).toEqual(fields.especificaciones)
          if (category === 'PISO_FLOTANTE')
            expect(Number(saved.piso.espesor_mm)).toBe(Number(fields.espesor_mm))
          if (category === 'OTRO') expect(saved.observaciones).toBe(fields.observaciones)
          const after = await readInventory()
          expect(after.count).toBe(before.count + 1)
          expect(after.stocks.filter(([id]) => id !== saved.id)).toEqual(before.stocks)
          await testInfo.attach('catalog-evidence', {
            body: JSON.stringify(
              {
                category,
                mode,
                transcription: proposal.texto_transcrito_original,
                fields,
                inventoryBefore: before,
                inventoryBeforeSave: 'unchanged',
                saved: { id: saved.id, sku: saved.sku, stock: saved.stock },
                automaticProductWrites: 0,
              },
              null,
              2,
            ),
            contentType: 'application/json',
          })
        } finally {
          await browser.close()
        }
      })
    }
  })
}
