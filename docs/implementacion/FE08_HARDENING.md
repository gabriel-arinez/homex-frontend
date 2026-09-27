# FE08 — Hardening, integración real y cierre funcional

## Estado

**Implementación completada y validada localmente.** La evidencia remota queda pendiente de la publicación de la rama por parte del responsable del repositorio.

- Rama: `feat/fe08-hardening-integracion`.
- Base frontend: `e44f46944f868ecffd072953caac809d595e2ffa`.
- Backend integrado y fijado: `96e5afd0c3bd0e5c75ddd5469313ac2e79cdad7e`.
- OpenAPI y tipos generados: sin cambios contractuales y sin drift.

## Objetivo alcanzado

FE08 demuestra los flujos críticos con la aplicación completa. La suite ordinaria conserva MSW para pruebas rápidas y deterministas, mientras que un gate independiente levanta Django, PostgreSQL, Redis, Celery worker, Celery beat, `homex-nlp` y faster-whisper. La prueba real no intercepta las solicitudes de negocio ni sustituye worker, ASR, NLP o HITL.

No se añadieron endpoints, estados, permisos, WebSockets ni reglas comerciales en Vue. El frontend sigue mostrando y enviando exclusivamente el contrato publicado por backend.

## Integración real reproducible

El job `integration-real` de GitHub Actions prepara un entorno aislado:

1. inicia PostgreSQL 17 y Redis 7.4;
2. instala el backend fijado por commit mediante su `uv.lock`;
3. aplica las migraciones desde una base vacía;
4. crea un usuario administrador, un cliente y un producto de prueba mediante servicios y modelos reales;
5. registra el stock como `CARGA_INICIAL`, sin escribir la existencia directamente;
6. descarga y cachea explícitamente `faster-whisper-base`;
7. genera un WAV efímero en español;
8. levanta API, worker y publicador outbox;
9. ejecuta Playwright contra el frontend y backend reales;
10. verifica en PostgreSQL los efectos comerciales y NLP, además de la eliminación del audio temporal.

El audio se genera durante el job, no se versiona ni se publica como artefacto. La comprobación final exige que el directorio temporal quede vacío.

## Recorrido comercial real

La prueba integrada cubre:

```text
login
→ cliente y producto reales
→ proforma manual BORRADOR
→ detalle de catálogo
→ ENVIADA
→ APROBADA
→ pedido CONFIRMADO
→ movimiento VENTA
→ orden de trabajo
→ recibo EMITIDO
→ cancelación bloqueada por cobro
→ recibo ANULADO
→ EN_PRODUCCION
→ LISTO_ENTREGA
→ nota de entrega
```

Un segundo pedido confirma la cancelación válida sin recibo emitido y la correspondiente `REVERSA_VENTA`. Un verificador posterior consulta PostgreSQL y exige la existencia de pedido, OT, venta, reversa, recibo anulado y nota de entrega.

## Recorrido NLP real

La segunda prueba integrada cubre:

```text
login
→ proforma BORRADOR
→ carga multipart de audio WAV
→ HTTP 202
→ outbox
→ Celery
→ ASR faster-whisper
→ homex-nlp RULES_ONLY
→ REQUIRES_REVIEW
→ revisión humana
→ confirmación HITL
→ detalle persistido
→ proforma continúa BORRADOR
```

El verificador exige una captura `COMPLETADA`, intento `FINALIZADO`, evidencia IA, corrección humana y transcripción ASR persistida. Así se evita que una interfaz aparentemente correcta o una respuesta mockeada oculten un fallo del pipeline.

## Hardening del cliente HTTP

El cliente distingue ahora un timeout propio de una cancelación explícita mediante `AbortSignal`. También normaliza correctamente los errores DRF que publican un campo como texto o como lista de textos. Esta corrección se obtuvo durante el recorrido real: la cancelación bloqueada devolvía un mensaje comercial válido en un campo de texto y antes terminaba presentada como error genérico.

Las respuestas exitosas con contenido no JSON se rechazan como `invalid_response`; una página HTML del proxy nunca se interpreta como una respuesta válida de dominio.

