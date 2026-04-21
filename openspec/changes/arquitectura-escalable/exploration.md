## Exploration: arquitectura-escalable

> Fecha: 2026-04-21 · Alcance: evaluar la escalabilidad de avicont-ia (Next.js 16, App Router, Prisma, Clerk multi-tenant) sin inventar migraciones innecesarias.
> Regla: solo se creó este archivo, no se tocó código.

### Current State

Avicont-ia es un **monolito modular** contable-avícola. Cada capability vive en `features/<name>/` con capas internas explícitas: `*.validation.ts` (Zod), `*.types.ts`, `*.repository.ts` (Prisma), `*.service.ts` (dominio) y `index.ts` / `server.ts` como dos barrels separados (ver `openspec/specs/feature-module-boundaries/spec.md` — `import "server-only"` en repos/servicios + ESLint `no-restricted-imports` desde client components).

- **Entry points HTTP**: `app/api/organizations/[orgSlug]/...` concentra ~80 rutas (Glob devolvió 84 `route.ts`). Toda ruta orgánica entra por `requirePermission(resource, action, orgSlug)` (`features/shared/permissions.server.ts:20`), que hace `requireAuth()` → `requireOrgAccess()` → `getMatrix(orgId)` + `requireMemberWithRoles()`. Hay además rutas globales `app/api/analyze/route.ts` y `app/api/documents/*`.
- **Middleware**: `proxy.ts:1-10` solo monta `clerkMiddleware()`. No hay rate limiting, no hay tenant guard transversal, no hay header de correlación. La autorización ocurre por ruta, no en middleware.
- **Patrón route → service → repo**: confirmado end-to-end en `app/api/organizations/[orgSlug]/equity-statement/route.ts:1-89` → `features/accounting/equity-statement/equity-statement.service.ts:16-89` → `features/accounting/equity-statement/equity-statement.repository.ts`. El servicio coordina 7 queries en paralelo con `Promise.all` (lines 44-61) y delega a un builder puro (`equity-statement.builder.ts`). Mismo shape en `features/accounting/journal.service.ts:62-307`.
- **Multi-tenant**: todo repo hereda de `features/shared/base.repository.ts:7-24` con `requireOrg(orgId)` que devuelve el scope `{ organizationId }`. Cada query Prisma lo expande (`where: { ...scope, ... }`). Es **disciplina**, no un tenant-guard forzado por el ORM — si un dev olvida `...scope`, no hay red de seguridad (ver Risks).
- **Prisma**: `lib/prisma.ts:1-11` instancia `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })` **en cada import sin singleton ni global cache**. En `next dev` con HMR esto multiplica conexiones. En producción Vercel serverless cada lambda abre su propio pool sin PgBouncer/Data Proxy.
- **Base de datos**: PostgreSQL + `pgvector` (campo `Unsupported("vector(768)")` en `prisma/schema.prisma:135`). El schema tiene ~30 modelos con `@@index([organizationId, ...])` razonables; raws SQL usan `$queryRaw` parametrizado (p.ej. `equity-statement.repository.ts:50-65`) — correcto contra SQLi.
- **Permisos**: `features/shared/permissions.cache.ts` — `Map<orgId, OrgMatrix>` con TTL 60 s, single-flight vía `inflight`, LRU cap 1000. Es explícitamente **en memoria por instancia**, sin Redis, y la invalidación solo limpia la Map local: `D.12` asume drift multi-instancia ≤ 60 s. `ensureOrgSeeded` (líneas 168-184) auto-seedea roles de sistema en el primer acceso si `roles.size === 0`.
- **Rendering / caching**: páginas en `app/(dashboard)/[orgSlug]/...` son Server Components que hacen `service.list()` inline (ej. `app/(dashboard)/[orgSlug]/accounting/journal/page.tsx:13-55`). No hay `unstable_cache`, `"use cache"`, `revalidatePath` ni `revalidateTag` (las rutas de export PDF/XLSX tienen `export const runtime = "nodejs"` pero no tags de caché). Serialización vía `JSON.parse(JSON.stringify(entries))` (page.tsx:65-67) para cruzar la barrera Server→Client por los `Decimal` de Prisma — funcional pero alloc overhead por request.
- **Trabajo pesado en request path**:
  - `app/api/analyze/route.ts:36` llama `analyzeWithGemini(content, ...)` síncrono.
  - `app/api/organizations/[orgSlug]/agent/route.ts:45-51` → `AgentService.query` → `queryWithTools` (Gemini `generateContent`), + `Promise.all` de 3 contextos (`agent.service.ts:57-61`) + historia de chat. Todo dentro del request.
  - Exporters PDF (`pdfmake`) y XLSX (`exceljs`) se ejecutan en el mismo handler (`equity-statement/route.ts:52-82`). Esto fuerza `runtime = "nodejs"` y ata el tiempo de respuesta al tamaño del reporte.
  - `features/rag/vector.repository.ts:22-36` inserta chunks con embeddings en un loop secuencial `for...of await` — N viajes a Postgres.
