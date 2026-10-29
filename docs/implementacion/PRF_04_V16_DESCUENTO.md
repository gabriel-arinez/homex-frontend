# V16: descuento desconocido al distribuir un total

Al mapear una captura con TOTAL_NEGOCIADO y descuento ausente, conservar el
campo descuento vacío. Antes se sustituía por 0.00, habilitando un unitario
automático sin evidencia de descuento cero. Un cero explícito sigue permitiendo
el cálculo exacto a centavos. Sin total dictado permanece el valor inicial habitual.

No cambia el contrato API, la interfaz visual ni el guardado comercial.
La extracción prepara una propuesta; el vendedor revisa PRF-03. Se protegen
cantidad, precio manual, cancelación, generación de respuestas y original ASR.
Las pruebas montan EspecificacionForm real y verifican campo vacío → ingreso
explícito 0.00 → unitario exacto, además del mapeador y controles históricos.

Esta corrección es compatible con PRF04_2 y puede revisarse por separado.
No homologa por sí misma el reemplazo del motor V15 ni acredita un recorrido
completo por navegador, cola y guardado de tienda.
