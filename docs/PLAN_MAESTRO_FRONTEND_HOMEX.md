# Plan maestro de implementación e integración — HOMEX Frontend

**Fecha de revisión:** 25 de septiembre de 2026  
**Versión del plan:** 1.4 — usabilidad Nielsen + contrato FE04 actualizado  
**Repositorio:** <code>gabriel-arinez/homex-frontend</code>  
**Rama rectora:** <code>main</code>  
**Baseline de código previo al plan:** <code>187670fe59da077311d9d3edea32cb1c4532cad4</code>  
**Baseline tecnológico existente:** Vue 3 + TypeScript + Vite + Vue Router + Pinia + Vitest + ESLint/Oxlint + Prettier  
**Package manager:** npm + <code>package-lock.json</code>  
**Repositorio de autoridad comercial/API:** <code>homex-backend</code>  
**Repositorio de autoridad NLP:** <code>homex-nlp</code>  
**Repositorio de despliegue:** <code>homex-deploy</code>

---

# 0. Propósito de este documento

Este documento es el contrato de ejecución del frontend HOMEX. Su objetivo es que una persona o un agente de desarrollo pueda tomar una fase concreta, implementarla sin reinterpretar el dominio, probarla de forma objetiva y demostrar que quedó cerrada antes de iniciar la siguiente.

El frontend no se desarrollará como una sucesión de pantallas aisladas. Cada fase define:

1. precondiciones;
2. fuentes de autoridad;
3. alcance permitido;
4. decisiones de arquitectura y UX ya congeladas;
5. trabajo obligatorio;
6. trabajo prohibido;
7. pruebas obligatorias;
8. gate local;
9. gate CI;
10. evidencia de cierre;
11. condición exacta para avanzar.

Una fase **NO** se considera terminada porque:

- la vista se vea bien;
- Vite arranque;
- el build compile;
- exista un commit;
- un flujo funcione una vez manualmente;
- una prueba unitaria aislada pase;
- se hayan usado datos mock para simular el backend;
- una captura de pantalla se parezca a un mockup.

Una fase solo se cierra cuando todos sus gates obligatorios están verdes, no existen errores TypeScript, no hay tests críticos omitidos, CI remoto está verde y la evidencia de fase está versionada.

**Responsive es una condición transversal y no una fase tardía.** Todo componente, vista, formulario, tabla, modal, navegación, estado vacío, flujo comercial y flujo NLP que se implemente debe nacer responsive desde su propia fase. Está prohibido acumular “deuda responsive” para corregirla al final en FE08.

Los mockups visuales utilizados durante el diseño son **referencias de ideas**, no contratos pixel-perfect. Este plan prevalece sobre cualquier contradicción visual de los mockups.

---

# 1. Estado inicial confirmado

El repositorio parte prácticamente del scaffold generado por Create Vue.

Estado previo a este documento:

- un único commit funcional inicial;
- <code>App.vue</code> mantiene el contenido de demostración;
- el router existe, pero no contiene rutas comerciales;
- Pinia contiene el store de ejemplo <code>counter</code>;
- existe una prueba de ejemplo que valida el texto “You did it!”;
- no existen módulos de dominio HOMEX;
- no existe cliente HTTP de aplicación;
- no existe autenticación integrada;
- no existe design system;
- no existe CI específica del proyecto;
- no existe integración OpenAPI;
- no existe E2E;
- no existe arquitectura modular implementada.

Dependencias actuales relevantes:

- Vue 3.5.x;
- Vue Router 5.x;
- Pinia 4.x;
- TypeScript 6.x;
- Vite 8.x;
- Vitest 4.x;
- Vue Test Utils;
- ESLint + Oxlint;
- Prettier.

Los scripts iniciales de lint/formato modifican archivos mediante <code>--fix</code>/<code>--write</code>. FE00 debe separar comandos de comprobación y comandos de corrección para que CI nunca “arregle” código silenciosamente.

---

# 2. Jerarquía de autoridad

Cuando dos fuentes parezcan contradecirse, usar este orden:

1. contrato OpenAPI aprobado de <code>homex-backend</code>;
2. requisitos empresariales y plan maestro vigente de <code>homex-backend</code>;
3. <code>homex-nlp/docs/requirements.md</code>;
4. <code>homex-nlp/docs/integration-django.md</code>;
5. <code>homex-nlp/docs/contract-v1.md</code>;
6. este Plan Maestro Frontend;
7. documentación de implementación de cada fase;
8. mockups;
9. código de demostración, fixtures visuales o prototipos históricos.

Para identidad visual, navegación, componentes y UX, este plan es la autoridad del frontend.

Para permisos, estados, totales, stock, cobros, aprobación, idempotencia y persistencia, el frontend **no es autoridad**.

Está prohibido compensar una ausencia del backend inventando un campo, estado, porcentaje, endpoint o regla comercial en Vue.

---

# 3. Arquitectura objetivo

HOMEX Frontend utilizará una **arquitectura modular por funcionalidades (Feature-Based Architecture)** con separación clara entre aplicación, módulos de dominio y recursos compartidos.

No se aplicará Clean Architecture estricta en cada módulo porque añadiría capas ceremoniales innecesarias para el alcance real del proyecto.

Estructura objetivo:

~~~text
src/
├── app/
│   ├── config/
│   ├── layouts/
│   ├── router/
│   ├── providers/
│   └── stores/
│
├── modules/
│   ├── auth/
│   ├── resumen/
│   ├── clientes/
│   ├── productos/
│   ├── proformas/
│   ├── pedidos/
│   ├── ordenes-trabajo/
│   ├── notas-entrega/
│   ├── movimientos-stock/
│   ├── recibos/
│   ├── capturas/
│   └── catalogos-sistema/
│
├── shared/
│   ├── api/
│   ├── composables/
│   ├── icons/
│   ├── styles/
│   ├── types/
│   ├── ui/
│   └── utils/
│
├── generated/
│   └── api/
│
├── tests/
│   ├── factories/
│   ├── fixtures/
│   └── msw/
│
├── App.vue
└── main.ts
~~~

Un módulo puede contener, solo cuando lo necesite:

~~~text
modules/proformas/
├── components/
├── composables/
├── services/
├── stores/
├── types/
├── views/
└── tests/
~~~

No crear carpetas vacías por ritual.

## 3.1. Flujo de dependencias

~~~text
Vista / componente
        ↓
Composable / store de módulo
        ↓
Service / API adapter
        ↓
shared/api
        ↓
Django / DRF
~~~

Reglas:

- un componente Vue no ejecuta <code>fetch</code> directamente;
- un módulo no importa internals privados de otro módulo;
- lo realmente compartido sube a <code>shared</code>;
- Pinia no se usa como repositorio universal de todo el servidor;
- los datos remotos no se duplican globalmente si solo los necesita una vista;
- <code>generated/api</code> se genera desde OpenAPI y no se edita manualmente.

---

# 4. Convención definitiva de idioma y nomenclatura

Esta decisión se congela antes de FE00.

## 4.1. Framework e infraestructura: inglés

Se mantienen en inglés:

- <code>app</code>, <code>modules</code>, <code>shared</code>, <code>generated</code>, <code>tests</code>;
- <code>components</code>, <code>views</code>, <code>composables</code>, <code>services</code>, <code>stores</code>, <code>types</code>;
- <code>router</code>, <code>layouts</code>, <code>config</code>;
- APIs nativas, Vue, Pinia, TypeScript, Vite y librerías;
- componentes genéricos reutilizables: <code>Button</code>, <code>Modal</code>, <code>DataTable</code>, <code>EmptyState</code>, <code>AppSidebar</code>, etc.;
- símbolos propios del framework como <code>props</code>, <code>emit</code>, <code>ref</code>, <code>computed</code>, <code>watch</code>.

## 4.2. Dominio HOMEX: español

Módulos, entidades y conceptos comerciales propios de HOMEX se expresan en español:

- <code>clientes</code>;
- <code>productos</code>;
- <code>proformas</code>;
- <code>pedidos</code>;
- <code>ordenes-trabajo</code>;
- <code>notas-entrega</code>;
- <code>movimientos-stock</code>;
- <code>recibos</code>;
- <code>capturas</code>;
- <code>catalogos-sistema</code>.

Ejemplos de componentes de dominio:

- <code>ListaProformas.vue</code>;
- <code>FormularioCliente.vue</code>;
- <code>TarjetaProducto.vue</code>;
- <code>DetallePedido.vue</code>;
- <code>RevisionCaptura.vue</code>.

Los campos recibidos desde el backend conservan exactamente la semántica del contrato OpenAPI. No se crean alias arbitrarios para “hacerlos más bonitos”.

## 4.3. Texto visible

Toda la interfaz operativa se redacta en español.

Locale objetivo inicial: <code>es-BO</code>.

Los identificadores técnicos no llevan tildes ni caracteres especiales; el texto visible sí.

## 4.4. Regla anti-refactor mecánico

Quedan prohibidos reemplazos globales ciegos para traducir:

- nombres de APIs;
- nombres de métodos nativos;
- nombres de propiedades generadas desde OpenAPI;
- símbolos de librerías;
- rutas externas;
- contratos NLP.

Cualquier cambio de nomenclatura posterior a FE00 debe ser deliberado, acotado y cubierto por pruebas.

---

# 5. Responsabilidades y límites del frontend

El frontend es responsable de:

- presentación;
- navegación;
- formularios;
- accesibilidad;
- feedback al usuario;
- validaciones de UX no autoritativas;
- corrección humana HITL;
- visualización de estados;
- envío de comandos al backend;
- adaptación visual claro/oscuro;
- conservación local de preferencias visuales no sensibles.

El frontend **NO** es autoridad para:

- stock;
- reserva de stock;
- totales comerciales;
- saldo;
- descuentos definitivos;
- aprobación;
- cancelación;
- transiciones válidas;
- permisos;
- numeraciones oficiales;
- creación de pedido/OT;
- recibos;
- notas de entrega;
- evidencia NLP original.

Un botón puede ocultarse por UX, pero el backend debe seguir rechazando accesos no autorizados.

Un total puede mostrarse provisionalmente en un formulario, pero el valor persistido y definitivo siempre es la respuesta del backend.

---

# 6. Contrato backend y OpenAPI

OpenAPI es el contrato frontend ↔ backend.

## 6.1. Regla principal

No escribir manualmente tipos TypeScript que pretendan duplicar DTOs ya descritos por OpenAPI.

Se utilizará <code>openapi-typescript</code> o herramienta equivalente aprobada para generar tipos en:

<code>src/generated/api/</code>

Los archivos generados:

