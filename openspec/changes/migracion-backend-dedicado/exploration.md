## Exploration: migracion-backend-dedicado

> Fecha: 2026-04-21 · Alcance: evaluar **conveniencia + factibilidad** de migrar TODO el backend (84 rutas `app/api/**` + los 30 módulos en `features/**`) a un servicio Node dedicado. Next.js queda como cliente (UI + BFF fino de auth).
> Stacks en evaluación: **NestJS** vs alternativas livianas (Fastify, Hono, Express). No se evalúan stacks no-Node.
> Relación con `sdd/arquitectura-escalable/explore`: la exploración previa descartó este movimiento (Approach C) "por falta de síntomas". Este documento lo reabre con números, no con principios, y asume que la decisión puede ir para cualquiera de los dos lados.
> Regla: sólo se crea este archivo; no se toca código ni la hermana `arquitectura-escalable`.

### Current State

El "backend" candidato a migrar es una capa **route→service→repo** muy consistente, pero todavía embebida en un proceso Next.js 16 App Router. Las mediciones que siguen anclan el costo real:

#### A.1 — Superficie HTTP a migrar

| Métrica | Valor | Fuente |
|---|---:|---|
| `route.ts` totales | **84** | `find app/api -name route.ts` |
| LOC totales en route handlers | **5 046** | `wc -l` sobre los 84 |
| LOC promedio por route | **~60** | 5046 / 84 |
| Rutas con al menos un `GET` | 60 | `grep -l "^export async function GET"` |
| Rutas con `POST`/`PATCH`/`PUT`/`DELETE` | 65 | `grep -l "^export async function (POST|…)"` |
| Handlers con `requirePermission(` | **129** llamadas en **76** archivos | `grep -c requirePermission\\( app/api` |
| Tests de route handler | **25** | `find app/api -name '*.test.ts'` |
| Rutas que fuerzan `runtime = "nodejs"` | 9 | `grep runtime\\s*=\\s*["']nodejs["']` |

Clasificación (por lectura de los nombres + inspección de 8 rutas representativas):

| Clase | Rutas (aprox.) | Ejemplos |
|---|---:|---|
| CRUD sobre domain entities (contactos, farms, lots, voucher-types, periods, product-types, operational-doc-types, signatures) | **~40** | `contacts/**`, `farms/**`, `lots/**`, `voucher-types/**`, `periods/**`, `product-types/**`, `operational-doc-types/**`, `signature-configs/**` |
| Workflow contable transaccional (journal, sales, purchases, payments, payables, receivables, dispatches, expenses, iva-books, monthly-close) | **~28** | `journal/**`, `sales/**`, `purchases/**`, `payments/**`, `cxp/**`, `cxc/**`, `iva-books/**`, `dispatches/**`, `monthly-close/**` |
| Reports + exports (JSON/PDF/XLSX) | **~10** | `equity-statement`, `trial-balance`, `worksheet`, `financial-statements/**`, `iva-books/*/export`, `ledger`, `balances` |
| AI / análisis sincrónico (Gemini) | **3** | `app/api/analyze`, `app/api/organizations/[orgSlug]/agent`, (embedding vía RAG corre en write-path de documents) |
| Auth/admin de organización | **~3** | `members/**`, `roles/**`, `settings/**`, `profile/**` |

LOC tan bajo (promedio 60 por route) confirma lo observado en la hermana: **los handlers son plumbing HTTP**; la lógica está en `features/*/service.ts`. Esto es un dato *crítico* para el costo — no hay que "reimplementar" 84 endpoints, hay que **re-pegar 84 handlers** a un framework distinto.

#### A.2 — Features: ¿qué tan portables son al mover el runtime?

| Métrica | Valor | Fuente |
|---|---:|---|
| Directorios bajo `features/` | 30 | `ls features/` |
| Archivos `.ts` no-test en `features/` | **258** | `find features -name '*.ts' -not -name '*.test.ts'` |
| LOC no-test en `features/` | **29 665** | `wc -l` |
| Archivos que importan **`next/*`** | **0** | `grep "from ['\"]next/" features/ → No matches` |
| Archivos que importan **`@clerk/nextjs`** | **3** | `features/auth/sync-user.service.ts`, `features/organizations/members.service.ts`, `features/shared/middleware.ts` |
| Archivos con `import "server-only"` | **115** | `grep "import ['\"]server-only['\"]"` |

**Este es el hallazgo más importante de la factibilidad**: `features/` **NO tiene dependencias de Next.js** salvo en 3 puntos, todos dentro del `shared/auth` que ya se reemplaza en cualquier migración. `server-only` es un marker que se stubea trivialmente (ya lo hace `__mocks__/server-only.ts` para los tests).

Concretamente, los 3 usos de `@clerk/nextjs`:

