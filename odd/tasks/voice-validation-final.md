# Final commercial voice validation corrections

Objective: simplify existing ASR/NLP/HITL validation and fix thickness and observation integrity.
Branches: existing feat/voice-hitl-review only. Delivery: corrective local work-unit commits, no PR/push/publish. Runners: pytest, Vitest, Playwright.

## Specs

S1.

```text
1. Eliminar las validaciones lingüísticas innecesarias del NLP

**Objetivo:** abandonar la estrategia de rechazar expresiones mediante listas de palabras sospechosas o prohibidas.

Tareas:

1. Eliminar las reglas incorporadas específicamente para detectar palabras o expresiones como `hola`, `buenas`, `probando`, `microfono` y otros términos semejantes.
2. Eliminar las restricciones que rechazan nombres comerciales por contener alguna de esas palabras, incluso cuando forman parte de un nombre válido.
3. No sustituir estas reglas por nuevas listas de expresiones prohibidas, excepciones lingüísticas o validaciones equivalentes.
4. Conservar la extracción de atributos comerciales mediante evidencias reales: producto, dimensiones, materiales, componentes, cantidades, precios y demás información reconocida.
5. Mantener las validaciones comerciales útiles de categoría, unidades, tipos de datos, valores y coherencia entre atributos.
6. Conservar la capacidad de abstención cuando no exista información suficiente para generar una propuesta.
7. No inventar atributos para completar descripciones insuficientes.
8. Verificar que la eliminación de estas restricciones no afecte al reconocimiento de nombres comerciales legítimos ni a los comportamientos correctos existentes.

**Resultado esperado:** el NLP no necesita reconocer todas las frases incorrectas posibles. Su responsabilidad es interpretar información comercial identificable y abstenerse cuando no exista evidencia suficiente.
```

S2.

```text
2. Filtro A — Duración mínima obligatoria de audio

**Objetivo:** impedir que grabaciones demasiado breves se envíen al reconocimiento de voz.

Establecer una duración mínima de **15 segundos** para las grabaciones y los archivos de audio utilizados en el asistente de captura comercial.

Tareas:

1. Sustituir el mínimo actual de 2 segundos por 15 segundos en el flujo de captura comercial por voz.
2. Validar la duración inmediatamente después de finalizar una grabación, antes de iniciar cualquier solicitud ASR.
3. Si la grabación dura menos de 15 segundos, impedir su envío y mostrar un mensaje indicando que debe dictarse una descripción más completa.
4. Aplicar el mismo mínimo a los archivos de audio seleccionados, verificando su duración antes de enviarlos.
5. Mantener la comprobación en Backend sobre la duración real del audio decodificado, sin confiar únicamente en el contador del navegador.
6. Conservar el máximo de 240 segundos para grabaciones por micrófono.
7. Conservar el máximo de 300 segundos y 20 MB para archivos subidos.
8. Mantener el ASR automático: cuando el audio cumpla las validaciones, comenzar la transcripción sin exigir un botón adicional.
9. No iniciar Whisper, NLP ni crear trabajos de procesamiento para audios rechazados por duración.
10. Presentar errores claros y permitir repetir la grabación o seleccionar otro archivo.

**Importante:** no incorporar por ahora un nuevo sistema obligatorio de detección de voz o VAD. El mínimo de duración es un requisito operativo; el siguiente filtro controlará la suficiencia del texto obtenido.

**Criterio de aceptación:** una grabación de 14 segundos se rechaza antes del ASR; una de 15 segundos o más puede transcribirse automáticamente, siempre que cumpla las demás validaciones técnicas.
```

S3.

