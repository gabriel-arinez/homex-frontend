# Confirmación comercial v15

Base #42 / ba6de1bf4aa79ee32a14c12d8b795c451a1fcda6. Consumidor de backend
#40 / 06940e8a45b9aae4654612723f49b534151cb418, NLP #33 / 0.1.15.

INVALID_PRICE permanece visible con campo vacío; sólo un precio humano positivo
resuelve la advertencia comercial. No se ofrece como sugerencia otro importe.
Se conserva la presentación de TOTAL_NEGOCIADO y sus confirmaciones. La fixture
textual prueba vacío → cero (pendiente) → ingreso humano positivo (resuelto).
No cambia OpenAPI ni código generado, permisos, revisiones o persistencia.

Validación local: 162 pruebas de unidad/componentes; TypeScript/build, lint,
formato y contrato regenerado sin diferencias. Nueve E2E FE06, incluidos cinco
anchos de accesibilidad. La integración con backend nuevo y ASR local usa WAV
TTS sintético: revisión de discrepancia total/unitario, guardado y relectura
tras reload. El caso de cancelación verifica ausencia de peticiones comerciales.
No se presentan estas pruebas como audio de vendedor ni GOLD.

Reproducción aislada: consultar docs/V15_VOZ_CONFIABLE.md de backend para el
stack 25434/26381/28002. Usar HOMEX_INTEGRATION_API_URL=http://127.0.0.1:28002,
VITE_API_BASE_URL con la misma API y HOMEX_PRF04_AUDIO apuntando al WAV TTS;
`npm run test:integration -- src/tests/integration/prf04-real.spec.ts`.
El servidor de prueba ocupa 4174. No tocar los laboratorios 28000/28001,
15176/15177, PostgreSQL 25432/25433 ni Redis 26379/26380.

Los pins CI operativos de contrato e integración se sincronizan al nuevo
backend. Los pins históricos F10 permanecen congelados. Las limitaciones ASR,
GOLD, catálogo y padre-hijo se documentan en NLP/backend y en la matriz privada;
no se resuelven inventando valores desde la interfaz.