- `features/shared/middleware.ts:1` → `auth()` para leer sesión. Reemplazo directo: `@clerk/backend` (ya instalado transitivamente, `node_modules/@clerk/backend/package.json` = 3.2.3, "Clerk Backend SDK — REST Client for Backend API & JWT verification utilities"). En NestJS/Fastify/etc., un guard verifica el `Authorization: Bearer <clerk-jwt>` que Next mandaría desde el BFF.
- `features/auth/sync-user.service.ts:2` → `currentUser()`. Reemplazo: `clerkClient.users.getUser(userId)` desde `@clerk/backend`.
- `features/organizations/members.service.ts:2` → `clerkClient()`. Reemplazo idéntico al anterior.

**Costo total de romper el acople a Next.js dentro de `features/`**: 3 archivos × ~30 LOC refactor = ~1 día.

LOC por área (para costear porte módulo por módulo):

| Área | LOC no-test | Servicios destacados |
|---|---:|---|
| `features/accounting/**` (journal, trial-balance, equity-statement, financial-statements, worksheet, iva-books, ledger, accounts) | **12 338** | `journal.service.ts` 636 LOC, `financial-statements.service.ts` 522 LOC |
| Ventas/compras/pagos (`sale`, `purchase`, `payment`, `payables`, `receivables`, `expenses`) | **6 420** | — |
| IA (`ai-agent` + `rag`) | **1 158** | `agent.service.ts` 265 LOC |
| Resto (shared, auth, organizations, contacts, documents, farms, lots, mortality, dispatch, org-profile, org-settings, voucher-types, periods, monthly-close, product-types, operational-doc-types, document-signature-config, account-balances, pricing, reports) | **~9 749** | — |

#### A.3 — Auth flow actual (y qué se rompe)

Cadena real que ejecuta cada request org-scoped (`features/shared/permissions.server.ts:20-49`):

```
requirePermission(resource, action, orgSlug)
  → requireAuth()                       // @clerk/nextjs auth() → userId
  → requireOrgAccess(userId, orgSlug)   // OrganizationsService.verifyMembership
  → ensureOrgSeeded(orgId)              // permissions.cache (60s TTL, single-flight, LRU 1000, auto-seed)
  → requireRole(userId, orgId, allowed) // OrganizationsService.requireMemberWithRoles
```

Todo lo que depende de Next.js en esta cadena vive en **UN** archivo: `features/shared/middleware.ts` (50 LOC, usa `auth()` de `@clerk/nextjs/server`). Todo lo demás es Prisma + Map en memoria, y está en `permissions.cache.ts` (que explícitamente documenta "NO Next.js unstable_cache or use cache (deprecated in Next 16)").

**En un backend dedicado**, esta cadena se convierte en un guard NestJS (o middleware Fastify/Hono):

```ts
// Pseudocódigo NestJS
@UseGuards(ClerkAuthGuard, OrgAccessGuard, PermissionGuard)
@Resource('journal') @Action('read')
class JournalController { ... }
```

La sustancia (`permissions.cache`, `OrganizationsService`, `requireMemberWithRoles`) se mueve tal cual. El `auth()` se reemplaza por `@clerk/backend` verificando el JWT del header.

#### A.4 — Data layer

| Archivo | Estado |
|---|---|
| `lib/prisma.ts` (11 LOC) | Instancia `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` **sin singleton**. Totalmente portable; no usa ninguna API Next. |
| `generated/prisma/client.ts` | Cliente Prisma estándar; ningún acople Next. |
| `prisma/schema.prisma` | 30+ modelos, `pgvector` en `document_chunks.embedding`, migraciones en `prisma/migrations/` portables tal cual. |
| `$queryRaw` en repos | Sin acople a `request context`. Concrete: `equity-statement.repository.ts:50-65`, `vector.repository.ts`, etc. — todos aceptan `orgId` por parámetro, puro SQL parametrizado. |

**Prisma es 100 % portable**. De hecho, un proceso Node long-lived **arregla** el problema de pooling que tiene hoy en serverless.

#### A.5 — Rendering / coupling UI↔servicios

| Métrica | Valor | Fuente |
|---|---:|---|
| `page.tsx` en `app/(dashboard)/[orgSlug]/**` | **50** | `find app/(dashboard)/[orgSlug] -name page.tsx` |
| Pages que instancian `new *Service()` directamente | **40** | `grep "new \w+Service\(\)" app/(dashboard)` |
| Archivos con `JSON.parse(JSON.stringify(...))` (serialización Decimal cross-boundary) | **28** | `grep -c "JSON.parse(JSON.stringify" app/` |
| Componentes con `'use client'` | **118** | `grep -rln "'use client'" components` |
| Componentes que ya llaman `fetch(` | **63** | `grep -c fetch\\( components` |
| Componentes que ya llaman `fetch('/api/…')` | **24** | `grep "fetch\(['\"\`]/api/"` |
| Ausencia de Next caching APIs (`unstable_cache`, `"use cache"`, `revalidatePath`, `revalidateTag`) | **0 usos** | grep explícito |
| Ausencia de Server Actions (`'use server'`) | **0 usos** | grep explícito |