- **Background jobs / colas**: **no existen**. `grep cron|queue|worker|bull|trigger.dev` no encuentra nada (solo palabras tipo "queue" en docstrings). No hay `vercel.json` con `crons` ni un worker separado. Todo es "online".
- **Observabilidad**: `grep` por `Sentry|pino|winston|logger` encontró 0 coincidencias fuera de 62 `console.log`/`console.error` dispersos (p. ej. `features/shared/middleware.ts:45`, `features/ai-agent/agent.service.ts:142`). No hay traces, ni structured logging, ni request-id, ni métricas. Solo `console.*` al stdout de Vercel.
- **Tests**: Vitest con 2 projects (`node` + `jsdom` para componentes). **270 archivos de test** para 258 archivos `.ts` en `features/` + 84 `route.ts`. Densidad de tests saludable. `vitest.setup.ts:1` solo importa jest-dom. No hay suite de integración contra una DB real — los tests mockean el loader de permisos (`permissions.cache.ts:82 _setLoader`) y usan mocks de Prisma. **Costo de test: bajo — todo in-memory.**
- **Schema evolution**: 14 migraciones en ~5 semanas (`prisma/migrations/` — de `2026-04-06` a `2026-04-20`) confirman alta cadencia de cambios de dominio (iva-books, custom-roles, contra-accounts, org-profile, voucher-type string prefix, etc.).

### Affected Areas

Ámbitos donde cualquier decisión de escalabilidad tocaría código (solo mapa — no propuesta):

- `lib/prisma.ts` — instancia Prisma sin singleton; foco de cualquier cambio de pooling (PgBouncer, Accelerate, Data Proxy).
- `features/shared/permissions.cache.ts` — TTL 60 s in-process; afectado si se introduce Redis/KV o `revalidateTag`.
- `features/shared/middleware.ts` + `proxy.ts` — única puerta transversal; candidato para rate limiting, request-id, tenant-guard global.
- `app/api/organizations/[orgSlug]/agent/route.ts` + `app/api/analyze/route.ts` — llamadas Gemini síncronas; candidatos para streaming o workers.
- `app/api/organizations/[orgSlug]/equity-statement/route.ts` (y hermanos: `trial-balance`, `worksheet`, `financial-statements/*`, `iva-books/*/export`) — renderizado PDF/XLSX en request; candidatos para offload.
- `features/accounting/*/repository.ts` (especialmente `journal.repository.ts`, `financial-statements.repository.ts`, `equity-statement.repository.ts`) — `$queryRaw` agregados por org, sensibles a índices y tamaño de `journal_lines`.
- `features/rag/vector.repository.ts` — loop secuencial de inserts; pgvector KNN sin índice IVFFlat/HNSW declarado en schema.
- `features/shared/base.repository.ts` — tenant scope por convención; cualquier endurecimiento (RLS, middleware Prisma) pasa por aquí.
- `app/(dashboard)/[orgSlug]/**/page.tsx` — Server Components con `service.list()` directo; candidatos para caching per-org con tags.
- 270 tests en `__tests__/` — cualquier reestructura de capas debe preservar esta inversión.

### Approaches

Cuatro opciones que salen de lo observado. El "tamaño del problema" hoy es **desconocido desde esta ventana** (el usuario no reportó síntomas concretos), así que las opciones se ordenan por costo creciente y se evalúan contra los hotspots reales.

1. **A) Mantener Next.js y endurecer hotspots específicos** — refinar lo que ya existe.
   - Qué incluye: (a) singleton Prisma + Accelerate/PgBouncer para pooling; (b) extraer `console.*` a un logger estructurado (`pino`) con request-id inyectado por un wrapper de `requirePermission`; (c) rate limiting por Clerk user + orgId en `proxy.ts`; (d) agregar índices pgvector (IVFFlat/HNSW) en `document_chunks.embedding`; (e) reemplazar el loop secuencial de `vector.repository.storeChunks` por `INSERT ... VALUES` batch; (f) encender error tracking (Sentry) y `revalidateTag` por orgId para páginas de lectura frecuente.
   - Pros: cero migración, cambios locales, cada uno reversible; no rompe los 270 tests; ataca los hotspots reales (Gemini sync, logs, pooling).
   - Cons: no resuelve trabajos largos (PDF grandes, reanálisis masivo de documentos) — siguen atados al timeout del request; no introduce backpressure real.
   - Esfuerzo: **Bajo-Medio** (se puede trocear en 5-6 PRs independientes).

