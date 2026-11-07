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

### S2 — Paso 02 Estructura

- Compactar `Conjuntos` en una franja discreta de una sola línea cuando `conjuntos.length === 0`, reservando protagonismo a las piezas del mueble; reemplazar contadores técnicos `(0/10)` y `(3/40)` por indicadores naturales (`Opcional` / `N piezas`).
- En el explorador izquierdo de piezas, mostrar resumen real de cada pieza (cantidad, material, espesor, color), indicador de alerta si falta el nombre y botón directo `+ Nueva pieza` al pie; cuando no hay piezas aún, presentar estado vacío de ancho completo con accesos rápidos de piezas frecuentes (`+ Tablero`, `+ Estructura`, etc.).
- En el editor de la pieza seleccionada, unificar acciones (`Subir`, `Bajar`, `Duplicar`, `Quitar pieza`) directamente en la cabecera eliminando el acordeón oculto `Acciones de esta pieza`; agrupar campos en bloques claros (Datos de la pieza vs Materiales y medidas), ocultar el selector `Conjunto` cuando no existen conjuntos creados y unificar las características adicionales con `MuebleOptionPicker` + chips rápidos.

### S3 — Paso 03 Accesorios

- Unificar las cabeceras de `Accesorios incluidos` y `Notas para fabricación` con agrupación a la izquierda de ícono + título, indicador de estado (`Opcional` / `N incluidos`) y botón `+ Añadir accesorio` fijo en la cabecera superior derecha.
- Reorganizar la lista de accesorios en una grilla de 2 columnas en escritorio (1 en móvil) con numeración sutil (`01`, `02`), acciones compactas (`Editar` y `Quitar` destructivo suave) y fila de edición de ancho completo con foco automático, confirmación con `Enter` y cancelación con `Escape` si está vacía.
- Incorporar accesos rápidos de un clic para accesorios frecuentes (`+ Pasacables`, `+ Correderas telescópicas`, etc.) y aplicar jerarquía de 3 capas en `Notas para fabricación` (contenedor, sub-bloque `--color-surface-muted` y `<textarea>` `--color-surface-raised` con `placeholder` orientativo).

### S4 — Paso 04 Imágenes

- Envolver la galería en `04 Imágenes` dentro de una tarjeta contenedora (`--color-surface` con borde) coherente con los pasos 01–03, evitando el salto vacío inferior cuando no hay errores externos en `EspecificacionForm`.
- Diferenciar las 3 capas visuales en `ImageGallery.vue` (modo `streamlined`) y `MuebleStudio.vue`: contenedor `--color-surface`, lienzo `.hero`/`.empty`/`.actions` en `--color-surface-muted` y controles interactivos/miniaturas en `--color-surface-raised`.
- Señalizar de forma inmediata cuál foto es la portada principal (badge superpuesto `Portada principal` + `Ampliar o gestionar` en `.hero`, e indicador `Star` + borde de acento en la miniatura correspondiente), mejorar el estado vacío (`0/8`) y sumar una guía breve en la columna de carga explicando cómo cambiar portada, ordenar o quitar.
- Reorganizar el modal `Visor de imágenes` en modo `streamlined`: ubicar la franja `.viewer-file` arriba con posición, nombre y badge `Imagen principal` / `Referencia adicional`, estructurar `.viewer-toolbar` con superficie propia y separadores entre navegación, zoom y gestión en una sola fila en escritorio, y confirmar `Portada actual` cuando la imagen abierta ya es principal.

## Tasks

- T1 — S1 — inline — `aeaeea3` — Paso 01 General completado y verificado.
- T2 — S2 — inline — `308992e` — Paso 02 Estructura completado y verificado.
- T3 — S3 — inline — `de4f8db` — Paso 03 Accesorios completado y verificado.
- T4 — S4 — inline — verificado — Paso 04 Imágenes implementado y verificado con pruebas unitarias, E2E, contraste WCAG AA y responsividad móvil (360px).

## Log

- L1 — Diagnóstico de Paso 01 General: `--color-surface-muted` no existía en `themes.css`, aplanando tres niveles jerárquicos al mismo color. Se definió `--color-surface-muted` con mezcla de tokens existentes y se diferenciaron los controles editables con `--color-surface-raised`.
- L2 — En `MuebleStudio.vue` se alineó a la izquierda el bloque de cabecera del paso y se ajustó el contraste de la pestaña activa. En `MuebleOptionPicker.vue` se integró el estado seleccionado y la acción `Quitar` dentro del campo sin duplicar texto afuera.
- L3 — En `EspecificacionForm.vue` se añadieron indicadores de obligatoriedad/opcionalidad, microcopy comercial, capitalización visual de medidas, acción `Quitar` en cabecera de sub-tarjeta para conservar alturas uniformes, accesos rápidos de un clic y estado vacío orientativo en Características generales.
- L4 — En `EspecificacionForm.vue` (Paso 02 Estructura) se compactó la franja de `Conjuntos` cuando está vacía, se reemplazaron contadores de límite técnico por indicadores naturales, se enriqueció el árbol izquierdo con resumen real de cada pieza y botón `+ Nueva pieza`, se incorporó estado vacío de ancho completo con chips de piezas frecuentes, se llevaron las acciones `Duplicar` y `Quitar pieza` directamente a la cabecera del editor eliminando el acordeón oculto, se agruparon los campos en sub-bloques con jerarquía de 3 capas, se ocultó el selector `Conjunto` cuando no existen conjuntos y se unificaron las características adicionales con `MuebleOptionPicker` + chips rápidos.
- L5 — En `EspecificacionForm.vue` (Paso 03 Accesorios) se corrigió la cabecera desalineada de `Notas para fabricación` agrupando ícono + título y badge `Opcional`, se llevó `+ Añadir accesorio` fijo a la cabecera de `Accesorios incluidos`, se transformó la lista en una grilla de 2 columnas con numeración (`01`, `02`), fila de edición de ancho completo con atajos `Enter`/`Escape`, chips de accesorios frecuentes de un clic y jerarquía de 3 capas en el bloque de observaciones (incluyendo `:deep(.textarea-field textarea)` con `--color-surface-raised`).
- L6 — En `MuebleStudio.vue` e `ImageGallery.vue` (Paso 04 Imágenes) se envolvió la galería en una tarjeta `--color-surface` con jerarquía de 3 capas, se señalizó la portada principal en `.hero` y en miniaturas (`Star` + borde de acento), se enriqueció el estado vacío (`0/8`) y la guía contextual del panel de carga, y se reestructuró el `Visor de imágenes` llevando `.viewer-file` a una franja superior clara con badge `Imagen principal` / `Referencia adicional` y agrupando `.viewer-toolbar` con confirmación `Portada actual`. También se ajustó el contraste en modo claro de migas y numeración de pasos en `MuebleStudio.vue`.