**Dos lecturas clave**:

1. Las 40 pages que hacen `new *Service()` inline son **el costo real de migración en el front**: cada una debe pasar a fetchear vía HTTP (client component) o vía un Server Component que consuma la API dedicada. La mayoría son CRUD simples (`list`, `get`, `getOrgMetadata`) — refactor mecánico.
2. El codebase ya evita agresivamente las APIs de Next que no son REST-friendly: **no hay caching de Next, no hay Server Actions**. El estilo es `fetch('/api/...')` desde client components más `service.list()` desde Server Components. De ahí es una línea recta a "frontend llama `fetch('${BACKEND_URL}/api/...')`".

El `JSON.parse(JSON.stringify(...))` sobre Prisma `Decimal` desaparece en el mundo REST: lo reemplaza un serializer en el backend (hoy `features/accounting/financial-statements/money.utils.ts:serializeStatement` ya hace esto para el endpoint JSON de equity-statement).

#### A.6 — Tests (la inversión a preservar)

| Métrica | Valor |
|---|---:|
| Tests `*.test.ts` totales | **182** |
| Tests `*.test.tsx` totales (componentes React) | **88** |
| Tests dentro de `features/` (unit de service/repo/builder) | **101** |
| Tests dentro de `components/` | **88** |
| Tests dentro de `app/api/**/__tests__/` (route-level) | **25** |
| Tests de integración contra DB real | **0** (confirmado en la hermana) |

`vitest.config.ts` es casi-portable: 2 projects (`node` + `jsdom`), plugin React para el segundo, alias `server-only` → stub. Ninguna referencia a Next.js config.

**Dosis de realidad**:
- **101 tests de `features/*` se mueven como copy/paste** al nuevo backend. No tocan el router ni runtime.
- **25 tests de `app/api/*` deben reescribirse** como controller tests en el nuevo framework (en NestJS: `TestingModule` + `supertest`; en Fastify: `fastify.inject`). El skeleton vale ~3h por test que cubra GET+POST.
- **88 tests de componentes React quedan intactos** (Next.js Client Components no cambian; lo que cambia es a dónde apuntan los `fetch` que mockean).

Costo de tests: **25 reescrituras × ~2-3 h = 50-75 h** ≈ 1.5-2 semanas persona.

#### A.7 — Build / deploy coupling

- `package.json` scripts: `dev: next dev`, `build: next build`, `start: next start`. No hay `vercel.json` ni workflows de GitHub Actions visibles — deploy parece manual o vía integración Vercel.
- No hay `Dockerfile` en el repo. Un backend dedicado **debe** traer su propio Dockerfile y pipeline.
- ENV: un solo `.env` (dotenv) con `DATABASE_URL`, `CLERK_*`, `GEMINI_*`, `BLOB_READ_WRITE_TOKEN`. Se duplican en el nuevo backend con los que correspondan (Clerk secret, Gemini key, DB URL).
- `next.config.ts`: solo headers de seguridad + redirects. **Ningún rewrite hacia API externa hoy** — si se hace Strangler, se agrega un `rewrites()` apuntando a `process.env.BACKEND_URL` y el browser no nota la diferencia.

### Affected Areas

Ámbitos del codebase que cualquier migración (total o Strangler) toca:

- `app/api/**` — **84 route handlers desaparecen** de este repo (o conviven con proxies delgados si se hace Strangler con rewrites).
- `app/(dashboard)/[orgSlug]/**/page.tsx` — **40 de 50 pages refactorizadas** de `new *Service()` a un client HTTP tipado (SDK) o a Client Component con React Query/SWR.
- `features/shared/middleware.ts` — reescrito como guard en el nuevo framework (usa `@clerk/backend`, no `@clerk/nextjs`).
- `features/shared/permissions.server.ts`, `permissions.cache.ts` — se mueven tal cual al nuevo backend.
- `features/auth/sync-user.service.ts`, `features/organizations/members.service.ts` — 2 refactors puntuales de `currentUser()`/`clerkClient()` a `@clerk/backend`.
- `features/accounting/**`, `features/sale`, `features/purchase`, `features/payment`, `features/payables`, `features/receivables`, `features/ai-agent`, `features/rag`, `features/contacts`, `features/expenses`, `features/dispatch`, `features/lots`, `features/farms`, `features/mortality`, `features/documents`, `features/fiscal-periods`, `features/voucher-types`, `features/product-types`, `features/operational-doc-types`, `features/org-profile`, `features/org-settings`, `features/document-signature-config`, `features/account-balances`, `features/pricing`, `features/monthly-close`, `features/organizations` — **29 667 LOC cruzan intactas** más el reemplazo del `"server-only"` guard.
- `lib/prisma.ts` — se mueve al nuevo backend y se introduce singleton (mejora colateral, no acople Next).
- `components/` — los 118 client components siguen funcionando, pero **los 63 que hacen fetch deben apuntar al nuevo host** (o pasar por rewrites Next durante Strangler).
- `vitest.config.ts` + stub `__mocks__/server-only.ts` — se duplican/adaptan al monorepo.
- `proxy.ts` + `next.config.ts` — en mundo Strangler, ganan `rewrites` hacia el backend dedicado. En mundo "big-bang", `proxy.ts` (clerkMiddleware) queda solo para la UI, `next.config.ts` pierde responsabilidades.
- `prisma/**` + `generated/prisma/**` + migraciones — **se MUEVEN** al nuevo backend (la UI no debería tener cliente Prisma). Esto es el cambio conceptual más fuerte: el repo actual se parte en dos (o se queda como monorepo con `apps/web` + `apps/api` compartiendo `packages/prisma`).

