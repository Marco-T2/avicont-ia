# Pruebas de Estrés con k6

Scripts de pruebas de carga y estrés para el sistema avicont-ia, usando [k6](https://k6.io/).

## Requisitos

- k6 instalado (`k6 version` debería responder)
- El sistema avicont-ia corriendo en `http://localhost:3000`

## Cómo correr el sistema

En una terminal:

```bash
npm run build
npm run start
```

> Importante: usar `npm run start` (build de producción) y NO `npm run dev`. El modo desarrollo es mucho más lento y daría números poco representativos.

## Scripts disponibles

| Script | Propósito | Duración | Carga |
|---|---|---|---|
| `basic.js` | Verificación rápida de que todo funciona | 30 s | 10 VUs constantes |
| `ramp.js` | Prueba de carga creciente — escenarios escalonados | ~6 min | 5 → 50 → 100 → 200 VUs |
| `stress.js` | Prueba de estrés buscando punto de quiebre | ~6 min | 100 → 300 → 500 VUs |

> **VU** = Virtual User (usuario virtual concurrente)

## Comandos

```bash
# Prueba básica (verificación)
k6 run tests/stress/basic.js

# Prueba de carga creciente (recomendada para tesis)
k6 run tests/stress/ramp.js

# Prueba de estrés
k6 run tests/stress/stress.js

# Cambiar URL base si el servidor corre en otro puerto
k6 run -e BASE_URL=http://localhost:8080 tests/stress/ramp.js

# Exportar resultados a JSON
k6 run --out json=resultados.json tests/stress/ramp.js
```

## Interpretación de resultados

k6 imprime al final un resumen con métricas clave:

| Métrica | Qué significa | Valor objetivo |
|---|---|---|
| `http_req_duration` | Tiempo total de cada petición | p(95) < 2 s |
| `http_req_failed` | Porcentaje de peticiones fallidas | < 5 % |
| `http_reqs` | Total de peticiones realizadas | — |
| `iterations` | Iteraciones del ciclo de prueba | — |
| `vus` | Usuarios virtuales activos | — |

## Para la tesis

Recomendaciones:

1. Ejecutar `ramp.js` y capturar el resumen completo de la consola.
2. Documentar los resultados por cada nivel de carga (5, 50, 100, 200 VUs).
3. Calcular el punto de quiebre (cuándo el tiempo de respuesta supera 3 s o el error rate supera 10 %).
4. Tomar capturas de pantalla del resumen final como evidencia.

## Endpoints probados

Los scripts usan rutas públicas del sistema:

- `/` → Página principal
- `/sign-in` → Pantalla de inicio de sesión

Estas rutas representan el primer punto de contacto del usuario con el sistema y son adecuadas para medir el comportamiento del *server-side rendering* y el *middleware* de autenticación bajo carga.