- no se editan manualmente;
- deben ser reproducibles;
- se actualizan solo cuando se acepta una nueva versión del contrato backend.

## 6.2. Snapshot contractual

El frontend mantendrá un snapshot versionado del OpenAPI backend aprobado para el release, por ejemplo:

~~~text
contracts/
├── backend-openapi.yaml
└── backend-ref.txt
~~~

<code>backend-ref.txt</code> identifica el commit/tag backend del que procede el contrato.

CI debe comprobar que los tipos generados corresponden exactamente al snapshot versionado.

No se consumirá automáticamente “latest main” durante CI porque haría el build no reproducible.

## 6.3. Cliente HTTP

Se utilizará inicialmente <code>fetch</code> nativo mediante un wrapper central en <code>shared/api</code>.

No instalar Axios por defecto.

El cliente debe resolver:

- URL base por entorno;
- headers aceptados;
- autenticación según contrato backend;
- serialización JSON;
- <code>AbortController</code>;
- normalización de errores;
- 401;
- 403;
- 404;
- 409;
- errores de validación por campo;
- errores de red;
- timeout lógico cuando corresponda.

No realizar reintentos automáticos de mutaciones.

Excepción: captura NLP con <code>clave_idempotencia</code> puede repetir exactamente la misma petición según T09.

---

# 7. Estado global y Pinia

Pinia se utiliza con moderación.

Estado global permitido:

- sesión/autenticación;
- capacidades/permisos recibidos del backend;
- información mínima del usuario autenticado;
- estado global excepcional que realmente atraviese varios módulos.

Preferencias UI simples como tema y sidebar pueden persistirse directamente mediante un composable dedicado y <code>localStorage</code>.

Está prohibido almacenar en <code>localStorage</code>:

- catálogo completo;
- proformas;
- pedidos;
- recibos;
- resultados NLP persistidos;
- audio;
- datos personales de clientes;
- tokens de larga duración sin una decisión explícita de seguridad.

No crear un “mega store” que replique la base de datos del servidor.

---

# 8. Identidad visual HOMEX

La identidad base queda congelada:

- **Rojo HOMEX:** <code>#B20A0A</code>;
- **Carbón:** <code>#1F1F1F</code>;
- **Blanco cálido:** <code>#F8F7F5</code>.

## 8.1. Escala roja

~~~text
50   #FDF2F2
100  #FBE3E3
200  #F6C5C5
300  #EE9898
400  #E26767
500  #D32727
600  #B20A0A  ← marca oficial
700  #920808
800  #750707
900  #5E0808
950  #350303
~~~

No usar valores rojos improvisados fuera de tokens.

## 8.2. Tema claro

~~~text
background            #F8F7F5
surface               #FFFFFF
surface-soft          #F1EFEC
surface-muted         #EAE7E3

text-primary          #1F1F1F
text-secondary        #625E59
text-muted            #85807A

border                #DEDAD5
border-strong         #C9C3BC

primary               #B20A0A
primary-hover         #920808
primary-active        #750707
primary-soft          #FDF2F2
~~~

## 8.3. Tema oscuro

~~~text
background            #121212
surface               #1F1F1F
surface-raised        #272727
surface-hover         #303030

text-primary          #F5F3F1
text-secondary        #B8B3AE
text-muted            #8F8A85

border                #383838
border-strong         #494949

primary-filled        #D32727
primary-hover         #E13A3A
primary-accent        #F05252
~~~

El Rojo HOMEX oficial no debe usarse como texto pequeño directamente sobre carbón oscuro porque su contraste es insuficiente. En dark mode, texto/iconos de acento utilizarán una variante luminosa como <code>#F05252</code>.

## 8.4. Colores semánticos

Marca y error no son el mismo concepto.

Definir tokens independientes para:

- <code>success</code>;
- <code>warning</code>;
- <code>danger</code>;
- <code>info</code>;
- <code>neutral</code>.

Los estados nunca se comunican únicamente mediante color; incluyen texto y, cuando aporte valor, icono.

---

# 9. Tema claro y oscuro

HOMEX tendrá ambos modos desde FE01.

Reglas:

- atributo de tema en el elemento raíz, por ejemplo <code>data-theme</code>;
- tokens CSS semánticos, no colores hardcodeados en componentes;
- preferencia persistida localmente;
- primera visita puede respetar <code>prefers-color-scheme</code>;
- no debe existir flash visible de tema incorrecto al cargar;
- <code>color-scheme</code> debe configurarse correctamente;
- todos los componentes se prueban en ambos temas.

El modo oscuro no es una inversión automática del claro.

---

# 10. Tipografía, iconografía y geometría

## 10.1. Tipografía

Familia principal: **Inter**.

Preferencia: empaquetar la fuente mediante dependencia local, no CDN de terceros.

Escala inicial:

~~~text
Page title        32px / 40px / 700
Section title     24px / 32px / 650–700
Subsection        20px / 28px / 600
Card title        16px / 24px / 600
Body              14px / 20px / 400
Body strong       14px / 20px / 600
Small             12px / 16px / 400–600
~~~

No mezclar tipografía serif para títulos operativos.

No utilizar titulares publicitarios de 50–60px en módulos administrativos.

## 10.2. Iconos

Familia objetivo: **Lucide**, estilo outline.

No mezclar múltiples familias de iconos.

El icono acompaña al texto; no reemplaza etiquetas esenciales salvo en sidebar colapsado o icon buttons con tooltip/aria-label.

## 10.3. Espaciado

Sistema base de 4px:

<code>4, 8, 12, 16, 20, 24, 32, 40, 48</code>

## 10.4. Radios

~~~text
input/button      8px
card              12px
dialog/modal      16px
badge             6–999px según componente
~~~

## 10.5. Sombras

Sombras mínimas y funcionales.

El diseño prioriza bordes y contraste de superficie antes que sombras grandes.

---

# 11. Layout global definitivo

## 11.1. Sidebar

El sidebar es el patrón principal y permanente de navegación de HOMEX, pero su comportamiento se adapta al viewport.

En desktop (≥ 1024px):

- sidebar visible permanentemente;
- estado expandido aproximado: <code>264px</code>;
- estado compacto aproximado: <code>72px</code>;
- el usuario puede alternar entre ambos estados;
- la preferencia se conserva localmente.

Expandido:

- marca HOMEX;
- grupos de navegación;
- icono + texto;
- badges cuando sean datos reales;
- selector de tema al pie;
- usuario al pie.

Compacto:

- marca simplificada;
- iconos;
- tooltip accesible en hover/focus;
- selección visible;
- badges cuando aporten valor;
- tema y avatar/usuario compactos.

En tablet (768–1023px):

- el sidebar puede iniciar compacto;
- puede expandirse como overlay sin reducir excesivamente el contenido;
- nunca debe bloquear acciones esenciales;
- el mismo árbol de navegación se conserva.

En móvil (< 768px):

- el sidebar se convierte en drawer/off-canvas;
- no queda una columna fija de 72px que desperdicie ancho;
- el disparador de navegación forma parte del <code>PageHeader</code> móvil, no de una topbar global;
- al abrirse conserva marca, navegación, selector de tema y usuario;
- el drawer atrapa foco, cierra con Escape y devuelve el foco al disparador;
- no se crea una segunda navegación móvil distinta.

## 11.2. No existe topbar global

Queda expresamente descartada una topbar permanente.

No habrá en una barra superior global:

- usuario;
- selector de tema;
- notificaciones;
- búsqueda;
- workspace;
- botón “Nueva proforma”.

Cada módulo controla sus acciones dentro de su propio encabezado.

En móvil puede existir dentro del <code>PageHeader</code> el botón de apertura del drawer; esto no constituye una topbar global.

## 11.3. Contenido

El área de contenido:

- utiliza fondo cálido en light;
- usa ancho máximo aproximado de 1440px para contenido general;
- mantiene márgenes/padding consistentes;
- permite tablas más anchas cuando sea necesario;
- no estira formularios y cards innecesariamente en ultrawide;
- nunca debe provocar overflow horizontal a nivel de página;
- reorganiza columnas, formularios y acciones según espacio disponible.

Padding orientativo:

- desktop amplio: 32px;
- desktop/tablet: 24px;
- móvil: 16px;
- móvil muy estrecho: 12px cuando sea necesario.

---

# 12. Navegación definitiva

Estructura inicial:

~~~text
HOMEX

GENERAL
  Resumen

COMERCIAL
  Clientes
  Proformas
  Productos

OPERACIONES
  Pedidos
  Órdenes de trabajo
  Notas de entrega

STOCK
  Movimientos de stock

FINANZAS
  Recibos

INTELIGENCIA
  Capturas

SISTEMA
  Catálogos

────────────────

Claro / Oscuro
Usuario
~~~

No crear:

- selector “HOMEX Bolivia”;
- multiworkspace;
- multitenancy visual;
- “Producción” como concepto paralelo a Órdenes de trabajo;
- “Inventario” como módulo genérico si el backend modela movimientos de stock.

Los ítems visibles deben respetar capacidades/permisos, pero el backend continúa siendo autoridad.

---

# 13. Rutas objetivo

Mapa inicial:

~~~text
/login

/resumen

/clientes
/clientes/:id

/productos
/productos/:id

/proformas
/proformas/nueva
/proformas/:id

/pedidos
/pedidos/:id

/ordenes-trabajo
/ordenes-trabajo/:id

/notas-entrega
/notas-entrega/:id

/movimientos-stock

/recibos
/recibos/:id

/capturas
/capturas/nueva
/capturas/:id

/catalogos
~~~

La raíz redirige a la ruta permitida adecuada, normalmente <code>/resumen</code>.

Las rutas se cargan de forma lazy por módulo cuando sea razonable.

No crear rutas futuras “por si acaso”.

---

# 14. Patrones UX globales

## 14.1. Encabezado de página

Patrón:

~~~text
Título
Descripción breve y funcional                         [acción contextual]
~~~

No usar permanentemente grandes slogans como:

- “Todo bajo control.”;
- “Cotizaciones que avanzan.”;
- “Del sí a la entrega.”.

Pueden existir microcopys humanos puntuales en Resumen, pero no dominan el layout.

## 14.2. Acciones contextuales

No existe botón global “Nueva proforma”.

<code>Nueva proforma</code> aparece únicamente en contextos pertinentes, por ejemplo:

- lista de proformas;
- ficha de cliente si el flujo lo justifica.

Lo mismo aplica a “Nuevo cliente”, “Emitir recibo”, etc.

## 14.3. Búsqueda

No existe buscador global.

Cada módulo puede tener búsqueda propia según API:

- clientes → nombre/documento/contacto según contrato;
- proformas → número/cliente;
- productos → SKU/nombre;
- pedidos → número/cliente.

