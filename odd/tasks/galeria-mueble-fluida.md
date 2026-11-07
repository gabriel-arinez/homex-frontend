# Galería fluida de muebles

Objetivo: simplificar carga y gestión de imágenes en Mueble Studio sin alterar otros contextos. Rama: feat/voz-panel-unificado-20261105. Pruebas: Vitest, Playwright, TypeScript.

## Specs

### S1
“en el modal, directamente se encuentren los botones de de gestión para establecer como principal eliminar o cambiar el orden”; mantener permisos, confirmación de eliminación, navegación y zoom. “hay botones que se estan repitiendo, mejor si todos los botones estan en una misma fila a la misma altura”; diferenciar navegación de cambio de orden y permitir ajuste responsive. “mejor si las imagnes secundarias se muestran en una columna verticalmente al lado de la imagen ya que hay un espacio abajo que no deberia [Image #1]”.
### S2
“un cuadro claro que represente el arrastrado de imagenes, y recien debajo de el el unico botón de agregar imagenes”; conservar formatos, límites y accesibilidad. “ahora lo mismo pero a la izquierda de la imagen grande, adaptalo bien[Image #1]”.
### S3
“una imagen debe de guardarse automaticamente se suba, es decir no debe de haber confirmación”; no perder archivos ante errores: preservar los pendientes y permitir reintentar. La variante de otros contextos conserva el comportamiento actual.

## Tasks

- T1 — S1-S3 — inline — implementado sin commit — variante de galería, pruebas y verificación; riesgo ítem 4 (orden asíncrono) y 3 (componente compartido).
- T2 — S1-S3 — verificado sin commit — revisión independiente, pruebas UI y regresiones focalizadas.

## Log

- L1 — “bien, mejoro bastante, ahroa mejoremos la fludez con la que se hace todo esto, ya que note que muchas cosas siguen una secuencia qeu se puede simplificar, por ejemplo, que en el modal, directamente se encuentren los botones de de gestión para establecer como principal eliminar o cambiar el orden y mejor si se pone un cuadro claro que represente el arrastrado de imagenes, y recien debajo de el el unico botón de agregar imagenes, una imagen debe de guardarse automaticamente se suba, es decir no debe de haber confirmación, si se equivocaron por algo esta el botón de eliminar, y mejor si es un icono de basurero”.
- L2 — MuebleStudio crea una galería con endpoint y usa flush() como barrera de salida; las galerías de otros contextos deben conservar su flujo. La carga automática usa la misma rutina secuencial existente con persistencia de pendientes y reintento.

- L3 — Usuario: “hay botones que se estan repitiendo, mejor si todos los botones estan en una misma fila a la misma altura [Image #1]”. Se agrupan controles de navegación, zoom y gestión en una sola barra amplia; las flechas de orden se identifican como tales y en móvil se permite ajuste de línea.

- L4 — Usuario: “mejor si las imagnes secundarias se muestran en una columna verticalmente al lado de la imagen ya que hay un espacio abajo que no deberia [Image #1]”. Las miniaturas ahora forman una columna a la derecha en escritorio y una fila debajo en móvil; el orden DOM de la variante coincide con la disposición móvil para navegación por teclado.
- L5 — Auto-carga secuencial con reintento y protección contra respuestas obsoletas; acciones de portada, orden y eliminación confirmada directamente en el visor; zona de arrastre y botón único. Verificación independiente: 14 pruebas pasaron, sin bloqueos; comportamiento estándar de otras galerías conservado. Pruebas propias: 24 unitarias, type-check, ESLint, Prettier y E2E de carga, gestión, zoom y distribución escritorio/móvil. Sin commit.

- L6 — Usuario: “muy bien, ya se ven como se deberia en una columna, ahora lo mismo pero a la izquierda de la imagen grande, adaptalo bien[Image #1]”. En el paso Imágenes, las miniaturas aparecen en columna a la izquierda de la imagen y los controles siguen a la derecha; sin imágenes no se reserva la columna, y en móvil se apilan debajo. RED/GREEN E2E en 1280px y 390px, 23 unitarias focalizadas, type-check/build, ESLint y Prettier pasaron.
