/// <reference types="vite/client" />

export {}

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    requiresAuth?: boolean
    capability?: import('@/modules/auth/types/session').Capability
  }
}