```text
3. Filtro B — Validación de extensión de la transcripción

**Objetivo:** evitar que el vendedor envíe al NLP transcripciones excesivamente breves, vacías o fuera de los límites establecidos.

Aplicar los siguientes requisitos al texto editable generado por ASR:

- **Mínimo:** 20 palabras.
- **Máximo inicial:** 3.000 caracteres, incluidos espacios y puntuación.

Tareas:

1. Mostrar la transcripción obtenida en el Drawer, permitiendo que el vendedor corrija errores de reconocimiento, números, cantidades, precios y especificaciones.
2. Incorporar un contador visible de palabras y caracteres, actualizado mientras se edita.
3. Si el texto está vacío o contiene menos de 20 palabras, mantener deshabilitado el botón **Procesar texto**.
4. Habilitar el procesamiento únicamente cuando existan al menos 20 palabras y no se supere el máximo de caracteres.
5. Implementar un conteo consistente que ignore espacios adicionales y signos aislados, contemplando correctamente números, cantidades y medidas normalizadas por ASR.
6. Impedir que el vendedor escriba caracteres adicionales después de alcanzar el máximo permitido.
7. Controlar también el pegado de texto para impedir que se supere el límite, sin eliminar silenciosamente contenido existente.
8. Si la transcripción original del ASR supera los 3.000 caracteres, conservarla íntegra, mostrar una advertencia y exigir que el vendedor reduzca el texto antes del NLP. **Nunca truncar automáticamente la salida del ASR.**
9. Aplicar las mismas comprobaciones en Backend para impedir que se omitan mediante solicitudes directas.
10. Mantener el texto editable y ofrecer mensajes específicos cuando no cumpla la longitud mínima o máxima.

**Alcance obligatorio:** los mínimos de 15 segundos y 20 palabras corresponden al asistente comercial de dictado por voz de HOMEX. No imponerlos indiscriminadamente al motor NLP general, la creación manual de productos, los registros históricos ni otros flujos que legítimamente utilicen descripciones breves.

**Referencia de calibración:** los 120 guiones escritos tienen entre 30 y 96 palabras y aproximadamente entre 192 y 671 caracteres. Utilizar esta evidencia para comprobar que el nuevo mínimo no afecta a los casos documentados.

Antes de fijar el máximo de 3.000 caracteres, verificarlo contra los ejemplos disponibles de grabaciones largas, especialmente de cuatro minutos. Ajustarlo solamente si se identifica evidencia real de que bloquea dictados válidos.

**Criterio de aceptación:** no debe ser posible enviar al NLP un texto vacío, de 19 palabras o de más de 3.000 caracteres. Con 20 palabras o más y dentro del límite, se permite solicitar interpretación, sin que esto garantice la existencia de una propuesta comercial.
```

S4.

```text
4. Filtro C — Mantener la validación comercial del NLP

**Objetivo:** permitir el procesamiento de textos suficientemente extensos sin convertir su longitud en garantía de validez comercial.

Tareas:

1. Conservar la identificación de entidades, atributos, evidencias y relaciones comerciales existentes.
2. Evaluar la información comercial reconocida, independientemente de que el texto haya superado los mínimos de duración y palabras.
3. Si no existe información comercial suficiente, devolver un resultado sin propuesta.
4. Mostrar en el Drawer una advertencia comprensible cuando no pueda generarse una propuesta.
5. Conservar la transcripción editable para que el vendedor pueda corregirla y solicitar una nueva interpretación.
6. Si existe información comercial parcial pero válida, mostrar únicamente los atributos identificados, junto con los pendientes correspondientes.
7. No completar automáticamente precios, medidas, materiales, componentes u otros datos que no estén respaldados por la evidencia.
8. Mantener las validaciones comerciales definitivas y los permisos del Backend al guardar el formulario.

**Criterio de aceptación:** un texto incoherente de 30 o 50 palabras puede enviarse al NLP, pero no debe convertirse artificialmente en un producto. Un texto comercial válido puede generar una propuesta parcial sin inventar información faltante.
```

S5.

```text
5. Corregir la asociación y trazabilidad de espesores

**Objetivo:** impedir que una observación de espesor quede registrada como resuelta mediante la asignación de un valor diferente al identificado.

Tareas:

1. Revisar la validación de `ESPESOR_SIN_COMPONENTE` en `apps/capturas/revision_voz.py` y sus consumidores.
2. Cuando se asigne un espesor pendiente a un componente, comprobar que el valor coincida con el pendiente correspondiente.
3. Normalizar unidades y representaciones equivalentes antes de comparar; por ejemplo, no considerar diferentes dos valores que representen exactamente la misma medida.
4. No aceptar una asignación únicamente porque el componente contenga algún espesor.
5. Si el vendedor decide corregir el espesor originalmente reconocido, distinguir esa operación de una simple asignación.
6. Registrar explícitamente el valor original, el valor corregido y la decisión humana correspondiente.
7. Mantener la validación de permisos, captura, evidencia e idempotencia de las decisiones HITL.
8. Comprobar que las observaciones se resuelvan y reabran correctamente cuando el vendedor modifica o revierte valores.

**Criterio de aceptación:** un pendiente de 18 mm no puede registrarse como asignado correctamente a un componente de 25 mm. Si el vendedor corrige intencionalmente el valor, debe quedar registrada una corrección verificable.
```