### Approaches

Sección que cubre los pedidos **B** (cost model) y **C** (stack comparison) del enunciado. No repito los Approaches A/B/D de la hermana — asumo que esos existen en paralelo.

#### Approach 1 — Big-bang (cold turkey)

Qué: branch off `master` → levantar nuevo backend con todo portado → flip DNS/rewrite → deprecar `app/api/**`.

Plan realista (anclado a los números de arriba):

| Fase | Tareas | Persona-semanas |
|---|---|---:|
| F1 — Andamiaje | Repo/monorepo, Docker, CI, env config, DB migration ownership, Clerk backend SDK integration, logger/Sentry, rate-limit, guard de auth | **2-3** |
| F2 — Migrar shared + organizations + auth + permissions | `features/shared/**`, `features/organizations/**`, `features/auth/**`, contracts de error, utils de dinero, `prisma` singleton | **2** |
| F3 — Migrar `features/` restantes (29 670 LOC, 30 módulos) | Mover código, ajustar "server-only" → stub, reescribir los 3 usos Clerk, pasar tests de features (ya mockean Prisma) | **3-4** |
| F4 — Re-pegar los 84 handlers como controllers | 84 × 1.5-2h medio (LOC 60 promedio) = 126-168 h ≈ **3-4** persona-semanas. Incluye validación Zod in-framework, serialización Decimal, manejo de errores unificado | **3-4** |
| F5 — Exporters PDF/XLSX | 9 rutas `runtime=nodejs` + módulos exporters (ya son código Node puro, pdfmake/exceljs). Puerto directo | **1** |
| F6 — AI (analyze + agent + RAG embeddings) | Portar `gemini.client.ts` (generic), `agent.service.ts`, `agent.tools.ts`, `rag/*`, decidir si meter streaming/SSE o queue en este momento | **1-2** |
| F7 — Reescribir 25 route-tests como controller-tests + integración básica | 25 × 3h = 75 h + smoke suite E2E | **2** |
| F8 — Frontend: 40 pages refactorizadas + SDK tipado | Generar cliente HTTP (OpenAPI / tRPC / manual). Refactor de pages que hoy hacen `new *Service()` | **3-4** |
| F9 — Cutover | DNS/proxy rewrite, monitoreo, rollback plan, blackout window | **1** |
| F10 — Bug-fix post-cutover + regresiones contables | Buffer realista dado el riesgo | **2-3** |

**Total: ~20-27 persona-semanas = 5-7 meses calendario con 1 dev**, 3-4 meses con 2 devs bien sincronizados. Asume que las 270 suites de test siguen pasando (son la red de seguridad principal). Durante F1-F8 la app **está congelada en features nuevas** o se hace cherry-picking continuo al branch de migración (costoso).

Riesgo regresión: las 14 migraciones Prisma en 5 semanas (la hermana lo documentó) **predicen que el cutover alcanza un codebase en movimiento**. Un big-bang exige un freeze de ~2-3 semanas en F9-F10, lo cual es caro en un producto contable en crecimiento.

#### Approach 2 — Strangler (incremental, reverse-proxy por ruta)

Qué: levantar el backend dedicado al lado. `next.config.ts` gana `rewrites()` que rutea algunas rutas `/api/*` al backend nuevo; el resto sigue en Next. Se migra módulo por módulo, ambos sistemas vivos en paralelo, **una sola DB compartida**.

Orden sugerido (módulos más autocontenidos primero):