## 14.4. Filtros

Los módulos de listado deben compartir un patrón común de:

- búsqueda;
- filtros;
- contador de filtros activos;
- ordenamiento;
- paginación;
- selector de columnas solo cuando aporte valor.

Filtros y paginación deberían reflejarse en query params cuando ello mejore volver/compartir URL.

## 14.5. Feedback

Definir consistentemente:

- loading;
- skeleton;
- empty;
- no-results;
- error;
- forbidden;
- not-found;
- success;
- confirmación destructiva;
- processing.

No depender únicamente de toasts.

## 14.6. Heurísticas de Nielsen — criterio transversal obligatorio

A partir de FE03.5, toda interfaz existente y toda interfaz nueva debe diseñarse y revisarse contra las **10 heurísticas de usabilidad de Jakob Nielsen**. No constituyen una capa visual opcional ni sustituyen accesibilidad, responsive, permisos o contrato OpenAPI.

La aplicación práctica en HOMEX es:

1. **Visibilidad del estado del sistema.** Toda carga, guardado, envío, aprobación, procesamiento o error debe comunicar claramente qué está ocurriendo y cuándo termina. No dejar acciones aparentemente inertes.
2. **Correspondencia entre el sistema y el mundo real.** Usar lenguaje comercial de HOMEX, nombres semánticos y unidades comprensibles. Si el backend expone código/nombre, no presentar IDs técnicos como significado de negocio.
3. **Control y libertad del usuario.** Permitir cancelar/cerrar operaciones de interfaz cuando sea seguro, volver sin quedar atrapado y confirmar acciones destructivas o irreversibles. No inventar reversas comerciales que el backend no permita.
4. **Consistencia y estándares.** Botones, formularios, tablas, badges, mensajes, navegación, ubicación de acciones y terminología deben seguir los mismos componentes y patrones en todos los módulos.
5. **Prevención de errores.** Deshabilitar o no ofrecer acciones imposibles según estado/capacidad conocida, validar antes de enviar cuando aporte UX y pedir confirmación donde el riesgo lo justifique. El backend sigue siendo autoridad.
6. **Reconocimiento antes que recuerdo.** Hacer visibles etiquetas, contexto, filtros activos, opciones y estado actual; no obligar al usuario a recordar IDs, códigos internos o información de una pantalla anterior.
7. **Flexibilidad y eficiencia de uso.** Los flujos frecuentes deben ser directos, operables por teclado y sin pasos redundantes. Atajos solo se incorporan si son descubribles, accesibles y realmente útiles.
8. **Diseño estético y minimalista.** Mostrar lo necesario para la tarea actual, con jerarquía visual clara; eliminar controles, textos o decoraciones redundantes que compitan con acciones comerciales.
9. **Ayudar a reconocer, diagnosticar y recuperarse de errores.** Los errores deben indicar qué ocurrió, qué campo/acción está afectado y cómo continuar. Los datos introducidos no deben perderse innecesariamente tras un fallo recuperable.
10. **Ayuda y documentación.** Conceptos no obvios deben tener ayuda contextual breve, labels/descripciones accesibles o documentación enlazable cuando corresponda. No convertir cada pantalla en un manual.

Reglas de verificación:

- cada fase nueva debe indicar qué heurísticas afecta y cómo las verifica;
- una mejora heurística no puede duplicar reglas de dominio en Vue;
- no se considera evidencia suficiente una apreciación visual subjetiva;
- cuando una heurística admita automatización, debe existir prueba unitaria, de componente, integración o E2E;
- lo que requiera revisión humana debe quedar en una matriz de auditoría versionada con escenario, evidencia y resultado;
- accesibilidad WCAG/axe, responsive y heurísticas Nielsen son gates complementarios, no equivalentes.

---

# 15. Tablas

Las tablas son la visualización principal para entidades operativas en desktop, pero **deben tener una estrategia responsive explícita**.

Patrón compartido:

~~~text
[Buscar…] [Filtros] [Columnas opcional]             [Acción contextual]

┌─────────────────────────────────────────────────────────────┐
│ columnas                                                   │
├─────────────────────────────────────────────────────────────┤
│ filas                                                       │
└─────────────────────────────────────────────────────────────┘

Mostrando X de Y                               < 1 2 3 >
~~~

Reglas:

- paginación del servidor cuando el contrato la soporte;
- no cargar cientos/miles de registros para paginar en cliente;
- cabeceras semánticas;
- fila accionable no puede ser el único mecanismo: debe ser navegable con teclado;
- estados con badge;
- moneda explícita;
- fechas consistentes;
- acciones destructivas fuera de clic accidental;
- en desktop se usa tabla completa;
- en tablet se priorizan columnas esenciales y las secundarias pueden pasar a detalle;
- en móvil, cuando una tabla resulte ilegible, debe transformarse en lista/card responsive o patrón maestro-detalle;
- el scroll horizontal interno se permite solo para tablas excepcionalmente densas y nunca como solución por defecto;
- ninguna acción crítica puede quedar fuera de pantalla;
- no se permite overflow horizontal del documento completo.

---

# 16. Catálogo visual de productos

Esta decisión forma parte del diseño objetivo.

Productos tendrá dos vistas:

1. cuadrícula visual;
2. lista/tabla administrativa.

La cuadrícula es la vista recomendada para exploración comercial.

Tarjeta de producto:

~~~text
┌────────────────────────┐
│ categoría               │
│                        │
│      FOTO PRODUCTO     │
│                        │
├────────────────────────┤
│ SKU                    │
│ Nombre                 │
│ Presentación / detalle │
│                        │
│ Precio         Stock   │
└────────────────────────┘
~~~

Debe mostrar, según contrato real:

- imagen principal;
- SKU;
- nombre;
- tipo/categoría;
- presentación relevante;
- precio;
- moneda;
- stock;
- promoción vigente si existe.

La imagen:

- usa fondo neutral;
- <code>object-fit: contain</code> cuando corresponda;
- carga lazy;
- tiene alt adecuado;
- tiene placeholder/fallback cuando no existe;
- no deforma el layout.

## 16.1. Contrato definitivo de imágenes y media

La decisión ya no está pendiente.

Producción utilizará **Cloudflare R2 Standard** como almacenamiento persistente de media, gestionado exclusivamente por <code>homex-backend</code> mediante Django <code>STORAGES</code>. El frontend no conoce credenciales, buckets, endpoint S3 ni reglas internas del proveedor.

Arquitectura congelada:

~~~text
Vue
 │
 │ multipart/form-data
 ▼
Django/DRF
 │
 ├── valida y procesa con Pillow
 ├── genera WebP 320/640/1280
 └── Cloudflare R2 Standard
       └── homex-public-media
            ├── productos/ → catálogo
            └── proformas/ → referencias de muebles a pedido
~~~

### Imagen principal de producto

Cada producto puede tener **cero o una** imagen principal. No existe galería en la primera versión.

El backend expone la imagen principal como recurso OpenAPI; Vue nunca construye rutas de R2.

La respuesta debe permitir generar <code>srcset</code> a partir de variantes disponibles. Cada variante expuesta incluye al menos:

- URL;
- ancho real;
- alto real;
- formato WebP.

El original no se carga por defecto en tarjetas/listados.

Reglas frontend:

- <code>loading="lazy"</code> fuera de contenido inmediatamente visible;
- <code>srcset</code> + <code>sizes</code>;
- dimensiones/aspect ratio reservados para evitar layout shift;
- <code>object-fit: contain</code> cuando corresponda;
- alt basado en nombre/contexto del producto;
- fallback estable cuando <code>imagen_principal = null</code>;
- error de red/imagen rota cae a fallback sin romper la card.

### Archivos de referencia de proforma

Una línea de mueble a pedido puede tener múltiples imágenes de referencia persistentes.

El flujo es exclusivamente:

~~~text
Vue → Django/DRF → R2 público
~~~

No existe subida directa navegador → R2.

Vue puede crear una preview local efímera con <code>URL.createObjectURL()</code> antes de enviar, pero:

- se revoca al dejar de necesitarla;
- no se persiste en Pinia;
- no se persiste en localStorage/IndexedDB;
- no se trata como confirmación de subida.

Los adjuntos persistentes de proforma se sirven mediante URL pública estable/cacheable del dominio de medios. **La lectura de la imagen no requiere autenticación una vez que alguien conoce su URL**; esta es una decisión explícita del producto. La creación, reemplazo y eliminación continúan pasando por Django y respetan autenticación, permisos y estado comercial.

### Formatos aceptados

La UI permite seleccionar únicamente:

- JPEG;
- PNG;
- WebP.

SVG no se admite en la primera versión.

La validación del navegador es de UX; la validación autoritativa siempre pertenece al backend.

### Regla de independencia del proveedor

Vue consume solo el contrato OpenAPI. Está prohibido:

- importar SDK de Cloudflare/AWS para media;
- usar access keys o secrets;
- conocer nombres de buckets como requisito funcional;
- construir URLs del proveedor o derivar keys/rutas;
- guardar imagen en Base64 como dato comercial.

FE01 y FE02 no dependen del storage. **FE03 y FE04 sí requieren F07.7 del backend cerrado y OpenAPI actualizado.**

---

# 17. Estados comerciales y badges

No inventar porcentajes de avance.

Quedan descartadas barras del tipo:

<code>Pedido 72%</code>

si el backend no mide avance porcentual real.

Los pedidos muestran estados reales y, opcionalmente, un stepper discreto basado en transiciones reales.

Ejemplos visuales conceptuales:

- BORRADOR → neutral;
- ENVIADA → info;
- APROBADA → success;
- CANCELADA → danger;
- EN_PRODUCCION → warning;
- LISTO_ENTREGA → success;
- ENTREGADO → success fuerte/neutral final.

La lista exacta procede del backend; el frontend no agrega estados.

---

# 18. Dashboard / Resumen

Resumen debe ser operativo, no decorativo.

Reglas:

- pocas KPI cards;
- pocas gráficas;
- ninguna métrica inventada;
- contenido adaptado al rol/capacidades;
- no mostrar “99.9% sistema operativo” sin observabilidad real;
- no mostrar “última sincronización” permanente;
- no mostrar notificaciones sin contrato;
- no mostrar “stock valorizado” si no está definida la semántica económica;
- no mostrar comparaciones porcentuales si el backend no proporciona un período comparable inequívoco.

Posibles bloques válidos, cuando existan datos reales:

- proformas activas;
- pedidos por estado;
- órdenes pendientes;
- entregas próximas;
- recibos/saldo con semántica definida;
- capturas pendientes de revisión;
- tiempo medio MANUAL vs NLP+HITL.

