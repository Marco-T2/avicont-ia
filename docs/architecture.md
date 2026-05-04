# Arquitectura — avicont-ia

> **Estado**: v0.4 — POC #8 Fase B aplicada: primer entity con métodos de mutación de estado (`Receivable.applyAllocation` / `revertAllocation`, espejo en `Payable`). Patrón canónico documentado en R9 + §5.5. Aclaración orquestación vs cálculo en §8.6.
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
| **R9** | Entities con métodos de transición de estado son **inmutables** — el método retorna nueva instancia, nunca muta in-place. **Invariantes enforzadas dentro del método** (no afuera). Sobre estados terminales (VOIDED, etc.) los métodos arrojan `DomainError`. El use case filtra entities en estado terminal **antes** de invocar (orquestación legítima, no lógica de negocio — ver §8.6). | Review |

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

Crítica para el dominio contable. Como el legacy `withAuditTx` expone `Prisma.TransactionClient`, queda **encapsulado detrás de un port** (POC #9):

```ts
// modules/shared/domain/ports/unit-of-work.ts
export interface AuditContext {
  userId: string;
  organizationId: string;
  justification?: string;
}

export interface UnitOfWorkScope {
  readonly correlationId: string;
  readonly fiscalPeriods: FiscalPeriodsTxRepo;
  // los repos de negocio crecen a medida que más módulos migran
}

export interface UnitOfWork {
  run<T>(
    ctx: AuditContext,
    fn: (scope: UnitOfWorkScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }>;
}

// modules/shared/infrastructure/prisma-unit-of-work.ts
export class PrismaUnitOfWork implements UnitOfWork {
  // delega a withAuditTx (legacy) — preserva orden exacto:
  //   1) correlationId pre-tx, 2) tx open, 3) setAuditContext, 4) fn(scope).
}
```

El uso de session vars de Postgres (`SET LOCAL app.current_user_id`) y los triggers PL/pgSQL **siguen exactamente como están** — los triggers escriben rows en `audit_logs` automáticamente cuando hay mutación dentro de la tx. Son detalles de infraestructura, viven en `shared/infrastructure/`. El dominio no los conoce.

**No existe `recordAudit(event)`** en el scope. La primitiva legacy es `setAuditContext`, llamada UNA vez al abrir la tx — los triggers hacen el resto. Inventar una primitiva write explícita sería drift contra el legacy (Stop rule v4).

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

### 5.5. Mutación de estado: `Receivable.applyAllocation` (Fase B de POC #8)

A partir del POC #8 Fase B aparece el primer entity con métodos de **transición de estado** (`applyAllocation` / `revertAllocation`). Los 7 POCs anteriores los entities eran "data containers con factory methods". A partir de acá son "objetos con comportamiento". Esto sienta el patrón canónico (codificado en R9) que se aplica a TODOS los módulos siguientes que necesiten mutar estado.

**Tres reglas operativas**:

1. **Inmutabilidad**: el método retorna una nueva instancia. NUNCA muta in-place.
2. **Invariantes en el entity**: el método valida y arroja `DomainError`. El cliente NO puede dejar el entity en estado inválido.
3. **Use cases orquestan, no calculan**: `findByIdTx → entity.transition() → repo.persistTx`. Cero lógica de cálculo en application.

**Entity** (invariantes adentro):

```ts
// modules/receivables/domain/receivable.entity.ts
applyAllocation(amount: MonetaryAmount): Receivable {
  if (!amount.isGreaterThan(MonetaryAmount.zero())) {
    throw new AllocationMustBePositive();
  }
  if (this.props.status === "VOIDED") {
    throw new CannotApplyToVoidedReceivable();   // simetría apply/revert sobre terminal
  }
  const newPaid = this.props.paid.plus(amount);
  if (newPaid.isGreaterThan(this.props.amount)) {
    throw new AllocationExceedsBalance();
  }
  const newBalance = this.props.amount.minus(newPaid);
  const newStatus: ReceivableStatus = newPaid.equals(this.props.amount) ? "PAID" : "PARTIAL";
  return new Receivable({
    ...this.props,
    paid: newPaid,
    balance: newBalance,
    status: newStatus,
    updatedAt: new Date(),
  });
}
```

**Use case** (orquesta — load → mutate → persist, sin cálculo):

```ts
// modules/receivables/application/receivables.service.ts
async applyAllocation(
  tx: unknown,
  organizationId: string,
  id: string,
  amount: MonetaryAmount,
): Promise<void> {
  const target = await this.repo.findByIdTx(tx, organizationId, id);
  if (!target) throw new NotFoundError("Cuenta por cobrar");
  const next = target.applyAllocation(amount);
  await this.repo.applyAllocationTx(
    tx, organizationId, id,
    next.paid, next.balance, next.status,    // ← estado COMPUTADO, no `amount`
  );
}
```

**Port** (primitiva dumb — recibe estado computado, no calcula):

```ts
// modules/receivables/domain/receivable.repository.ts
applyAllocationTx(
  tx: unknown,
  organizationId: string,
  id: string,
  paid: MonetaryAmount,        // ← computado por el entity
  balance: MonetaryAmount,     // ← computado por el entity
  status: ReceivableStatus,    // ← computado por el entity
): Promise<void>;
```

**Por qué el port recibe estado computado y no `amount`**: si el adapter recibiera `amount`, el adapter (o un futuro adapter alternativo) tendría que recalcular `paid`, `balance` y `status`. Eso duplicaría la lógica del entity en infraestructura. Manteniendo el port primitivo, el cálculo vive en UN solo lugar (el entity) y todos los adapters quedan dumb.

**Estado terminal (VOIDED) — simetría apply/revert** (decisión de Fase B):
- Tanto `applyAllocation` como `revertAllocation` arrojan sobre `VOIDED`. Una sola regla: "sobre estado terminal no se opera". Se descartaron alternativas no-op idempotente y asimétrica porque debilitaban la invariante o introducían conceptos nuevos (Result type, comparación `updated === target`) que no eran necesarios.
- El use case que necesite saltar VOIDED hace `if (target.status === 'VOIDED') continue;` ANTES de invocar el método del entity. Esa filtración es **orquestación**, no lógica de negocio (ver §8.6).
- Espejo limpio en `modules/payables/`: `Payable.applyAllocation` / `revertAllocation` con la misma forma y los errores espejo (`CannotApplyToVoidedPayable`, etc.).

Cross-ref: commit de POC #8 Fase B introduce este patrón. R9 codifica la regla. §8.6 codifica la distinción orquestación vs cálculo.

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

### 8.6. Filtrar input ≠ lógica de negocio

El principio "use cases orquestan, no calculan" (R7, §8.4) NO significa "use cases no condicionan". Filtrar QUÉ entities procesar es **orquestación legítima**, no lógica de negocio.

`if (target.status === 'VOIDED') continue` en un use case es **orquestación legítima** — decidir QUÉ entities procesar es parte del rol del use case. Lo prohibido es **CÁLCULO de negocio** (aritmética sobre estado, transición de estado, derivación de campos).

| Permitido en use case (orquestación) | Prohibido en use case (cálculo — va al entity) |
|--------------------------------------|------------------------------------------------|
| `if (!target) continue`              | `newPaid = currentPaid + amount`               |
| `if (target.status === 'VOIDED') continue` | `newStatus = newPaid === total ? 'PAID' : 'PARTIAL'` |
| `if (input.dryRun) return preview`   | `if (newPaid > total) throw`                   |
| Loop con skip condicional            | `total = items.reduce(...)`                    |
| Componer load → mutate → persist     | Cualquier cambio en propiedades del entity     |

**Test mental**: si el código del use case toca propiedades calculadas del entity (`paid`, `balance`, `status`, `total`) para SETEARLAS, es cálculo y debe ir al entity. Si solo las LEE para decidir si invoca o no al entity, es orquestación.

Esta distinción aparece por primera vez en POC #8 Fase B (revert sobre receivable VOIDED). Se documenta acá para que no vuelva a discutirse en POCs futuros.

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

## 12. Convención naming infrastructure adapters

Convención **emergente** — descubierta inspeccionando los archivos existentes en `modules/*/infrastructure/` durante POC #10 C3-C, no inventada. Cumple retroactivamente sin excepciones en los 32 archivos de scope (3 `.repo.ts` + 8 `.repository.ts` + 21 `.adapter.ts`). Aplica a adapters y repositories; mappers, unit-of-work y tests siguen patrones propios fuera de este scope (ver §12.5).

### 12.1. Regla — owner vs consumer

| Rol | Sufijo de archivo | Cuándo aplicar |
|---|---|---|
| **Owner** del aggregate del módulo (persiste sus filas) | `.repo.ts` o `.repository.ts` | El módulo posee el aggregate y lo persiste |
| **Consumer** de un concept externo (legacy, otro módulo, lookup) | `.adapter.ts` | Wrappea concept ajeno o consume port de otro módulo |

La distinción **NO es DB vs no-DB**. `prisma-payment-credit.adapter.ts` y `prisma-lot-inquiry.adapter.ts` tocan Prisma directo y aún así son `.adapter.ts` porque el módulo no posee ese aggregate — son consumers que leen/agregan datos de otros módulos.

### 12.2. Sub-prefijos para `.adapter.ts`

| Prefijo | Significado | Ejemplo |
|---|---|---|
| `legacy-` | Wrappea código de `features/` (era pre-modularización) | `legacy-journal-entries-read.adapter.ts` |
| `prisma-` | Toca Prisma directo, sin wrapper legacy intermediario | `prisma-payment-credit.adapter.ts` |
| (sin prefijo) | Wrappea port de otro módulo ya migrado | `contacts-read.adapter.ts` |

Distribución actual de los 21 `.adapter.ts`: 11 `legacy-`, 2 `prisma-`, 8 sin prefijo.

Para `.repo.ts` / `.repository.ts` de owner: siempre con prefijo `prisma-` — es la única implementación productiva en el repo a la fecha.

### 12.3. Sub-convención `.repo.ts` vs `.repository.ts`

Coexisten dos sub-convenciones para owner-aggregate; **ambas válidas**. NO se uniforma retroactivamente.

| Sufijo | Origen | Módulos |
|---|---|---|
| `.repository.ts` | Convención anterior (módulos pre-`shared/`) | `contacts`, `fiscal-periods`, `mortality`, `org-settings`, `payables`, `payment`, `receivables`, `voucher-types` |
| `.repo.ts` | Convención posterior (`accounting` + `shared/`) | `accounting/prisma-account-balances`, `accounting/prisma-journal-entries`, `shared/prisma-fiscal-periods-tx` |

Distribución actual: 8 `.repository.ts`, 3 `.repo.ts`. Adoptar `.repo.ts` para módulos nuevos; mantener `.repository.ts` en los 8 existentes.

### 12.4. Class name match — sub-prefix

El sub-prefix del filename (`prisma-`, `legacy-`, sin prefijo) se preserva en el prefix de la class. Regla determinística sin excepciones en los 32 archivos de scope.

| Filename | Class |
|---|---|
| `prisma-foo.{adapter\|repo\|repository}.ts` | `PrismaFoo<Suffix>` |
| `legacy-foo.adapter.ts` | `LegacyFoo<Suffix>` |
| `foo.adapter.ts` (sin prefijo) | `Foo<Suffix>` (sin prefijo) |

Ejemplos:

- `prisma-payment-credit.adapter.ts` → `PrismaPaymentCreditAdapter`
- `legacy-permissions.adapter.ts` → `LegacyPermissionsAdapter`
- `contacts-read.adapter.ts` → `ContactsReadAdapter`

El concept central de la class, la pluralidad y la translation del file-suffix (`.repo` → `Repo` vs `Repository`) **no son determinísticos** — siguen patrones heurísticos contextuales declarados en §12.5.

### 12.5. Out of scope

La convención cubre **solo adapters y repositories** en `modules/*/infrastructure/`. Los siguientes archivos del mismo directorio quedan fuera del scope (siguen patrones propios):

- **Mappers** (`*.mapper.ts`) — lógica de mapeo entre tipos de dominio y rows de Prisma. Anomalía menor de naming: `accounting/journal-mapping.ts` (no `.mapper.ts`).
- **Unit of Work** (`*-unit-of-work.ts`) — `shared/prisma-unit-of-work.ts`, `accounting/prisma-accounting-unit-of-work.ts`.
- **Tests** (`__tests__/*.{test,integration.test}.ts`) — sufijo derivado del archivo testeado.

Si se introduce un archivo nuevo en `modules/*/infrastructure/` que no encaja en las categorías de §12.1, documentar la categoría nueva explícitamente antes de adoptarla.

**Heurísticas contextuales (no normadas)**: el concept central de la class, la pluralidad y la translation del file-suffix tienen variabilidad legítima en el inventario actual:

- **Concept central**: a veces alineado al filename (`legacy-fiscal-periods.adapter.ts` → `LegacyFiscalPeriodsAdapter`, descartando el `Read` del port `FiscalPeriodsReadPort`), a veces al port (`payables.adapter.ts` → `PayablesQueryAdapter`, agregando el `Query` del port).
- **Pluralidad**: la class suele seguir el filename, no el port (`prisma-payables.repository.ts` con port `PayableRepository` singular → class `PrismaPayablesRepository` plural).
- **File-suffix**: `.repo.ts` mapea a class suffix `Repo` en 2/3 casos (`PrismaAccountBalancesRepo`, `PrismaFiscalPeriodsTxRepo`) y a `Repository` en 1/3 (`PrismaJournalEntriesRepository`). Coexistencia válida — NO uniformizar retroactivamente.

Estas heurísticas no son violaciones de §12.4 — la regla literal cristalizada (sub-prefix match) sigue determinística. Cuando un archivo nuevo presente ambigüedad de concept/pluralidad/suffix, decidir en contexto y documentar la elección en el commit body si la decisión no es obvia.

---

## 13. Auditoría retroactiva de POCs

Cuando un POC revela un **problema sistémico de fidelidad o consistencia** (drift de codes/contratos, antipattern recurrente, parity gap), auditar retroactivamente los POCs anteriores que pudieron tener el mismo problema es **práctica estándar** — no una decisión caso por caso.

**Por qué**: la Stop rule v4 (legacy-behavior-parity gap como categoría STOP de máxima precedencia) sólo detecta el patrón en el POC en curso. Para los POCs hechos antes de existir la regla, el mismo patrón pudo entrar silenciosamente. La auditoría retroactiva extiende el alcance de la regla hacia atrás.

**Cómo**:

1. Identificar el patrón en el POC actual (Stop rule v4 surfacea el primer caso).
2. Listar POCs anteriores que tocaron el mismo dominio o usaron la misma técnica.
3. Hacer **inventario read-only** (Stop rule cat 1: surfacear, no fixear silenciosamente). Construir tabla de hallazgos con clasificación: drift real / dead code / módulo-local legítimo / observación.
4. Reportar y dejar que el usuario decida scope de fix.
5. Si el fix se conoce y se está auditando justamente para arreglarlo, **no documentar como deuda formal**: documentar deuda que sabemos arreglar HOY es procrastinación con disfraz de prudencia. Genera carga cognitiva en cada lectura futura.

**Cuándo NO auditar retroactivamente**: si el "problema" es una mejora estética, una preferencia de estilo, o algo que no afecta contrato externo (API surface, error codes, behaviors observables). El criterio es **fidelidad/consistencia**, no perfeccionismo.

**Precedente**: post POC #8 (payment), la auditoría retroactiva de receivables (POC #6) y payables (POC #7) surfaceó dos drifts reales de error codes — `PAYMENT_ALLOCATION_EXCEEDS_BALANCE` y `PAYMENT_ALLOCATION_TARGET_VOIDED` (shared) coexistían con codes módulo-locales en receivables/payables, y payment los compensaba con pre-checks defensivos. La Opción C aplicada eliminó el drift en la fuente y borró los pre-checks, devolviendo la invariante a un solo lugar (R9 — invariantes en entity).

**Pre-phase audit gate operacional**: complemento operacional de la auditoría retroactiva sistémica. Al cerrar una sub-fase de un POC, correr **full suite** (no sólo focused) es check de bajo costo OBLIGATORIO. Métricas focused (e.g. "iva-books 245/245 ✅, mapper 10/10 ✅, export route 22/22 ✅") **NO sustituyen** full audit — pueden pasar verde mientras drift cross-feature regresiona silently en otra capa. La auditoría retroactiva (resto de §13) detecta drift hacia atrás; el pre-phase audit gate detecta drift en curso al momento de cerrar.

**Por qué**: el costo asimétrico favorece el check. Full suite cuesta minutos; drift slip silent puede costar horas-días de bisect en POC siguiente, donde aparece mezclado con complejidad nueva. Vale para cierre de sub-fase, cierre de POC entero, y cierre de sub-tarea con scope cross-module.

**Precedente — POC #11.0c A4-c**: bookmark `poc-11/0c/a4/c/closed` reportó focused metrics ✅ (iva-books 245/245 + mapper 10/10 + export route 22/22) pero full suite NO corrió post-A4-c. 4 violations REQ-FMB.5 (entity-to-dto.ts importando Prisma directo en vez de via barrel) slipped silent y surfacearon recién al abrir POC #11.0c A5 (full suite mostró 7 fails vs 6 baseline heredados pre-POC). Fix corrector retroactivo `2893a42` (entity-to-dto barrel re-route) cerró el gap; lección codificada acá.

**Cross-ref**: la regla complementa Stop rule v4 (engram `feedback/sub-agent-stop-rule`); ambas evitan que parity gaps lleguen a master. Aplicación recursiva — feedback `feedback_pre_phase_audit` + `feedback_low_cost_verification_asymmetry` (engrams personales).

### 13.7. Lecciones operacionales agent-lock-discipline

Protocolo cross-POC aplicable a TODAS las sub-fases paired RED+GREEN futuras — burden upstream agente conocedor target files, NO downstream verify post-execute. Lecciones #1-#9 cementadas durante POC siguiente A1+A2 (origen §13 emergentes recurrence 15 lettered G-U + 5 A1-C1 unlettered = 20 cumulative). Lecciones #10-#14 + #10-skippable sub-precedent cementadas durante POC nuevo dedicado A3 doc-only post-mortem A3-D1 (origen §13 emergentes cumulative cross-ciclos POC nuevo A3 — body canónico engrams `poc-nuevo/a3/c*/closed`; detail §19.6 status closure). Evidencias cumulative POC nuevo A4 (A4-C1+C2+C3+D1 — body canónico engrams `poc-nuevo/a4/c*/closed` + `poc-nuevo/a4/13.eta-mock-factory-load-bearing`; detail §19.7 status closure). Reverse delegation: agente surface emergente, Marco confirma timing — más §13 caught antes execute.

1. **Pre-recon profundo expand → architecture enforcement test runs**: cuando lock toca import paths cross-feature, agregar al pre-recon `feature-boundaries.test.ts` (REQ-FMB.4 + REQ-FMB.5) + `no-restricted-imports` ESLint rules + custom architecture invariants tests. Multi-axis NO single-axis grep.
2. **Lock regex/assertion requires target file read pre-RED**: agente DEBE leer target file completo + validar regex discrimina pre-state (RED falla correcto) vs target-state (GREEN pasa). Surface §13 emergente si discriminación falla — NO aceptar lock blind. Pattern stronger regex: binding capture + line-anchored.
3. **Runtime invariants verify pre-lock (~5s confirm)**: cuando lock incluye runtime semántica específica (Decimal.js, JSON serialization, hash, regex engine behavior), proponer + ejecutar runtime confirm rápido ANTES de cementar. Speculative locks rompen recurrentemente — runtime confirm temprano es ~5s vs hours re-trabajo follow-up.
4. **TDD paired discipline post-§13 emergente (NO inline update)**: cuando §13 emergente surface post-GREEN y requiere test/regex update, follow-up paired RED+GREEN sequential preserva atomic granularity bisect-friendly. Inline update rompe paired discipline. Mirror precedent A1-C1 follow-up `b86c26d` + A2-C1.5 follow-up.
5. **Shape tests prev sub-fase self-contained against future deletes**: pattern `expect(fs.existsSync(path)).toBe(false)` future-proof vs `fs.readFileSync(path)` fragile (ENOENT exception masks `not.toMatch` semantic). DROP/UPGRADE tests fragile mismo RED commit ANTES de proceder con deletion atomic batch — Marco override timing crítico (cambios shape pertenecen a RED, NO GREEN). Empirical validation §13.N A2-C3.
6. **Heuristic path discrimination requires lectura individual**: grep PROJECT-scope cuenta candidatos sin discriminar JSDoc references natural prose vs imports/instantiations reales. Pattern: grep `^import.*X\|new X\|from.*X` para discriminar binding actual vs JSDoc cosmetic. Lectura individual obligatoria pre-clasificación Cat A/B/C.
7. **Scope shrink in-flight via lectura individual obligatoria**: pre-recon expand cuenta candidatos via grep ≠ alcance final. Lectura individual cada candidato OBLIGATORIA para clasificar Cat A/B/C disposition surgical. Cost ~3 min lectura vs corrupción silent risk.
8. **Re-pre-recon independent cross-check próxima sesión sin engram persistido**: pre-recon expand vive en contexto prompt sesión actual, NO sustituye engram. Próxima sesión cold start DEBE re-pre-recon independent cross-check ANTES de opinar Q's pendientes. Burden upstream agente nuevo: re-verify scope independiente, NO blind accept context prompt.
9. **Burden upstream agente conocedor target files (meta-pattern)**: lecciones #2 + #5 + #6 + #7 share root: agente DEBE lectura individual archivos target pre-execute. Burden upstream NO downstream verify post-commit. Cheaper + bisect-friendlier. Empirical validation cumulative POC siguiente: 5 §13 emergentes Q-U surfaced TODOS pre-RED via lecciones #1-#8 application — cero §13 emergentes post-execute pre-recon A3.
10. **ESLint baseline impact verify pre-RED via dry-run mirror precedent target files contra contested rules**: agente DEBE ejecutar `npx eslint <target-file>` dry-run pre-RED contra rules contested (R5 banPrismaInPresentation + REQ-FMB.5 feature boundaries) cuando target file pattern compromete reglas. 16+ evidencias cumulative cross-POC (POC nuevo A3 13+ cross-ciclos A3-C1.5/C2/C3/C3.5/C4a/C4b/C5/C5.5/C4a.5/C4b.5/C6a/C6b/C6c + POC nuevo A4 3+ cross-ciclos A4-C1/A4-C2/A4-C3). **Sub-precedent #10-skippable**: dry-run pre-RED skippable cuando AMBAS condiciones cumplen — (a) target file pattern ESTRUCTURALMENTE PURO contra rules contested (`fs.existsSync` puro / `fs.readFileSync` source-string puro / JSDoc-only changes / markdown doc-only), (b) sibling tests precedent clean baseline cumulative cross-ciclos verified. Cuando AMBAS cumplen → SKIP válido (asymmetric cost-benefit ratio: skip cost 0 + skip risk 0 + dry-run cost ~2-5min). Cuando UNA falla → dry-run MANDATORY (mantiene main rule). 3 evidencias formales A3-C7 1ra + A3-C8 2da + A4-D1 3ra PROACTIVE Marco Lock pre-RED (A4-D1 doc-only architecture.md markdown puro estructuralmente puro vs rules contested + sibling A3-D1 precedent clean baseline cumulative ESLint 10e/13w preserved A4 closure runtime verified).
11. **Pre-recon grep callers + mocks comprehensive cross-paths (`__tests__/` legacy + presentation mappers + mock factories)**: agente DEBE ejecutar grep PROJECT-scope cross-paths antes de RED scope final — incluir `app/(dashboard)/__tests__/`, `modules/{module}/presentation/mappers/__tests__/`, `features/{module}/__tests__/`, vi.mock factory declarations. Pattern matures reactive→proactive→PROACTIVE cumulative cross-ciclos POC nuevo A3 (A3-C3.5 reactive + A3-C4b reactive + A3-C5 proactive + A3-C5.5 PROACTIVE ZERO REACTIVE + A3-C4a.5 reactive scope expansion + A3-C4b.5 mock factory expansion + A3-C6a comprehensive). 9+ evidencias cumulative cross-POC (POC nuevo A3 8+ + POC nuevo A4-C1 PROACTIVE 1ra+ pre-recon comprehensive cross-paths PROJECT-scope 16 ubicaciones cross-categoría — Cat 1 6 app pages + 1 api route + Cat 2 4 page-rbac vi.mock factory + Cat 3 3 source cross-feature/cross-module + 2 paired tests).
12. **Cutover RED scope debe incluir runtime path coverage (status enums + null branches), NO solo `__tests__` paths o shape source**: cuando cutover toca caller que invoca mapper presentation o función con `throw on null`/runtime invariants, RED scope expansion DEBE cubrir status enum branches (DRAFT/POSTED/LOCKED/VOIDED) + null branches (sequenceNumber/optional fields). Runtime path coverage assertions — `expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/)` null guard ternary, `expect(pageSource).toMatch(/\$\{PREFIX\}-DRAFT/)` fallback template literal, `expect(pageSource).toMatch(/status\s*===\s*"DRAFT"/)` status enum branch. 4 evidencias formales cumulative cross-POC: POC nuevo A3 (RETROACTIVE A3-C4a.5+C4b.5 + PROACTIVE A3-C6a) + POC nuevo A4-C1 4ta PROACTIVE (.toSnapshot() runtime path coverage 30 assertions α RED scope expand pre-RED — adapter snapshot serialization + 0-args→factory composition root branches paired sister §13.A4-α DTO divergence entity vs snapshot + §13.A4-β callers no-args 9 cumulative). Tendencia: PROACTIVE timing > RETROACTIVE paired follow-up (más eficiente, evita transient TSC, reduce granularity ciclos).
13. **Bookmark heredado próxima sesión NO sustituye verify precedent cross-feature/cross-ciclo paridad pre-lock (Step 0 PROACTIVE)**: cualquier sub-fase con bookmark heredado describiendo scope cross-feature paired (sale ↔ purchase / iva-books ↔ org-settings) requires Step 0 PROACTIVE expand pre-recon — verify precedent state real cross-feature/cross-ciclo paridad pre-lock. Bookmark heredado + Marco subdecisiones adelantadas son HYPOTHESIS NO TRUTH — NO blind accept eco mecánico. Operational checklist: identify precedent exhaustivamente + verify state real vs bookmark target + verify consumer behavior (`response.json()` body consumption real vs assumed) + cross-feature precedent check + surface honest divergencia + Marco re-lock antes RED. 4 evidencias formales PROACTIVE cumulative cross-POC: POC nuevo A3 (A3-C6c 1ra scope creep ~25 cambios mecánicos prevented + A3-C7 2da + A3-C8 3ra Marco Opción A1 razón corregida via Step 0 expand pre-recon) + POC nuevo A4-C1 4ta (Step 0 PROACTIVE expand pre-RED descubrió Cat 1/Cat 2 mock-source coupling estructural — bookmark Opción α' "5 ciclos preserved nominal" ilusión separation cuando vi.mock target = imported path → Path α'' merge atomic resolution superior §13.A4-η formal post-RED).
14. **Cumulative arithmetic claims engram chain require runtime verify pre architecture.md cementación**: engram cumulative claim chains (Suite passed/failed counts, TSC baseline, ESLint counts, file counts) acumulan arithmetic errors progresivos cycle-by-cycle si cada delta NO se re-verifica runtime. Architecture.md cementación final POC requires runtime verify mandatory ANTES de cementar — `npx tsc --noEmit | grep "error TS" | wc -l` + `pnpm vitest run --reporter=dot` + `npx eslint .` runtime ground truth supersedes engram cumulative claim regardless threshold evidencias. Pattern reusable: cualquier doc-only post-mortem cumulative cementando métricas finales debe ejecutar 3 verificaciones runtime pre-edit. 3 evidencias formales paired sister cumulative cross-POC: POC nuevo A3 (§13.A3-C7-γ TSC drift 16→17 discovered A3-C7 GREEN runtime verify + §13.A3-C8-δ Suite passed drift 5043→4942 = +101 discovered A3-D1 PROACTIVE Marco mandate runtime pre-cementación) + POC nuevo A4-D1 PROACTIVE pre-cementación 3ra paired sister (TSC 17 + ESLint 10e/13w + Suite 4998/6/2 runtime ground truth confirmed clean baseline preventive evidence — protocol forward-applicable cumulative arithmetic claims chain regardless drift discovery vs preventive verification outcome). Cementación PROACTIVE 1ra evidencia paired explicit Marco lock asymmetry cost-benefit (mirror lección #13 PROACTIVE pattern). Cross-ref MEMORY.md `feedback_textual_rule_verification` + `feedback_low_cost_verification_asymmetry` + `feedback_engram_textual_rule_verification`.

**Cross-ref engrams** (texto canónico cementado): `protocol/agent-lock-discipline` #1509 (lecciones #1-4 A2-C1) + `protocol/agent-lock-discipline/a2c2-additions` #1512 (lecciones #7-8 A2-C2 cumulative) + `protocol/agent-lock-discipline/a2c3-additions` #1515 (lección #5 A2-C3 empirical validation precedent) + `arch/lecciones/leccion-12-runtime-path-coverage` #1542 (lección #12 PROACTIVE pattern matures cumulative POC nuevo A3) + `arch/lecciones/leccion-13-bookmark-precedent-verification` #1546 (lección #13 PROACTIVE 1ra evidencia explicit Marco lock A3-C6c + 2da A3-C7 + 3ra A3-C8) + `arch/lecciones/leccion-10-eslint-dry-run-skippable` #1550 (lección #10 sub-precedent skippable PROACTIVE 1ra evidencia A3-C7 + 2da A3-C8) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 PROACTIVE 1ra evidencia paired §13.A3-C7-γ + §13.A3-C8-δ + 3ra paired sister A4-D1 PROACTIVE pre-cementación clean baseline preventive evidence) + `poc-nuevo/a4/13.eta-mock-factory-load-bearing` #1567 (§13.A4-η formal post-RED vi.mock factory load-bearing render path coverage NO orphan + §13.A4-γ candidate engram-only Alt A drift textual §18.4 línea 787 paired sister 4ta evidencia §14).

**Aplicabilidad**: cross-POC. POC nuevo dedicado A3 heredó lecciones #1-#9 starting state — pre-recon expand cumulative ciclos C1...C8 las aplicó (engram `poc-siguiente/a3/pre-recon-deferred-new-poc` heredado). POC nuevo dedicado A4 cleanup `features/org-settings/` heredó las 14 lecciones + #10-skippable starting state — pre-recon expand cumulative ciclos A4-C1+C2+C3 las aplicó (engram `poc-nuevo/a4/pre-recon-comprehensive` #1564 + paired sister `poc-futuro/a4-org-settings/pre-recon-comprehensive` #1565). POCs siguientes inmediatos (~11 features remaining post-A4: IVA books / payables / receivables / journal entries / fiscal periods / accounts / contacts / dispatches / shipments / wage / etc.) heredarán las 14 lecciones + 1 sub-precedent starting state. Pattern matures: 9 → 14 cumulative cross-POC + evidence count expansion POC nuevo A4 sin cementar lecciones nuevas (POC nuevo A4 NO origina lecciones — expand contadores evidencias cumulative #10-#14 + sub-precedent).

---

## 14. Componente mínimo de una decisión arquitectónica

Una decisión arquitectónica que **depende de un componente mínimo para ser ejercitable** debe incluir ese componente en el mismo POC. Diferirlo NO respeta la regla "una decisión arquitectónica por POC" — la fragmenta.

**Por qué**: una decisión sin su componente mínimo no está terminada — es la **firma** de la decisión, no la decisión. Cerrar un POC en ese estado deja un esqueleto no-ejercitable; el bug estructural no desaparece, sólo se traslada al POC siguiente, donde aparece **mezclado** con la complejidad propia de ese POC.

**Cómo aplicar**: antes de cerrar un POC arquitectónico, validá que la decisión tiene al menos un test de integración real que la ejercite end-to-end. Si para escribir ese test necesitás agregar un componente "extra", agregalo — es ejecución de la decisión original, no decisión adicional.

**Precedente — POC #9 (UnitOfWork)**: la decisión "introducir UoW Shape A" se descubrió no-ejercitable contra Postgres real sin ≥1 repo en `UnitOfWorkScope`. Sin un repo del scope, los consumers no podían mutar dentro de la tx del UoW (el `tx` token está oculto). El primer repo (`fiscalPeriods.markClosed`) se incluyó en el mismo POC como ejecución de la decisión, no como decisión nueva.

**Análogo**: cuando se decidió `MonetaryAmount` como VO, no fue "decisión 1: hacer el VO" + "decisión 2: agregar constructor". Era UNA decisión — el constructor es ejecución. Mismo patrón.

**Cuándo NO aplicar**: si el componente "extra" introduce decisiones nuevas (eligir librería, definir invariantes nuevos, abrir contratos cross-feature), no es ejecución — es decisión nueva. Ahí sí, POC separado.

**Cross-ref**: complementa la regla "una decisión arquitectónica por POC" (engram `architecture/migration-ladder`). Junto con Stop rule v4 y la auditoría retroactiva (§13), forman el triángulo de validación de POCs: surfacear drift en curso, completar la decisión actual, auditar POCs anteriores.

---

## 15. Lo que NO está en este documento (todavía)

- Estrategia de testing detallada por capa
- Composition root completo (DI)
- ~~Cómo manejar transacciones que cruzan módulos~~ — cerrado en §17.
- ~~Migración de la audit-context a port~~ — cerrado en POC #9 (§4.3).

Esos quedan abiertos para iterar **después** del POC en `mortality`. Si los definimos ahora, los definimos mal — la POC nos va a mostrar qué falta de verdad.

---

## 16. Referencias

- Cockburn, Alistair. "Hexagonal Architecture" (2005)
- Vernon, Vaughn. "Domain-Driven Design Distilled" (2016)
- ADR existentes: `docs/adr/001`, `docs/adr/002`

---

## 17. Carve-out: cross-module imports en `infrastructure/`

Excepción contextual a la convención implícita "`infrastructure/` no importa concretos cross-module". Cubre el caso documentado en §15 ("Cómo manejar transacciones que cruzan módulos") cuando R3 sigue vigente — la flecha apunta al dominio porque el adapter concreto importado implementa un port definido en `domain/` del módulo dueño.

### 17.1. Scope acotado — qué cubre y qué NO

El carve-out aplica **únicamente** a:

| Categoría | Filename pattern | Razón estructural |
|---|---|---|
| **Unit of Work** | `*-unit-of-work.ts` | El UoW debe construir adapters tx-bound dentro del callback `withAuditTx`. La `Prisma.TransactionClient` no existe pre-tx — un singleton en composition-root no puede capturar el `tx` per-run. Sin esta excepción, el UoW pattern (§4.3) es inejecutable. |
| **Helpers puros de mapping** | `*-mapping.ts`, `*.mapper.ts`, funciones `hydrate*FromRow` / `to*Persistence` | Funciones puras row ↔ entity, sin estado ni efectos. Reutilizar evita duplicar mapeos byte-equivalentes (mismo tradeoff que rule-of-three §11.1). |

**NO aplica** a adapters generales (`*.adapter.ts`, `*.repository.ts`, `*.repo.ts`). Si un adapter regular necesita lógica de otro módulo, va vía port (R3 + R6) o wrap-thin de legacy (`features/`). El carve-out NO es justificación universal.

### 17.2. Direccionalidad — R3 sigue vigente

Los adapters concretos importados **implementan ports definidos en `domain/`** del módulo dueño:

```
sale/infrastructure/prisma-sale-unit-of-work.ts
   ↓ imports concrete (carve-out §17)
accounting/infrastructure/prisma-journal-entries.repo.ts
   ↓ implements (R3)
accounting/domain/ports/journal-entries.repo.ts (port)
```

El UoW de `sale` no acopla con la **lógica** de `accounting` — solo con la **construcción** de un adapter que ya respeta el contrato del port. Sustitución por test fake se hace inyectando otro `UnitOfWork` completo, no patcheando el UoW concreto.

### 17.3. Cita obligatoria en JSDoc

Todo import cross-module concreto cubierto por este carve-out **debe citar la regla en el JSDoc del archivo** con la forma:

```
§17 carve-out: <razón estructural concreta>
```

Ejemplo:

```ts
/**
 * Postgres-backed adapter for the sale UnitOfWork port.
 *
 * §17 carve-out: UoW construye adapters tx-bound dentro de `withAuditTx` —
 * `Prisma.TransactionClient` no existe pre-tx, singleton en composition root
 * no puede capturar `tx` per-run. Cross-module concrete imports:
 * `accounting/PrismaAccountBalancesRepo`,
 * `accounting/PrismaJournalEntriesRepository`,
 * `receivables/PrismaReceivablesRepository`,
 * `shared/PrismaFiscalPeriodsTxRepo`.
 */
```

La cita es **auditable**: cualquier import cross-module concreto en `infrastructure/` que no cite §17 es violación, no excepción.

### 17.4. Precedentes

| POC | Adapter | Cross-module imports cubiertos |
|---|---|---|
| #10 | `accounting/infrastructure/prisma-accounting-unit-of-work.ts` | `shared/PrismaFiscalPeriodsTxRepo` |
| #11.0a Ciclo 6 | `sale/infrastructure/prisma-sale-unit-of-work.ts` | `shared/PrismaFiscalPeriodsTxRepo`, `accounting/PrismaAccountBalancesRepo`, `accounting/PrismaJournalEntriesRepository`, `receivables/PrismaReceivablesRepository` |
| #11.0a Ciclo 4 | `sale/infrastructure/prisma-journal-entry-factory.adapter.ts` | `accounting/journal-mapping.hydrateJournalFromRow` (helper puro) |

### 17.5. Cross-ref

- **Cierra**: §15 ítem abierto "Cómo manejar transacciones que cruzan módulos".
- **Complementa**: R3 (dirección de dependencia), §11.1 (rule of three para promoción a `shared/`).
- **NO debilita**: R1, R2, R4 — `domain/`, `application/`, `presentation/` siguen sin importar cross-module infrastructure (ESLint §9 lo enforça).

---

## 18. Reducción de scope en cutover por dependencia con decisiones lockeadas

Cuando un POC de cutover (sustitución de un módulo legacy por su equivalente hex) descubre que parte del scope original depende de un **bridge o interface cuya forma viola una decisión arquitectónica lockeada en POCs anteriores** (e.g., un path que ya fue retirado intencionalmente), la respuesta correcta es **reducir scope y diferir la parte afectada** al POC donde la decisión deje de aplicar — NO forzar el cutover.

**Por qué**: forzar el cutover en presencia de esta colisión deja sólo tres caminos, todos malos:

- **(α) Adaptador wrap-thin que ignora la decisión** — el bridge re-implementa el path retirado en el adapter (e.g., reabre tx interna por shape, hidrata entidades cross-aggregate por loop). Resultado: decisión lockeada queda viva en infraestructura, contradiciendo la decisión documentada. Suele también violar fidelidad regla #1 (atomicidad, performance, consistencia observable).
- **(β) Revertir la decisión lockeada** — re-codificar el path retirado en `application/` o `domain/`. Pierde el progreso del POC anterior; descalibra la conversación arquitectónica.
- **(δ) Path lateral compensatorio** (saga, eventual consistency, N+1 hidratación) — introduce un patrón nuevo sin precedente que va a propagar.

La opción correcta — **(γ) reducir scope y diferir** — preserva la decisión lockeada y deja la deuda explícita, con destino y forma de cierre conocidos.

### 18.1. Cuándo aplicar

Aplica cuando se cumplen los tres criterios:

1. **Decisión lockeada anterior**: el cutover de la parte afectada requeriría revivir un path que un POC anterior retiró intencionalmente (con cita en commit, JSDoc, o §X de este documento).
2. **Bridge inevitable**: el legacy consumer expone una interface (`*ServiceForBridge`, `*ServiceForHub`, etc.) cuyo contrato sólo se cumple revivendo ese path.
3. **POC futuro identificable**: existe un POC en el roadmap donde la interface deja de existir (porque su consumer migra a hex también) o se rediseña.

Si el criterio 3 falla — no hay POC futuro donde el bloqueador desaparezca — entonces la opción γ no resuelve, sólo posterga. En ese caso, el problema es la decisión lockeada, no el cutover; reabrir la decisión.

### 18.2. Cómo documentar

Toda reducción de scope cubierta por §18 debe registrar **en el commit y en el bookmark del POC**:

1. **Scope original** (lo que el bookmark prometió): "POC #X cutover N consumers".
2. **Scope reducido** (lo que se entrega): "POC #X cutover M consumers; (N − M) diferidos a POC #Y".
3. **Razón estructural concreta** — qué decisión lockeada bloquea, con cita: "§5.5 retired Ciclo 6 elimina `externalTx` en `regenerateJournalForIvaChange`; bridge `SaleServiceForBridge` requiere `externalTx` para atomicidad write-IVA + regen".
4. **POC destino** + **acceptance del cierre**: "POC #Y debe cutover los (N − M) diferidos como pre-condición de cierre. El bridge se rediseña en POC #Y porque su consumer (IVA) migra a hex y el contrato deja de necesitar `externalTx`".

Sin los 4 puntos, la deuda se vuelve invisible y se transmite como "el scope era distinto al bookmark, no me acuerdo por qué".

### 18.3. Direccionalidad — el POC destino hereda la deuda explícita

El POC destino **NO** es libre de cerrar sin honrar el cutover diferido. La deuda `(N − M)` es pre-condición. El bookmark del POC destino debe abrir con esa deuda en su lista de scope, no descubrirla al cerrarlo.

### 18.4. Precedentes

| POC | Bookmark scope | Scope entregado | Diferido a | Razón estructural |
|---|---|---|---|---|
| #11.0a A4 | Cutover 12 consumers formales de legacy `SaleService` (3 core API + 8 iva-books + 1 dispatches-hub)¹ | Cutover 3 consumers (A4-a: 3 core API routes) | POC #11.0c | Bridges `SaleServiceForBridge` (8 iva-books) y `SaleServiceForHub` (1 hub) requieren shape y contracts que sólo hacen sentido cuando IVA migre a hex y los bridges se rediseñen sin `externalTx` (§5.5 retired Ciclo 6 hex `regenerateJournalForIvaChange`) ni shape-adapter (`Sale` aggregate hex no expone `period` hidratado ni `displayCode`/`contact` hidratado para hub). En POC #11.0c, el consumer (IVA) migra a hex; los bridges legacy desaparecen y los 10 consumers diferidos hacen cutover atómico contra puertos hex equivalentes. |
| #11.0b A4 γ | Cutover 12 consumers formales de legacy `PurchaseService` (3 core API + 4 iva-books/purchases + 3 server components + 2 client components)² | Cutover 1 consumer (A4-a γ: `purchases/route.ts` GET + POST) | POC #11.0c | Asimetría legítima vs sale A4-a (3 core routes): purchase entrega scope mínimo γ porque (a) shape arquitectónico hex `makePurchaseService()` factory ya validado por sale A4-a precedent — re-validar 3 core API routes purchase es trabajo redundante; (b) bridge cross-module `iva-books.service.ts:618 recomputeFromPurchaseCascade` paralelo simétrico al sale `recomputeFromSaleCascade:559` requiere cutover atómico cuando IVA migre a hex; (c) `PurchaseWithDetails` legacy DTO migration paralelo sale A5 β Ciclo 3 diferida POC #11.0c — server components + client components consumen el DTO legacy directamente. γ entrega validación asimetrías purchase-specific (object DI spread vs sale positional, factory cross-module sale-side reusado `PrismaJournalEntryFactoryAdapter`, 5+1 cross-module imports §17, UoW 9 scope members) — destapó drift heredado A4-a γ simétrico al sale (legacy Zod parsea `date: string + lineAmount: number` vs hex `CreateDraftInput {date: Date, lineAmount: MonetaryAmount}`, runtime safe via JS coerción, tsc baseline 14 → 16 con 2 callsites POST createDraft + createAndPost vs sale 1 callsite). |
| #11.0c A4 + A5 | Hereda 10 cutovers sale-side diferidos POC #11.0a A4 (8 iva-books + 1 hub + `dispatches/page`) + 11 cutovers purchase-side diferidos POC #11.0b A4 γ (2 core API + 4 iva-books/purchases + 3 server components + 2 client components) + cleanup `features/sale/` y `features/purchase/` load-bearing (POC #11.0a A5 β y POC #11.0b A5 cleanup completo diferido)³ | A4 entera 18 cutovers runtime entregados (A4-a 8 routes core + A4-b 10 iva-books cascade + A4-c cycle-break + cutover hex contract + cleanup integration mirror) + retroactive REQ-FMB.5 fix corrector (entity-to-dto barrel re-route) + A5 sanitize correlationId-api-leak (8 prod routes + 8 tests + 8 JSDoc atomic revoke) | POC futuro pre-IVA-CRUD-hex-migration | 4 bridges teardown DEFER IVA-CRUD-hex-migration (2 inbound `SaleServiceForBridge`, `PurchaseServiceForBridge` + 2 outbound `IvaBooksServiceForSaleCascade`, `IvaBooksServiceForPurchaseCascade`) — pre-condición pre-IVA-CRUD-hex-migration: contracts bridge sólo se rediseñan cuando IVA migre a hex y el shape `externalTx` (§5.5 retired Ciclo 6) deja de ser pre-condición. (Bridge `SaleServiceForHub` defer separado: hub-migration POC, NO IVA-CRUD; shape-adapter cross-aggregate hidratación `Sale.period`/`displayCode`/`contact` permanece §18.4 fila POC #11.0a contexto histórico.) Cleanup `features/sale/` + `features/purchase/` load-bearing también se difiere al mismo POC futuro — load-bearing por bridges activos. Detalle estructural §19. |
| **POC siguiente** (IVA CRUD hex migration + bridges teardown atómico) | A1 (4 bridges teardown atómico: 2 inbound `SaleServiceForBridge` + `PurchaseServiceForBridge` deletion + 2 outbound `IvaBooksServiceFor{Sale,Purchase}Cascade` asimetría C1 purchase + C2 sale) + A2 (TASA_IVA Decimal migration legacy → `iva-calc.utils.ts` + REQ-FMB.5 re-export top-level barrel + vi.mock factory legacy cleanup 8 archivos surgical Cat A 6 + Cat B 2 + atomic delete legacy class structure 2 source classes `IvaBooksService`/`IvaBooksRepository` + 4 legacy tests + 2 Q5 integration tests + `server.ts` trim) — pre-condición §19 puntos 1 + 3 CUMPLIDA | A1 (3 commits master `c7805f3` + bridges) + A2 (5 commits cumulative `9964739`/`972c884` C1 + `d01089c`/`ee5f461` C1.5 + `1fe6874`/`66be172` C2 + `b1c429d`/`349ea9a` C3) + A4 doc-only (this commit batch — JSDoc sweep `37b2301` + architecture.md cementación) | POC nuevo dedicado A3 | A3 cleanup `features/{sale,purchase}/` load-bearing es **trabajo distinto, NO cleanup atómico** (§14 boundary natural): (a) migración hex `modules/purchase/presentation/dto+schemas` precondición — asimetría material §13.R (sale tiene `presentation/{dto,schemas}/`, purchase NO); (b) 8 callers cutover (4 sale `new SaleService()` no-args + HubService dep en `dispatches/page` + `dispatches-hub/route` + 4 purchase `new PurchaseService()` no-args en 2 pages + 2 routes — NO 3 como prompt original §13.Q count drift); (c) DTO mappers presentation pages cutover (§13.T shape divergence hex `Sale[]` entity vs legacy `SaleWithDetails[]` DTO — pages requieren mapper, NO trivial swap); (d) HubService refactor decisión (Sale↔Dispatch hub callers); (e) 20 legacy tests deletion final (11 sale + 9 purchase). Pre-recon expand reveló 5 §13 emergentes Q-U scope honest desde inicio POC nuevo (mirror A2 strategy β refinement precedent). Engram heredado `poc-siguiente/a3/pre-recon-deferred-new-poc` (#1517) — POC nuevo Step 0 leerá este bookmark + scope-locked-bookmark inicial Marco lock granularity 6-8 ciclos (A3-C1 build hex purchase presentation/dto+schemas + A3-C2 sale callers cutover + A3-C3 purchase callers cutover + A3-C4 types/schemas consumers + A3-C5 HubService decisión + A3-C6 atomic delete features/sale + A3-C7 atomic delete features/purchase + A3-C8 doc-only post-mortem). |
| **POC nuevo dedicado A3** (cleanup `features/{sale,purchase}/` load-bearing + cumulative cutover hex modules/{sale,purchase}/ presentation) | 8 ciclos originales heredados engram `poc-siguiente/a3/pre-recon-deferred-new-poc` (#1517) — A3-C1 build hex purchase presentation/dto+schemas + A3-C2 sale callers cutover + A3-C3 purchase callers cutover + A3-C4 types/schemas consumers + A3-C5 HubService decisión + A3-C6 atomic delete features/sale + A3-C7 atomic delete features/purchase + A3-C8 doc-only post-mortem | 15 ciclos cumulative entregados (granularity natural §14 expandida — paired follow-ups RETROACTIVE C1.5+C3.5+C4a.5+C4b.5+C5.5 evidencias #12 1+2 cumulative + PROACTIVE pattern matures C6a+C6b+C6c evidencias #12 3+4 + #13 1+2+3) + atomic delete A3-C7 features/sale wholesale + A3-C8 features/purchase wholesale (Marco Opción A1 archivo bridges-teardown DELETE wholesale §13.A3-C8-γ) + A3 Parte 2 doc-only post-mortem A3-D1+D2+D3+D4. **Suite 4942/6/2 runtime verified cementación A3-D1** (delta +14 net cumulative POC nuevo A3 vs A2 closure 4928 — engram cumulative claim 5043 stale drift +101 §13.A3-C8-δ formal cementación §19.6). **TSC 17 baseline EXACT preserved** (correction §13.A3-C7-γ — drift cumulative arithmetic discovery A3-C7 GREEN runtime verify, NO regression POC nuevo A3 — engram chain A2-C3 closure → A3-C* cumulative sin re-verify runtime cycle-by-cycle origen drift). **ESLint 10e/13w preserved** (improvement -1 errors vs POC siguiente baseline 11e/13w — error vivía en archivo deleted A3-C7+C8 wholesale, NO regression). **REQ-FMB.5 0 violations preserved**. **Test files 481 cumulative** (delta -10 net vs A2 closure 491 — `features/sale/__tests__/` × 11 + `features/purchase/__tests__/` × 9 + `bridges-teardown-shape.poc-siguiente-a1.test.ts` × 1 deleted = 21 cumulative offset por +11 NEW shape tests cumulative ciclos C2-C8). 32 commits cumulative pre-push + 3 doc-only D1+D2+D3 + push D4 = 35 commits batch al cierre POC entero. | POC futuro dedicado paridad fix routes 3+4 PATCH/POST mismatch sale + purchase paired (D5 sub-fase A3-D3 doc-only post-mortem cementación + cross-ref defer) | A3 cleanup `features/{sale,purchase}/` load-bearing fue entregado cumulative cutover hex modules/{sale,purchase}/ presentation precondición — granularity expandida natural §14 (8 → 15 ciclos paired follow-ups + atomic delete wholesale) NO scope creep, evidencias documentadas lecciones #12 + #13 PROACTIVE pattern matures cumulative. Bookmark scope original NO lockeado granularity ciclos final inicio POC nuevo A3 — Marco lock granularity expandida progresiva post-discovery latent bugs RETROACTIVE (#12 evidencias 1+2 A3-C4a.5+C4b.5) + PROACTIVE pattern matures (#12 evidencia 3 A3-C6a + #13 evidencias 1+2+3 A3-C6c+C7+C8). Pre-recon expand cumulative aplicó lecciones #1-#9 heredadas POC siguiente starting state — POC nuevo A3 cementa #10-#14 + #10-skippable sub-precedent doc-only A3-D1 (asymmetric cost-benefit Marco lock PROACTIVE 1ra evidencia paired #14 sister §13.A3-C7-γ + §13.A3-C8-δ runtime verify mandate). |
| **POC nuevo dedicado A4** (cleanup `features/org-settings/` load-bearing + cumulative cutover hex modules/org-settings/ presentation cross-feature/cross-module) | Bookmark scope engrams `poc-nuevo/a4/pre-recon-comprehensive` (#1564) + paired sister `poc-futuro/a4-org-settings/pre-recon-comprehensive` (#1565) — 16 ubicaciones cross-categoría: Cat 1 (6 app pages + 1 api route) + Cat 2 (4 page-rbac vi.mock factory) + Cat 3 (3 source cross-feature/cross-module + 2 paired tests) + atomic delete `features/org-settings/` wholesale (server.ts + index.ts + rmdir, sin __tests__/ collateral). Marco lock granularity Opción α'' Path α'' merge atomic Cat 1+Cat 2 single ciclo A4-C1 post Step 0 PROACTIVE pre-RED descubrió mock factory load-bearing render path coverage NO orphan suposición §13.A4-η formal cementación post-RED (mirror lección #13 PROACTIVE pattern). | 4 ciclos cumulative entregados (granularity natural §14 expandida — Path α'' merge atomic A4-C1 Cat 1+Cat 2 paired + atomic delete A4-C3 wholesale): A4-C1 atomic Cat 1+Cat 2 cutover hex pages/route + 4 vi.mock factory paired (Path α'' merge §13.A4-η — commits `07c9462` RED 30 assertions α + `a6de933` GREEN 10 archivos / 25 changes — 6 source pages/route + 4 vi.mock factory paired) + A4-C2 atomic Cat 3 cleanup cross-feature/cross-module hex 5 archivos / 13 source changes (commits `3951d05` RED 21 assertions α granular per callsite + `2a33993` GREEN, RED scope Test 15 method-target correction NAMED §13.A4-ι NO-formal mid-cycle) + A4-C3 atomic delete `features/org-settings/` wholesale (commits `0bae9f2` RED 5 assertions α 3 transition + 2 safety net per `feedback_red_acceptance_failure_mode` + `31ff403` GREEN 2 archivos + rmdir, mirror A3-C7+C8 simpler shape sin __tests__/ collateral) + A4-D1 doc-only post-mortem cementación cumulative architecture.md §18.4 fila A4 + §13.7 contadores expand 5 lecciones + §19.7 status closure (esta fila + §19.7) + §13.A4-γ engram-only Alt A. **Suite 4998/6/2 runtime verified cementación A4-D1** (delta +56 net cumulative POC nuevo A4 vs A3 closure 4942 — runtime ground truth confirmed clean baseline cumulative arithmetic claims engram chain — preventive evidence vs drift discovery §13.A3-C7-γ + §13.A3-C8-δ pattern, lección #14 3ra paired sister formal). **TSC 17 baseline EXACT preserved** (NO regression POC nuevo A4 vs A3 closure 17). **ESLint 10e/13w preserved** (NO regression POC nuevo A4). **REQ-FMB.5 0 violations preserved**. **Test files 484 cumulative** (delta +3 vs A3 closure 481 — shape tests NEW POC A4 ciclos C1-C3 cumulative). 6 commits cumulative pre-push + A4-D1 doc-only commit cumulative cierre A4 entero (defer push batch A4 closure mirror precedent A1+A2+A3). | Ninguno (POC entero CLOSED A4-D1 cementación) | A4 cleanup `features/org-settings/` load-bearing fue entregado cumulative cutover hex modules/org-settings/ presentation precondición — granularity expandida natural §14 (5 ciclos α' originales propuesta agente pre-recon → 4 ciclos final Path α'' merge atomic post Step 0 PROACTIVE descubrió Cat 1/Cat 2 mock-source coupling estructural §13.A4-η). Pre-recon expand cumulative aplicó lecciones #1-#14 + #10-skippable heredadas POC nuevo A3 starting state — POC nuevo A4 NO cementa lecciones nuevas, expand contadores evidencias cumulative #10-#14 + sub-precedent (§13.7). 7 §13 emergentes A4 cumulative (5 PROACTIVE pre-RED engram-only formal α DTO divergence entity vs snapshot + β callers no-args 9 cumulative + γ drift textual §18.4 línea 787 + δ cross-module dep break payment adapter + ε cross-feature dep break dispatch + ai-agent + 1 formal post-RED §13.A4-η vi.mock factory load-bearing render path coverage NO orphan + 3 NO-formal inventory accuracy paired sisters cumulative cross-cycle ζ JSDoc `@deprecated` claim adapter inferential incorrect + θ + ι Test 15 method-target correction NAMED A4-C2 RED scope mid-cycle). §13.A4-γ engram-only Alt A drift textual §18.4 línea 787 nominal "A3-C2 sale callers cutover" vs entregado real (engram #1522 — A3-C2 cutover 6 consumers `@/features/purchase` barrel → hex modules/purchase/presentation deep paths) — preservación historical accuracy mirror precedent §13.A3-D3-α (3ra evidencia drift textual line ref §20.5). Pattern paired sister cumulative drift docs cumulative — 4 evidencias formales lección #14 (§13.A3-C7-γ + §13.A3-C8-δ + §13.A3-D3-α + §13.A4-γ). |

¹ **Nota correctiva (POC #11.0a A5 β Step 0 D-Step0#2)**: pre-recon A5 β reveló 3 server components adicionales consumiendo `SaleService` legacy NO listados en el scope formal del bookmark histórico A4-a: `app/(dashboard)/[orgSlug]/sales/page.tsx`, `sales/[saleId]/page.tsx`, `dispatches/page.tsx`. POC #11.0c hereda **10 cutovers explícitos** (8 iva-books + 1 hub + `dispatches/page` — el surface nuevo que A5 β agrega al scope heredado), no 9. Los otros 2 server components (`sales/page` + `sales/[saleId]/page`) son consumers conocidos pre-existentes pero quedan para auditoría retroactiva POC #11.0c. El bookmark histórico se preserva sin reescribir — la corrección vive aquí (auditabilidad).

² **Nota correctiva (POC #11.0b post-A3 audit-6 Marco challenge)**: bookmark scope POC #11.0b nunca se lockeó explícitamente al inicio del POC (asumido implícito mirror sale POC #11.0a 5 sub-fases). Cuando A1+A2+A3 cerraron, reporte interpretó "POC #11.0b CLOSED completo" — Marco surfaceó el gap (A4 + A5 pendientes mirror sale precedent). Bookmark `poc-11/0b/scope-locked-bookmark` (engram) se creó retroactivamente con γ lockeada Marco (A4-a γ minimal + A5 cleanup completo deferral). POC #11.0c hereda **11 cutovers purchase-side explícitos** post A4-a γ (2 core API restantes + 4 iva-books/purchases + 3 server components + 2 client components) + cleanup completo `features/purchase/` (mirror sale cleanup completo diferido). Tsc baseline POC #11.0c heredado actualizado: 16 errores (3 sales/route + 2 purchases/route + 11 findManyByCodes) — drift heredado A4-a γ simétrico al sale precedente. El bookmark POC #11.0b se preserva con la corrección retroactiva en `poc-11/0b/scope-locked-bookmark` engram (auditabilidad). Lección operacional: bookmark scope-locked-bookmark al INICIO de un POC es check obligatorio — sin él, cierre prematuro pasa silently incluso con auditoría retroactiva por sub-fase.

³ **Nota emergente (POC #11.0c A4-c)**: bridges teardown surfaceó como NEW §13 emergente durante A4-c P-items recon — blast radius excedió expectativa "validación estructural sale + purchase". Las 4 interfaces IVA-bridge (2 inbound `SaleServiceForBridge`, `PurchaseServiceForBridge` consumidas por IVA legacy + 2 outbound `IvaBooksServiceForSaleCascade`, `IvaBooksServiceForPurchaseCascade` consumidas por Sale/Purchase legacy cascade) son cross-module IVA↔Sale/Purchase y NO migran en POC #11.0c — sus contracts dependen de `externalTx` (§5.5 retired Ciclo 6 hex). (Bridge `SaleServiceForHub` defer separado: hub-migration POC, shape-adapter no expuesto por aggregate hex `Sale.period` hidratado + `displayCode`/`contact` permanece §18.4 fila POC #11.0a contexto histórico — NO IVA-CRUD pre-condición.) Lock D-Step0 Marco: NO A4-c, NO A5, NO POC #11.0c entero — defer atómico POC futuro pre-IVA-CRUD-hex-migration cuando consumer (IVA) migre a hex y bridges desaparezcan en cutover atómico (§19). Adicionalmente A5 cerró sanitize `correlationId-api-leak` (Opción C ejecutada cleanup pre-decidido per engram `poc-11/0c/a4/section-13/correlationid-api-leak`) — convención formal codificada §20. Métricas POC #11.0c finales: 5030/6/2 (5038 tests) + tsc 16 + ESLint 11e/15w heredados pre-existentes — POC futuro retire #6 ESLint warnings legacy `features/` + #9 drift externo R5 Prisma value-objects.

### 18.5. Cleanup parcial honesto — caso inverso

§18.4 cubre el caso donde el cutover NO se puede hacer (bridge bloquea, scope se difiere). Hay un caso simétrico inverso: el cutover principal está bloqueado (parte del scope diferida a POC futuro), **pero porciones del legacy son fachada-presentation pura — cero consumers internos del propio legacy** y se pueden DELETE/migrar sin esperar el cutover completo.

**Cuándo aplica**:

1. El POC actual está cerrando con parte del scope diferida a POC futuro vía §18.4.
2. Existen archivos o sub-modules legacy donde el pre-recon (grep cross-cutting **PROJECT-scope**) confirma cero consumers internos del propio legacy: schemas Zod no consumidos por el service, tipos DTO presentation no referenciados por dominio, helpers no llamados desde otras capas legacy.
3. Los consumers cross-module se pueden re-rutear ahora (sin esperar al POC destino) porque el shape migrado es bit-exact.

**Por qué entregarlo en el POC actual**:

- Reduce surface legacy ahora — menos código que el POC destino tenga que tocar.
- Entrega valor incremental observable: el POC actual no cierra "vacío" cuando hay cleanup factible.
- Establece precedente: cleanup honesto sólo aplica donde el legacy NO es load-bearing. NO es atajo para evadir §18.4.

**Cómo distinguir cleanup factible de scope creep**:

- Pre-recon honesto **PROJECT-scope** (no sólo `app/`) — incluyendo `__tests__/` legacy y mocks. Excluir directorios da falsos negativos.
- Validación post-GREEN con `tsc --noEmit` para cambios type-only. Las imports `import type` se elidan en runtime vitest — los smoke tests pasan trivialmente y NO producen RED genuino para tipos puros. La validación honesta es tsc.
- Si surgen consumers no detectados, update in-place sólo si el shape migrado es bit-exact (regla #1) y el cambio es type-only.

**Precedentes**:

| POC | Cleanup entregado | Status del archivo |
|---|---|---|
| #11.0a A5 β Ciclo 1 | Drift A3 paridad bit-exact: `prisma-iva-book-regen-notifier.adapter.ts` drop `status: "ACTIVE"` filter (alinear con legacy SIN filter — adapter NO inventa "defensive" filter; precedente Ciclo 3 `getNextSequenceNumber`). | Adapter intacto, drift cerrado |
| #11.0a A5 β Ciclo 2 | DELETE `features/sale/sale.validation.ts` (4 schemas Zod fachada-presentation pura, cero consumers internos legacy). 3 routes core re-routeadas a `modules/sale/presentation/schemas/`. | Archivo eliminado |
| #11.0a A5 β Ciclo 3 | Migrate `SaleWithDetails` + 3 tipos (`PaymentAllocationSummary`, `ReceivableSummary`, `SaleDetailRow`) a `modules/sale/presentation/dto/`. ELIMINATE `IvaSalesBookDTO` re-export muerto. 8 imports re-routed (4 producción + 4 tests legacy). | `sale.types.ts` reducido a input types |
| #11.0a A5 β (cleanup completo `features/sale/`) | — | Diferido POC #11.0c (load-bearing por runtime consumers heredados §18.4) |

### 18.6. Cross-ref

- **Complementa**: §13 (auditoría retroactiva — surface drift hacia atrás), §14 (componente mínimo — completar la decisión actual), §18.5 (cleanup parcial honesto — caso inverso). §18 cubre el caso simétrico hacia adelante: cuando la decisión actual choca con scope prometido, mover el scope, no la decisión.
- **NO debilita**: regla #1 fidelidad legacy (la deuda explícita no es atajo — es el costo conocido y declarado de la decisión lockeada anterior).
- **Pre-condición POC destino**: el POC que herede la deuda diferida la lista en su bookmark de apertura como scope obligatorio. Sin eso, el patrón se rompe.

---

## 19. Bridges teardown legacy — ~~defer pre-IVA-CRUD-hex-migration~~ **CLOSED post-POC siguiente**

Cuatro interfaces bridge IVA ~~quedan vivas post-POC #11.0c~~ **fueron teardown atómicamente en POC siguiente A1+A2** (bookmarks `poc-siguiente/a1/c2/closed` #1506 + `poc-siguiente/a2/c3/closed` #1514). El teardown era **pre-condición de cierre** del POC futuro que migre IVA CRUD a hex — POC siguiente entregó esa pre-condición CUMPLIDA. (El bridge `SaleServiceForHub` queda fuera de §19 — es Sale↔Dispatch hub, defer atado a hub-migration POC, NO IVA-CRUD; cross-aggregate hidratación `Sale.period`/`displayCode`/`contact` permanece §18.4 fila POC #11.0a contexto histórico.)

### 19.1. Interfaces afectadas

| Interface | Owner | Consumer | Razón shape-bound |
|---|---|---|---|
| `SaleServiceForBridge` (inbound IVA→Sale) | `features/sale/sale.service.ts` | `iva-books.service.ts:567 recomputeFromSaleCascade` | Contract requiere `externalTx` para atomicidad write-IVA + regen sale. §5.5 retired Ciclo 6 elimina `externalTx` en hex `regenerateJournalForIvaChange` — el bridge no puede satisfacer la signature hex sin resucitar el path retirado. |
| `PurchaseServiceForBridge` (inbound IVA→Purchase) | `features/purchase/purchase.service.ts` | `iva-books.service.ts:626 recomputeFromPurchaseCascade` | Mirror simétrico sale-side (§18.4 fila #11.0b A4 γ). Misma shape-dependency `externalTx`. |
| `IvaBooksServiceForSaleCascade` (outbound Sale→IVA) | `features/accounting/iva-books/iva-books.service.ts` | `sale.service.ts:59 interface decl + 926 invocation en SaleService.editPosted` | Cascade `recomputeFromSaleCascade(tx, orgId, saleId, newTotal)` invocado desde `SaleService.editPosted` durante write-tx. Shape `tx`-bound legacy + path `regenerateJournalForIvaChange` (§5.5 retired Ciclo 6). Re-rutear via puerto hex equivalente sin resucitar `externalTx` ni cross-tx coupling. |
| `IvaBooksServiceForPurchaseCascade` (outbound Purchase→IVA) | `features/accounting/iva-books/iva-books.service.ts` | `purchase.service.ts:60 interface decl + 1078 invocation en PurchaseService.editPosted` | Mirror simétrico sale-side. Misma shape-dependency `tx`-bound + `regenerateJournalForIvaChange`. |

### 19.2. Pre-condición ~~POC futuro pre-IVA-CRUD-hex-migration~~ **CUMPLIDA POC siguiente A1+A2**

El POC que cierre el cutover IVA CRUD a hex **debía** entregar:

1. ~~Cutover atómico de los 4 bridges como parte del scope IVA hex~~ ✅ **CUMPLIDO POC siguiente A1** — 4 bridges teardown atómico:
   - A1-C1: 2 inbound (`SaleServiceForBridge` + `PurchaseServiceForBridge`) deletion + purchase outbound full asimetría (`IvaBooksServiceForPurchaseCascade`)
   - A1-C2: sale outbound asimetría (`IvaBooksServiceForSaleCascade`) deletion
2. ~~Cleanup `features/sale/` + `features/purchase/` load-bearing files~~ ✅ **CUMPLIDO POC nuevo dedicado A3** — features/sale/ atomic delete A3-C7 wholesale (commit `ad36da2` — 6 source + 11 tests + 2 dir rmdir + 2 vi.mock cleanup named explicit) + features/purchase/ atomic delete A3-C8 wholesale (commit `4aa8480` — 7 source + 9 tests + 2 dir rmdir + 1 vi.mock cleanup + 1 archivo bridges-teardown DELETE wholesale Marco Opción A1 §13.A3-C8-γ). §18.4 fila POC nuevo dedicado A3 + §19.6 status closure.
3. ~~Re-rutear cross-module concretos via puertos hex equivalentes~~ ✅ **CUMPLIDO POC #11.0c A4-c + POC siguiente A2** — adapters Prisma directo (`PrismaIvaBookReaderAdapter`, `PrismaIvaBookVoidCascadeAdapter`, `PrismaIvaBookRegenNotifierAdapter`) post-cutover hex factory `makeIvaBookService` + IVA CRUD migration (TASA_IVA → `iva-calc.utils.ts` + `IvaBooksService`/`IvaBooksRepository` deletion).

### 19.3. Por qué NO entra en §15

§15 lista pendientes iterables tras el POC `mortality` — items con scope no-bloqueante, refinables incrementalmente. Bridges teardown es **bloqueador estructural** pre-IVA-CRUD-hex-migration: condición binaria de cierre, no item refinable. Coherente con §18 dejar la deuda explícita con destino y forma de cierre conocidos (§18.2 punto 4 — POC destino + acceptance del cierre).

### 19.4. Cross-ref

- **Origen**: §18.4 fila POC #11.0c (³ nota emergente A4-c) — defer lockeado D-Step0 Marco.
- **Engrams POC #11.0c**: `poc-11/0c/a4/c/closed` (P-items A4-c) — surface inicial blast radius bridges; `poc-11/0c/a4/closed` (POC #11.0c A4 entera CLOSED) — defer ratificado.
- **Engrams POC siguiente cierre**: `poc-siguiente/a1/c2/closed` #1506 (4 bridges teardown atómico) + `poc-siguiente/a2/c3/closed` #1514 (legacy class deletion atómica + IVA CRUD migration completion).
- **Complementa**: §18 (caso simétrico forward — defer scope con destino conocido). §19 es ejecución concreta de §18 aplicada al cierre POC #11.0c — y POC siguiente es ejecución concreta del defer cumpliendo la pre-condición.

### 19.5. Status closure POC siguiente A1+A2

POC siguiente "IVA CRUD hex migration + bridges teardown atómico" entregó la pre-condición §19.2 puntos 1 + 3 — punto 2 (cleanup `features/{sale,purchase}/` load-bearing) DIFERIDO POC nuevo dedicado A3 por scope honest §14 (trabajo distinto: migración hex purchase presentation/dto+schemas asimetría + DTO mappers + HubService refactor decisión + 8 callers cutover). Mirror precedent A2 strategy β refinement.

**Métricas finales POC siguiente A1+A2**: 8 commits master cumulative pre-A4 doc-only. TSC 16 baseline preserved. Suite 4928/6/2 (delta -55 legacy tests deleted + 8 RED→GREEN A2-C3 - 1 dropped Test 2 bridges = -48 net). ESLint 11e/13w (improvement -2 warnings vs baseline 11e/15w — warnings vivían en archivos legacy deleted, NO regression). REQ-FMB.4 8 baseline preserved. REQ-FMB.5 0 violations preserved.

**§13 emergentes cumulative POC siguiente** (15 lettered + 5 A1-C1 unlettered = 20 total): G/H/I (A2-C1 Decimal.js + REQ-FMB.5 + binding-capture regex) + J/K/L/M (A2-C2 vi.mock factory + path discrimination + scope shrink + JSDoc defer) + N/O/P (A2-C3 shape-self-contained + JSDoc stale + count drift narrativo) + Q/R/S/T/U (A3 pre-recon — count drift + asimetría purchase hex DTO+schemas + getById signature + DTO shape divergence + bridges-teardown-shape Tests 3+4 NO self-contained).

**Lecciones operacionales agent-lock-discipline**: 9 cementadas — ver §13.7.

### 19.6. Status closure POC nuevo dedicado A3

POC nuevo dedicado A3 "cleanup `features/{sale,purchase}/` load-bearing + cumulative cutover hex modules/{sale,purchase}/ presentation" entregó la pre-condición §19.2 punto 2 — features/sale/ atomic delete A3-C7 (commit `ad36da2`) + features/purchase/ atomic delete A3-C8 (commit `4aa8480`) wholesale (mirror precedent A2-C3 atomic delete legacy class structure). 32 commits cumulative pre-push (15 ciclos cumulative paired RED+GREEN — A3-C1 build hex + C1.5 paired follow-up + C2 + C3 + C3.5 + C4a + C4a.5 PROACTIVE + C4b + C4b.5 + C5 + C5.5 + C6a + C6b + C6c + C7 + C8). A3 Parte 2 doc-only post-mortem cumulative en curso (A3-D1 architecture.md cementación esta sub-sección + A3-D2 JSDoc cosmetic sweep + A3-D3 D5 PATCH/POST mismatch documentation defer POC futuro paridad + A3-D4 push origin batch 35 commits cumulative cierre A3 entero).

**Métricas finales POC nuevo A3** (runtime verified A3-D1 PROACTIVE pre-cementación per lección #14): **Suite 4942/6/2** (delta +14 net cumulative POC nuevo A3 vs A2 closure 4928 — engram cumulative claim 5043 stale, drift +101 discovered runtime cementación A3-D1 formal §13.A3-C8-δ). **TSC 17 baseline EXACT preserved** (correction §13.A3-C7-γ — drift cumulative arithmetic discovery durante A3-C7 GREEN runtime verify, NO regression POC nuevo A3). **ESLint 10e/13w preserved** (improvement -1 errors vs POC siguiente baseline 11e/13w — error vivía en archivo deleted A3-C7+C8 wholesale, NO regression). **REQ-FMB.5 0 violations preserved**. **Test files 481 cumulative** (delta -10 net vs A2 closure 491 — `features/sale/__tests__/` × 11 + `features/purchase/__tests__/` × 9 + `bridges-teardown-shape.poc-siguiente-a1.test.ts` × 1 deleted = 21 cumulative offset por +11 NEW shape tests cumulative ciclos C2-C8).

**§13.A3-C7-γ — TSC baseline cumulative arithmetic drift discovery (formal cementación)**: durante A3-C7 GREEN verify runtime `npx tsc --noEmit | grep "error TS" | wc -l` returned **17** errors, NO 16 cementado en architecture.md líneas 780/786/788/867 (POC #11.0c + POC siguiente histórico). Origen drift indeterminate: probable mis-count cumulative engram #1514 (POC siguiente A2-C3 closure) propagado forward A3-C1 → A3-C6c sin re-verify runtime cycle-by-cycle. Resolution: cement runtime number 17 forward (esta sub-sección §19.6 + §18.4 fila POC nuevo A3) + preserve historical POC #11.0c + POC siguiente líneas 780/786/788/867 sin rewrite (auditabilidad — historical claim was 16 at the time, drift discovered later).

**§13.A3-C8-δ — Suite passed cumulative arithmetic drift discovery (formal cementación paired sister §13.A3-C7-γ)**: durante A3-D1 doc-only post-mortem PROACTIVE pre-cementación (Marco mandate lección #14 + textual_rule_verification + low_cost_verification_asymmetry MEMORY.md application), runtime `pnpm vitest run --reporter=dot` returned **Suite 4942/6/2 (Test files 481)**, NO 5043/6/2 (Test files 482) cementado en bookmark kickoff + engram #1553 (A3-C8 closed). Drift cumulative: +101 passed / +1 test files. Origen drift indeterminate: probable cumulative claim chain A3-C1 → A3-C8 sin re-verify runtime cycle-by-cycle. Resolution: cement runtime numbers 4942/6/2 + 481 test files forward (esta sub-sección §19.6 + §18.4 fila POC nuevo A3) + preserve historical engrams sin rewrite (auditabilidad). Pattern paired sister §13.A3-C7-γ — 2 evidencias formales fundamenta lección #14 cumulative arithmetic runtime verify mandate (§13.7 entry #14).

**§13 emergentes cumulative POC nuevo A3** — V/W/X/Y/Z/AA/AB/AC variantes cumulative cross-ciclos C1.5...C6c (engrams cumulative bookmarks `poc-nuevo/a3/c*/closed`) + A3-C7-α/β/γ + A3-C8-α/β/γ/δ (engram §13.A3-C7-γ TSC drift discovery + §13.A3-C8-δ Suite drift discovery formal cementación esta sub-sección). Body canónico vive en engrams — architecture.md preserva summary + cross-ref pattern §19.5 line 869 precedent.

**Lecciones operacionales agent-lock-discipline cumulative**: **14 cementadas + 1 sub-precedent** post POC nuevo A3 doc-only A3-D1 (9 originadas POC siguiente A1+A2 + #10 main + #10-skippable sub-precedent + #11 + #12 + #13 + #14 cementadas POC nuevo A3 doc-only A3-D1) — ver §13.7.

**Cross-ref engrams POC nuevo A3 closure**: `poc-nuevo/a3/c8/closed` #1553 (A3-C8 atomic delete features/purchase wholesale + §13.A3-C8-α/β/γ) + `poc-nuevo/a3/c7/closed` #1551 (A3-C7 atomic delete features/sale wholesale + §13.A3-C7-α/β/γ TSC drift discovery origen) + cumulative engrams `poc-nuevo/a3/c*/closed` ciclos previos C1...C6c (granularity ciclos paired follow-ups + cutover hex composition root + DTO mappers + HubService decisión) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 PROACTIVE 1ra evidencia paired §13.A3-C7-γ + §13.A3-C8-δ).

### 19.7. Status closure POC nuevo dedicado A4

POC nuevo dedicado A4 "cleanup `features/org-settings/` load-bearing + cumulative cutover hex modules/org-settings/ presentation cross-feature/cross-module" entregó cleanup atomic Path α'' merge — A4-C1 atomic Cat 1+Cat 2 cutover hex pages/route + 4 vi.mock factory paired (Path α'' merge §13.A4-η formal post-RED — commits `07c9462` RED 30 assertions α + `a6de933` GREEN 10 archivos / 25 changes — 6 source pages/route + 4 vi.mock factory paired) + A4-C2 atomic Cat 3 cleanup cross-feature/cross-module hex (commits `3951d05` RED 21 assertions α granular per callsite + `2a33993` GREEN 5 archivos / 13 source changes, RED scope Test 15 method-target correction NAMED §13.A4-ι NO-formal mid-cycle) + A4-C3 atomic delete `features/org-settings/` wholesale (commits `0bae9f2` RED 5 assertions α 3 transition + 2 safety net per `feedback_red_acceptance_failure_mode` + `31ff403` GREEN 2 archivos + rmdir, mirror A3-C7+C8 simpler shape sin __tests__/ collateral). 6 commits cumulative pre-push + A4-D1 doc-only commit cumulative cierre A4 entero (defer push batch A4 closure mirror precedent A1+A2+A3 cumulative push deferred al cierre POC entero).

**Métricas finales POC nuevo A4** (runtime verified A4-D1 PROACTIVE pre-cementación per lección #14 3ra paired sister): **Suite 4998/6/2** (delta +56 net cumulative POC nuevo A4 vs A3 closure 4942 — runtime ground truth confirmed clean baseline cumulative arithmetic claims engram chain — preventive evidence vs drift discovery §13.A3-C7-γ + §13.A3-C8-δ pattern). **TSC 17 baseline EXACT preserved** (NO regression POC nuevo A4 vs A3 closure 17). **ESLint 10e/13w preserved** (NO regression POC nuevo A4). **REQ-FMB.5 0 violations preserved**. **Test files 484 cumulative** (delta +3 vs A3 closure 481 — shape tests NEW POC A4 ciclos C1-C3 cumulative). Cumulative arithmetic invariant 4998+6+2=5006 holds.

**§13.A4-η — vi.mock factory load-bearing render path coverage NO orphan formal cementación post-RED A4-C1** (5ta evidencia paired sister cumulative §11/§12 cross-evidence + §13.A4-ζ Step 0 inventory finding NO-formal paired): durante Step 0 PROACTIVE pre-RED A4-C1 descubrió coupling estructural Cat 1/Cat 2 — 4 page-rbac tests "renders when requirePermission resolves" cases reach `getOrCreate()` mock intercept (lines 99-113 payments/new + análogos otros 3 page-rbac tests). Sin Cat 2 paired atomic Cat 1 GREEN romperia 4 tests post-cutover (real Prisma DB error en test env). Path α'' merge atomic resolution superior — Path β'' "5 ciclos preserved nominal" ilusión separation, mock-source acopladas estructuralmente cuando vi.mock target = imported path. Pattern reusable: cualquier suposición bookmark "X mocks orphan" pre-RED requires Step 0 verify "do these tests render the cutover-target source code path? If yes → mock load-bearing, atomic-coupled with source cutover". Body canónico engram `poc-nuevo/a4/13.eta-mock-factory-load-bearing` #1567 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A4-γ — drift textual §18.4 línea 787 nominal "A3-C2 sale callers cutover" vs entregado real (engram-only Alt A formal cementación, 4ta evidencia paired sister cumulative drift docs lección #14)**: tabla §18.4 línea 787 fila POC siguiente cita "A3-C2 sale callers cutover" como parte de la lista 6-8 ciclos originales heredados engram `poc-siguiente/a3/pre-recon-deferred-new-poc` #1517. Engram entregado real #1522 (A3-C2 closed) reporta "A3-C2 cutover 6 consumers `@/features/purchase` barrel → hex modules/purchase/presentation deep paths" — granularity reorganization durante POC nuevo A3 Marco lock expandida §14 (8 → 15 ciclos). §18.4 línea 787-788 preserva nominal heredado SIN actualizar shape entregado real (auditabilidad — historical claim was nominal at the time, drift discovered later). Resolution Alt A mirror §13.A3-D3-α (3ra evidencia drift textual line ref §20.5): preservar §18.4 línea 787 historical accuracy sin rewrite, engram-only cementación 4ta evidencia paired sister cumulative drift docs (cumulative arithmetic counts + textual line refs + textual scope shape descriptions docs §18.4) — fundamenta lección #14 forward beyond solo counts.

**§13 emergentes cumulative POC nuevo A4** — 7 emergentes total: 5 PROACTIVE pre-RED engram-only formal `poc-nuevo/a4/pre-recon-comprehensive` #1564 + paired sister #1565 (α DTO divergence entity vs snapshot + β callers no-args 9 cumulative + γ drift textual §18.4 línea 787 + δ cross-module dep break payment adapter + ε cross-feature dep break dispatch + ai-agent) + 1 formal post-RED `poc-nuevo/a4/13.eta-mock-factory-load-bearing` #1567 (η vi.mock factory load-bearing) + 3 NO-formal inventory accuracy paired sisters cumulative cross-cycle (ζ JSDoc `@deprecated` claim adapter inferential incorrect Step 0 A4-C1 + θ + ι Test 15 method-target correction NAMED A4-C2 RED scope mid-cycle). Body canónico vive en engrams — architecture.md preserva summary + cross-ref pattern §19.5 + §19.6 precedent.

**Lecciones operacionales agent-lock-discipline cumulative**: **14 cementadas + 1 sub-precedent** preserved POC nuevo A4 (NO origin lecciones nuevas — POC nuevo A4 expand contadores evidencias cumulative #10-#14 + sub-precedent — ver §13.7). Pattern matures: 9 (POC siguiente A1+A2) → 14 (POC nuevo A3 doc-only A3-D1) → 14 + evidence count expansion (POC nuevo A4 doc-only A4-D1 sin cementar lecciones nuevas).

**Cross-ref engrams POC nuevo A4 closure**: `poc-nuevo/a4/c3/closed` (A4-C3 atomic delete features/org-settings wholesale — A4-D2 candidate sub-task #10 cumulative engram cleanup separate commit) + `poc-nuevo/a4/c2/closed` (A4-C2 atomic Cat 3 cleanup — A4-D2 candidate) + `poc-nuevo/a4/c1/closed` (A4-C1 Path α'' merge atomic Cat 1+Cat 2 — A4-D2 candidate) + `poc-nuevo/a4/13.eta-mock-factory-load-bearing` #1567 (§13.A4-η formal post-RED + §13.A4-ζ inventory paired NO-formal) + `poc-nuevo/a4/pre-recon-comprehensive` #1564 + paired sister `poc-futuro/a4-org-settings/pre-recon-comprehensive` #1565 (5 §13 emergentes PROACTIVE pre-RED + 16 ubicaciones cross-categoría) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 3ra paired sister A4-D1 PROACTIVE pre-cementación clean baseline preventive evidence) + `arch/§13/A4-gamma-drift-textual-linea-787-engram-only` (§13.A4-γ formal cementación 4ta evidencia paired sister cumulative drift docs — engram TBD post-commit save).

---

## 20. correlationId NO en API surface

Las hex routes Next.js que retornan `Response.json` (o `NextResponse.json`) **NO** deben spread `correlationId` en el body de la response:

```ts
// ❌ INCORRECTO — leak audit telemetry interno en API surface
return Response.json({ ...result.entry, correlationId: result.correlationId });

// ✅ CORRECTO — sólo entrega el aggregate/DTO público
return Response.json(result.entry);
```

**Razón estructural**: `correlationId` es identificador de correlation tracking entre transacción + audit log. Es **telemetría interna del backend** — no parte del contrato API público. Filtrarlo al body acopla consumers externos a un campo audit-only que puede cambiar shape (UUID v4 → ULID → trace-id distributed) sin notice, y expone el modelo audit a clients que NO deben razonar sobre él.

El shape canónico hex `{ entry, correlationId }` (retornado por `service.execute()`) **separa concerns correctamente**: `entry` es el aggregate público, `correlationId` es metadata audit. La capa HTTP route es responsable de elegir qué se publica — y `correlationId` no se publica.

### 20.1. Auditoría retroactiva esperable pre-merge POC futuro

Toda hex route nueva — y toda hex route existente que entre a un POC futuro de cutover/refactor — debe auditarse contra el leak shape:

```bash
# pattern grep pre-merge — hits = leak
grep -rE "Response\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId" app/
grep -rE "NextResponse\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId" app/
```

Strip atómico en mismo edit que toque la route — no diferir a "cleanup commit posterior". Si requiere RED+GREEN paired (assertions test acopladas), precedent A5 split TDD aplica (RED separado del GREEN+REFACTOR atomic, per `feedback_jsdoc_atomic_revoke`).

### 20.2. Precedente — POC #11.0c A5

Surfaceó como `§13 emergente correlationId-api-leak` durante POC #11.0c A4-a Ciclo 1 Q4 verify gate: 8 routes iva-books `{sales,purchases}` × `{POST, PATCH, void, reactivate}` retornaban `Response.json({ ...result.entry, correlationId: result.correlationId })`. Lock decisional fue Opción C (preservation-during-cutover, cleanup futuro pre-decidido) en POC #11.0c A4-a; ejecutado en POC #11.0c A5 (sanitize TDD split: 8 tests inversion RED en `e55e551` + 8 routes strip + 8 JSDoc atomic revoke GREEN+REFACTOR en `6ed613d`).

### 20.3. Cross-ref

- **Origen**: §13 (auditoría retroactiva) — la convención emerge de un drift sistémico audit-only filtrado a API; auditoría retroactiva (§20.1) extiende detección hacia atrás.
- **Engram**: `poc-11/0c/a4/section-13/correlationid-api-leak` (lock textual original Opción C → CLOSED A5), `poc-11/0c/a5/closed` (sanitize ejecución A5).

### 20.4. Verify retroactivo POC siguiente

POC siguiente "IVA CRUD hex migration + bridges teardown atómico" verify retroactivo §20.1 pattern grep ejecutado pre-cierre (A4 doc-only post-mortem):

- **Routes nuevas added POC siguiente**: 0 — POC siguiente fue cleanup atómico (deletions + migrations), NO surface API growth.
- **Routes editadas POC siguiente**: 0 routes añaden `correlationId` al body. Modificaciones se limitaron a (a) drop legacy class instantiations (`new IvaBooksService()` deletion), (b) re-import paths post-A2-C1.5 redirect (TASA_IVA top-level barrel), (c) vi.mock factory cleanup A2-C2.
- **Convención §20 preservada**: leak shape NO regressed. 8 commits cumulative POC siguiente verify clean contra `Response.json({ ...result, correlationId })` pattern.

Pattern application coherente §20.1: cualquier hex route futura POC nuevo A3 (cutover legacy → hex) DEBE auditarse contra leak shape pre-merge. Strip atómico mismo edit que toque la route.

### 20.5. Verify retroactivo POC nuevo A3

POC nuevo dedicado A3 "cleanup `features/{sale,purchase}/` load-bearing + cumulative cutover hex modules/{sale,purchase}/ presentation" verify retroactivo §20.1 pattern grep ejecutado pre-cierre A3-D1 doc-only post-mortem (PROACTIVE Marco mandate lección #14 runtime verify pre-cementación):

- **Routes nuevas added POC nuevo A3**: 0 — POC nuevo A3 fue cumulative cutover (composition root `makeService` factory + DTO mappers + DELETE legacy class instantiations), NO surface API growth.
- **Routes editadas POC nuevo A3**: sale routes 3+4 (A3-C5 cutover `sales/[saleId]/route.ts` PATCH + `sales/[saleId]/status/route.ts` POST → hex composition root) + purchase routes 3+4 (A3-C6c cutover `purchases/[purchaseId]/route.ts` PATCH + `purchases/[purchaseId]/status/route.ts` POST → hex composition root). 0 routes añaden `correlationId` al body — verify runtime grep `Response\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths. Modificaciones se limitaron a (a) replace `new SaleService()`/`new PurchaseService()` legacy con `makeSaleService()`/`makePurchaseService()` composition root + (b) replace import `@/features/sale/server`/`@/features/purchase/server` con `@/modules/{sale,purchase}/presentation/composition-root` + (c) signature swaps object-DI vs positional + (d) `Response.json` raw entity preserved (NO mapper invocation routes mutation per consumer behavior `purchase-form.tsx`/`sale-form.tsx` mutation handlers NO consume body solo `response.ok`).
- **Convención §20 preservada**: leak shape NO regressed. 32 commits cumulative POC nuevo A3 verify clean contra `Response.json({ ...result, correlationId })` pattern.
- **D5 PATCH/POST mismatch defer POC futuro paridad fix sale + purchase paired**: sale `sales/[saleId]/status/route.ts:10` POST vs client `sale-form.tsx:344,454` PATCH (handlePost + handleVoid) + purchase `purchases/[purchaseId]/status/route.ts:15` POST vs client `purchase-form.tsx:564,590` PATCH (handlePost + handleVoid) mismatches paired. Documentation A3-D3 sub-fase doc-only post-mortem ✅ §21.1 (line refs sale corregidos `:15`→`:10` retroactivo §13.A3-D3-α drift cumulative arithmetic engram chain — 3ra evidencia paired sister §13.A3-C7-γ + §13.A3-C8-δ engram-only). Cross-ref §21 + engram `poc-futuro/d5-patch-post-mismatch-paridad-fix` POC futuro candidate.

Pattern application coherente §20.1 forward: cualquier hex route futura POCs siguientes inmediatos (~12 features remaining: IVA books / payables / receivables / journal entries / fiscal periods / accounts / org settings / contacts / dispatches / shipments / wage / etc.) DEBE auditarse contra leak shape pre-merge. Strip atómico mismo edit que toque la route. Lección #14 runtime verify pre-cementación architecture.md aplicable cumulative arithmetic claims POC future closures (Suite/TSC/ESLint/file counts).

- **Complementa**: §3 (reglas duras) — convención HTTP-layer specific, no reemplaza R1-R9; §8 (anti-patrones) — leak abstracción audit en API surface.

---

## 21. Bugs latentes documentados defer POC futuro

Bugs estructurales detectados durante POC nuevo A3 doc-only post-mortem cumulative que NO bloquean POC entrega y se difieren a POC futuro dedicado. Documentation aquí preserva auditabilidad cross-feature paired pre-fix — auditable cualquier sub-fase futura via grep `§21.N`.

### 21.1. D5 PATCH/POST mismatch sale + purchase paired (defer POC futuro paridad fix)

Routes `/status` y client mutation handlers desacoplados — bug latente paired ambos features sale + purchase:

| Endpoint / Caller | Path | Línea | Método HTTP |
|---|---|---|---|
| Route handler sale | `app/api/organizations/[orgSlug]/sales/[saleId]/status/route.ts` | 10 | `POST` |
| Route handler purchase | `app/api/organizations/[orgSlug]/purchases/[purchaseId]/status/route.ts` | 15 | `POST` |
| Client caller sale `handlePost` | `components/sales/sale-form.tsx` | 344 | `PATCH` |
| Client caller sale `handleVoid` | `components/sales/sale-form.tsx` | 454 | `PATCH` |
| Client caller purchase `handlePost` | `components/purchases/purchase-form.tsx` | 564 | `PATCH` |
| Client caller purchase `handleVoid` | `components/purchases/purchase-form.tsx` | 590 | `PATCH` |

**Ground truth REST**: status transition (POSTED/VOIDED) es state mutation parcial — `PATCH` es semánticamente correcto cliente-side. Routes deben migrar a `export async function PATCH` (o aceptar ambos métodos si retro-compat necesaria).

**Cobertura runtime ZERO**: directorios `[saleId]/status/` y `[purchaseId]/status/` NO contienen `__tests__/` sibling — bug latente sin runtime test que detecte.

**Cross-ref**: §20.5 (mention parcial originada A3-D1) + engram `poc-futuro/d5-patch-post-mismatch-paridad-fix` (POC futuro candidate fix paridad ambos features sale + purchase paired — out-of-scope POC nuevo A3 entrega).