| Wave | Módulo | Rutas | Razón |
|---|---|---:|---|
| W1 | `pricing` + `mortality` + `farms` + `lots` + `operational-doc-types` + `product-types` | ~10 | Dominios simples, pocas dependencias cruzadas, prueban la plataforma |
| W2 | `voucher-types` + `fiscal-periods` + `org-profile` + `org-settings` + `document-signature-config` + `monthly-close` | ~10 | Config / admin de org — bajo tráfico, bajo riesgo |
| W3 | Exporters pesados (`equity-statement`, `trial-balance`, `worksheet`, `financial-statements/**`, `iva-books/*/export`, `ledger`, `balances`) | ~10 | Ganancia inmediata: salen del timeout de request Next/Vercel |
| W4 | AI (`analyze`, `agent`, RAG en documents) | ~3 | Aquí aparece la opción de streaming/queue en el nuevo runtime |
| W5 | Workflow contable transaccional (`journal`, `sales`, `purchases`, `payments`, `cxp`, `cxc`, `payables`, `receivables`, `dispatches`, `expenses`, `iva-books` CRUD) | ~28 | Corazón del negocio — se deja para el final |
| W6 | Auth/org admin (`members`, `roles`, `organizations`, `settings`) | ~5 | Se migra cuando el modelo de guard ya esté probado |
| W7 | Sunset `app/api/**`, eliminar `lib/prisma.ts` del lado web, limpiar pages directas | — | Cleanup |

Costo por módulo (incluye: portar feature + handler + test + apuntar rewrite + smoke):

- Módulo CRUD simple (5 rutas, ~500 LOC feature): **~1 persona-semana**
- Módulo transaccional (`journal`, `sales`): **~2 persona-semanas cada uno**
- AI / exporters: **~1-1.5 persona-semanas cada uno** (dependencias externas + tests de exporters)

**Total Strangler**: ~18-24 persona-semanas ≈ **4-6 meses calendario con 1 dev**, idéntico orden de magnitud al big-bang. La ventaja no es tiempo, es **riesgo**: se entrega valor y se detectan problemas de la plataforma (pool de conexiones, logging, observabilidad) **con la wave 1**, no con la wave 5.

Qué corre en paralelo:

- **Una sola DB Postgres** (ambas apps apuntan al mismo connection string). Las migraciones se corren desde UN solo lugar — candidata natural es el nuevo backend, que pasa a ser el "dueño" del schema. Durante Strangler, Next.js lee/escribe la misma DB vía su `lib/prisma.ts`. **Zero data migration**.
- Clerk: idem, una sola app Clerk, dos consumidores (UI via `@clerk/nextjs`, API via `@clerk/backend`).
- La `permissions.cache` **existe duplicada** durante la transición (60s TTL por instancia en cada app). Aceptable porque el TTL cubre drift; si se necesitara consistencia fuerte, habría que externalizar el cache a Redis — pero eso ya es Approach B/D de la hermana.

Riesgo de cutover por módulo: **bajo por wave** (se puede revertir el rewrite de una ruta en 1 línea de `next.config.ts`). Éste es el *selling point* real de Strangler vs big-bang.

Freeze period: **NO existe**. Features nuevas se pueden seguir mergeando al lado que aún tiene el módulo, o directamente en el nuevo si ya migró.

#### Approach 3 — Stack comparison para ESTE codebase

Comparación contra los puntos de contacto reales medidos arriba (Prisma, Zod, Clerk, Vitest, ~60 LOC de plumbing por route, exporters síncronos, Gemini síncrono, 30 módulos, 129 call-sites de `requirePermission`):

| Dimensión | NestJS | Fastify + DI liviana | Hono | Express |
|---|---|---|---|---|
| **Match con route→service→repo actual** | Excelente: Controller/Service/Module mapea 1:1 al patrón feature→service→repo; DI explícita reemplaza el `new *Service()` artesanal. | Muy bueno: plugins por módulo, `fastify.register()` por feature. DI hay que armarla (awilix/tsyringe) o vivir sin ella (explicitly imports). | Bueno: middleware-based; fuerza patrón "handler-plano". Hay que armar DI. | Igual a Fastify pero API anticuada; usarían `express-zod-api` o custom. |
| **Curva con equipo actual (Next + React, 270 tests)** | Alta (decorators, Modules, providers). Semana + de onboarding. Beneficio: el patrón mata ambigüedad. | Media. Casi "TS puro". El equipo ya escribe services/repos — Fastify les parece el mismo código. | Baja. Edge-first, APIs minimalistas. Se siente "Express moderno". | Mínima — pero herramientas anticuadas. |
| **Prisma integration** | Idiomático vía `@nestjs/prisma` / provider. | Trivial — singleton global o plugin. | Trivial — singleton global. | Trivial. |
| **Clerk (`@clerk/backend`) integration** | `CanActivate` guard + `@Resource`/`@Action` decorators custom — encaja perfecto con el `requirePermission(resource, action, orgSlug)` actual. **Este es el match más directo** con el patrón existente. | Preffix hook (`fastify.addHook("preHandler")`) por plugin o global. Funciona; requiere helper propio. | Middleware `c.get("user")`. Funciona; requiere helper propio. | Middleware. Funciona; requiere helper propio. |
| **Validación (hoy Zod en `*.validation.ts`)** | `ZodValidationPipe` (third-party maduro) o `class-validator` nativo. Preferible Zod para preservar los 30 módulos intactos. | Zod vía `fastify-type-provider-zod` — first-class integration. **Mejor ergonomía que Nest.** | `@hono/zod-validator` — first-class, trivial. | Manual o `express-zod-api`. |
| **Observabilidad (hoy: cero)** | Interceptors + `@nestjs/opentelemetry`. Richest ecosystem. | `fastify-otel`, hooks nativos, pino built-in. Muy bueno. | `@hono/otel` disponible; más artesanal. | Artesanal. |
| **Test ergonomics (con Vitest existente)** | `TestingModule.createTestingModule` + `supertest`. Mocks verbosos. | `fastify.inject({ method, url })` — sin HTTP real, rapidísimo. **Mejor match con los 270 tests actuales.** | `app.request()` — idem Fastify. | Supertest. |
| **Runtime target (Node long-lived vs serverless)** | Pensado para long-lived Node; workers built-in (`@nestjs/bull`). | Long-lived o Lambda (`@fastify/aws-lambda`). Portable. | **Edge-first** (Bun, Workers, Node adapter). Si se piensa en edge después, gana. | Long-lived. |
| **Ecosystem cross-cutting (rate-limit, guards, OpenAPI)** | Maduro, integrado (`@nestjs/throttler`, `@nestjs/swagger`). | Maduro (`@fastify/rate-limit`, `@fastify/swagger`). | Creciente pero menos cubierto — rate-limit hay que traerlo externo o escribirlo. | Maduro pero anticuado. |
| **Generación de SDK tipado para el front** | Swagger/OpenAPI → `openapi-typescript` o `zodios`. Nest tiene CLI para esto. | Igual, vía `@fastify/swagger`. | Minimal; Hono RPC client built-in **es excelente** (infiere tipos directamente de `app.route`). | Manual. |