Las métricas NLP deben explicar claramente la variable. Ejemplo preferido:

~~~text
Tiempo medio de elaboración
Manual             9m 03s
NLP + revisión     3m 29s
↓ 61 % de tiempo
~~~

No mostrar simplemente “61% eficiencia” sin definición.

Gráficas se introducen únicamente cuando responden una pregunta operativa clara. La librería de gráficas no se instala en FE00/FE01.

---

# 19. Autenticación y permisos

El backend autentica y autoriza.

El frontend:

- presenta login;
- mantiene la sesión según el contrato elegido por backend;
- protege navegación mediante route guards;
- oculta/deshabilita acciones no disponibles para mejorar UX;
- maneja 401 y 403;
- nunca considera el route guard como seguridad suficiente.

No decidir unilateralmente almacenamiento de JWT de larga duración.

Si backend admite cookies HttpOnly seguras, preferirlas. Si el contrato vigente usa bearer token, implementar exactamente la estrategia acordada y documentarla en FE02.

Debe existir una fuente única de capacidades del usuario. No duplicar una matriz de roles escrita manualmente en varios componentes.

---

# 20. Dinero, fechas y formatos

## 20.1. Dinero

BOB y USD son explícitos.

No hay conversión automática.

Los importes del API se tratan como decimal string, no como <code>float</code> comercial.

Helpers centralizados:

- <code>formatMoney</code>;
- <code>formatDecimal</code>;
- validación/parsing controlado.

Si se necesita cálculo provisional en UI, utilizar decimal exacto mediante una librería como <code>decimal.js</code> y considerar el resultado solo una vista previa. La respuesta backend siempre reemplaza el valor provisional tras guardar.

Regresión obligatoria:

- cantidad 3;
- total negociado 100.00;
- UI conserva 100.00;
- no lo convierte en 300.00.

## 20.2. Fechas

Locale inicial: <code>es-BO</code>.

Una fecha pura del backend no debe sufrir desplazamiento de zona horaria al parsearse.

Los datetime deben respetar el offset/contrato backend.

No mezclar formatos arbitrarios entre módulos.

---

# 21. NLP, audio y HITL

El navegador **no llama directamente a homex-nlp**.

Flujo:

~~~text
Navegador
  ↓ audio / texto
Django
  ↓
worker / ASR / homex-nlp
  ↓
Django persiste evidencia
  ↓
Frontend consulta propuesta
  ↓
Humano corrige
  ↓
Frontend envía corrección humana
  ↓
Django confirma transacción
~~~

## 21.1. Audio

- captura mediante APIs del navegador;
- no persistir audio en localStorage/IndexedDB;
- no crear historial de audio;
- no reproducir audio histórico una vez backend lo haya eliminado;
- manejar permiso denegado del micrófono;
- manejar navegador sin soporte;
- mostrar estado de carga/procesamiento;
- permitir cancelar antes de envío.

## 21.2. Idempotencia

El frontend genera <code>clave_idempotencia</code> UUID para el POST de captura.

Un reintento del mismo envío reutiliza la misma clave.

No reutilizar la clave para contenido distinto.

409 se presenta como conflicto explícito, no como error genérico silencioso.

## 21.3. Evidencia IA

El original IA procede del servidor.

El navegador no debe enviar una copia de la propuesta IA para que backend la confíe como original.

El frontend envía la corrección humana requerida por el contrato.

Confirmar captura **no aprueba comercialmente la proforma**.

## 21.4. Offsets Unicode

homex-nlp persiste offsets como índices de puntos de código Unicode de Python.

JavaScript usa UTF-16.

El frontend implementará y probará un conversor explícito antes de resaltar evidencia.

Pruebas obligatorias con:

- texto ASCII;
- tildes;
- ñ;
- símbolos;
- emoji;
- secuencias Unicode que ocupen dos unidades UTF-16.

Nunca reescribir offsets persistidos para “adaptarlos” a JavaScript.

## 21.5. Estados NLP

La UI debe contemplar:

- PENDIENTE;
- PROCESANDO;
- COMPLETADA;
- ERROR;

y resultados contractuales:

- REQUIRES_REVIEW;
- NO_PROPOSAL;
- ERROR.

No representar ausencia de propuesta como éxito vacío.

---

# 22. CSS y design system

No utilizar Tailwind, Vuetify, PrimeVue u otro framework visual en la baseline.

Motivos:

- identidad HOMEX propia;
- evitar estilos impuestos;
- controlar light/dark;
- reducir dependencia del diseño a una librería externa.

Base:

~~~text
shared/styles/
├── tokens.css
├── themes.css
├── base.css
└── utilities.css   ← solo utilidades verdaderamente globales
~~~

Componentes con estilos scoped cuando corresponda.

Prohibido:

- colores hex hardcodeados repetidos en componentes;
- tamaños arbitrarios sin tokens;
- <code>!important</code> como solución habitual;
- estilos globales específicos de una página;
- copiar CSS de mockups sin integrarlo al sistema.

---

# 23. Componentes base obligatorios

FE01 debe establecer, con API consistente, al menos:

- <code>AppSidebar</code>;
- <code>PageHeader</code>;
- <code>Button</code>;
- <code>IconButton</code>;
- <code>TextField</code>;
- <code>SearchField</code>;
- <code>Select</code>;
- <code>Checkbox</code>;
- <code>Radio</code>;
- <code>Switch</code>;
- <code>Badge</code>;
- <code>StatusBadge</code>;
- <code>Card</code>;
- <code>KpiCard</code>;
- <code>DataTable</code> o primitives suficientes para tablas consistentes;
- <code>Pagination</code>;
- <code>FilterBar</code>;
- <code>Modal/Dialog</code>;
- <code>ConfirmDialog</code>;
- <code>Tooltip</code>;
- <code>Toast</code>;
- <code>LoadingSkeleton</code>;
- <code>EmptyState</code>;
- <code>ErrorState</code>;
- <code>ForbiddenState</code>.

No construir una megabiblioteca antes de necesitarlos; FE01 crea el núcleo y fases posteriores pueden ampliar de forma controlada.

---

# 24. Accesibilidad

Objetivo mínimo: WCAG 2.1 AA en flujos principales.

Reglas:

- contraste suficiente;
- foco visible;
- navegación por teclado;
- labels de formulario reales;
- errores vinculados mediante ARIA cuando aplique;
- icon buttons con nombre accesible;
- tablas con semántica adecuada;
- diálogos con control de foco;
- estados no comunicados solo por color;
- sidebar compacto navegable por teclado;
- tooltips no como única fuente de información crítica;
- respeto razonable de <code>prefers-reduced-motion</code>.

Los tests E2E críticos utilizarán <code>@axe-core/playwright</code> o equivalente para detectar violaciones serias/críticas.

---

# 25. Responsive universal — regla no negociable

HOMEX debe ser **full responsive en todo lo que se implemente**.

Responsive no significa únicamente “que no se rompa”. Significa que cada flujo principal debe seguir siendo comprensible, navegable y operable en desktop, tablet y móvil, adaptando composición y densidad sin perder funcionalidad esencial.

Esta regla aplica desde FE01 y a **cada nueva vista/componente en su propia fase**. FE08 verifica y endurece; no es la fase donde se “arregla responsive”.

## 25.1. Viewports de aceptación

Matriz mínima obligatoria para interfaces nuevas:

- 360px: móvil estrecho;
- 390px: móvil común;
- 768px: tablet vertical;
- 1024px: tablet horizontal / desktop compacto;
- 1440px: desktop estándar/amplio.

Además se debe comprobar que el layout siga siendo estable entre estos puntos, no solo exactamente en ellos.

No asumir únicamente dispositivos específicos; los breakpoints responden al contenido.

## 25.2. Reglas globales

En cualquier viewport:

- no debe existir overflow horizontal a nivel de página;
- texto crítico no se corta ni se solapa;
- acciones principales siguen accesibles;
- modales/dialogs caben y pueden desplazarse internamente;
- formularios cambian de multi-columna a una columna cuando sea necesario;
- cards reorganizan grid automáticamente;
- filtros se apilan o condensan sin desaparecer;
- botones pueden ocupar ancho completo en móvil cuando mejora uso;
- targets táctiles deben ser cómodos;
- estados loading/empty/error/forbidden también son responsive;
- dark/light deben funcionar en todos los tamaños;
- no se oculta información comercial esencial solo para “hacer que quepa”.

## 25.3. Navegación responsive

- ≥ 1024px: sidebar permanente, expandido o compacto;
- 768–1023px: sidebar compacto por defecto, con expansión overlay cuando convenga;
- < 768px: drawer/off-canvas accesible desde el <code>PageHeader</code>;
- tema y usuario permanecen en la parte inferior de esa navegación;
- no introducir topbar global para resolver móvil.

## 25.4. Tablas responsive

Prioridad:

1. tabla completa en desktop;
2. reducción de columnas y detalle progresivo en tablet;
3. lista/card o maestro-detalle en móvil;
4. scroll horizontal interno solo cuando la naturaleza de los datos lo haga realmente necesario.

Las acciones críticas nunca pueden requerir desplazarse horizontalmente para descubrir que existen.

## 25.5. Formularios responsive

- desktop: dos o más columnas cuando mejore lectura;
- tablet: una o dos columnas según contenido;
- móvil: una columna;
- labels y errores no se separan de su control;
- footer de acciones puede volverse sticky solo si se demuestra útil y accesible;
- teclados móviles (<code>inputmode</code>, tipos de input) deben configurarse correctamente.

## 25.6. Gráficas responsive

Toda gráfica que se incorpore:

- debe redimensionarse sin perder significado;
- debe tener alternativa textual/tabular;
- leyendas y etiquetas se adaptan;
- no depende del hover para información esencial;
- en móvil se simplifica si es necesario, sin cambiar la métrica.

## 25.7. Prueba y gate responsive

Toda fase con UI debe incluir evidencia responsive de las vistas que crea o modifica.

Como mínimo:

- pruebas automatizadas de viewport con Playwright cuando esté disponible;
- validación manual documentada antes de introducir Playwright;
- ausencia de overflow global;
- flujos críticos ejecutables a 360/390, 768, 1024 y 1440;
- screenshots de regresión selectivos en móvil y desktop para componentes/pantallas críticas.

Una fase con UI **no puede cerrarse** si “desktop está terminado pero móvil queda para después”.

No construir una segunda aplicación móvil independiente; la misma SPA se adapta responsivamente.

---

# 26. Rendimiento

Reglas:

