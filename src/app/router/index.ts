import { createRouter, createWebHistory, type NavigationGuard } from 'vue-router'
import MainLayout from '@/app/layouts/MainLayout.vue'
import { useSessionStore } from '@/app/stores/useSessionStore'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/resumen' },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/modules/auth/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        {
          path: 'resumen',
          name: 'resumen',
          component: () => import('@/modules/resumen/views/DesignSystemView.vue'),
          meta: { capability: 'comercial.operar' },
        },
        {
          path: 'clientes',
          name: 'clientes',
          component: () => import('@/modules/clientes/views/ClientesListView.vue'),
          meta: { capability: 'comercial.operar' },
        },
        {
          path: 'clientes/:id',
          name: 'cliente-detail',
          component: () => import('@/modules/clientes/views/ClienteDetailView.vue'),
          meta: { capability: 'comercial.operar' },
        },
        {
          path: 'productos',
          name: 'productos',
          component: () => import('@/modules/productos/views/ProductosListView.vue'),
          meta: { capability: 'comercial.operar' },
        },
        {
          path: 'productos/:id',
          name: 'producto-detail',
          component: () => import('@/modules/productos/views/ProductoDetailView.vue'),
          meta: { capability: 'comercial.operar' },
        },
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/modules/errors/views/ForbiddenView.vue'),
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/modules/errors/views/NotFoundView.vue'),
        },
      ],
    },
  ],
})
export const authGuard: NavigationGuard = async (to) => {
  const session = useSessionStore()
  await session.initialize()
  if (to.meta.public && session.isAuthenticated && to.name === 'login') return { name: 'resumen' }
  if (to.meta.requiresAuth && !session.isAuthenticated)
    return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.capability && !session.can(to.meta.capability)) return { name: 'forbidden' }
}
router.beforeEach(authGuard)
export default router