**One-liner por framework** (leído como "si fuera yo hoy, con este codebase"):

- **NestJS**: perfect fit semántico (route→controller, service→provider, guard=requirePermission), pero el costo de aprendizaje lo convierte en una segunda migración encadenada dentro de la primera. El equipo pasa 2-3 semanas aprendiendo decorators y DI antes de migrar nada real. Recomendable SÓLO si el driver es "queremos la arquitectura más convencional y mainstream para poder contratar".
- **Fastify + Zod + tsyringe (o sin DI)**: **mejor match técnico objetivo**. El código actual (clases service, repos, validators Zod) se copia casi sin cambiar. `fastify.inject()` reemplaza de manera más rápida los tests actuales que cualquier stack. **Recomendado** si el driver es performance, productividad y preservar código. Es el stack que menos código nuevo exige.
- **Hono**: atractivo para una app 100 % REST + edge, pero este backend hace PDF/XLSX y llama a `pdfmake`/`exceljs`/`pg` — **no corre en edge**, y entonces Hono sobre Node pierde parte de su razón de ser. Sería "Fastify más nuevo", pero con menos ecosystem. Usable, no óptimo.
- **Express**: trae problemas sin traer ventajas. Solo si alguien del equipo ya lo domina y el timing es crítico — pero el timing no es crítico, es meses.

### Recommendation

Sección que cubre el pedido **D** (convenience re-evaluated): **¿conviene migrar?**. La respuesta honesta es **depende del driver, y el driver no está explícito**. Acá va un árbol de decisión con evidencia por rama.

#### D.1 — Re-examinando la tesis "no migrar" con lentes nuevos