- lazy loading por rutas/módulos;
- imágenes de producto lazy;
- evitar librerías grandes para problemas pequeños;
- no cargar catálogo completo si existe paginación;
- no almacenar duplicados de respuestas grandes;
- evitar watchers profundos innecesarios;
- no introducir charting library hasta FE07;
- build de producción debe analizar warnings y chunks anómalos.

Objetivo inicial orientativo:

- primera pantalla usable sin dependencias innecesarias de módulos futuros;
- ningún módulo comercial debe forzar la carga de NLP o charts si no los usa.

---

# 27. Seguridad frontend

Reglas:

- no <code>v-html</code> con contenido externo salvo sanitización explícita y justificada;
- no loguear tokens;
- no loguear audio;
- no loguear datos personales de clientes en producción;
- no guardar audio local;
- no guardar dominio sensible en localStorage;
- respetar autorización backend;
- mutaciones no se reintentan a ciegas;
- secretos nunca en variables Vite públicas;
- <code>VITE_*</code> se considera público;
- errores visibles no deben exponer stack traces internos;
- dependencias productivas con vulnerabilidades high/critical bloquean release hasta revisión.

Headers CSP, HSTS y política del servidor estático pertenecen a <code>homex-deploy</code>, coordinados en FE09.

---

# 28. Estrategia de pruebas

Las pruebas se implementan dentro de cada fase, no al final.

## 28.1. Unitarias

Vitest para:

- formatters;
- mappers;
- validadores UI;
- utilidades;
- permisos derivados de capacidades;
- conversión de offsets Unicode;
- lógica de composables puros;
- money helpers.

## 28.2. Componentes

Vue Test Utils para:

- componentes compartidos;
- formularios;
- tablas;
- estados;
- interacción;
- theme-sensitive behavior cuando aplique.

## 28.3. Integración frontend

MSW o equivalente para simular contratos HTTP aprobados sin inventar campos.

Debe probar:

- loading;
- success;
- validation error;
- 401;
- 403;
- 404;
- 409;
- 500/network error;
- abort/cancel cuando aplique.

Mock no reemplaza E2E real para cierre global.

## 28.4. E2E

Playwright.

Se distinguen:

1. E2E frontend con API controlada;
2. E2E compartido con backend real.

FE08 no se cierra únicamente con mocks.

## 28.5. Regresión visual

Playwright screenshots selectivos para:

- sidebar expandido/compacto;
- light/dark;
- tabla;
- formulario;
- modal;
- catálogo de productos;
- estados empty/error;
- captura HITL.

No aplicar pixel snapshots indiscriminadamente a cada página.

## 28.6. Cobertura

Coverage se reporta, pero un porcentaje global no sustituye la matriz de comportamiento.

No escribir tests inútiles para inflar cobertura.

Cada fase lista explícitamente los casos críticos que deben existir.

## 28.7. Verificación de usabilidad heurística

Desde FE03.5, cada fase debe mantener una matriz H1–H10 que relacione:

- heurística;
- pantalla/flujo;
- riesgo detectado;
- cambio aplicado;
- prueba automatizada cuando sea posible;
- evidencia manual cuando la automatización no sea suficiente;
- resultado final.

Pruebas esperadas según el caso:

- componentes para estados loading/disabled/error/success y preservación de datos;
- MSW para 400/401/403/404/409/500 y errores de red;
- Playwright para navegación, foco, teclado, confirmaciones, recuperación y flujos críticos;
- axe para accesibilidad automatizable;
- screenshots selectivos para consistencia, jerarquía y estados visuales;
- validación responsive en 360/390, 768, 1024 y 1440px.

Una fase no se cierra con una matriz H1–H10 incompleta o con defectos críticos de usabilidad conocidos sin documentar.

---

# 29. CI mínimo obligatorio

FE00 debe crear GitHub Actions con jobs independientes.

## 29.1. install / lock integrity

~~~bash
npm ci
~~~

<code>package-lock.json</code> es la fuente reproducible.

## 29.2. type-check

~~~bash
npm run type-check
~~~

## 29.3. lint

Debe ser un comando de comprobación, sin <code>--fix</code>.

~~~bash
npm run lint:check
~~~

## 29.4. format

~~~bash
npm run format:check
~~~

No modificar archivos en CI.

## 29.5. unit-component

~~~bash
npm run test:unit -- --run
~~~

## 29.6. build

~~~bash
npm run build
~~~

## 29.7. contract

Desde FE02:

- generar tipos OpenAPI;
- comparar contra <code>src/generated/api</code>;
- fallar si hay drift.

## 29.8. e2e

Desde la fase en que Playwright entra al proyecto.

Los jobs deben ser independientes para que un fallo de lint no oculte resultados de tests/build/contract.

Una fase no se cierra con CI rojo.

---

# 30. Protocolo obligatorio de ejecución por fase

## 30.1. Antes de tocar código

El implementador debe:

1. confirmar rama;
2. confirmar commit base;
3. leer la fase completa;
4. revisar el informe de la fase anterior;
5. inspeccionar los archivos actuales;
6. revisar el OpenAPI/requisitos que la fase consume;
7. listar qué archivos espera modificar;
8. ejecutar baseline local;
9. no iniciar si la fase anterior obligatoria está roja.

## 30.2. Durante la fase

Prohibido:

- adelantar módulos de fases futuras;
- inventar campos;
- inventar endpoints;
- cambiar idioma globalmente;
- desactivar tests;
- añadir <code>skip</code> a tests críticos;
- introducir <code>any</code> para esconder incompatibilidades contractuales;
- copiar un mockup literalmente sin respetar design system;
- hardcodear permisos;
- duplicar reglas backend;
- hacer refactor masivo no relacionado.

## 30.3. Gate local

Según fase:

~~~bash
npm ci
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run build
~~~

Y cuando correspondan:

~~~bash
npm run contract:check
npm run test:e2e
npm run test:a11y
~~~

## 30.4. Informe de fase

Cada fase crea:

<code>docs/implementacion/&lt;FASE&gt;.md</code>

Debe incluir:

- branch/commit base;
- objetivo;
- archivos modificados;
- dependencias añadidas/eliminadas;
- decisiones aplicadas;
- contrato backend usado;
- pruebas ejecutadas;
- resultado exacto de cada gate;
- screenshots de evidencia solo cuando aporten valor;
- riesgos conocidos;
- bloqueos externos;
- skips, que deben ser cero para pruebas obligatorias;
- commit final;
- estado CI.

No escribir “fase completada” si queda un gate rojo.

---

# 31. Estrategia de ramas

Patrón:

~~~text
main
 ├── feat/fe00-baseline
 ├── feat/fe01-design-system
 ├── feat/fe02-auth-api
 ├── feat/fe03-clientes-productos
 ├── refactor/fe03-5-usabilidad-nielsen
 ├── feat/fe04-proformas
 ├── feat/fe05-operaciones
 ├── feat/fe06-capturas-hitl
 ├── feat/fe07-resumen
 ├── feat/fe08-hardening
 └── feat/fe09-release
~~~

Reglas:

- una fase parte de <code>main</code> tras fusionar la anterior requerida;
- una PR por fase;
- no mezclar dos fases grandes en la misma PR;
- merge solo con CI verde;
- preferir squash merge limpio;
- dependencias externas bloqueantes se documentan, no se simulan como si estuvieran terminadas.

---

# 32. FE00 — Baseline seguro, herramientas y convenciones

**Objetivo:** convertir el scaffold en una base reproducible y testeable antes de implementar diseño o dominio.

**Precondición:** <code>main</code> + este plan.

## Trabajo obligatorio

1. Fijar Node 24.12.x como baseline de desarrollo/CI y documentarlo con <code>.nvmrc</code> o mecanismo equivalente.
2. Mantener npm y <code>package-lock.json</code> como única fuente de dependencias.
3. Eliminar código de ejemplo:
   - store counter;
   - prueba “You did it!”;
   - contenido demo de App.
4. Crear estructura base <code>app/modules/shared/generated/tests</code>.
5. Configurar aliases de importación.
6. Crear <code>.env.example</code>.
7. Definir y validar <code>VITE_API_BASE_URL</code>.
8. Separar:
   - <code>lint:check</code>;
   - <code>lint:fix</code>;
   - <code>format:check</code>;
   - <code>format</code>.
9. Mantener TypeScript estricto; no relajar para pasar build.
10. Crear CI por jobs.
11. Crear README HOMEX real.
12. Crear estructura <code>docs/implementacion</code>.
13. Añadir configuración de test reusable.
14. No instalar UI framework.

## Prohibido

- módulos comerciales;
- llamadas reales a backend;
- login productivo;
- design system completo;
- Tailwind/Vuetify/PrimeVue;
- Axios sin necesidad aprobada;
- charts;
- NLP.

## Pruebas obligatorias

- <code>npm ci</code>;
- type-check;
- lint check;
- format check;
- Vitest básico;
- build;
- CI verde.

## Cierre

<code>docs/implementacion/FE00_BASELINE.md</code>

No avanzar a FE01 con CI rojo.

---

# 33. FE01 — Design system, temas y shell

**Objetivo:** congelar visualmente HOMEX antes de crear pantallas de negocio.

**Precondición:** FE00 cerrada.

## Trabajo obligatorio

1. Implementar tokens de color de este plan.
2. Implementar light/dark.
3. Integrar Inter.
4. Integrar Lucide.
5. Crear <code>AppSidebar</code> expandido/compacto.
6. Persistir preferencia visual no sensible.
7. Crear layout principal sin topbar.
8. Implementar PageHeader.
9. Construir primitives/componentes base de §23.
10. Implementar estados loading/empty/error/forbidden.
11. Definir tablas base y toolbar contextual.
12. Definir focus states.
13. Definir responsive shell completo para desktop, tablet y móvil.
14. Implementar sidebar/drawer responsive según §11 y §25.
15. Documentar <code>docs/design-system.md</code>.

## Criterios visuales obligatorios

- light coherente;
- dark coherente;
- sidebar expandido;
- sidebar compacto;
- usuario abajo;
- tema abajo;
- no topbar;
- no búsqueda global;
- no notificaciones;
- no workspace;
- no botón global “Nueva proforma”.

## Pruebas

- componentes base;
- keyboard;
- tema persistente;
- sidebar persistente/compacto/drawer según viewport;
- shell validado en 360, 390, 768, 1024 y 1440px;
- ausencia de overflow horizontal global;
- visual snapshots clave en móvil y desktop;
- axe sin violaciones serias/críticas en shell.

## Cierre

<code>docs/implementacion/FE01_DESIGN_SYSTEM.md</code>

---

# 34. FE02 — API, OpenAPI, autenticación, permisos y routing

**Objetivo:** conectar el shell con contratos reales sin implementar aún el flujo comercial completo.

**Precondiciones:**