2. **B) Extraer un worker/queue para trabajo pesado (Gemini, PDF/XLSX, RAG indexing)** — Next.js sigue siendo el frontend/API-gateway, pero las tareas blocking salen del request path.
   - Qué incluye: elegir un runner (Trigger.dev / Inngest / QStash / Vercel Cron + tabla `jobs` propia), mover `analyze/route.ts` y el POST del agent-write-action a encolar un job, y exponer un endpoint de status/polling o streaming. Los exporters PDF/XLSX pueden quedarse síncronos si son < 5 s o migrar también.
   - Pros: desacopla SLA de UI del tiempo de Gemini; abre la puerta a retries/idempotencia; escalado horizontal del worker independiente del tráfico web.
   - Cons: infra extra (costo + complejidad operativa); hay que repensar la UX (progress/estado); consistencia eventual en documentos/chunks; los tests necesitarían un in-memory queue para mantener costo bajo.
   - Esfuerzo: **Medio** (si se acota a 2-3 casos de uso: analyze, agent-write confirmation, exports grandes).

3. **C) Migración "Strangler" a NestJS REST** (la estimación previa de sesiones anteriores).
   - Qué incluye: levantar servicio Nest separado, mover `features/*/repository.ts` + `service.ts` allá con la misma capa, dejar Next.js como BFF/UI, migrar rutas por módulo.
   - Pros: proceso long-lived (pool Prisma estable, workers in-proc sin serverless cold starts), DI explícita, ecosistema maduro para interceptors/guards/rate-limit/observability.
   - Cons: **no se observó ningún bloqueante que lo justifique hoy**: el patrón route→service→repo ya está limpio, `server-only` ya aísla, los tests ya son rápidos. Duplicaría infra (dos deploys, dos pipelines), partiría la auth (hoy una sola Clerk middleware), invalidaría las 84 rutas y sus tests, y reabriría decisiones que ya están resueltas (permissions cache). Es una respuesta desproporcionada a síntomas no confirmados.
   - Esfuerzo: **Alto** (3-6 meses de doble pista, con riesgo real de regresiones contables).

4. **D) Consolidar el tenant-scope con Postgres RLS + middleware Prisma** — ortogonal a las otras, atacable sola.
   - Qué incluye: activar `ROW LEVEL SECURITY` sobre las tablas con `organizationId` y un `SET app.current_org_id = $1` por transacción, emitido desde un Prisma middleware alimentado por `requirePermission`. Hoy la seguridad tenant vive en la disciplina de `...scope` dentro de cada repo; RLS la convierte en invariante de la DB.
   - Pros: elimina la clase completa "dev olvida `organizationId` en un `findMany`"; protege incluso raw queries; complemento natural a cualquiera de A/B/C.
   - Cons: requiere revisar cada migración futura (todas las tablas nuevas deben tener política); el adapter `@prisma/adapter-pg` necesita un pool que respete sesión o SET por transacción; hay que auditar los `$queryRaw` existentes (p.ej. `equity-statement.repository.ts`, `vector.repository.ts`) para que pasen también el scope.
   - Esfuerzo: **Medio** (1-2 sprints con auditoría), independiente del resto.

| Approach | Pros | Cons | Esfuerzo |
|---|---|---|---|
| A – Endurecer hotspots | Reversible, ataca dolor real, 0 migración | No resuelve tareas largas | Bajo-Medio |
| B – Worker/queue | Desacopla IA/PDF del request | Infra + UX adicionales | Medio |
| C – Strangler → NestJS | Proceso long-lived, DI explícita | Desproporcionado hoy, duplica infra | Alto |
| D – RLS + tenant middleware | Tenant-safety por construcción | Auditoría de raw queries y migraciones | Medio |

### Recommendation

**A primero (ya), D después (cuando haya un sprint libre), B cuando aparezca el dolor. C: descartar mientras no haya evidencia.**

Razonamiento anclado en lo leído:

1. La **arquitectura actual es sorprendentemente limpia para el tamaño**: 30 features, 84 rutas, 270 tests, un patrón route→service→repo consistente, barrels `server.ts`/`index.ts` con `server-only` + ESLint, permisos cacheados con single-flight, builders puros separados de repos. No hay deuda estructural obvia que justifique una migración.
2. **Los dolores reales potenciales son operativos y específicos**, no arquitecturales:
   - `lib/prisma.ts` sin singleton → en serverless cada lambda consume conexiones; con Clerk + Gemini en el mismo request, el pool de Postgres es el primer techo que aparecerá (ver Risks).
   - `console.*` × 62 y cero tracing → cuando aparezca un bug de producción multi-tenant, debuggear va a doler.
   - Gemini síncrono en `analyze` y `agent` → un pico de tráfico se come el concurrency limit de Vercel Functions.
   - `permissions.cache` TTL 60 s per-instance → con >1 lambda viva, un cambio de rol puede tardar hasta 60 s en propagar; aceptable hoy, no escala a "tiempo real".
