import { expect, test } from '@playwright/test'

test('PRF-04 voz real hasta guardado integral sin escrituras prematuras', async ({ page }) => {
  test.skip(
    !process.env.HOMEX_PRF04_AUDIO,
    'Requiere audio autorizado de prueba y stack real PRF-04.',
  )
  const comerciales: string[] = []
  page.on('request', (r) => {
    if (['POST', 'PUT', 'PATCH'].includes(r.method()) && /\/proformas\//.test(r.url()))
      comerciales.push(r.url())
  })
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('fe08-admin')
  await page.getByLabel('Contraseña').fill('fe08-integration-only')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/resumen$/)
  await page.goto('/proformas/nueva')
  await page.getByRole('button', { name: 'Añadir ítem' }).click()
  await page.getByRole('button', { name: 'Mueble a pedido' }).click()
  await page.getByRole('button', { name: 'Dictar especificaciones' }).click()
  await page.getByRole('button', { name: 'Grabar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Grabando' })).toBeVisible()
  // Reproducir el fixture completo a través de MediaRecorder real de Chromium.
  await page.waitForTimeout(12000)
  await page.getByRole('button', { name: 'Detener', exact: true }).click()
  await expect(page.getByLabel('Nombre comercial del mueble')).toHaveValue(/escritorio/i, {
    timeout: 120000,
  })
  expect(comerciales).toEqual([])
  await page.getByLabel('Cantidad cotizada').fill('3')
  await page.getByLabel('Precio unitario negociado (BOB)').fill('100')
  // El dictado comunica 100 BOB de total, mientras que 3 × 100 BOB = 300 BOB.
  // El guardado no debe omitir la confirmación comercial explícita.
  await page.getByRole('button', { name: 'Guardar especificación' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Confirma la diferencia entre el total dictado' }),
  ).toBeVisible()
  await page
    .getByRole('checkbox', {
      name: /Confirmo que el importe comercial difiere del total dictado/,
    })
    .check()
  await page.getByRole('button', { name: 'Guardar especificación' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(comerciales).toEqual([])
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page).toHaveURL(/\/proformas\/\d+\/editar$/)
  expect(comerciales).toHaveLength(1)
  await page.reload()
  await expect(page.getByText(/escritorio/i).first()).toBeVisible()
})

test('PRF-04 cancelar configurador no persiste datos comerciales', async ({ page }) => {
  const commercialWrites: string[] = []
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH'].includes(request.method()) && /\/proformas\//.test(request.url()))
      commercialWrites.push(request.url())
  })
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('fe08-admin')
  await page.getByLabel('Contraseña').fill('fe08-integration-only')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/resumen$/)
  await page.goto('/proformas/nueva')
  await page.getByRole('button', { name: 'Añadir ítem' }).click()
  await page.getByRole('button', { name: 'Mueble a pedido' }).click()
  await page.getByLabel('Nombre comercial del mueble').fill('Mueble cancelado de laboratorio')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(commercialWrites).toEqual([])
})