S6.

```text
6. Evitar duplicar transcripciones en Observaciones comerciales

**Objetivo:** impedir que la descripción completa dictada por el vendedor termine copiada automáticamente en el campo de Observaciones del producto.

Tareas:

1. Revisar la generación del campo `observaciones` en el NLP de Catálogo y su aplicación en `ProductoForm.vue`.
2. Evitar que el fallback copie automáticamente toda la transcripción como una observación comercial.
3. No utilizar Observaciones como almacenamiento alternativo del texto original de ASR.
4. Conservar la transcripción original y las versiones corregidas en sus registros de captura y trazabilidad.
5. Permitir que Observaciones contenga información comercial complementaria que no tenga un campo estructurado específico.
6. No eliminar observaciones legítimas que el vendedor haya introducido manualmente.
7. Evitar que aplicar una propuesta sobrescriba observaciones existentes con el contenido íntegro de la transcripción.
8. Incorporar pruebas con descripciones que incluyan producto, medidas, materiales, precios y observaciones adicionales explícitas.

**Criterio de aceptación:** después de aplicar una propuesta, el formulario contiene los atributos comerciales identificados y únicamente las observaciones complementarias pertinentes, sin duplicar el dictado completo.
```

S7.

```text
7. Conservar el comportamiento HITL existente

Verificar que las modificaciones anteriores no alteren las funcionalidades ya implementadas:

1. El ASR comienza automáticamente cuando el audio cumple los requisitos.
2. La transcripción aparece antes de ejecutar NLP y puede corregirse.
3. El NLP se ejecuta únicamente cuando el vendedor pulsa **Procesar texto**.
4. La propuesta se presenta con atributos comerciales comprensibles, no mediante JSON técnico.
5. Los campos con observaciones se identifican visualmente y permiten revisar el motivo.
6. Los pendientes críticos deben resolverse mediante acciones válidas antes del guardado.
7. Las propuestas antiguas y respuestas asíncronas obsoletas no pueden aplicarse.
8. La propuesta se aplica al formulario únicamente mediante confirmación explícita.
9. Después de aplicar, desaparece el apartado de transcripción libre y el vendedor continúa trabajando sobre los campos estructurados.
10. La evidencia ASR/NLP y las decisiones humanas conservan su trazabilidad.
```

S8.

```text
8. Pruebas y verificación integral

Realizar las pruebas necesarias sobre las modificaciones y sus interacciones.

**Audio:**

1. Grabaciones de 14, 15, 16, 240 y 241 segundos.
2. Archivos subidos de 14, 15, 300 y más de 300 segundos.
3. Archivos vacíos, incompatibles o superiores a 20 MB.
4. Comprobación de que ningún audio inferior al mínimo desencadena trabajo ASR.
5. Transcripción automática y conservación de los controles de cancelación y reintento.

**Texto:**

1. Transcripciones vacías y compuestas únicamente por espacios.
2. Textos de 19, 20 y 21 palabras.
3. Textos de 2.999, 3.000 y 3.001 caracteres.
4. Escritura, pegado, borrado y edición del texto.
5. Salidas ASR superiores al límite, verificando que no se truncan.
6. Solicitudes directas al Backend que intenten omitir las validaciones.

**NLP:**

1. Verificar que la eliminación de listas de palabras prohibidas no produzca regresiones.
2. Probar nombres comerciales legítimos que antes eran rechazados.
3. Comprobar abstenciones ante textos incoherentes de longitud suficiente.
4. Comprobar propuestas comerciales completas y parciales.
5. Verificar que las categorías, unidades y atributos continúen respetando las reglas existentes.
6. Evaluar los 120 guiones de referencia frente a los nuevos umbrales, distinguiendo los guiones escritos de las transcripciones ASR reales.

**HITL y formularios:**

1. Asociación correcta e incorrecta de espesores.
2. Corrección explícita de un espesor y registro de la decisión.
3. Reversión de valores previamente confirmados.
4. Aplicación de propuestas sin duplicar la transcripción en Observaciones.
5. Conservación de observaciones comerciales legítimas.
6. Guardados repetidos, idempotencia y trazabilidad.
7. Verificación E2E y accesibilidad de los controles modificados.

**Integración:**

1. Ejecutar pruebas unitarias, de integración y regresión de los repositorios afectados.
2. Ejecutar lint, formato, typecheck y build.
3. Comprobar contratos OpenAPI y tipos del Frontend.
4. Verificar que Backend utilice exactamente la versión instalada del NLP correspondiente a la rama.
5. Si cambia el paquete NLP, generar una nueva versión y actualizar dependencias, lockfile, wheel y checksum, sin modificar artefactos publicados anteriormente.
6. Repetir las pruebas afectadas después de la última modificación.
7. Documentar claramente las verificaciones ejecutadas y las limitaciones del entorno.
```