3. **C (Strangler a Nest) resuelve problemas que este codebase no tiene**. El patrón route→service→repo ya está en Next.js, `server-only` ya previene fugas a cliente, y los tests ya son rápidos sin DB. Migrar sería optar por una arquitectura nueva para atacar síntomas que no se han manifestado.
4. **B (worker/queue)** vale la pena **el día que** (a) un export PDF se acerque a 10 s, (b) el ratio de 429/timeout de Gemini suba, o (c) se quiera reanalizar documentos en bulk. Hoy, sin métricas, no se puede justificar la infra.
5. **D (RLS)** es el único "refuerzo arquitectural" que vale la pena aunque no haya dolor: convierte disciplina de equipo en invariante de DB, y es compatible con A y B. Si la base de usuarios crece a decenas de orgs activas, un leak accidental de tenant es el bug que ningún equipo quiere ver.

Sugerencia de secuencia (si el proponer adopta esto):
- **Fase 1 (A, bajo riesgo, 1-2 semanas)**: singleton Prisma (reusar adapter), logger estructurado + request-id inyectado, Sentry, rate limiting en middleware, índice HNSW en `document_chunks.embedding`, batch insert en `vector.repository`.
- **Fase 2 (D, medio)**: activar RLS por tabla con `organizationId`, Prisma middleware que `SET` el tenant desde `requirePermission`, auditoría de `$queryRaw`.
- **Fase 3 (B, medio, dependiente de evidencia)**: medir p95 de `analyze`, `agent`, exporters. Si > 3-5 s o con tasa de error relevante → meter queue; si no, dejarlo.
- **C**: no hacerlo hasta que algún dolor lo justifique (p.ej. Vercel serverless deja de alcanzar).

### Risks

- **Tenant leak por disciplina**: el scope multi-tenant es una convención (`...this.requireOrg(orgId)`), no un invariante DB. Un `findMany` sin `organizationId` en un PR bien formateado pasa revisión sin un lint específico. **Alto impacto, probabilidad media en crecimiento de equipo**.
- **Prisma sin singleton + sin pooler**: `lib/prisma.ts` instancia en cada import. Bajo carga serverless (>50 reqs concurrentes) se agotan conexiones; bajo `next dev` con HMR es directamente conocido que dispara "too many connections". Impacto: 500s bajo pico.
- **Llamadas Gemini síncronas en request path**: `agent/route.ts` y `analyze/route.ts` gastan el budget de timeout de Vercel (típico 60-300 s) por request. Un pico de RAG queries con Gemini lento bloquea el pool de funciones.
- **Observabilidad esencialmente cero**: 62 `console.*`, ningún `Sentry`/`pino`/OpenTelemetry. Cuando un tenant reporte un asiento mal balanceado, no hay cómo tracear qué pasó con qué inputs. Esto **no rompe la app**, rompe la capacidad de operarla.
- **Sin rate limiting ni idempotencia**: un cliente malicioso o un bug de retry puede duplicar `createAndPost` (journal), `registerExpense`, etc. La idempotencia existe por `@@unique` en schema (p.ej. `voucher_types[org,code]`, `journal_entries[org,voucherType,period,number]`), pero doble-click en un POST no tiene protección aplicacional visible.
- **`permissions.cache` TTL 60 s per-instance**: cambios de rol pueden tardar hasta 60 s en propagar entre lambdas concurrentes. Aceptable hoy, doloroso si se promete "revocación inmediata".
- **`vector.repository.storeChunks` con loop secuencial** y sin índice ANN declarado (el schema dice `Unsupported("vector(768)")`, ningún `@@index` ann): ingesta O(n) de round-trips y búsqueda KNN sin índice → degrada cuando los chunks crezcan.
- **Exporters en request path**: `pdfmake`/`exceljs` para un EEPN o Balance con muchas cuentas puede superar 10-30 s y matar el request; no hay fallback async.
- **Falta de suite de integración**: los 270 tests son unitarios con mocks — altamente productivos, pero cero tests contra Postgres real verifican que los `$queryRaw` de `equity-statement`/`financial-statements`/`worksheet`/`trial-balance` siguen devolviendo lo mismo tras cambios de schema. Esto es inversión diferida, no bug.

### Ready for Proposal

**Sí, listo para `sdd-propose`** — con una condición importante: el propose debe **pedir al usuario qué dolor específico quiere atacar primero** (conexiones DB, tiempos Gemini, tenant-safety, observabilidad). La recomendación A+D cubre el mayor retorno-por-esfuerzo si no hay preferencia, pero la secuencia óptima depende de síntomas que no están visibles desde esta exploración. **No recomendar C (Strangler/NestJS)** a menos que el usuario aporte evidencia de que Next.js está bloqueando el producto.
