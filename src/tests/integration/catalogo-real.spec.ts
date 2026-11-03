import { expect, test } from '@playwright/test'
import { join } from 'node:path'
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
        test.skip(!directory || !password, 'Requiere stack local, credenciales y audios de prueba.')
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
          await page.goto('/productos')
          await page.getByRole('combobox', { name: 'Categoría para crear' }).selectOption(category)
          await page.getByRole('button', { name: 'Nuevo producto', exact: true }).click()
          await expect(page.getByRole('heading', { name: 'Descripción por voz' })).toBeVisible()
          if (mode === 'upload') {
            await page
              .getByLabel('Subir audio', { exact: true })
              .setInputFiles(join(directory!, file + '.wav'))
          } else {
            await page.getByRole('button', { name: 'Grabar descripción', exact: true }).click()
            await expect(page.getByRole('status').filter({ hasText: 'Grabando' })).toBeVisible()
            await page.waitForTimeout(16000)
            await page.getByRole('button', { name: 'Detener', exact: true }).click()
          }
          const completed = page.waitForResponse(async (response) => {
            if (
              !response.url().includes('/capturas/catalogo/') ||
              response.request().method() !== 'GET' ||
              response.status() !== 200
            )
              return false
            return (await response.json()).estado === 'COMPLETADA'
          })
          await page.getByRole('button', { name: 'Procesar audio', exact: true }).click()
          const proposal = (await (await completed).json()) as ResultadoCatalogo
          await expect(page.getByRole('heading', { name: 'Campos detectados' })).toBeVisible()
          const text = page.getByRole('textbox', { name: 'Transcripción / texto corregido' })
          expect((await text.inputValue()).trim().length).toBeGreaterThan(4)
          expect(writes).toEqual([])
          await page.getByRole('button', { name: 'Aplicar al formulario', exact: true }).click()
          expect(writes).toEqual([])
          const fields = proposal.propuesta!.fields
          const controls = {
            nombre: 'Nombre comercial',
            precio_lista: 'Precio de lista (BOB)',
            unidad_stock: 'Unidad comercial',
          }
          expect(Object.keys(fields).some((field) => field in controls)).toBe(true)
          for (const field of ['nombre', 'precio_lista', 'unidad_stock'] as const) {
            if (fields[field] != null)
              await expect(page.getByLabel(controls[field], { exact: true })).toHaveValue(
                String(fields[field]),
              )
          }
          // Required SKU remains a deliberate manual choice.
          await page
            .getByLabel('SKU', { exact: true })
            .fill(`VOICE-${category}-${mode}-${Date.now()}`)
          const name = page.getByLabel('Nombre comercial', { exact: true })
          if (!(await name.inputValue())) await name.fill(`Prueba voz ${category}`)
          await page.getByLabel('Precio de lista (BOB)', { exact: true }).fill('100')
          await page.getByRole('button', { name: 'Guardar producto', exact: true }).click()
          await expect(page).toHaveURL(/\/productos(?:\?|$)/)
          expect(writes).toHaveLength(1)
        } finally {
          await browser.close()
        }
      })
    }
  })
}