- FE01 cerrada;
- contrato auth backend estable;
- OpenAPI backend aprobado para los endpoints consumidos.

## Trabajo obligatorio

1. Añadir snapshot OpenAPI.
2. Generar tipos.
3. Crear <code>shared/api</code>.
4. Normalizar errores.
5. Implementar session store.
6. Implementar login/logout.
7. Implementar guards.
8. Implementar 401/403/404.
9. Resolver estrategia real de tokens/cookies.
10. Obtener identidad/capacidades desde backend.
11. Filtrar navegación por capacidades.
12. Implementar lazy routing.
13. Añadir MSW para tests de integración.
14. Crear contract drift gate.

## Prohibido

- matriz de permisos hardcodeada en cada pantalla;
- tipos DTO manuales duplicados;
- tokens sensibles en logs;
- fake endpoints;
- roles asumidos solo por nombre visual.

## Tests

- login éxito/error;
- sesión;
- logout;
- 401;
- 403;
- ruta prohibida;
- permiso de navegación;
- API network failure;
- generated types sin drift;
- refresh si contrato lo requiere;
- no loop infinito de auth.

## Cierre

<code>docs/implementacion/FE02_AUTH_API.md</code>

---

# 35. FE03 — Clientes y catálogo visual de productos

**Objetivo:** implementar los maestros comerciales necesarios antes de proformas.

**Precondiciones:**

- FE02 cerrada;
- backend F07.7 cerrado;
- endpoints backend de clientes/productos estables;
- OpenAPI de imagen principal estable y generado;
- contrato de paginación/búsqueda definido.

## Clientes

Implementar:

- listado;
- búsqueda;
- filtros reales;
- paginación;
- detalle;
- alta/edición si permisos/contrato lo permiten;
- estados;
- validación server-side visible.

No inventar “ciudad”, “tipo empresa/persona” u otros campos si OpenAPI no los contiene.

## Productos

Implementar:

- vista grid;
- vista lista;
- imagen/fallback;
- SKU;
- nombre;
- tipo;
- precio/moneda;
- stock;
- presentación;
- promoción vigente cuando contrato la exponga;
- detalle;
- búsqueda/filtros;
- paginación.

## Imagen

Implementar el contrato definitivo de §16.1:

- consumir únicamente <code>imagen_principal</code> generado por OpenAPI;
- construir <code>srcset</code> con las variantes WebP disponibles;
- seleccionar <code>sizes</code> según grid/lista responsive;
- no solicitar el original como recurso normal de catálogo;
- lazy loading cuando corresponda;
- fallback para producto sin imagen;
- fallback ante URL inválida/fallo de carga;
- no exponer detalles R2 en estado, logs o UI.

FE03 **no puede cerrarse** con un placeholder permanente si F07.7 está disponible: debe integrar el recurso real.

## Tests

- búsqueda;
- paginación;
- filtros;
- CRUD permitido;
- 403;
- validation error;
- empty/no results;
- card con imagen y <code>srcset</code>;
- card sin imagen;
- imagen rota;
- variante responsive correcta sin descargar original innecesariamente;
- ninguna dependencia/SDK de R2 en bundle;
- dark/light;
- stock no alterable desde frontend salvo endpoint explícito;
- promociones no recalculadas arbitrariamente;
- clientes y productos operables en 360/390, 768, 1024 y 1440px;
- grid de productos refluye correctamente;
- listado/tabla adopta patrón responsive sin perder acciones críticas.

## Cierre

<code>docs/implementacion/FE03_CLIENTES_PRODUCTOS.md</code>

---

# 35.5. FE03.5 — Refactor de usabilidad según las 10 heurísticas de Nielsen

**Objetivo:** refactorizar la interfaz ya implementada en FE00–FE03 para establecer un baseline de usabilidad verificable antes de construir proformas manuales.

**Precondiciones:**

- FE03 cerrada y fusionada a `main`;
- CI de FE03 completamente verde;
- contrato OpenAPI de FE03 estable;
- no iniciar implementación de FE04 en paralelo sobre una base UX distinta.

## Alcance obligatorio

Auditar y refactorizar únicamente lo ya existente:

- login, restauración de sesión y estados de autenticación;
- shell, sidebar/drawer, tema y encabezados;
- navegación, forbidden y not-found;
- estados compartidos loading/skeleton/empty/no-results/error/success/processing;
- clientes;
- productos;
- formularios, filtros, paginación, tablas/grid y mensajes de validación existentes.

No implementar todavía proformas, pedidos, NLP ni funcionalidades de fases posteriores.

## Aplicación obligatoria H1–H10

La fase debe demostrar, como mínimo:

- **H1:** feedback visible en operaciones asíncronas y prevención de doble submit;
- **H2:** lenguaje HOMEX y representación semántica; no IDs técnicos cuando exista etiqueta contractual;
- **H3:** cierre/cancelación segura de overlays y confirmación de acciones destructivas;
- **H4:** unificación de patrones de botones, formularios, estados, tablas, badges y mensajes;
- **H5:** prevención de acciones inválidas sin sustituir la validación del backend;
- **H6:** filtros/opciones/contexto visibles y reconocibles;
- **H7:** flujos frecuentes sin pasos redundantes y completamente operables por teclado;
- **H8:** reducción de ruido visual y jerarquía clara de información/acciones;
- **H9:** errores accionables, asociados al campo/acción y sin pérdida innecesaria de datos;
- **H10:** ayuda contextual breve para conceptos no evidentes y labels/descripciones accesibles.

## Restricciones

- no cambiar reglas de negocio;
- no crear endpoints;
- no hardcodear roles, estados o catálogos;
- no recalcular stock, precios, descuentos ni permisos;
- no sustituir respuestas 4xx/409 del backend por éxito aparente;
- no introducir una librería UI completa para resolver inconsistencias que el design system existente pueda cubrir;
- no convertir la fase en un rediseño visual sin evidencia de problema de usabilidad.

## Pruebas obligatorias

### Unitarias/componentes

- loading/processing bloquea doble acción;
- errores de campo son visibles y mantienen el valor introducido;
- confirmación destructiva no ejecuta antes de confirmar;
- componentes compartidos mantienen terminología, variantes y estados consistentes;
- filtros activos son visibles y removibles;
- empty/no-results/error no se confunden entre sí;
- controles deshabilitados explican el motivo cuando sea necesario.

### Integración con MSW

Cubrir en flujos existentes:

- 400 de validación;
- 401 y restauración/expiración de sesión;
- 403;
- 404;
- 409 cuando el contrato consumido pueda producirlo;
- 500/error de red;
- reintento manual seguro;
- conservación de datos de formulario tras errores recuperables.

### E2E / accesibilidad

- login → navegación permitida;
- navegación por teclado de sidebar/drawer y acciones críticas;
- foco visible y retorno de foco al cerrar overlays;
- Escape donde corresponda;
- dark/light;
- axe sin violaciones críticas/serias en rutas auditadas;
- 360/390, 768, 1024 y 1440px;
- sin overflow horizontal global;
- clientes y productos siguen siendo operables después del refactor;
- screenshots selectivos de estados clave para detectar regresiones de consistencia.

### Auditoría heurística

Crear una matriz H1–H10 con al menos un escenario real por heurística. Cada hallazgo debe quedar en uno de estos estados:

- corregido y probado;
- no aplica, con justificación;
- riesgo aceptado explícitamente, sin severidad crítica.

No se permite cerrar la fase con hallazgos críticos abiertos.

## Gate

Además del gate normal:

```bash
npm run type-check
npm run lint:check
npm run format:check
npm run test:unit -- --run
npm run test:e2e
npm run test:a11y
npm run build
```

Ejecutar también `npm run contract:check` para demostrar que el refactor no alteró ni falsificó el contrato backend.

## Cierre

Crear:

`docs/implementacion/FE03_5_USABILIDAD_NIELSEN.md`

Debe incluir:

- matriz H1–H10;
- hallazgos antes/después;
- cambios realizados;
- pruebas y viewports ejecutados;
- evidencia light/dark y teclado;
- riesgos aceptados;
- commit final y CI.

**FE04 no puede comenzar hasta que FE03.5 esté cerrada y fusionada a `main`.**

---

# 36. FE04 — Proformas manuales

**Objetivo:** implementar el flujo comercial manual completo antes de captura NLP.

**Precondiciones:**

