# Frontend del NLP definitivo

La corrección de descuento de PR45 se conserva independientemente del motor:
TOTAL_NEGOCIADO con descuento ausente mantiene el campo pendiente; confirmar una
diferencia de precio no equivale a confirmar descuento cero. El mapeador y el
formulario impiden esa sustitución. El vendedor conserva sus cambios manuales;
la voz no guarda automáticamente y una respuesta tardía no reemplaza su edición.

La integración real CI fija el commit consumidor del paquete final0.1.18 y ejecuta
API, worker, ASR de prueba, navegador y persistencia sobre datos ficticios. El
contrato sigue siendo PRF04_2 y OpenAPI no cambia. No se rediseña la interfaz ni
se añaden formularios. La revisión normal del vendedor no exige participar en
el desarrollo. No hay despliegue ni habilitación para usuarios finales.

El motor prf04-rules-final queda congelado; ASR es la próxima etapa y debe mantener
la frontera de texto existente. PR45 queda como antecedente de la corrección;
esta rama prepara su incorporación con el backend final seleccionado.