S9.

```text
9. Entrega y condiciones de cierre

1. Trabajar únicamente en las ramas `feat/voice-hitl-review` existentes.
2. Crear commits correctivos identificables, conservando el historial anterior.
3. No crear PR, realizar fusiones a `main`, publicar paquetes ni ejecutar `push` sin autorización.
4. Mantener limpios los worktrees al finalizar.
5. Actualizar `docs/voice-hitl-corrective-verification.md` y los registros técnicos correspondientes.
6. Documentar archivos modificados, pruebas nuevas, resultados obtenidos, versiones y commits finales.
7. Verificar que las correcciones se limiten a los requisitos acordados y no introduzcan nuevas restricciones lingüísticas innecesarias.
8. Realizar una comprobación final del flujo completo antes de declarar terminada la intervención.

### Criterio definitivo de aceptación

El sistema debe seguir este comportamiento:

**Audio válido de al menos 15 segundos → ASR automático → transcripción editable de al menos 20 palabras y como máximo 3.000 caracteres → NLP explícito → propuesta comercial o abstención → revisión HITL → aplicación confirmada al formulario.**

El propósito es que las validaciones respondan al procedimiento habitual de los vendedores de HOMEX, utilizando como referencia los 120 dictados comerciales disponibles, sin mantener listas interminables de palabras prohibidas ni introducir complejidad innecesaria.

**No ampliar el alcance para resolver escenarios puramente hipotéticos que no afecten al funcionamiento acordado.** Priorizar la correcta implementación de estos requisitos, la integridad comercial y la ausencia de regresiones.

Dar por completada la intervención únicamente cuando todos los criterios de aceptación establecidos estén verificados.
```

## Tasks

T1 | S1,S4,S6,S8 | delegated: independent NLP linguistic/fallback unit | verified | bf67a50; source and installed suites 1209 passed; independent backend/NLP verifier passed
T2 | S2,S3,S7,S8 | inline: coordinated frontend/backend voice-only thresholds | verified; frontend commit pending | backend 2ccab9a; backend 752 passed, frontend 412 passed, browser 108 passed + 7 correction rechecks passed
T3 | S5,S7,S8 | delegated: independent thickness provenance unit | verified | backend f311c8d, frontend 23d3343; independent verification passed
T4 | S8,S9 | inline packaging/integration + independent high-risk verification | pending

## Log

L1. Original request (verbatim):

