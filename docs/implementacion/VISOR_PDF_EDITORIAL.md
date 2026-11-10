# HOMEX · Visor PDF institucional

Decisiones vigentes de FRONT SENIOR V, noviembre de 2026.

El PDF tamaño carta del backend es la única representación comercial canónica. El frontend no debe reimprimir HTML o reconstruir el documento en canvas para descargar o imprimir.

## Visor y accesibilidad

- Mantener Vue 3, TypeScript y PDF.js 6.x, con páginas renderizadas y texto seleccionable.
- Zoom manual y ajuste de página y ancho calculados a partir de dimensiones reales del PDF.
- Navegación de páginas visible, entrada accesible para saltar a una página, barra de desplazamiento utilizable.
- Conservar zoom y scroll robustos, navegación por teclado y ciclo de vida correcto del documento.
- Imprimir y descargar el PDF original guardado por backend, no una maqueta HTML.
- Revisar móviles, archivos multipágina, texto, imágenes, memoria de canvas y navegadores distintos.

## Arquitectura documental aprobada

Modos visual con fotografía y compacto técnico sin fotografía; ejes fijos de ítem/cantidad, especificaciones, precio unitario e importe; total cotizado sin subtotal redundante; firma manuscrita con espacio. El modo comparativo excluyente requiere agrupaciones explícitas persistidas y reglas de total: no inferir precios por nombre o descripción. Todos los datos de cliente, condiciones, garantías y vendedor deben proceder de HOMEX; nunca inventarlos.

El diseño editorial se implementa principalmente en el backend: apps/documentos/pdf.py.