| Driver hipotético | Veredicto | Por qué (anclado en evidencia) | Plan alternativo si se queda en Next |
|---|---|---|---|
| **Team growth** (3+ devs, frontend aislado) | **SÍ migrar** | Un monolito Next con `features/` y `app/(dashboard)` revueltos no escala a múltiples devs sin colisiones constantes. Separar web/api elimina la clase "merge conflict en page.tsx + route.ts por el mismo PR". | Modularización estricta con CODEOWNERS + feature flags + trunk-based, pero el techo es real. |
| **Cost**: Vercel function invocations + Gemini + PDFs que se acercan a 10s | **SÍ migrar parcial (solo rutas pesadas)** | Las 9 rutas con `runtime=nodejs` (exporters) + las 3 de AI son las que se benefician de un proceso long-lived (re-uso de pool, cold-start cero). Las otras 72 son CRUD triviales < 200 ms en serverless — migrarlas es costo sin ganancia. | Enforce `runtime=nodejs` + Vercel Fluid / edge config, o Approach B de la hermana (worker/queue). |
| **Vendor lock Vercel** (quieren self-host / DigitalOcean / Fly.io) | **SÍ migrar o reducir Next** | Next.js 16 se puede self-hostear con standalone output, pero las 9 rutas `runtime=nodejs` + Gemini en request path + exporters pesados hacen que el contenedor Node sea el *verdadero* runtime. Un backend dedicado explicita ese runtime y libera del SSR stack. | `output: 'standalone'` en next.config + Dockerfile + Postgres managed. Funciona, pero conserva los 3 acoples Vercel (blob storage, preview deploys, analytics). |
| **Testing**: suite de integración contra DB real | **NO justifica migrar por sí solo** | La suite de integración se puede agregar HOY en Next con `testcontainers` + Vitest; no hay ninguna barrera técnica. Es un sprint de trabajo, no una migración. | Introducir testcontainers + `pnpm test:integration` contra Postgres real. 1-2 semanas. |
| **Career / hiring** ("queremos ser una backend-NestJS shop para contratar") | **Depende de ambición** | Argumento real pero no-técnico: NestJS es el stack más buscado en backend TS. El codebase es lo suficientemente limpio como para que migrar sea entregar un backend "ejemplar" que pueda ser portfolio del equipo. | Abrazar Next como backend (hay empresas que lo hacen) y documentar explícitamente el rol del App Router como "servicio BFF + UI". |
| **Observabilidad / operabilidad** (62 `console.*`, 0 tracing, bugs contables) | **NO justifica migrar** | El problema es tooling, no arquitectura. `pino` + Sentry + request-id en `requirePermission` se puede incorporar hoy en Next con ~3 días de trabajo. Migrar "para tener logs" es rotar un edificio para cambiar la lámpara. | Plan A de la hermana: Sentry + pino + Prisma singleton. ~1 semana. |
| **Gemini síncrono agotando concurrency** | **NO justifica migrar** | Worker/queue (Approach B de la hermana) resuelve esto sin cambiar el runtime. Lo que importa es "sacar la llamada Gemini del request path", no "mover la llamada a otro framework". | Trigger.dev / Inngest / QStash + status polling — 2-3 semanas. |

#### D.2 — Decision tree

```
¿Cuál es el driver principal hoy?

├── Operabilidad / logs / débt técnica aguda
│   → NO migrar. Ejecutar Approach A de la hermana (Sentry + pino + Prisma singleton + rate-limit).
│
├── Tiempos de Gemini / PDFs / throughput
│   → NO migrar (o migrar sólo esas 9+3 rutas como Wave 3-4 de Strangler).
│     Primera opción: Approach B de la hermana (worker/queue).
│
├── Tenant safety / compliance
│   → NO migrar. Approach D de la hermana (RLS + Prisma middleware).
│
├── Team growth (3+ devs, aislamiento frontend/backend)
│   → SÍ migrar. Strangler (Approach 2 arriba). Stack: Fastify + Zod + @clerk/backend.
│     Timeline realista: 4-6 meses calendario, 1-2 devs dedicados.
│
├── Cost / vendor flexibility (self-host, ≠Vercel)
│   → MIGRAR PARCIAL: solo rutas pesadas en backend dedicado (Wave 3-4).
│     O, más conservador: `next output: standalone` + Docker. Probablemente suficiente.
│
├── Career / convención de mercado ("NestJS shop")
│   → SÍ migrar. Es una decisión de producto/equipo, no técnica.
│     Stack: NestJS (para maximizar el efecto hiring).
│     Timeline: 5-7 meses calendario (la curva Nest agrega 3-4 semanas).
│
└── "No tengo un driver claro, es que me parece que un backend dedicado es más serio"
    → NO migrar. La arquitectura actual (30 features, 258 archivos, 0 acoples Next en features,
      route handlers de 60 LOC, 270 tests) es mejor que la media de los proyectos NestJS.
      Lo que parece inmadurez es, en realidad, madurez: el equipo eligió no adoptar Server Actions
      ni caching de Next y se mantuvo con REST puro — eso hace que el "backend dedicado" sea
      un refactor mecánico pero no una mejora *arquitectural*.
```

#### D.3 — Veredicto direccional

**Si el usuario no identifica un driver de los primeros cuatro (team growth, cost, vendor, career), la recomendación es NO MIGRAR** y en su lugar ejecutar los tres Approaches pendientes de la hermana en el orden A → D → B. Eso reduce 80 % del dolor potencial con 20 % del costo.

**Si el driver es team growth o vendor flexibility**, la migración **es factible y razonablemente barata** (4-6 meses Strangler con 1 dev, 2-3 meses con 2 devs) **porque el codebase ya está casi REST-first**: 0 imports `next/*` en features, 0 uso de caching Next, 0 Server Actions, route handlers plumbing de 60 LOC promedio, permission system encapsulado en un módulo. El big-bang NO se recomienda en ningún escenario — el Strangler captura el mismo valor con un orden de magnitud menos riesgo.

**Stack recomendado para la migración (si se decide migrar)**: **Fastify + Zod (via `fastify-type-provider-zod`) + `@clerk/backend` + Prisma singleton + pino + Sentry**. NestJS es el segundo lugar, y solo si el driver explícito es "queremos hiring con keyword NestJS".

### Risks

(Ordenados por severidad; asume que la decisión es "migrar").