```text
# HOMEX — Simplificación definitiva de validaciones ASR/NLP y correcciones de integridad

Realizar una intervención final sobre las ramas existentes `feat/voice-hitl-review` de los repositorios `homex-nlp`, `homex-backend` y `homex-frontend`.

El objetivo es **simplificar el sistema de validaciones para adaptarlo al procedimiento real de dictado comercial de HOMEX**, eliminando restricciones lingüísticas innecesarias y estableciendo tres filtros claros: duración del audio, extensión de la transcripción y validación comercial del NLP.

Como referencia funcional se dispone de 120 guiones basados en proformas reales de HOMEX: 79 muebles a pedido, 31 sillas, 7 pisos flotantes y 3 productos de otras categorías. Los guiones contienen aproximadamente entre 30 y 96 palabras, con una mediana de 55 palabras.

Esta intervención debe ser acotada. No rehacer la arquitectura ASR → NLP → HITL ni introducir nuevas funcionalidades ajenas al alcance.

## 1. Eliminar las validaciones lingüísticas innecesarias del NLP

**Objetivo:** abandonar la estrategia de rechazar expresiones mediante listas de palabras sospechosas o prohibidas.

Tareas:

1. Eliminar las reglas incorporadas específicamente para detectar palabras o expresiones como `hola`, `buenas`, `probando`, `microfono` y otros términos semejantes.
2. Eliminar las restricciones que rechazan nombres comerciales por contener alguna de esas palabras, incluso cuando forman parte de un nombre válido.
3. No sustituir estas reglas por nuevas listas de expresiones prohibidas, excepciones lingüísticas o validaciones equivalentes.
4. Conservar la extracción de atributos comerciales mediante evidencias reales: producto, dimensiones, materiales, componentes, cantidades, precios y demás información reconocida.
5. Mantener las validaciones comerciales útiles de categoría, unidades, tipos de datos, valores y coherencia entre atributos.
6. Conservar la capacidad de abstención cuando no exista información suficiente para generar una propuesta.
7. No inventar atributos para completar descripciones insuficientes.
8. Verificar que la eliminación de estas restricciones no afecte al reconocimiento de nombres comerciales legítimos ni a los comportamientos correctos existentes.

**Resultado esperado:** el NLP no necesita reconocer todas las frases incorrectas posibles. Su responsabilidad es interpretar información comercial identificable y abstenerse cuando no exista evidencia suficiente.

## 2. Filtro A — Duración mínima obligatoria de audio

**Objetivo:** impedir que grabaciones demasiado breves se envíen al reconocimiento de voz.

Establecer una duración mínima de **15 segundos** para las grabaciones y los archivos de audio utilizados en el asistente de captura comercial.

Tareas:

1. Sustituir el mínimo actual de 2 segundos por 15 segundos en el flujo de captura comercial por voz.
2. Validar la duración inmediatamente después de finalizar una grabación, antes de iniciar cualquier solicitud ASR.
3. Si la grabación dura menos de 15 segundos, impedir su envío y mostrar un mensaje indicando que debe dictarse una descripción más completa.
4. Aplicar el mismo mínimo a los archivos de audio seleccionados, verificando su duración antes de enviarlos.
5. Mantener la comprobación en Backend sobre la duración real del audio decodificado, sin confiar únicamente en el contador del navegador.
6. Conservar el máximo de 240 segundos para grabaciones por micrófono.
7. Conservar el máximo de 300 segundos y 20 MB para archivos subidos.
8. Mantener el ASR automático: cuando el audio cumpla las validaciones, comenzar la transcripción sin exigir un botón adicional.
9. No iniciar Whisper, NLP ni crear trabajos de procesamiento para audios rechazados por duración.
10. Presentar errores claros y permitir repetir la grabación o seleccionar otro archivo.

**Importante:** no incorporar por ahora un nuevo sistema obligatorio de detección de voz o VAD. El mínimo de duración es un requisito operativo; el siguiente filtro controlará la suficiencia del texto obtenido.

**Criterio de aceptación:** una grabación de 14 segundos se rechaza antes del ASR; una de 15 segundos o más puede transcribirse automáticamente, siempre que cumpla las demás validaciones técnicas.

## 3. Filtro B — Validación de extensión de la transcripción

**Objetivo:** evitar que el vendedor envíe al NLP transcripciones excesivamente breves, vacías o fuera de los límites establecidos.

Aplicar los siguientes requisitos al texto editable generado por ASR:

- **Mínimo:** 20 palabras.
- **Máximo inicial:** 3.000 caracteres, incluidos espacios y puntuación.

Tareas:

1. Mostrar la transcripción obtenida en el Drawer, permitiendo que el vendedor corrija errores de reconocimiento, números, cantidades, precios y especificaciones.
2. Incorporar un contador visible de palabras y caracteres, actualizado mientras se edita.
3. Si el texto está vacío o contiene menos de 20 palabras, mantener deshabilitado el botón **Procesar texto**.
4. Habilitar el procesamiento únicamente cuando existan al menos 20 palabras y no se supere el máximo de caracteres.
5. Implementar un conteo consistente que ignore espacios adicionales y signos aislados, contemplando correctamente números, cantidades y medidas normalizadas por ASR.
6. Impedir que el vendedor escriba caracteres adicionales después de alcanzar el máximo permitido.
7. Controlar también el pegado de texto para impedir que se supere el límite, sin eliminar silenciosamente contenido existente.
8. Si la transcripción original del ASR supera los 3.000 caracteres, conservarla íntegra, mostrar una advertencia y exigir que el vendedor reduzca el texto antes del NLP. **Nunca truncar automáticamente la salida del ASR.**
9. Aplicar las mismas comprobaciones en Backend para impedir que se omitan mediante solicitudes directas.
10. Mantener el texto editable y ofrecer mensajes específicos cuando no cumpla la longitud mínima o máxima.

**Alcance obligatorio:** los mínimos de 15 segundos y 20 palabras corresponden al asistente comercial de dictado por voz de HOMEX. No imponerlos indiscriminadamente al motor NLP general, la creación manual de productos, los registros históricos ni otros flujos que legítimamente utilicen descripciones breves.

**Referencia de calibración:** los 120 guiones escritos tienen entre 30 y 96 palabras y aproximadamente entre 192 y 671 caracteres. Utilizar esta evidencia para comprobar que el nuevo mínimo no afecta a los casos documentados.

Antes de fijar el máximo de 3.000 caracteres, verificarlo contra los ejemplos disponibles de grabaciones largas, especialmente de cuatro minutos. Ajustarlo solamente si se identifica evidencia real de que bloquea dictados válidos.

**Criterio de aceptación:** no debe ser posible enviar al NLP un texto vacío, de 19 palabras o de más de 3.000 caracteres. Con 20 palabras o más y dentro del límite, se permite solicitar interpretación, sin que esto garantice la existencia de una propuesta comercial.

## 4. Filtro C — Mantener la validación comercial del NLP

**Objetivo:** permitir el procesamiento de textos suficientemente extensos sin convertir su longitud en garantía de validez comercial.

Tareas:

1. Conservar la identificación de entidades, atributos, evidencias y relaciones comerciales existentes.
2. Evaluar la información comercial reconocida, independientemente de que el texto haya superado los mínimos de duración y palabras.
3. Si no existe información comercial suficiente, devolver un resultado sin propuesta.
4. Mostrar en el Drawer una advertencia comprensible cuando no pueda generarse una propuesta.
5. Conservar la transcripción editable para que el vendedor pueda corregirla y solicitar una nueva interpretación.
6. Si existe información comercial parcial pero válida, mostrar únicamente los atributos identificados, junto con los pendientes correspondientes.
7. No completar automáticamente precios, medidas, materiales, componentes u otros datos que no estén respaldados por la evidencia.
8. Mantener las validaciones comerciales definitivas y los permisos del Backend al guardar el formulario.

**Criterio de aceptación:** un texto incoherente de 30 o 50 palabras puede enviarse al NLP, pero no debe convertirse artificialmente en un producto. Un texto comercial válido puede generar una propuesta parcial sin inventar información faltante.

## 5. Corregir la asociación y trazabilidad de espesores

**Objetivo:** impedir que una observación de espesor quede registrada como resuelta mediante la asignación de un valor diferente al identificado.

Tareas:

1. Revisar la validación de `ESPESOR_SIN_COMPONENTE` en `apps/capturas/revision_voz.py` y sus consumidores.
2. Cuando se asigne un espesor pendiente a un componente, comprobar que el valor coincida con el pendiente correspondiente.
3. Normalizar unidades y representaciones equivalentes antes de comparar; por ejemplo, no considerar diferentes dos valores que representen exactamente la misma medida.
4. No aceptar una asignación únicamente porque el componente contenga algún espesor.
5. Si el vendedor decide corregir el espesor originalmente reconocido, distinguir esa operación de una simple asignación.
6. Registrar explícitamente el valor original, el valor corregido y la decisión humana correspondiente.
7. Mantener la validación de permisos, captura, evidencia e idempotencia de las decisiones HITL.
8. Comprobar que las observaciones se resuelvan y reabran correctamente cuando el vendedor modifica o revierte valores.

**Criterio de aceptación:** un pendiente de 18 mm no puede registrarse como asignado correctamente a un componente de 25 mm. Si el vendedor corrige intencionalmente el valor, debe quedar registrada una corrección verificable.

## 6. Evitar duplicar transcripciones en Observaciones comerciales

**Objetivo:** impedir que la descripción completa dictada por el vendedor termine copiada automáticamente en el campo de Observaciones del producto.

Tareas:

1. Revisar la generación del campo `observaciones` en el NLP de Catálogo y su aplicación en `ProductoForm.vue`.
2. Evitar que el fallback copie automáticamente toda la transcripción como una observación comercial.
3. No utilizar Observaciones como almacenamiento alternativo del texto original de ASR.
4. Conservar la transcripción original y las versiones corregidas en sus registros de captura y trazabilidad.
5. Permitir que Observaciones contenga información comercial complementaria que no tenga un campo estructurado específico.
6. No eliminar observaciones legítimas que el vendedor haya introducido manualmente.
7. Evitar que aplicar una propuesta sobrescriba observaciones existentes con el contenido íntegro de la transcripción.
8. Incorporar pruebas con descripciones que incluyan producto, medidas, materiales, precios y observaciones adicionales explícitas.

**Criterio de aceptación:** después de aplicar una propuesta, el formulario contiene los atributos comerciales identificados y únicamente las observaciones complementarias pertinentes, sin duplicar el dictado completo.

## 7. Conservar el comportamiento HITL existente

Verificar que las modificaciones anteriores no alteren las funcionalidades ya implementadas:

1. El ASR comienza automáticamente cuando el audio cumple los requisitos.
2. La transcripción aparece antes de ejecutar NLP y puede corregirse.
3. El NLP se ejecuta únicamente cuando el vendedor pulsa **Procesar texto**.
4. La propuesta se presenta con atributos comerciales comprensibles, no mediante JSON técnico.
5. Los campos con observaciones se identifican visualmente y permiten revisar el motivo.
6. Los pendientes críticos deben resolverse mediante acciones válidas antes del guardado.
7. Las propuestas antiguas y respuestas asíncronas obsoletas no pueden aplicarse.
8. La propuesta se aplica al formulario únicamente mediante confirmación explícita.
9. Después de aplicar, desaparece el apartado de transcripción libre y el vendedor continúa trabajando sobre los campos estructurados.
10. La evidencia ASR/NLP y las decisiones humanas conservan su trazabilidad.

## 8. Pruebas y verificación integral

Realizar las pruebas necesarias sobre las modificaciones y sus interacciones.

**Audio:**

1. Grabaciones de 14, 15, 16, 240 y 241 segundos.
2. Archivos subidos de 14, 15, 300 y más de 300 segundos.
3. Archivos vacíos, incompatibles o superiores a 20 MB.
4. Comprobación de que ningún audio inferior al mínimo desencadena trabajo ASR.
5. Transcripción automática y conservación de los controles de cancelación y reintento.

**Texto:**

1. Transcripciones vacías y compuestas únicamente por espacios.
2. Textos de 19, 20 y 21 palabras.
3. Textos de 2.999, 3.000 y 3.001 caracteres.
4. Escritura, pegado, borrado y edición del texto.
5. Salidas ASR superiores al límite, verificando que no se truncan.
6. Solicitudes directas al Backend que intenten omitir las validaciones.

**NLP:**

1. Verificar que la eliminación de listas de palabras prohibidas no produzca regresiones.
2. Probar nombres comerciales legítimos que antes eran rechazados.
3. Comprobar abstenciones ante textos incoherentes de longitud suficiente.
4. Comprobar propuestas comerciales completas y parciales.
5. Verificar que las categorías, unidades y atributos continúen respetando las reglas existentes.
6. Evaluar los 120 guiones de referencia frente a los nuevos umbrales, distinguiendo los guiones escritos de las transcripciones ASR reales.

**HITL y formularios:**

1. Asociación correcta e incorrecta de espesores.
2. Corrección explícita de un espesor y registro de la decisión.
3. Reversión de valores previamente confirmados.
4. Aplicación de propuestas sin duplicar la transcripción en Observaciones.
5. Conservación de observaciones comerciales legítimas.
6. Guardados repetidos, idempotencia y trazabilidad.
7. Verificación E2E y accesibilidad de los controles modificados.

**Integración:**

1. Ejecutar pruebas unitarias, de integración y regresión de los repositorios afectados.
2. Ejecutar lint, formato, typecheck y build.
3. Comprobar contratos OpenAPI y tipos del Frontend.
4. Verificar que Backend utilice exactamente la versión instalada del NLP correspondiente a la rama.
5. Si cambia el paquete NLP, generar una nueva versión y actualizar dependencias, lockfile, wheel y checksum, sin modificar artefactos publicados anteriormente.
6. Repetir las pruebas afectadas después de la última modificación.
7. Documentar claramente las verificaciones ejecutadas y las limitaciones del entorno.

## 9. Entrega y condiciones de cierre

1. Trabajar únicamente en las ramas `feat/voice-hitl-review` existentes.
2. Crear commits correctivos identificables, conservando el historial anterior.
3. No crear PR, realizar fusiones a `main`, publicar paquetes ni ejecutar `push` sin autorización.
4. Mantener limpios los worktrees al finalizar.
5. Actualizar `docs/voice-hitl-corrective-verification.md` y los registros técnicos correspondientes.
6. Documentar archivos modificados, pruebas nuevas, resultados obtenidos, versiones y commits finales.
7. Verificar que las correcciones se limiten a los requisitos acordados y no introduzcan nuevas restricciones lingüísticas innecesarias.
8. Realizar una comprobación final del flujo completo antes de declarar terminada la intervención.

### Criterio definitivo de aceptación

El sistema debe seguir este comportamiento:

**Audio válido de al menos 15 segundos → ASR automático → transcripción editable de al menos 20 palabras y como máximo 3.000 caracteres → NLP explícito → propuesta comercial o abstención → revisión HITL → aplicación confirmada al formulario.**

El propósito es que las validaciones respondan al procedimiento habitual de los vendedores de HOMEX, utilizando como referencia los 120 dictados comerciales disponibles, sin mantener listas interminables de palabras prohibidas ni introducir complejidad innecesaria.

**No ampliar el alcance para resolver escenarios puramente hipotéticos que no afecten al funcionamiento acordado.** Priorizar la correcta implementación de estos requisitos, la integridad comercial y la ausencia de regresiones.

Dar por completada la intervención únicamente cuando todos los criterios de aceptación establecidos estén verificados.
```

