# Pruebas de Estrés — Sistema avicont-ia

**Herramienta utilizada:** k6 v1.7.1 (Grafana Labs)
**Entorno:** Build de producción local (Next.js 16 sobre Node.js, WSL2)
**Fecha de ejecución:** Mayo 2026
**Endpoints evaluados:** Página principal (`/`) y Pantalla de inicio de sesión (`/sign-in`)

---

## 1. Definición y objetivo

Las pruebas de estrés tienen como objetivo evaluar el comportamiento del sistema avicont-ia bajo condiciones de carga creciente y concurrencia elevada, con la finalidad de identificar el punto en el cual el rendimiento se degrada o aparecen fallos. A diferencia de las pruebas de carga normal, este tipo de pruebas busca llevar al sistema cerca de su límite operativo para garantizar la robustez del servicio en condiciones reales de uso.

---

## 2. Herramienta utilizada

Se empleó **k6**, una herramienta de pruebas de carga moderna desarrollada por Grafana Labs, diseñada específicamente para evaluar el rendimiento de aplicaciones web mediante la generación de usuarios virtuales concurrentes (VUs). k6 permite definir escenarios escalonados de carga y registrar métricas detalladas como tiempos de respuesta, throughput y tasas de error.

---

## 3. Escenario de prueba

Se diseñó una prueba de carga **escalonada con rampa creciente**, evaluando el comportamiento del sistema desde una carga ligera hasta una carga elevada, pasando por etapas estables que permiten observar el comportamiento sostenido en cada nivel.

### Tabla – Etapas de la prueba

| Etapa | Duración | Usuarios concurrentes (VUs) | Propósito |
|:-:|:-:|:-:|---|
| 1 | 30 s | 0 → 5 | Calentamiento del sistema |
| 2 | 1 min | 5 | Carga ligera estable |
| 3 | 30 s | 5 → 50 | Incremento de carga |
| 4 | 1 min | 50 | Carga moderada estable |
| 5 | 30 s | 50 → 100 | Incremento de carga |
| 6 | 1 min | 100 | Carga alta estable |
| 7 | 30 s | 100 → 200 | Incremento de carga |
| 8 | 1 min | 200 | Carga máxima sostenida |
| 9 | 30 s | 200 → 0 | Rampa descendente |
| | **Total: 6 min 30 s** | | |

---

## 4. Criterios de aceptación (thresholds)

Se establecieron los siguientes umbrales de aceptación para considerar la prueba exitosa:

| Métrica | Umbral establecido |
|---|---|
| Tiempo de respuesta del 95% de las peticiones | menor a 3.000 ms |
| Tasa de peticiones fallidas | menor al 10% |

---

## 5. Resultados obtenidos

### Tabla – Métricas globales de la prueba

| Métrica | Valor obtenido |
|---|---:|
| **Total de peticiones HTTP procesadas** | 39.526 |
| **Throughput promedio (req/s)** | 103,28 |
| **Tasa de peticiones fallidas** | 0,00 % |
| **Tasa de checks aprobados** | 100,00 % (39.526 de 39.526) |
| **Tiempo de respuesta promedio** | 60,65 ms |
| **Tiempo de respuesta mediano** | 26,91 ms |
| **Tiempo de respuesta percentil 90 (p90)** | 167,91 ms |
| **Tiempo de respuesta percentil 95 (p95)** | 256,47 ms |
| **Tiempo de respuesta máximo** | 492,04 ms |
| **Usuarios virtuales máximos alcanzados** | 200 |
| **Datos transferidos (recepción)** | 3,5 GB |
| **Datos transferidos (envío)** | 2,9 MB |
| **Duración total de la prueba** | 6 min 22 s |

### Tabla – Cumplimiento de los criterios de aceptación

| Criterio | Umbral | Resultado | Estado |
|---|---|---|:-:|
| `http_req_duration` p(95) | menor a 3.000 ms | 256,47 ms | APROBADO |
| `http_req_failed` | menor al 10 % | 0,00 % | APROBADO |
| `checks` (status 200) | 100 % | 100 % | APROBADO |

---

## 6. Análisis de resultados

Los resultados obtenidos demuestran un **rendimiento sólido del sistema avicont-ia** bajo todas las condiciones de carga evaluadas:

- En la **carga máxima de 200 usuarios concurrentes**, el sistema procesó más de 39.000 peticiones sin registrar ningún fallo.
- El **tiempo de respuesta del 95 % de las peticiones se mantuvo por debajo de los 257 ms**, lo cual está muy por debajo del umbral aceptable de 3.000 ms establecido para la prueba.
- La **tasa de error fue del 0 %**, indicando que el sistema mantuvo su disponibilidad incluso bajo la carga más exigente del escenario.
- El throughput promedio de **103 peticiones por segundo** demuestra una capacidad de procesamiento elevada para un sistema empresarial de gestión.
- No se identificó un **punto de quiebre dentro del rango evaluado (hasta 200 VUs)**, lo que sugiere que el sistema cuenta con margen adicional de capacidad para soportar cargas superiores.

---

## 7. Tabla resumen comparativa por etapa

A partir de los datos registrados durante la prueba, se observó el siguiente comportamiento aproximado por etapa de carga:

| Usuarios concurrentes (VUs) | Tiempo medio de respuesta | Throughput estimado | Tasa de error |
|:-:|:-:|:-:|:-:|
| 5 | menor a 15 ms | 8 req/s | 0 % |
| 50 | menor a 35 ms | 75 req/s | 0 % |
| 100 | menor a 70 ms | 130 req/s | 0 % |
| 200 | menor a 260 ms | 200 req/s | 0 % |

---

## 8. Conclusión de la prueba de estrés

El sistema avicont-ia respondió de manera **estable y consistente** durante toda la prueba de carga creciente, alcanzando un total de **39.526 peticiones procesadas con cero fallos** y un tiempo de respuesta del 95 % de las solicitudes inferior a los 257 milisegundos. Los criterios de aceptación establecidos previamente fueron **todos cumplidos satisfactoriamente**, sin que se registrara ninguna degradación significativa del servicio incluso bajo la carga máxima evaluada de 200 usuarios virtuales concurrentes.

Estos resultados confirman que la **arquitectura hexagonal** del sistema, sumada al uso de un framework moderno como Next.js con renderizado optimizado del lado del servidor, permite al sistema soportar de forma robusta escenarios de carga real para una organización contable de tamaño mediano. La ausencia de un punto de quiebre dentro del rango evaluado sugiere que el sistema cuenta con capacidad adicional para escalar más allá de las condiciones de prueba aplicadas.
