# Rediseño progresivo de Mueble Studio

Objetivo: optimizar jerarquía visual, contraste de capas, distribución y microcopy del formulario de creación/edición de muebles a pedido para orientar rápidamente al vendedor, respetando estrictamente la paleta de colores e iconografía existentes. Rama: feat/voz-panel-unificado-20261105.

## Specs

### S1 — Paso 01 General

- Definir `--color-surface-muted` en `themes.css` usando exclusivamente los tonos de la paleta actual y diferenciar el fondo de controles editables (`--color-surface-raised`) para separar 3 planos visuales claros (sección, sub-tarjeta, campo editable) tanto en modo claro como oscuro.
- Agrupar a la izquierda la cabecera del paso (`PASO 01 DE 06`, título y subtítulo) en `MuebleStudio.vue` y mejorar la legibilidad de la pestaña activa.
- En `MuebleOptionPicker.vue`, integrar el estado seleccionado dentro del propio campo con contraste de valor activo y acción `Quitar` en línea para evitar texto duplicado suelto debajo.
- En `Identificación`, distinguir claramente obligatoriedad (`Nombre comercial`) vs opcionalidad (`Tipo de mueble`) y optimizar proporción de columnas.
- En `Dimensiones generales`, orientar el texto al vendedor, capitalizar visualmente las etiquetas sin romper contratos de accesibilidad, unificar la altura de todas las tarjetas de medida ubicando `Quitar` en la cabecera de las medidas agregadas y sumar accesos rápidos de un clic junto al buscador `Agregar medida`.
- En `Características generales`, mostrar estado vacío orientativo cuando no hay elementos, ubicar las características registradas por encima del buscador y alinear cada tarjeta con altura uniforme.

## Tasks

- T1 — S1 — inline — implementado sin commit — Paso 01 General completado y verificado (vue-tsc, ESLint, Prettier, 62 unitarias y 5 flujos E2E/axe-core en 360px, 768px y 1440px).

## Log

- L1 — Diagnóstico de Paso 01 General: `--color-surface-muted` no existía en `themes.css`, aplanando tres niveles jerárquicos al mismo color. Se definió `--color-surface-muted` con mezcla de tokens existentes y se diferenciaron los controles editables con `--color-surface-raised`.
- L2 — En `MuebleStudio.vue` se alineó a la izquierda el bloque de cabecera del paso y se ajustó el contraste de la pestaña activa. En `MuebleOptionPicker.vue` se integró el estado seleccionado y la acción `Quitar` dentro del campo sin duplicar texto afuera.
- L3 — En `EspecificacionForm.vue` se añadieron indicadores de obligatoriedad/opcionalidad, microcopy comercial, capitalización visual de medidas, acción `Quitar` en cabecera de sub-tarjeta para conservar alturas uniformes, accesos rápidos de un clic y estado vacío orientativo en Características generales.