L2. All feature worktrees clean. RDD globally off. Forecast exceeds 400 authored lines; cohesive local corrective commits only; PR strategy deferred because PR creation is prohibited. Parallel T1/T3 disjoint surfaces; parent owns git, thresholds, packaging. Risk: items 1 (audit integrity), 3 (capture contracts), 5 (package integration).

L3. Verified root causes: catalog lexical/name heuristics and entire-input observations fallback; thickness backend checked only presence while frontend audited the pending rather than actual value. Removed lexical rejection; explicit observations only; exact normalized thickness plus distinct correction decisions. New assistant-only limits are decoded15seconds,20words,3000Unicodecodepoints. Added PyAV to API runtime dependencies to reject before job creation. Both 240-second synthetic experiments (2807/638chars) fit3000;120written and120storedASR allpass. Real-ASR durations unknown; no genuine long seller evidence supplied. NLP0.1.29source andinstalled1209pass; historicalartifacts unchanged. Independent final verifiers running on scratch copies.

L4. NLP unit committed as bf67a50. Removed linguistic/name blacklist gates and whole-transcript observations fallback, preserving general short-text and category/evidence semantics; source and installed0.1.29 suites1209passed each. Independent candidate backend752passed plus NLP1209passed and all backend static/build/migration/offline-lock checks. Frontend independent412unitpass and static/contract/buildpass. Seven E2E fixtures intentionally invalidated by newthresholds are being updated in one bounded test-only correction, no productioncodechanges.

L5. Thickness units committed as backend f311c8d and frontend 23d3343; catalog note preservation as frontend 980720c; backend admission and package integration as 2ccab9a. Corrective commits preserve previous history and unpublished historical wheels. Backend admission unit exceeds the advisory 400-line heuristic because its decoder-before-job boundary, endpoint contract, installed package identity and regression fixtures must agree; no whitespace/tests were removed to shrink it. PR slicing remains deferred under the explicit no-PR/existing-branches constraint.
L6. Final independent verification: backend 752 passed; NLP source and installed suites 1209 passed each; frontend 412 passed. Frontend static checks, typecheck, build and generated OpenAPI contract passed. Browser full run: 108 passed and 7 threshold-invalidated fixture failures; all 7 passed the single scoped correction recheck after real 15-second WAV/20-word edits and specific short-mobile-duration assertions. No production correction was needed. Parent spot check reran 23 voice tests and backend Ruff successfully. API web-runtime environment installed offline in the backend feature worktree's ignored .venv; metadata and all 32 installed NLP files match 0.1.29 wheel exactly. No remote CI, physical microphone, package publication, push, PR or main merge is claimed.
