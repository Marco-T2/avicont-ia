# Arquitectura — avicont-ia

> **Estado**: v0.2 — POC de `mortality` validado (17/17 tests, tsc limpio). Lint enforcement activo. Addenda incremental por POC subsiguientes (ver §11 para política de `modules/shared/`).
> **Última actualización**: 2026-04-27.

## TL;DR

- **Estilo**: Hexagonal Pragmático (Ports & Adapters, Cockburn 2005).
- **Topología**: Monolito Next.js. Separación lógica interna; **NO** separar front/back físicamente todavía.
- **Migración**: Incremental. Pilot en `mortality`, validar, replicar.
- **Regla única que importa**: las dependencias apuntan al dominio. Nunca al revés.

---

## 1. Principio fundamental

> **Las dependencias apuntan al dominio. Nunca al revés.**

Esta es la única regla que define la arquitectura. Todo lo demás (carpetas, nombres, capas) es **consecuencia** de respetar esta regla, no la regla en sí.

Si en algún momento te encontrás justificando una excepción ("solo este import, total es chico"), **parate**. Cada excepción degrada la arquitectura. La disciplina es la arquitectura.

---

## 2. Estructura por módulo

Cada feature de negocio vive en `modules/{feature}/` con cuatro carpetas:

```
modules/mortality/
├── domain/                       ← núcleo del dominio
│   ├── mortality.entity.ts       ← entidad rica con behavior
│   ├── mortality.repository.ts   ← interfaz (port)
│   ├── value-objects/
│   │   └── mortality-count.ts
│   └── errors/
│       └── mortality-errors.ts
├── application/                  ← orquestación (use cases / services)
│   └── mortality.service.ts      ← agrupa use cases afines
├── infrastructure/               ← implementaciones (adapters)
│   ├── prisma-mortality.repository.ts
│   └── mortality.mapper.ts       ← Prisma row ↔ Domain entity
└── presentation/                 ← adapters de entrada
    ├── mortality.actions.ts      ← Next.js server actions
    ├── mortality.routes.ts       ← API routes (si aplica)
    └── mortality.validation.ts   ← Zod schemas (input HTTP)
```

**Notas**:
- El frontend Next.js sigue viviendo en `app/`. Los componentes consumen server actions que están en `presentation/`.
- `presentation/` es donde Next.js conoce a la app. El resto del dominio NO conoce a Next.js.
- Cuando una feature crece, `application/` puede partirse en `application/use-cases/` con un archivo por use case. Empezar agrupado, fragmentar cuando duela.

---

## 3. Reglas duras (las inviolables)

| # | Regla | Enforcement |
|---|-------|-------------|
| **R1** | `domain/` NO importa de `infrastructure/`, `application/`, `presentation/`, ni de `@/generated/prisma/client`, ni de `@prisma/client`. | ESLint + review |
| **R2** | `application/` SOLO importa de `domain/` (suyo o de `shared/domain/`). | ESLint + review |
| **R3** | `infrastructure/` implementa interfaces definidas en `domain/`. Nunca al revés. | Review |
| **R4** | `presentation/` SOLO habla con `application/`. Nunca toca `infrastructure/` ni Prisma. | ESLint + review |
| **R5** | Tipos generados por Prisma (`MortalityLog`, `AccountSubtype`, etc.) viven SOLO en `infrastructure/`. Si la presentation o el dominio necesitan un tipo equivalente, se define propio. | ESLint + review |
| **R6** | Repositorios devuelven **entidades de dominio**, no rows de Prisma. La conversión la hace el `mapper`. | Review |
| **R7** | Use cases / services tienen UN propósito claro. Si el archivo pasa de ~200 líneas o tiene >5 dependencias inyectadas, se parte. | Review |
| **R8** | Errores de dominio son explícitos (`MortalityCountExceedsAlive`), no `throw new Error("...")`. Reutilizar la jerarquía existente (`AppError`, `ValidationError`, etc.). | Review |

**Las flechas SIEMPRE van hacia `domain/`.** Si una flecha apunta hacia afuera, está mal.

---

## 4. Lo que se preserva del código actual

El repo ya tiene piezas que son **arquitectónicamente correctas**. NO se tiran. Se mueven o se respetan según corresponda.

### 4.1. Sistema de errores tipados (`features/shared/errors.ts`)

`AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `ForbiddenError`, `ExternalSyncError` + 100+ códigos nombrados (`PAYMENT_ALLOCATION_EXCEEDS_BALANCE`, `JOURNAL_NOT_BALANCED`, etc.).

**Esto es lenguaje de dominio.** Migra a `shared/domain/errors/`. Los códigos específicos de cada módulo migran al `domain/errors/` de su módulo.

### 4.2. Multi-tenancy via `requireOrg`

`BaseRepository.requireOrg(organizationId)` es una guarda explícita. La mantenemos — solo se mueve a la implementación `infrastructure/` del repo.

### 4.3. Auditoría con `withAuditTx` + `setAuditContext`

Crítica para el dominio contable. Pero como hoy expone `Prisma.TransactionClient`, hay que **encapsularla detrás de un port**:

```ts
// shared/domain/ports/unit-of-work.ts
export interface UnitOfWork {
  run<T>(ctx: AuditContext, fn: (uow: UnitOfWorkScope) => Promise<T>): Promise<{ result: T; correlationId: string }>;
}

export interface UnitOfWorkScope {
  // métodos abstractos que las features necesitan dentro de la transacción
  // — NO expone Prisma.TransactionClient
}

// shared/infrastructure/prisma-unit-of-work.ts
export class PrismaUnitOfWork implements UnitOfWork {
  // delega a withAuditTx + setAuditContext (Postgres-specific)
}
```

El uso de session vars de Postgres (`SET LOCAL app.current_user_id`) y los triggers PL/pgSQL **siguen exactamente como están**. Son detalles de infraestructura — viven en `shared/infrastructure/`. El dominio no los conoce.

### 4.4. Middleware HTTP (`requireAuth`, `requireOrgAccess`, `requirePermission`, `handleError`)

Son adapters de entrada. Migran a `shared/presentation/middleware/`. Las routes y server actions los siguen usando igual.

### 4.5. Validación con Zod

Permanece. Vive en `presentation/` (es validación de input HTTP, no del dominio). El dominio asume input ya validado.

---

## 5. Antes / Después — usando `mortality` real

### 5.1. Tipos de dominio (R5, R6)

**ANTES** (`features/mortality/mortality.types.ts:1`):

```ts
import type { MortalityLog } from "@/generated/prisma/client";  // ❌ leak
export type MortalityLogWithRelations = MortalityLog & { ... };  // ❌ exporta tipo Prisma
```

**DESPUÉS** (`modules/mortality/domain/mortality.entity.ts`):

```ts
import { MortalityCount } from "./value-objects/mortality-count";

export class Mortality {
  private constructor(
    private readonly id: string,
    private readonly lotId: string,
    private readonly count: MortalityCount,
    private readonly cause: string | null,
    private readonly date: Date,
    private readonly createdById: string,
    private readonly organizationId: string,
  ) {}

  static log(props: {
    lotId: string;
    count: number;
    cause?: string;
    date: Date;
    createdById: string;
    organizationId: string;
    aliveCountInLot: number;
  }): Mortality {
    if (props.count > props.aliveCountInLot) {
      throw new MortalityCountExceedsAlive(props.aliveCountInLot);
    }
    return new Mortality(
      crypto.randomUUID(),
      props.lotId,
      MortalityCount.of(props.count),
      props.cause ?? null,
      props.date,
      props.createdById,
      props.organizationId,
    );
  }

  // getters de solo lectura para mapping
  toSnapshot() { return { /* ... */ }; }
}
```

**Nota clave**: la regla de negocio (`count > aliveCount → error`) AHORA vive **dentro de la entidad**, no en el service. La entidad no se puede instanciar en estado inválido.

### 5.2. Repositorio: interfaz vs implementación (R3, R6)

**ANTES** (`features/mortality/mortality.repository.ts`): clase concreta que extiende `BaseRepository`, devuelve tipos Prisma.

**DESPUÉS**:

```ts
// modules/mortality/domain/mortality.repository.ts (PORT)
export interface MortalityRepository {
  findByLot(orgId: string, lotId: string): Promise<Mortality[]>;
  countByLot(orgId: string, lotId: string): Promise<number>;
  save(mortality: Mortality): Promise<void>;
}
```

```ts
// modules/mortality/infrastructure/prisma-mortality.repository.ts (ADAPTER)
import type { MortalityRepository } from "../domain/mortality.repository";
import type { MortalityLog } from "@/generated/prisma/client";  // ✅ permitido SOLO acá
import { toDomain, toPersistence } from "./mortality.mapper";

export class PrismaMortalityRepository implements MortalityRepository {
  constructor(private readonly db = prisma) {}

  async findByLot(orgId: string, lotId: string): Promise<Mortality[]> {
    const rows = await this.db.mortalityLog.findMany({
      where: { lotId, organizationId: orgId },
      orderBy: { date: "desc" },
    });
    return rows.map(toDomain);  // mapper convierte row → entity
  }

  async save(m: Mortality): Promise<void> {
    const data = toPersistence(m);
    await this.db.mortalityLog.create({ data });
  }
  // ...
}
```

### 5.3. Service / Use Case (R2, R7)

**ANTES** (`features/mortality/mortality.service.ts`): instancia repos en el constructor con `?? new MortalityRepository()` (poor man's DI).

**DESPUÉS**:

```ts
// modules/mortality/application/mortality.service.ts
export class MortalityService {
  constructor(
    private readonly repo: MortalityRepository,           // ← interfaz, no clase
    private readonly lots: LotsService,                   // ← otro use case (puede ser interface)
  ) {}