## Matriz de fallos

| Caso                           | Comportamiento y evidencia                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Backend no disponible / red    | El cliente produce error `network`; autenticación y vistas conservan estados recuperables cubiertos desde FE02–FE07. |
| `401`                          | Refresh único, repetición segura y cierre de sesión cuando no puede renovarse, cubierto en FE02.                     |
| `403`                          | Vista y mensajes de acceso denegado, guards por capabilities y rechazo backend, cubiertos en FE02, FE04 y FE05.      |
| `404`                          | Ruta de aplicación y recurso inexistente diferenciados; matriz transversal verifica el estado y mensaje.             |
| `409`                          | Conflicto preservado, recarga de autoridad backend y mensajes accionables, cubierto en FE04/FE06 y matriz FE08.      |
| `500`                          | Mensaje seguro sin presentar éxito ni perder el código HTTP.                                                         |
| Timeout                        | Código `timeout` diferenciado de caída de red y de una cancelación explícita.                                        |
| Captura `ERROR`                | FE06 presenta el estado terminal y la evidencia publicada sin inventar propuesta.                                    |
| Contrato NLP desconocido       | Backend rechaza el contrato; frontend presenta el error contractual publicado.                                       |
| Imagen ausente                 | `ProductImage` conserva fallback accesible sin depender del original, cubierto desde FE03.                           |
| Resultado vacío                | `NO_PROPOSAL` se presenta como ausencia de propuesta y no como éxito vacío, cubierto en FE06.                        |
| Lista vacía                    | Clientes, productos, proformas, operaciones, capturas y resumen conservan estados vacíos semánticos.                 |
| JSON inválido con `200`        | Se rechaza como `invalid_response`.                                                                                  |
| Error DRF por campo como texto | Se conserva como mensaje comercial y se normaliza a la colección de errores del formulario.                          |

## Regresión visual, responsive y accesibilidad

Se incorporaron snapshots versionados del login en tema claro y oscuro a 390 px. La regresión funcional acumulada recorre los módulos en 360, 390, 768, 1024 y 1440 px, valida ausencia de overflow, navegación móvil, light/dark, foco y operación por teclado.

La suite Axe acumulada contiene 23 escenarios sobre los flujos principales y no reporta violaciones serias o críticas. FE08 conserva las correcciones responsive dentro de sus módulos originales y usa la suite transversal como gate, en lugar de duplicar componentes o estilos.

## Rendimiento y consola

El recorrido comercial real exige que la navegación medida permanezca por debajo de 10 segundos en el entorno de integración. Es un presupuesto de regresión local/CI, no una afirmación sobre latencia productiva.

Ambos recorridos reales capturan `console.error` y `pageerror`. El flujo nominal debe terminar con cero errores. La respuesta `400` de una cancelación deliberadamente bloqueada se comprueba como caso comercial esperado y se separa antes de evaluar la consola del recorrido nominal.

El build mantiene división por rutas y componentes. FE08 no añadió una dependencia gráfica ni una librería de estado adicional.

## Validación local final

- type-check: verde;
- lint: verde, 0 errores y 0 warnings;
- format: verde;
- unit/component/integration MSW: **71 passed**;
- Playwright funcional y visual: **68 passed**;
- accesibilidad Axe: **23 passed**;
- integración con backend/worker/ASR/NLP reales: **2 passed**;
- verificación posterior en PostgreSQL y audio efímero: verde;
- contract drift: verde;
- build de producción: verde;
- auditoría de dependencias: **0 vulnerabilidades**;
- migraciones backend desde base vacía para el gate: verde.

## Cierre y límite de fase

FE08 deja automatizada la evidencia equivalente a la integración F09 del backend. El cierre remoto podrá registrarse cuando la rama sea publicada y el nuevo job `integration-real`, junto con los diez gates existentes, termine verde en GitHub Actions.

Release, despliegue, HTTPS, headers, CSP, reverse proxy y piloto pertenecen a FE09 y no se adelantan en esta fase.
