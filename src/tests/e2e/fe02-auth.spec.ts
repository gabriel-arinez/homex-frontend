import { expect, test, type Page } from '@playwright/test'

const access = 'eyJhbGciOiJub25lIn0.eyJ1c2VyX2lkIjo3fQ.signature'
const vendedor = {
  id: 7,
  username: 'vendedor',
  display_name: 'María Vendedora',
  capabilities: ['comercial.operar'],
}

async function mockLogin(page: Page) {
  await page.route('**/api/v1/auth/token/', async (route) => {
    const body = route.request().postDataJSON() as { username: string; password: string }
    if (body.username === 'vendedor' && body.password === 'correcta')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access, refresh: 'refresh' }),
      })
    else
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'invalid' }),
      })
  })
}

async function mockMe(page: Page, identity: typeof vendedor = vendedor) {
  await page.route('**/api/v1/auth/me/', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(identity) }),
  )
}

test('FE02 protege rutas, carga identidad real y permite cerrar sesión', async ({ page }) => {
  await mockLogin(page)
  await mockMe(page)
  await page.goto('/resumen')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('Usuario').fill('vendedor')
  await page.getByLabel('Contraseña').fill('incorrecta')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos.')
  await page.getByLabel('Contraseña').fill('correcta')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/resumen$/)
  await expect(page.getByText('María Vendedora')).toBeVisible()
  await expect(page.getByText('vendedor', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Catálogos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('FE02 restaura la sesión consultando /auth/me/ y representa 404', async ({ page }) => {
  await page.route('**/api/v1/auth/token/refresh/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access, refresh: 'refresh' }),
    }),
  )
  await mockMe(page)
  await page.addInitScript(
    ({ token }) =>
      sessionStorage.setItem(
        'homex.session.v1',
        JSON.stringify({ access: token, refresh: 'refresh' }),
      ),
    { token: access },
  )
  await page.goto('/ruta-inexistente')
  await expect(page.getByText('María Vendedora')).toBeVisible()
  await expect(page.getByRole('alert').getByText('Página no encontrada')).toBeVisible()
})

test('FE02 niega todo acceso comercial cuando capabilities está vacío', async ({ page }) => {
  await mockLogin(page)
  await mockMe(page, {
    id: 9,
    username: 'sin_rol',
    display_name: 'Usuario sin rol',
    capabilities: [],
  })
  await page.goto('/login')
  await page.getByLabel('Usuario').fill('vendedor')
  await page.getByLabel('Contraseña').fill('correcta')
  await page.getByRole('button', { name: 'Ingresar' }).click()

  await expect(page).toHaveURL(/\/forbidden$/)
  await expect(page.getByText('Usuario sin rol')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Resumen' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Clientes' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Catálogos' })).toHaveCount(0)
})
