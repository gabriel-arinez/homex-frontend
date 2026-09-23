# Design system HOMEX

## Fundamentos

HOMEX usa Inter local, iconografía Lucide outline, una escala espacial basada en 4 px y tokens
semánticos. Los componentes nunca deben introducir colores de marca o de estado mediante valores
hexadecimales propios. Los temas se aplican con `data-theme="light|dark"` sobre `html` y configuran
`color-scheme` correctamente.

El rojo HOMEX representa marca y acciones principales. Error, éxito, advertencia e información
tienen tokens independientes y siempre se acompañan de texto. En oscuro, el acento usa una variante
con contraste suficiente.

## Shell

El shell tiene una única navegación lateral y no posee topbar global. En escritorio mide 264 px y
puede compactarse a 72 px; en tablet parte del ancho compacto y puede superponerse; por debajo de
768 px funciona como drawer. El disparador móvil pertenece a `PageHeader`. Tema y usuario permanecen
al pie del mismo árbol de navegación.

Preferencias locales permitidas:

- `homex.theme`: `light` o `dark`;
- `homex.sidebar.compact`: `true` o `false`.

No se almacenan tokens, datos personales ni información comercial en esas claves.

## Componentes

Los componentes base viven en `src/shared/ui`. Sus APIs usan `modelValue`/`update:modelValue` para
controles y slots para contenido variable.

- Acciones: `Button`, `IconButton`.
- Formularios: `TextField`, `SearchField`, `Select`, `Checkbox`, `Radio`, `Switch`.
- Presentación: `Badge`, `StatusBadge`, `Card`, `KpiCard`.
- Listados: `DataTable`, `Pagination`, `FilterBar`.
- Capas y feedback: `Modal`, `ConfirmDialog`, `Tooltip`, `Toast`.
- Estados: `LoadingSkeleton`, `EmptyState`, `ErrorState`, `ForbiddenState`.
- Estructura: `AppSidebar`, `PageHeader`, `MainLayout`.

Los icon buttons requieren `label`; los campos requieren `label` y `name`; los errores se enlazan
por ARIA. `Modal` atrapa el foco, cierra con Escape y devuelve el foco al elemento anterior.

## Responsive

Los breakpoints rectores son 768 px y 1024 px. La aceptación se realiza en 360, 390, 768, 1024 y
1440 px. El documento no admite overflow horizontal. `DataTable` cambia a filas tipo ficha en móvil,
los filtros se apilan, los encabezados reorganizan acciones y los diálogos limitan su altura con
scroll interno.

## Uso

Importar tokens una sola vez mediante `shared/styles/base.css`. El contenido comercial usa
`PageHeader` para título, descripción y acciones contextuales. No deben añadirse búsqueda,
notificaciones, workspace ni acciones comerciales globales al shell.