  async log(orgId: string, input: LogMortalityInput): Promise<Mortality> {
    const lot = await this.lots.getById(orgId, input.lotId);
    const totalDead = await this.repo.countByLot(orgId, input.lotId);

    const mortality = Mortality.log({
      ...input,
      organizationId: orgId,
      aliveCountInLot: lot.initialCount - totalDead,
    });

    await this.repo.save(mortality);
    return mortality;
  }
}
```

**Cambios**:
- El constructor **requiere** la dependencia (sin `??`). El wiring se hace en un único lugar — la "composition root" (presentation layer).
- La validación `count > aliveCount` **se fue al dominio**. El service solo orquesta.

### 5.4. Presentation — server action

```ts
// modules/mortality/presentation/mortality.actions.ts
"use server";

import { logMortalitySchema } from "./mortality.validation";
import { mortalityComposition } from "./composition-root";

export async function logMortalityAction(input: unknown) {
  const { userId, orgId } = await requireAuth();
  const validated = logMortalitySchema.parse(input);
  return mortalityComposition.service.log(orgId, { ...validated, createdById: userId });
}
```

El frontend importa server actions, **nunca** repos ni services directos.

---

## 6. Ejemplo de leak que ELIMINAMOS

`app/api/organizations/[orgSlug]/accounts/route.ts:5`:

```ts
import { AccountSubtype } from "@/generated/prisma/client";  // ❌ R5 violada
```

La route handler conoce un enum del ORM. **Mal**. La nueva forma:

```ts
// modules/accounting/domain/value-objects/account-subtype.ts
export const AccountSubtype = {
  ACTIVO_CORRIENTE: "ACTIVO_CORRIENTE",
  // ...
} as const;
export type AccountSubtype = typeof AccountSubtype[keyof typeof AccountSubtype];
```

El enum del dominio se define en el dominio. La infraestructura tiene un mapper que traduce a/desde el enum de Prisma.

---

## 7. Definiciones — vocabulario común

| Concepto | Definición operacional |
|----------|----------------------|
| **Entity** | Objeto con identidad y comportamiento. `Mortality`, `Payment`, `Account`. Lógica de negocio adentro. |
| **Value Object** | Objeto sin identidad, definido por sus valores. `Money`, `MortalityCount`, `EmailAddress`. Inmutable. Validación en el constructor. |
| **Port** | Interfaz definida en `domain/`. Describe QUÉ necesita el dominio del mundo exterior. |
| **Adapter** | Implementación concreta de un port. Vive en `infrastructure/` o `presentation/`. |
| **Use Case** | Operación de negocio única (`LogMortality`, `VoidPayment`). Orquesta entidades y ports. Sin lógica de negocio propia — la lógica vive en entities. |
| **Service** (en `application/`) | Agrupador de use cases afines. Mortality tiene 3 operaciones — no necesita 3 archivos, alcanza con `MortalityService`. |
| **Mapper** | Función pura que convierte entre representaciones. `toDomain(row)` y `toPersistence(entity)`. |
| **Composition Root** | El único lugar donde se instancian implementaciones concretas. Típicamente en `presentation/composition-root.ts`. |

---

## 8. Anti-patrones a evitar

### 8.1. Anemic Domain Model
Entidades que son solo datos, sin behavior. La validación, transiciones de estado, cálculos viven en services. **MAL.** Esa lógica va en la entidad.

### 8.2. Interface Astronaut
Crear una interface para cada clase "por si acaso". Las interfaces existen para:
- (a) tener múltiples adapters (`PrismaXRepo` + `InMemoryXRepo` para tests), o
- (b) invertir la dependencia entre capas.
Si no cumple ni (a) ni (b), **NO crear interface**.

### 8.3. Leaky Abstraction
Definir un port que retorna `Prisma.XxxGetPayload<...>`. Eso no es un port — es un wrapper de Prisma.

### 8.4. Service haciendo lógica de negocio
Si en `mortality.service.ts` ves un `if (input.count > ...) throw ...`, esa lógica **debería estar en `Mortality.log()`** (la entidad). El service solo orquesta.

### 8.5. Premature abstraction
Crear `IEmailService` con un solo `SendgridEmailService` "por si cambiamos de proveedor". Eso es deuda preventiva. Cuando aparezca el segundo proveedor, recién ahí extraés la interface.

---

## 9. Reglas de linting (ACTIVAS)

Implementadas en `eslint.config.mjs` usando `no-restricted-imports` (built-in, sin plugin nuevo) — consistente con el patrón existente del repo para `serverBarrelPatterns`.

**Reglas activas:**

| Layer | Bloquea | Citado en error |
|-------|---------|-----------------|
| `modules/*/domain/**` | `@prisma/client`, `@/generated/prisma/*`, `@/lib/prisma`, `**/infrastructure/*`, `**/application/*`, `**/presentation/*` | R1, R5 |
| `modules/*/application/**` | Lo mismo + `**/presentation/*` | R2, R5 |
| `modules/*/presentation/**` | `@prisma/client`, `@/generated/prisma/*`, `@/lib/prisma`, `**/infrastructure/*` | R4, R5 |

**Excepción documentada**: `modules/*/presentation/composition-root.ts` está excluido de la regla R4 vía `ignores`. Es el ÚNICO archivo en presentation/ que puede importar de infrastructure/, porque su rol explícito es wirear adapters concretos al service.

**Verificado**: violaciones deliberadas (archivo de prueba con import prohibido) disparan errores ESLint claros con cita de regla y referencia al doc. Cero falsos positivos en `modules/mortality/`.

**Sin lint, la disciplina se degrada en 6 semanas.** No es opcional.

---

## 10. Checklist de aplicación por módulo

Cuando migrás un módulo a esta arquitectura, verificar:

- [ ] `domain/` tiene una entidad por concepto de negocio (no por modelo Prisma)
- [ ] La entidad valida sus invariantes en el factory/constructor
- [ ] Existe al menos UN port (repository) definido en `domain/`
- [ ] La implementación del port vive en `infrastructure/`, con mapper
- [ ] El service (`application/`) NO importa nada de Prisma
- [ ] Las server actions (`presentation/`) solo llaman al service
- [ ] Errores de dominio son named subclasses de `AppError`
- [ ] Tests unitarios del dominio NO requieren Prisma ni mocks
- [ ] Tests de integración cubren el adapter de Prisma contra DB real
- [ ] `pnpm tsc --noEmit` y `pnpm lint` pasan sin errores

---

## 11. Promoción a `modules/shared/`

`modules/shared/` aloja value objects, errores y tipos que cruzan fronteras de feature dentro del dominio hexagonal. Aplica las mismas reglas R1-R5 que cualquier otro módulo (es un peer estructural de `modules/<feature>/`). La diferencia es semántica: shared kernel.

### 11.1. Cuándo promover (rule of three)

NO promover preventivamente. Esperar **tres consumidores reales** con semántica idéntica:

- 2 consumidores → mantener duplicados (no hay evidencia de patrón).
- 3 consumidores con **misma semántica** → promover a `modules/shared/domain/...`.
- 3 consumidores con **semántica divergente** (multi-moneda, redondeo distinto, signos permitidos, etc.) → mantener separados. Son tres cosas distintas, no una repetida.

Pregunta antes de promover: ¿esto es UNA cosa que aparece en tres lugares, o son TRES cosas que casualmente se parecen? Si dudás, no promovés.

**Precedente**: commit `5977e6f` promovió `MonetaryAmount` a `modules/shared/domain/value-objects/` tras confirmarse rule of three con receivables, payables y payment (POC #8). Las tres impls eran byte-equivalentes (no negativo, max 9.9M, redondeo a 2 decimales).

### 11.2. Co-promoción de errores con VOs

**Cuando promovés un value object, los errores que ese VO instancia viajan con él al mismo nivel.**

Ejemplo: al promover `MonetaryAmount` a `modules/shared/domain/value-objects/`, también se promovió `InvalidMonetaryAmount` (subclass de `ValidationError`) a `modules/shared/domain/errors/monetary-errors.ts`. Razón: el VO en shared no puede importar errores de un feature module — sería dependencia inversa (shared → feature). La única forma limpia es mover el error al mismo nivel que el VO.

**Anti-patterns rechazados**:
- (a) Mantener cada error feature-local + shared importando uno de los dos → asimétrico, opaco.
- (b) Re-export shim en los archivos feature-local de errors para back-compat → deuda equivalente a la duplicación que estamos eliminando.

**Test mental**: si el VO en shared lanza `throw new InvalidX(...)`, ¿de dónde importa `InvalidX`? Si la respuesta es "de un feature module", la promoción está incompleta — falta co-promover el error.

---

## 12. Lo que NO está en este documento (todavía)

- Estrategia de testing detallada por capa
- Composition root completo (DI)
- Cómo manejar transacciones que cruzan módulos
- Migración de la audit-context a port

Esos quedan abiertos para iterar **después** del POC en `mortality`. Si los definimos ahora, los definimos mal — la POC nos va a mostrar qué falta de verdad.

---

## 13. Referencias

- Cockburn, Alistair. "Hexagonal Architecture" (2005)
- Vernon, Vaughn. "Domain-Driven Design Distilled" (2016)
- ADR existentes: `docs/adr/001`, `docs/adr/002`
