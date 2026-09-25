import { createRouter, createWebHistory } from 'vue-router'

import MainLayout from '@/app/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/resumen' },
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: 'resumen',
          component: () => import('@/modules/resumen/views/DesignSystemView.vue'),
        },
      ],
    },
  ],
})

export default router
