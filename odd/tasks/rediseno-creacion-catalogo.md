# Rediseño del Formulario de Creación de Catálogo y Completado por Voz

Objetivo: Optimizar el formulario de creación de productos de catálogo en HOMEX (`ProductoForm.vue`), el flujo directo de asistencia por voz (`CapturaCatalogo.vue`), la extracción de precios comerciales en NLP y la jerarquía de capas visuales, eliminando fricciones innecesarias y selectores técnicos expuestos al vendedor. Rama: `feat/productos-catalogo-creacion-20261108`.

## Specs

### S1 — Flujo Directo de Completado por Voz

- Eliminar el cajón intermedio de revisión de transcripción, editor de texto y botón manual "Aplicar al formulario" en `CapturaCatalogo.vue`.
- Incorporar transcodificación transparente a WAV para audios móviles (.aac, .opus) mediante `audioConversion.ts`.
- Incorporar feedback interactivo en vivo durante el análisis con cronómetro y fases secuenciales.
- Aplicar los datos recibidos del backend directamente sobre los campos editables del formulario sin interrupciones ni modales bloqueantes de conflicto.
- Mostrar la transcripción original conservada de forma abierta y legible en la columna lateral (`form-aside`), ubicada inmediatamente debajo de la galería de imágenes, acompañada de los avisos y advertencias de campos pendientes de revisión.

### S2 — Reglas Flexibles de Reconocimiento de Precios en NLP

- Habilitar en `homex_nlp/catalog.py` y `homex_nlp/rules.py` la identificación de precios dictados en lenguaje natural comercial («precio 4000», «total 3000», «precio unitario 3500», «precio de lista 5200 bolivios», «cuesta 4500 Bs»).
- Admitir la variante fonética/coloquial «bolivios» en el reconocedor de divisas.
- Distinguir totales comerciales de catálogo frente a cálculos de lote/stock.
- Incorporar heurística de contingencia en el frontend para capturar el precio y el color primario si no vienen estructurados desde el backend.

### S3 — Rediseño de Información General y Supresión de Redundancias

- Unificar la cabecera del formulario eliminando duplicaciones entre el título general y el título del formulario, añadiendo una cápsula contextual de catálogo con ícono correspondiente.
- Retirar el selector redundante de categoría cuando ya ha sido preseleccionada en el flujo de entrada.
- Reemplazar el desplegable bloqueado de unidad comercial por una pastilla informativa de 3 capas (`--color-surface-muted`) con badge descriptivo (`Fijada por la categoría`), evitando la sensación de control defectuoso.

### S4 — Rediseño de Características de Silla

- Suprimir por completo la columna técnica «Tipo de respuesta» (texto, número, booleano, nulo), manejando la serialización de tipos primitivos de manera transparente en el mapper.
- Humanizar los nombres de características extraídas por voz (convirtiendo slugs snake_case como `apoyo_lumbar` o `material_respaldo` a etiquetas legibles como «Apoyo lumbar» y «Material del respaldo»).
- Incorporar accesos rápidos de un clic para añadir características ergonómicas habituales («+ Apoyo lumbar», «+ Brazos regulables», «+ Mecanismo de inclinación», «+ Asiento», «+ Material del respaldo», «+ Ruedas»).

### S5 — Rediseño de Precio y Promociones

- Aplicar arquitectura de 3 capas con contenedor base para precio de lista en BOB con tipografía tabular y badge de estado dinámico (`Precio obligatorio` / `Precio fijado`).
- Reorganizar la sección de promociones con interruptor claro, desglose visual de ahorro en vivo (`-X% OFF · Ahorro: Bs ...`), campos alineados de vigencia (`Fecha de inicio` y `Fecha de finalización`) y cápsula de estado en tiempo real (`Vigente`, `Programada`, `Finalizada`).

### S6 — Rediseño de Observaciones

- Estructurar el área de notas comerciales en 3 capas con marco `--color-surface-muted` y área de texto `--color-surface-raised`.
- Agregar accesos rápidos de un clic para notas frecuentes («+ Garantía de 1 año», «+ Uso en interiores», «+ Requiere armado sencillo», «+ Entrega inmediata»).

## Tasks

- T1 — S2 — `homex-nlp` — Reglas flexibles de precio de catálogo y soporte de divisa («bolivios») en `rules.py` y `catalog.py`.
- T2 — S1 — inline — `CapturaCatalogo.vue` simplificado a captura directa con transcodificación móvil y fases en vivo.
- T3 — S3 — inline — `ProductoForm.vue`: cabecera limpia, cápsula contextual, tarjeta de unidad comercial y eliminación de selectores redundantes.
- T4 — S4 — inline — `ProductoForm.vue`: eliminación de «Tipo de respuesta», humanización de claves snake_case y chips rápidos.
- T5 — S5 — inline — `ProductoForm.vue`: 3 capas en precio de lista, cálculo vivo de descuento y vigencia.
- T6 — S6 — inline — `ProductoForm.vue`: tarjeta lateral de transcripción conservada y alertas, notas comerciales con chips rápidos.
- T7 — S1 — inline — `catalogo-voz.spec.ts`: actualización de pruebas de voz al flujo directo sin pantallas intermedias ni modales de conflicto.
- T8 — S4/S3 — inline & NLP — Normalización de modelos hablados con guión en NLP (`NF Guión 810` -> `NF-810`), extracción completa de especificaciones ergonómicas de silla, grilla balanceada 2x2 en Información general, eliminación de cabeceras redundantes y prevención de volcado de audio en Observaciones.