- FE03.5 cerrada y fusionada a `main`;
- backend F07.7 cerrado;
- contrato backend de FE04 fusionado a `homex-backend/main` (PR #3, merge `9fac22ecc4f471237e6611b5a226532ab2a037ab`);
- snapshot OpenAPI frontend actualizado contra ese contrato antes de escribir UI de proformas;
- adjuntos públicos por detalle disponibles según OpenAPI.

## Trabajo obligatorio

1. Listado de proformas.
2. Búsqueda/filtros/paginación.
3. Creación.
4. Selección de cliente.
5. Adición/edición de líneas.
6. Selección de productos.
7. Especificaciones de mueble según contrato.
8. Modos:
   - PRECIO_UNITARIO;
   - TOTAL_NEGOCIADO.
9. BOB/USD sin conversión.
10. Visualización de promoción aplicada.
11. Estados.
12. Envío.
13. Aprobación de la propia proforma por el vendedor mediante el endpoint autorizado; no existe capacidad separada `comercial.aprobar`.
14. Cancelación únicamente donde exista acción válida del backend: después de aprobación la cancelación pertenece al PEDIDO, no se “desaprueba” la proforma.
15. Congelar controles de UI fuera de BORRADOR; ENVIADA y APROBADA no admiten edición.
16. Mostrar siempre valores autoritativos devueltos por backend y representar conflictos de estado/concurrencia 409 de forma accionable.
17. Consumir `estado_info`, `moneda_info`, `cliente_resumen`, `tipo_item_info`, `unidad_info` y `tipo_mueble_info` en lugar de inferir semántica por IDs.
18. Consumir `GET /api/v1/catalogo/opciones/?concepto=...` para ESTADO_PROFORMA, MONEDA, TIPO_ITEM, UNIDAD_MEDIDA y TIPO_MUEBLE; no hardcodear IDs.
19. Acción <code>Nueva proforma</code> solo dentro de contexto de proformas/cliente.
20. Gestionar imágenes de referencia de muebles a pedido por <code>DetalleProforma</code> mediante el API de media pública.

## Imágenes de referencia por detalle

Para un detalle de mueble a pedido:

- permitir seleccionar una o varias imágenes JPEG/PNG/WebP;
- mostrar previews locales efímeras antes de subir;
- enviar cada archivo mediante <code>multipart/form-data</code> al backend;
- mostrar estado de subida/error;
- después de confirmar, reemplazar la preview local por el recurso devuelto por backend;
- listar adjuntos ya persistidos;
- visualizar y descargar mediante URL pública estable/cacheable devuelta por backend;
- eliminar un adjunto únicamente si backend lo permite para el estado actual;
- asociar siempre el archivo al detalle correcto, no solo a la cabecera de proforma;
- no usar SVG;
- no guardar Blob/Base64 en estado persistente del navegador.

El navegador no decide el nombre de storage, la key ni la política de acceso.

## Regresiones críticas

- 3 por 100 total negociado se ve como 100.00;
- unitario no multiplica el total negociado;
- no float;
- BOB/USD no se convierte;
- ENVIADA congela campos visualmente según reglas;
- backend 409/conflicto se explica;
- aprobación doble no se simula como éxito;
- recurso comercial de otro vendedor no se revela: acceso directo a proforma/detalle queda fuera del queryset autorizado y se representa como 404;
- operaciones de media ajena mantienen 403 cuando así lo define el contrato;
- usuario sin permiso no ve acción, y si fuerza URL recibe 403.

## Tests E2E con API controlada

- crear borrador;
- editar;
- enviar;
- visualizar freeze;
- aprobar;
- error de stock;
- error de concurrencia/conflicto;
- subir imagen válida a detalle;
- archivo inválido/tamaño rechazado representa error backend;
- otro vendedor no puede modificar/eliminar por API un adjunto fuera de su alcance;
- una URL pública de media puede visualizarse/descargarse sin sesión según el contrato;
- eliminación bloqueada por estado se representa correctamente;
- preview local se revoca y no persiste al recargar;
- creación/edición/revisión de proforma operable en 360/390, 768, 1024 y 1440px;
- formulario se reorganiza sin perder campos, totales ni acciones;
- listado/tabla responsive sin overflow global.

## Cierre

<code>docs/implementacion/FE04_PROFORMAS.md</code>

---

# 37. FE05 — Pedidos, órdenes de trabajo, stock, recibos, notas y documentos

**Objetivo:** representar correctamente el flujo posterior a aprobación sin inventar lógica operacional.

**Precondiciones:**

- FE04 cerrada;
- backend F07.3/F07.4 disponibles para funcionalidades consumidas.

## Pedidos

- listado;
- detalle;
- estados reales;
- fechas reales;
- sin porcentaje de progreso inventado;
- stepper solo con estados reales;
- cancelación contextual según respuesta backend.

## Órdenes de trabajo

El módulo se llama **Órdenes de trabajo**, no “Producción”.

- listado;
- detalle;
- estado;
- datos de pedido;
- fecha/entrega si contrato la define.

No crear porcentajes 18/68/100 salvo un futuro contrato explícito.

## Movimientos de stock

- historial;
- filtros;
- lectura clara de tipo/motivo/cantidad/producto;
- no simular reserva por proforma.

## Recibos

- listado/detalle;
- emisión según permisos;
- estado EMITIDO/ANULADO;
- no botón DELETE;
- anulación como acción explícita con confirmación;
- saldo mostrado desde backend.

## Notas de entrega

- emisión solo cuando backend la permite;
- una por pedido;
- no crear automáticamente al aprobar;
- entrega física separada si endpoint existe.

## Documentos

Permitir visualizar/descargar:

- proforma;
- orden de trabajo;
- recibo;
- nota de entrega;

solo cuando backend exponga el recurso correspondiente.

## Tests

- estados reales;
- cancelación bloqueada por recibo emitido;
- recibo anulado deja de mostrarse como vigente;
- nota no disponible antes de LISTO_ENTREGA;
- errores 409/400 visibles;
- ausencia de porcentajes inventados;
- documentos;
- permisos por módulo;
- pedidos, OT, stock, recibos y notas operables en 360/390, 768, 1024 y 1440px;
- estados y acciones críticas visibles sin depender de hover;
- tablas/listados adaptan su patrón en móvil.

## Cierre

<code>docs/implementacion/FE05_OPERACIONES.md</code>

---

# 38. FE06 — Captura por voz, NLP y HITL

**Objetivo:** implementar la funcionalidad diferenciadora del proyecto sin convertir al navegador en autoridad IA/comercial.

**Precondiciones:**

- FE05 cerrada para flujo comercial base;
- backend F08.1–F08.3 disponible;
- homex-nlp contract v1 soportado por backend;
- OpenAPI captura/HITL estable.

## Trabajo obligatorio

1. Pantalla Capturas.
2. Nueva captura.
3. Permiso de micrófono.
4. Grabación con MediaRecorder.
5. Estado visual de grabación.
6. Cancelación antes de envío.
7. Envío de audio.
8. UUID de idempotencia.
9. Estado PENDIENTE/PROCESANDO/COMPLETADA/ERROR.
10. Polling controlado si ese es el contrato inicial; no WebSocket inventado.
11. Resultado:
    - REQUIRES_REVIEW;
    - NO_PROPOSAL;
    - ERROR.
12. Mostrar texto transcrito si backend lo devuelve.
13. Mostrar propuesta.
14. Mostrar advertencias.
15. Resaltar evidencia.
16. Convertir offsets Python → UTF-16 solo para visualización.
17. Edición humana.
18. Confirmación.
19. Confirmación no aprueba proforma.
20. No conservar audio histórico.

## UX

La revisión debe distinguir visualmente:

- dato propuesto por IA;
- dato faltante;
- dato corregido por humano;
- advertencia;
- evidencia textual;
- confirmación final.

No usar “confianza” inventada si el contrato no expone un score definido.

## Tests críticos

- micrófono denegado;
- MediaRecorder no soportado;
- grabación cancelada;
- POST 202;
- reintento mismo UUID;
- conflicto mismo UUID/contenido distinto;
- procesamiento;
- error de worker;
- NO_PROPOSAL;
- propuesta parcial;
- Unicode offsets con emoji;
- browser no sustituye original IA;
- doble confirmación;
- confirmación no aprueba proforma;
- refresh no recupera audio eliminado;
- grabación, progreso, revisión HITL y confirmación operables en 360/390, 768, 1024 y 1440px;
- evidencia y formulario de corrección se reordenan sin perder contexto;
- controles de grabación tienen targets táctiles adecuados.

## Cierre

<code>docs/implementacion/FE06_CAPTURAS_HITL.md</code>

---

# 39. FE07 — Resumen operativo y métricas

**Objetivo:** construir un dashboard útil únicamente con métricas reales.

**Precondiciones:**

- módulos comerciales principales disponibles;
- endpoints agregados o semántica de métricas definida;
- FE06 cerrada si se muestran métricas NLP.

## Trabajo obligatorio

1. Resumen por rol/capacidad.
2. KPI cards limitadas.
3. listas “requiere atención” solo con criterio backend real.
4. máximo de gráficas necesario, no decorativo.
5. métricas de NLP claramente definidas.
6. estados vacíos.
7. enlaces a módulos.

## Prohibido

- “Sistema 99.9%” sin observabilidad;
- última sincronización permanente;
- notificaciones ficticias;
- stock valorizado sin definición;
- porcentajes comparativos inventados;
- más gráficos para rellenar espacio;
- métricas derivadas de cargar todos los registros en navegador.

## Charts

Solo en esta fase se evalúa instalar Chart.js + wrapper Vue o alternativa ligera.

Cada chart debe documentar:

- pregunta que responde;
- endpoint;
- unidad;
- período;
- semántica;
- estado vacío.

## Tests

- diferentes capacidades/roles;
- sin datos;
- error parcial de una métrica;
- light/dark;
- a11y del gráfico;
- fallback textual de valores;
- no carga de librería chart en rutas que no la usan;
- dashboard operativo en 360/390, 768, 1024 y 1440px;
- KPI cards y charts refluye sin overflow ni texto ilegible;
- métricas siguen disponibles sin depender de hover.

## Cierre

<code>docs/implementacion/FE07_RESUMEN.md</code>

---

# 40. FE08 — Hardening, integración real y cierre funcional

**Objetivo:** demostrar que el frontend completo funciona con backend real y no solo con mocks.

**Precondiciones:**

- FE00–FE07 cerradas;
- backend F07/F08 cerrado para alcance correspondiente;
- entorno integrado disponible.

## Trabajo obligatorio

- Playwright contra backend real;
- accesibilidad;
- regresión visual;
- auditoría responsive transversal de todos los módulos;
- manejo de caídas;
- permisos;
- contract drift;
- rendimiento;
- documentación;
- recorrido E2E completo;
- revisión de dependencias;
- errores de consola = 0 en flujo nominal.

## E2E comercial real mínimo

~~~text
login
→ cliente
→ producto
→ proforma manual
→ enviar
→ aprobar
→ pedido
→ movimiento VENTA
→ orden de trabajo
→ recibo
→ LISTO_ENTREGA
→ nota de entrega
~~~

También:

- cancelación válida sin recibo emitido;
- cancelación bloqueada con recibo emitido;
- anulación de recibo según contrato.

## E2E NLP real mínimo

~~~text
login
→ nueva captura
→ audio
→ 202
→ procesamiento real
→ propuesta
→ revisión humana
→ confirmación
→ detalle/especificación persistida
→ proforma sigue sin aprobar automáticamente
~~~

No cerrar FE08 con worker/NLP mockeado únicamente.

## Matriz obligatoria de fallos

- backend no disponible;
- 401;
- 403;
- 404;
- 409;
- 500;
- timeout/red;
- captura ERROR;
- contrato desconocido manejado por backend;
- imagen producto ausente;
- resultado vacío;
- lista vacía.

## Cierre

<code>docs/implementacion/FE08_HARDENING.md</code>

FE08 representa el cumplimiento práctico de la integración frontend equivalente a F09 del plan backend.

---

# 41. FE09 — Release, despliegue y piloto

**Objetivo:** entregar el frontend al repositorio de despliegue y validar el uso real.

**Precondición:** FE08 cerrada.

## Release

- versión/tag;
- <code>npm ci</code>;
- build reproducible;
- contrato backend fijado por commit/tag;
- variables de entorno documentadas;
- source maps según política;
- assets optimizados;
- no secretos en bundle.

## homex-deploy

Coordinar:

- build de frontend;
- servidor estático/reverse proxy;
- HTTPS;
- CSP;
- HSTS;
- cache de assets con hash;
- fallback SPA correcto;
- API base;
- health externo del servicio;
- compresión;
- headers.

No duplicar infraestructura dentro de este repo.

## Piloto

Validar con usuarios reales:

- creación manual;
- navegación;
- tiempos;
- errores frecuentes;
- captura NLP;
- HITL;
- light/dark;
- legibilidad de catálogo;
- sidebar expandido/compacto.

No cambiar arquitectura durante piloto por una preferencia aislada; clasificar feedback en defecto, mejora o requisito nuevo.

## Cierre

<code>docs/implementacion/FE09_RELEASE.md</code>

---

# 42. Dependencias previstas por fase

No instalar todo en FE00.

Baseline existente:

- Vue;
- Vue Router;
- Pinia;
- TypeScript;
- Vite;
- Vitest;
- Vue Test Utils;
- ESLint/Oxlint;
- Prettier.

FE01:

- <code>@fontsource-variable/inter</code> o equivalente local;
- <code>lucide-vue-next</code>.

FE02:

- <code>openapi-typescript</code>;
- <code>msw</code>.

FE03.5:

- no añadir una librería UI completa por defecto;
- reutilizar Playwright/axe existentes o incorporarlos solo si aún no están presentes.

FE04:

- <code>decimal.js</code> solo si existe cálculo provisional necesario.

FE08 o antes cuando empiece E2E:

- <code>@playwright/test</code>;
- <code>@axe-core/playwright</code>.

FE07:

- librería chart solo si las métricas justifican gráficos.

Cualquier nueva dependencia debe documentar:

- necesidad;
- tamaño/impacto;
- mantenimiento;
- por qué no se resolvió con APIs existentes.

---

# 43. Prohibiciones de diseño y producto

No reintroducir sin cambio formal del plan:

- topbar global;
- buscador global;
- botón global “Nueva proforma”;
- workspace “HOMEX Bolivia”;
- notificaciones ficticias;
- “última sincronización” permanente;
- porcentaje de avance de pedidos;
- “Producción” como módulo alternativo a Órdenes de trabajo;
- charts decorativos;
- métricas inventadas;
- slogans gigantes en cada módulo;
- sidebar fijo sin opción de compactar;
- sidebar blanco como única identidad;
- serif para encabezados operativos;
- múltiples librerías de iconos;
- colores hardcodeados;
- dark mode como simple inversión;
- UI framework que sobrescriba el design system sin decisión explícita.

---

# 44. Prohibiciones técnicas

No:

- <code>fetch</code> directo en componentes;
- <code>any</code> para silenciar OpenAPI;
- DTOs duplicados a mano;
- localStorage para datos sensibles;
- audio histórico;
- direct call navegador → homex-nlp;
- cálculo comercial como autoridad cliente;
- hardcodear rol “ADMIN” en decenas de componentes;
- endpoint ad hoc solo porque una pantalla quedó difícil;
- reintento automático de POST no idempotente;
- guardar dinero como JS float para operaciones;
- parsear fechas puras como UTC si causa cambio de día;
- tests skipped para cerrar fase;
- CI que modifica archivos;
- branch con varias fases mezcladas.

---

# 45. Matriz mínima de regresión frontend

| Regla | Regresión frontend obligatoria |
|---|---|
| G01/P29 | TOTAL_NEGOCIADO 3 por 100 permanece 100.00 |
| G02/P30 | nota no aparece como emitible antes de LISTO_ENTREGA |
| G03/P31 | recibo EMITIDO impide UX de cancelación y backend 409/4xx se muestra |
| T02 | ENVIADA congela visualmente cliente/snapshot; backend sigue siendo autoridad |
| T03 | detalle/especificación no ofrece mutaciones prohibidas tras freeze |
| T04 | conflicto concurrente de proforma no se pierde ni se sobrescribe silenciosamente |
| T05 | frontend no crea reversas; solo representa resultado backend |
| T06 | recibo no tiene DELETE; solo anulación permitida |
| T07 | evidencia IA cerrada no se ofrece como editable/original reemplazable |
| T09 | captura reintenta con misma clave y conflicto diferente muestra 409 |
| P21 | no existe historial de audio |
| P22 | pendientes no se representan como stock reservado |
| P32 | presentación/SKU se muestra como producto con stock propio |
| Contrato NLP | offset Unicode se convierte solo para renderizado |
| Permisos | ocultación UX + 403 forzado cubiertos |
| Tema | rutas críticas pasan light y dark |
| A11y | teclado/foco/axe en flujos críticos |
| Nielsen H1–H10 | cada fase desde FE03.5 mantiene matriz heurística, pruebas automatizables y evidencia manual de lo no automatizable |

---

# 46. Definición de terminado de una fase

Una fase está terminada únicamente cuando:

- [ ] alcance coincide con el plan;
- [ ] no incluye funcionalidades futuras;
- [ ] nomenclatura respeta idioma congelado;
- [ ] TypeScript está verde;
- [ ] lint check verde;
- [ ] format check verde;
- [ ] unit/component tests verdes;
- [ ] build verde;
- [ ] contract check verde cuando aplica;
- [ ] E2E verde cuando aplica;
- [ ] a11y verde cuando aplica;
- [ ] matriz Nielsen H1–H10 completa desde FE03.5, sin hallazgos críticos abiertos;
- [ ] pruebas/evidencia de usabilidad de la fase versionadas;
- [ ] light/dark validados cuando aplica;
- [ ] toda UI nueva/modificada es responsive y está validada en los viewports obligatorios;
- [ ] no existe overflow horizontal global;
- [ ] no hay skips críticos;
- [ ] no hay <code>any</code> añadido para evadir contrato;
- [ ] CI remoto completamente verde;
- [ ] documentación de fase actualizada;
- [ ] dependencias nuevas justificadas;
- [ ] riesgos/bloqueos documentados;
- [ ] PR contiene solo la fase.

---

# 47. Definición de terminado del frontend antes de producción

Además de FE00–FE09:

- [ ] build reproducible;
- [ ] backend contract fijado;
- [ ] auth real probado;
- [ ] permisos reales probados;
- [ ] flujo manual E2E verde;
- [ ] flujo NLP E2E verde;
- [ ] light/dark;
- [ ] sidebar expandido/compacto;
- [ ] catálogo visual con imagen principal real, variantes WebP y fallback;
- [ ] adjuntos públicos de muebles a pedido operativos por detalle;
- [ ] ninguna imagen comercial persistida en Base64/localStorage/IndexedDB;
- [ ] ninguna credencial, SDK R2 ni construcción manual de URLs/keys presente en frontend;
- [ ] no topbar global;
- [ ] no search global;
- [ ] no notificaciones ficticias;
- [ ] no porcentajes de pedido inventados;
- [ ] a11y crítica sin fallos serios;
- [ ] responsive completo probado en todos los módulos y flujos críticos;
- [ ] flujo comercial y NLP utilizables en 360/390, 768, 1024 y 1440px;
- [ ] no existe deuda responsive conocida ni overflow global;
- [ ] errores API representados;
- [ ] no audio histórico;
- [ ] no secretos en bundle;
- [ ] deploy con HTTPS/headers;
- [ ] no errores críticos/altos abiertos;
- [ ] documentación operativa actualizada.

---

# 48. Insumos externos y bloqueos legítimos

No inventar datos para cerrar una fase.

Dependencias conocidas:

1. OpenAPI backend por fase.
2. Matriz real de permisos.
3. Contrato de autenticación definitivo.
4. Media persistente:
   - arquitectura cerrada en backend F07.7;
   - Cloudflare R2 Standard productivo;
   - OpenAPI de imagen principal y adjuntos públicos debe estar disponible antes de cerrar FE03/FE04;
   - credenciales/dominio R2 son responsabilidad de backend/deploy y nunca del frontend.
5. Datos reales de catálogo:
   - SKU;
   - precio;
   - stock;
   - presentación.
6. Documentos reales para proforma/OT/recibo/nota.
7. Backend F08 para captura/HITL.
8. Audios reales para piloto.
9. Endpoints agregados si Resumen requiere métricas.

Una fase puede cerrar como “implementación validada; integración real bloqueada por contrato” únicamente si el plan de esa fase permite explícitamente ese estado. FE08 no admite ese cierre parcial.

---

# 49. Secuencia de ejecución

~~~text
MAIN + Plan Frontend 1.4
        ↓
FE00 baseline + CI + convenciones
        ↓
FE01 design system + light/dark + sidebar
        ↓
FE02 OpenAPI + auth + permisos + routing
        ↓
backend F07.7 media + OpenAPI cerrado
        ↓
FE03 clientes + productos visuales
        ↓
FE03.5 refactor de usabilidad + Nielsen H1–H10
        ↓
FE04 proformas manuales
        ↓
FE05 pedidos + OT + stock + recibos + notas
        ↓
FE06 captura + NLP + HITL
        ↓
FE07 resumen y métricas reales
        ↓
FE08 hardening + E2E real + integración
        ↓
FE09 release + homex-deploy + piloto
~~~

Dependencias inter-repositorio:

~~~text
homex-backend F07.0/F07.2… ─────→ FE02/FE03/FE04/FE05
homex-backend F08 + homex-nlp ───→ FE06
homex-backend F09 ←─────────────── FE08
homex-deploy F10 ←──────────────── FE09
~~~

FE00 y FE01 pueden avanzar sin esperar al backend comercial completo.

FE02 en adelante no debe programarse contra endpoints imaginarios.

---

# 50. Principios finales

1. **El frontend representa el dominio; no lo redefine.**
2. **La interfaz más bonita que contradice el backend es un defecto.**
3. **Las pruebas nacen junto con cada fase.**
4. **CI verde es condición de avance.**
5. **OpenAPI evita duplicar contratos.**
6. **El Rojo HOMEX identifica; no invade.**
7. **Light y dark son temas diseñados, no invertidos.**
8. **El sidebar concentra navegación, tema y usuario.**
9. **No existe topbar global.**
10. **No existe buscador global.**
11. **Las acciones son contextuales.**
12. **Las tablas sirven para operar; las cards para resumir; el grid para explorar productos.**
13. **Las gráficas deben justificar su existencia.**
14. **No se inventan porcentajes, métricas ni campos.**
15. **El catálogo es visual, pero la imagen requiere contrato real backend.**
16. **El navegador corrige NLP; no reemplaza evidencia IA.**
17. **Audio es efímero.**
18. **Permisos del frontend mejoran UX; permisos backend garantizan seguridad.**
19. **No hacer un refactor masivo de idioma después de construir módulos.**
20. **Todo lo que se construye nace responsive; no existe una fase posterior para “adaptarlo a móvil”.**
21. **Si una prueba revela una contradicción, se corrige el diseño antes de consolidar la siguiente fase.**

El objetivo no es completar pantallas lo más rápido posible. El objetivo es que cada fase aceptada se convierta en una base estable, comprobable y coherente con <code>homex-backend</code>, <code>homex-nlp</code> y <code>homex-deploy</code>.
