# Regresiones de contrato PRF04_2: voz real v14

Base: frontend #41, `bf1e397`. No cambia el contrato ni el código generado.

`src/tests/prf04/voz-real-v14.spec.ts` comprueba:

1. Alto 75 cm no completa la unidad del ancho. MISSING_UNIT permanece
   visible y la unidad del ancho queda vacía.
2. Un componente cajones/cantidad_interna=2 no recibe automáticamente
   18 mm por «y una etapa». El pendiente exige seleccionar explícitamente
   un componente; hacer clic sin destino no crea tapa ni asigna espesor.
   La selección humana posterior resuelve el pendiente.

Validación local: 161 pruebas de unidad/componentes; las dos regresiones
focalizadas pasan también tras añadir el ciclo completo de resolución.
Lint, formato, tipos, regeneración de contrato sin diferencias y build OK.
La suite se ejecuta con VITE_API_BASE_URL=http://localhost:8000, como CI.
Estas fixtures son replays textuales; no modifican capturas ni audios.