1. **Regresión contable silenciosa durante cutover (CRÍTICO)**. Los 270 tests son unitarios con mocks; no validan invariantes de asientos balanceados contra Postgres real. Un handler migrado que pierda el `...this.requireOrg(orgId)` o serialice un `Decimal` mal puede colar un asiento desbalanceado. Mitigación: **exigir suite de integración con testcontainers ANTES de la Wave 5** (el workflow transaccional). Costo: 2-3 semanas de tests de integración por adelantado. Sin esto, **no migrar**.
2. **Cadencia de cambios en el producto (14 migraciones en 5 semanas)**. El codebase se está moviendo rápido en dominio contable. Un Strangler largo genera una base de "features nuevas en web" + "features nuevas en backend" que se desincronizan. Mitigación: waves cortas (1 módulo ≤ 2 semanas), freeze de features en el módulo que se está migrando, merge frecuente de master al branch de migración.
3. **Duplicación de `permissions.cache` (60s TTL)** durante la transición. Dos instancias (web + api) con cachés independientes → drift de permisos hasta 60s. Aceptable hoy, pero se amplifica si hay cambios frecuentes de rol. Mitigación: reducir TTL a 30s durante la transición, o forzar invalidación via endpoint interno.
4. **Curva NestJS** (si se elige NestJS). 2-3 semanas de productividad baja del equipo antes de migrar la primera línea útil. Mitigación: elegir Fastify salvo que el driver sea hiring explícito. O contratar un contractor senior NestJS para F1-F2.
5. **Frontend-backend contract drift**. Sin SDK tipado generado, los 63 componentes que hacen `fetch('/api/...')` dependen de tipos copy-pasteados. Mitigación: Zod schemas compartidos vía `packages/contracts` en monorepo, o generar cliente desde OpenAPI (Nest y Fastify lo soportan). **Omitir esto introduce bugs de tipo en runtime — NO negociable.**
6. **Tests de route (25 archivos) no se auto-migran**. 50-75 h de reescritura, fácil de subestimar. Mitigación: reescribir los 25 ANTES de eliminar las rutas originales (red de seguridad doble durante el corte).
7. **Deploy operativo nuevo** (Docker, CI, secrets, observability stack). Del día uno hay que operar un segundo servicio. Si el equipo no tiene experiencia ops, la curva de "levantar Postgres managed + Docker + backend Node + logs + métricas" es 2-4 semanas propia. Mitigación: plataforma que abstraiga (Railway, Fly.io, Render) para evitar Kubernetes premature.
8. **Exporters (`pdfmake`, `exceljs`, fonts) y ENV (Clerk secret, Gemini API key, blob token)** tienen que reproducirse 1:1. El PDF de equity-statement tiene fonts embebidos (`pdf.fonts.ts`) — riesgo de regresión visual. Mitigación: golden-file testing sobre exporters antes de migrar la Wave 3.
9. **`$queryRaw` con agregados contables** (`equity-statement.repository.ts:50-65`, `financial-statements.repository.ts`, etc.) — SQL literal que pasa a un proceso distinto debe mantener el mismo comportamiento de tipos `numeric`/`Decimal`. Mitigación: tests de integración con fixtures determinísticos antes de portar.
10. **Monorepo governance**. Si se elige monorepo (`apps/web` + `apps/api` + `packages/prisma` + `packages/contracts`), la herramienta (pnpm workspaces, turbo, nx) debe elegirse temprano. Mitigación: pnpm workspaces + turbo. NO iniciar con nx sin experiencia previa.

### Ready for Proposal

**Condicionalmente sí**, pero el `sdd-propose` debe **empezar por confirmar cuál es el driver real** con el usuario. El árbol de decisión de D.2 es el input explícito para la propuesta. Posibles caminos de salida de la exploración:

- **Camino A — "No tengo driver claro"** → recomendar STOP; ejecutar Approaches A + D + B de la hermana en ese orden. No abrir propose para migración.
- **Camino B — "Driver = team growth o vendor"** → abrir `sdd-propose` para **Strangler a Fastify + Zod + @clerk/backend**, con la estructura de waves W1-W7 de este documento como input de alcance.
- **Camino C — "Driver = career / NestJS shop"** → abrir `sdd-propose` para **Strangler a NestJS**, reconociendo ~3 semanas extra de curva. Mismo esquema de waves.
- **Camino D — "Driver = costos solo de PDFs/Gemini"** → abrir `sdd-propose` acotado: migrar SOLO W3+W4 (exporters + AI) a un worker/backend dedicado, dejar el resto en Next. Es una versión small-scope del Strangler que probablemente resuelve el 80% del dolor con 20% del costo.

El orquestador debe pedirle explícitamente al usuario cuál de A/B/C/D es antes de proponer. Si la respuesta es **A**, el veredicto final es "don't migrate, stay in Next, execute the A/D/B plan of `arquitectura-escalable`" y `next_recommended = stop`.
