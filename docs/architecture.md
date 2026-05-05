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

Protocolo cross-POC aplicable a TODAS las sub-fases paired RED+GREEN futuras — burden upstream agente conocedor target files, NO downstream verify post-execute. Lecciones #1-#9 cementadas durante POC siguiente A1+A2 (origen §13 emergentes recurrence 15 lettered G-U + 5 A1-C1 unlettered = 20 cumulative). Lecciones #10-#14 + #10-skippable sub-precedent cementadas durante POC nuevo dedicado A3 doc-only post-mortem A3-D1 (origen §13 emergentes cumulative cross-ciclos POC nuevo A3 — body canónico engrams `poc-nuevo/a3/c*/closed`; detail §19.6 status closure). Evidencias cumulative POC nuevo A4 (A4-C1+C2+C3+D1 — body canónico engrams `poc-nuevo/a4/c*/closed` + `poc-nuevo/a4/13.eta-mock-factory-load-bearing`; detail §19.7 status closure). Evidencias cumulative POC nuevo A5 (A5-C1+C2a+C2b+C2c+C3+D1 — body canónico engrams `poc-nuevo/a5/c*/closed` + `arch/§13/A5-{alpha,gamma,epsilon,zeta}` + `arch/lecciones/dispatches-hub-flake-recurrente`; detail §19.8 status closure). Evidencias cumulative POC paired payables↔receivables (C0+C1a+C1b-α+C3-C4+C5-C6+C7-pre+C7+C8 — body canónico engrams `paired/payables-receivables/c*/closed` + `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite` NEW classification 1ra evidencia formal cementación + `arch/§13/B-paired-dto-drop-axis-paired` NEW top-level letter sibling §13.A1...§13.A5; detail §19.9 status closure). Reverse delegation: agente surface emergente, Marco confirma timing — más §13 caught antes execute.

1. **Pre-recon profundo expand → architecture enforcement test runs**: cuando lock toca import paths cross-feature, agregar al pre-recon `feature-boundaries.test.ts` (REQ-FMB.4 + REQ-FMB.5) + `no-restricted-imports` ESLint rules + custom architecture invariants tests. Multi-axis NO single-axis grep.
2. **Lock regex/assertion requires target file read pre-RED**: agente DEBE leer target file completo + validar regex discrimina pre-state (RED falla correcto) vs target-state (GREEN pasa). Surface §13 emergente si discriminación falla — NO aceptar lock blind. Pattern stronger regex: binding capture + line-anchored.
3. **Runtime invariants verify pre-lock (~5s confirm)**: cuando lock incluye runtime semántica específica (Decimal.js, JSON serialization, hash, regex engine behavior), proponer + ejecutar runtime confirm rápido ANTES de cementar. Speculative locks rompen recurrentemente — runtime confirm temprano es ~5s vs hours re-trabajo follow-up.
4. **TDD paired discipline post-§13 emergente (NO inline update)**: cuando §13 emergente surface post-GREEN y requiere test/regex update, follow-up paired RED+GREEN sequential preserva atomic granularity bisect-friendly. Inline update rompe paired discipline. Mirror precedent A1-C1 follow-up `b86c26d` + A2-C1.5 follow-up.
5. **Shape tests prev sub-fase self-contained against future deletes**: pattern `expect(fs.existsSync(path)).toBe(false)` future-proof vs `fs.readFileSync(path)` fragile (ENOENT exception masks `not.toMatch` semantic). DROP/UPGRADE tests fragile mismo RED commit ANTES de proceder con deletion atomic batch — Marco override timing crítico (cambios shape pertenecen a RED, NO GREEN). Empirical validation §13.N A2-C3.
6. **Heuristic path discrimination requires lectura individual**: grep PROJECT-scope cuenta candidatos sin discriminar JSDoc references natural prose vs imports/instantiations reales. Pattern: grep `^import.*X\|new X\|from.*X` para discriminar binding actual vs JSDoc cosmetic. Lectura individual obligatoria pre-clasificación Cat A/B/C.
7. **Scope shrink in-flight via lectura individual obligatoria**: pre-recon expand cuenta candidatos via grep ≠ alcance final. Lectura individual cada candidato OBLIGATORIA para clasificar Cat A/B/C disposition surgical. Cost ~3 min lectura vs corrupción silent risk.
8. **Re-pre-recon independent cross-check próxima sesión sin engram persistido**: pre-recon expand vive en contexto prompt sesión actual, NO sustituye engram. Próxima sesión cold start DEBE re-pre-recon independent cross-check ANTES de opinar Q's pendientes. Burden upstream agente nuevo: re-verify scope independiente, NO blind accept context prompt.
9. **Burden upstream agente conocedor target files (meta-pattern)**: lecciones #2 + #5 + #6 + #7 share root: agente DEBE lectura individual archivos target pre-execute. Burden upstream NO downstream verify post-commit. Cheaper + bisect-friendlier. Empirical validation cumulative POC siguiente: 5 §13 emergentes Q-U surfaced TODOS pre-RED via lecciones #1-#8 application — cero §13 emergentes post-execute pre-recon A3.
10. **ESLint baseline impact verify pre-RED via dry-run mirror precedent target files contra contested rules**: agente DEBE ejecutar `npx eslint <target-file>` dry-run pre-RED contra rules contested (R5 banPrismaInPresentation + REQ-FMB.5 feature boundaries) cuando target file pattern compromete reglas. 28+ evidencias cumulative cross-POC (POC nuevo A3 13+ cross-ciclos A3-C1.5/C2/C3/C3.5/C4a/C4b/C5/C5.5/C4a.5/C4b.5/C6a/C6b/C6c + POC nuevo A4 3+ cross-ciclos A4-C1/A4-C2/A4-C3 + POC nuevo A5 5+ cross-ciclos A5-C1/A5-C2a/A5-C2b/A5-C2c/A5-C3 + POC paired payables↔receivables 7+ cross-ciclos C0/C1a/C1b-α/C3-C4/C5-C6/C7-pre/C7). **Sub-precedent #10-skippable**: dry-run pre-RED skippable cuando AMBAS condiciones cumplen — (a) target file pattern ESTRUCTURALMENTE PURO contra rules contested (`fs.existsSync` puro / `fs.readFileSync` source-string puro / JSDoc-only changes / markdown doc-only), (b) sibling tests precedent clean baseline cumulative cross-ciclos verified. Cuando AMBAS cumplen → SKIP válido (asymmetric cost-benefit ratio: skip cost 0 + skip risk 0 + dry-run cost ~2-5min). Cuando UNA falla → dry-run MANDATORY (mantiene main rule). 5 evidencias formales A3-C7 1ra + A3-C8 2da + A4-D1 3ra + A5-D1 4ta + POC paired C8 5ta PROACTIVE Marco Lock pre-RED (POC paired C8 doc-only architecture.md markdown puro estructuralmente puro vs rules contested + sibling baseline clean cumulative cross-ciclos POC paired C0+C1a+C1b-α+C3-C4+C5-C6+C7-pre+C7 verified ESLint 10e/13w preserved POC paired closure runtime verified).
11. **Pre-recon grep callers + mocks comprehensive cross-paths (`__tests__/` legacy + presentation mappers + mock factories)**: agente DEBE ejecutar grep PROJECT-scope cross-paths antes de RED scope final — incluir `app/(dashboard)/__tests__/`, `modules/{module}/presentation/mappers/__tests__/`, `features/{module}/__tests__/`, vi.mock factory declarations. Pattern matures reactive→proactive→PROACTIVE cumulative cross-ciclos POC nuevo A3 (A3-C3.5 reactive + A3-C4b reactive + A3-C5 proactive + A3-C5.5 PROACTIVE ZERO REACTIVE + A3-C4a.5 reactive scope expansion + A3-C4b.5 mock factory expansion + A3-C6a comprehensive). 11+ evidencias cumulative cross-POC (POC nuevo A3 8+ + POC nuevo A4-C1 PROACTIVE 1ra+ pre-recon comprehensive cross-paths PROJECT-scope 16 ubicaciones cross-categoría — Cat 1 6 app pages + 1 api route + Cat 2 4 page-rbac vi.mock factory + Cat 3 3 source cross-feature/cross-module + 2 paired tests + POC nuevo A5 Step 0 PROACTIVE expand pre-recon comprehensive paired sister `poc-nuevo/a5/pre-recon-comprehensive` #1579 + `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580 — 4 categorías cross-categoría cumulative drift correction Cat 4 listing 4→3 + §13.A5-ζ formal cementación PROACTIVE pre-RED classification by-target-type 5 evidencias cumulative cross-§13 same POC + POC paired payables↔receivables Step 0 PROACTIVE expand pre-recon comprehensive paired sister `paired/payables-receivables/pre-recon-comprehensive` #1612 — Cat 1 paired UI pages + API routes paired sister cxp+cxc 6 source + Cat 2 paired vi.mock factory paired 4 page-rbac + Cat 3 paired cross-feature/cross-module α/β/γ + paired test cascade + Cat 4 paired drop legacy POJO type defs + DTO divergence paired axis hex + barrel sub-imports residuales schemas zod cutover prerequisite + atomic delete paired sister wholesale).
12. **Cutover RED scope debe incluir runtime path coverage (status enums + null branches), NO solo `__tests__` paths o shape source**: cuando cutover toca caller que invoca mapper presentation o función con `throw on null`/runtime invariants, RED scope expansion DEBE cubrir status enum branches (DRAFT/POSTED/LOCKED/VOIDED) + null branches (sequenceNumber/optional fields). Runtime path coverage assertions — `expect(pageSource).toMatch(/sequenceNumber\s*(!==|===)\s*null/)` null guard ternary, `expect(pageSource).toMatch(/\$\{PREFIX\}-DRAFT/)` fallback template literal, `expect(pageSource).toMatch(/status\s*===\s*"DRAFT"/)` status enum branch. 6 evidencias formales cumulative cross-POC: POC nuevo A3 (RETROACTIVE A3-C4a.5+C4b.5 + PROACTIVE A3-C6a) + POC nuevo A4-C1 4ta PROACTIVE (.toSnapshot() runtime path coverage 30 assertions α RED scope expand pre-RED — adapter snapshot serialization + 0-args→factory composition root branches paired sister §13.A4-α DTO divergence entity vs snapshot + §13.A4-β callers no-args 9 cumulative) + POC nuevo A5-C1 5ta PROACTIVE (DTO divergence runtime path coverage 8 callsites Opción C 4 representative material 4× magnitud vs §13.A4-α paired sister §13.A5-γ formal cementación PROACTIVE pre-RED — `VoucherType` entity con VOs `code: VoucherTypeCode` + `prefix: VoucherTypePrefix` vs legacy `string` + `enum` divergence) + POC paired payables↔receivables C5-C6 6ta PROACTIVE (DTO divergence paired axis runtime path coverage 26 assertions α 13/13 per side RED scope expand pre-RED — drop legacy POJO `{X}WithContact` + Snapshot+Contact hex DTO `{X}SnapshotWithContact = {X}Snapshot & { contact: Contact }` composition shape replacement + bridge mapper simplification `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación post-cementación cumulative paired sister §13.B-paired NEW classification 'DTO drop axis paired'). Tendencia: PROACTIVE timing > RETROACTIVE paired follow-up (más eficiente, evita transient TSC, reduce granularity ciclos).
13. **Bookmark heredado próxima sesión NO sustituye verify precedent cross-feature/cross-ciclo paridad pre-lock (Step 0 PROACTIVE)**: cualquier sub-fase con bookmark heredado describiendo scope cross-feature paired (sale ↔ purchase / iva-books ↔ org-settings) requires Step 0 PROACTIVE expand pre-recon — verify precedent state real cross-feature/cross-ciclo paridad pre-lock. Bookmark heredado + Marco subdecisiones adelantadas son HYPOTHESIS NO TRUTH — NO blind accept eco mecánico. Operational checklist: identify precedent exhaustivamente + verify state real vs bookmark target + verify consumer behavior (`response.json()` body consumption real vs assumed) + cross-feature precedent check + surface honest divergencia + Marco re-lock antes RED. 6 evidencias formales PROACTIVE cumulative cross-POC: POC nuevo A3 (A3-C6c 1ra scope creep ~25 cambios mecánicos prevented + A3-C7 2da + A3-C8 3ra Marco Opción A1 razón corregida via Step 0 expand pre-recon) + POC nuevo A4-C1 4ta (Step 0 PROACTIVE expand pre-RED descubrió Cat 1/Cat 2 mock-source coupling estructural — bookmark Opción α' "5 ciclos preserved nominal" ilusión separation cuando vi.mock target = imported path → Path α'' merge atomic resolution superior §13.A4-η formal post-RED) + POC nuevo A5-C1 5ta (Step 0 PROACTIVE expand pre-recon comprehensive descubrió Cat 4 listing drift correction retroactivo 4→3 + §13.A5-ζ formal cementación PROACTIVE pre-RED classification by-target-type — bookmark heredado inferential vs entregado real 5 evidencias cumulative cross-§13 same POC matures via paired sister A5-C2a/A5-C2b/A5-C2c precedent EXACT) + POC paired payables↔receivables 6ta cumulative paired sister axis (Step 0 PROACTIVE expand pre-recon comprehensive paired sister cumulative cross-cycles C0-C7 descubrió 9 ciclos initial refined → 7 ciclos final con C7-pre split prerequisite §13.A5-ζ-prerequisite NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home + scope expand Opción B atomic c5-c6 cleanup superseded auto-declarado JSDoc origen — bookmark heredado paired sister inferential vs entregado real 7 ciclos refined granularity expandida natural §14 cumulative cross-POC).
14. **Cumulative arithmetic claims engram chain require runtime verify pre architecture.md cementación**: engram cumulative claim chains (Suite passed/failed counts, TSC baseline, ESLint counts, file counts) acumulan arithmetic errors progresivos cycle-by-cycle si cada delta NO se re-verifica runtime. Architecture.md cementación final POC requires runtime verify mandatory ANTES de cementar — `npx tsc --noEmit | grep "error TS" | wc -l` + `pnpm vitest run --reporter=dot` + `npx eslint .` runtime ground truth supersedes engram cumulative claim regardless threshold evidencias. Pattern reusable: cualquier doc-only post-mortem cumulative cementando métricas finales debe ejecutar 3 verificaciones runtime pre-edit. 6 evidencias formales paired sister cumulative cross-POC: POC nuevo A3 (§13.A3-C7-γ 1ra TSC drift 16→17 discovered A3-C7 GREEN runtime verify + §13.A3-C8-δ 2da Suite passed drift 5043→4942 = +101 discovered A3-D1 PROACTIVE Marco mandate runtime pre-cementación) + POC nuevo A4-D1 PROACTIVE pre-cementación 3ra paired sister (TSC 17 + ESLint 10e/13w + Suite 4998/6/2 runtime ground truth confirmed clean baseline preventive evidence — protocol forward-applicable cumulative arithmetic claims chain regardless drift discovery vs preventive verification outcome) + POC nuevo A4 §13.A4-γ engram-only Alt A drift textual §18.4 línea 787 4ta paired sister (cumulative drift docs beyond solo counts — textual line refs + scope shape descriptions) + POC nuevo A5-D1 PROACTIVE pre-cementación 5ta paired sister (TSC 17 + ESLint 10e/13w + Suite 5092/7/2 cumulative invariant 5101 preserved {7,8} margin §13.A3-D4-α 10na evidencia matures env-dependent toggle cumulative POC A5 — suite-full FAIL vs isolated 10/10 PASS divergence confirmed cross-cycle session 3 consecutive runs in-session stable + `feedback/diagnostic-stash-gate-pattern` 3ra evidencia cumulative POC A5 grep-evidence economic asymmetry refinement) + POC paired payables↔receivables C8 PROACTIVE pre-cementación 6ta paired sister (TSC 17 + ESLint 10e/13w + Suite 5199/7/2 cumulative invariant 5199 preserved {6,9} margin §13.A3-D4-α 17ª evidencia matures envelope expansion NEW flake source self-lock-integration emergent cumulative POC paired closure pre-cementación + bookmark accounting drift heredado pre-existing -2 detected real baseline 5191 vs declared 5193 — math verified post-cleanup 5199 = 5191 + 16 NEW C7 - 8 c5-c6 cleanup; NO cascade NEW POC paired causa + 9na evidencia diagnostic stash gate pattern matures cumulative cross-POC scope expand Opción B atomic single batch c5-c6 cleanup auto-declarado JSDoc origen + per-test FAIL/PASS ledger enumerated explicit cycle-start C8 § 19.9 ledger 7 fails enumerated lower-bound {7} margin §13.A3-D4-α 17ª envelope expansion). **Sub-finding forward-applicable cumulative POC A5 + POC paired**: bookmarks closure futuros lock enumerated baseline failure ledger explicit (NO solo count {N}/{M}/{S}) — cumulative invariant arithmetic preservation NO suficiente para diagnostic stash gate pattern functioning forward; per-test FAIL/PASS ledger enumerated requerido para identification deterministically toggle cross-session pre architecture.md cementación POC closure. Cementación PROACTIVE 1ra evidencia paired explicit Marco lock asymmetry cost-benefit POC A5-D1 (mirror lección #13 PROACTIVE pattern) + 2da evidencia POC paired C8 closure aplicación post-cementación (§19.9 ledger 7 fails enumerated explicit cycle-start C8 lower-bound {7} margin §13.A3-D4-α 17ª envelope expansion 6 baseline pre-existing + 1 dispatches-hub flake). Cross-ref MEMORY.md `feedback_textual_rule_verification` + `feedback_low_cost_verification_asymmetry` + `feedback_engram_textual_rule_verification` + `feedback_diagnostic_stash_gate_pattern` + `feedback_enumerated_baseline_failure_ledger`.

**Cross-ref engrams** (texto canónico cementado): `protocol/agent-lock-discipline` #1509 (lecciones #1-4 A2-C1) + `protocol/agent-lock-discipline/a2c2-additions` #1512 (lecciones #7-8 A2-C2 cumulative) + `protocol/agent-lock-discipline/a2c3-additions` #1515 (lección #5 A2-C3 empirical validation precedent + lección A6 #5 fs.existsSync future-proof vs fs.readFileSync fragile pattern matures forward-applicable cumulative cross-POC) + `arch/lecciones/leccion-12-runtime-path-coverage` #1542 (lección #12 PROACTIVE pattern matures cumulative POC nuevo A3 + 6ta evidencia POC paired C5-C6 paired sister §13.B-paired NEW classification 'DTO drop axis paired') + `arch/lecciones/leccion-13-bookmark-precedent-verification` #1546 (lección #13 PROACTIVE 1ra evidencia explicit Marco lock A3-C6c + 2da A3-C7 + 3ra A3-C8 + 4ta A4-C1 Path α'' merge + 5ta A5-C1 + 6ta POC paired cumulative paired sister axis cross-cycles C0-C7) + `arch/lecciones/leccion-10-eslint-dry-run-skippable` #1550 (lección #10 sub-precedent skippable PROACTIVE 1ra evidencia A3-C7 + 2da A3-C8 + 3ra A4-D1 + 4ta A5-D1 + 5ta POC paired C8 doc-only architecture.md markdown puro estructuralmente puro cumulative cross-ciclos C0-C7 verified) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 PROACTIVE 1ra evidencia paired §13.A3-C7-γ + §13.A3-C8-δ + 3ra paired sister A4-D1 PROACTIVE pre-cementación clean baseline preventive evidence + 5ta paired sister A5-D1 PROACTIVE pre-cementación cumulative invariant 5101 preserved {7,8} margin §13.A3-D4-α 10na evidencia matures + 6ta paired sister POC paired C8 PROACTIVE pre-cementación cumulative invariant 5199 preserved {6,9} margin §13.A3-D4-α 17ª evidencia matures envelope expansion NEW flake source self-lock-integration emergent + bookmark accounting drift heredado pre-existing -2 detected real baseline 5191 vs declared 5193) + `poc-nuevo/a4/13.eta-mock-factory-load-bearing` #1567 (§13.A4-η formal post-RED vi.mock factory load-bearing render path coverage NO orphan + §13.A4-γ candidate engram-only Alt A drift textual §18.4 línea 787 paired sister 4ta evidencia §14 + matures POC paired C3-C4 paired sister §13.A4-η vi.mock load-bearing render path coverage MATERIAL paired sister axis aplicación cumulative cross-POC) + `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 + paired sisters cumulative POC paired (11ma evidencia matures cumulative + 7ma aplicación post-cementación cumulative cross-POC paired sister sub-cycle C1a + C1b-α + C3-C4 + C5-C6 + C7-pre + C7) + `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 + paired sisters cumulative POC paired (Opción A bridge NEW pattern emergent C3-C4 + Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative C5-C6 paired sister §13.B-paired NEW classification) + `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (Option D-3 method-on-class final lock dynamic import bypass R2 + Parameters introspection bypass R5) + `arch/§13/A5-zeta-classification-by-target-type` #1598 + paired sister #1599 (5 evidencias classification by-target-type drift correction retroactivo cumulative POC A5 + 6ta evidencia POC paired C7 wholesale paired sister axis cumulative cross-POC) + `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite` #1629 (NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home POC paired C7-pre — distingue de §13.A5-ζ wholesale por barrel sub-imports vivos exigen Path C7-α split sub-cycle previo cutover residuos antes wholesale delete C7) + `arch/§13/B-paired-dto-drop-axis-paired` (NEW top-level letter sibling §13.A1...§13.A5 — 1ra evidencia POC paired C5-C6 emergent UNIQUE legacy A1+A2 pre-hex pattern + cementación canonical POC paired closure C8 + engram TBD post-commit save batch sequence) + `arch/lecciones/dispatches-hub-flake-recurrente` (10na evidencia matures cumulative POC A5 env-dependent toggle suite-full FAIL vs isolated PASS + 17ª evidencia matures cumulative POC paired envelope expansion {6,9} NEW flake source self-lock-integration emergent — engram TBD update post-commit save batch sequence) + `feedback/diagnostic-stash-gate-pattern` #1603 (3ra evidencia cumulative POC A5 grep-evidence economic asymmetry refinement + 9na evidencia matures cumulative POC paired closure scope expand Opción B atomic single batch c5-c6 cleanup auto-declarado JSDoc origen).

**Aplicabilidad**: cross-POC. POC nuevo dedicado A3 heredó lecciones #1-#9 starting state — pre-recon expand cumulative ciclos C1...C8 las aplicó (engram `poc-siguiente/a3/pre-recon-deferred-new-poc` heredado). POC nuevo dedicado A4 cleanup `features/org-settings/` heredó las 14 lecciones + #10-skippable starting state — pre-recon expand cumulative ciclos A4-C1+C2+C3 las aplicó (engram `poc-nuevo/a4/pre-recon-comprehensive` #1564 + paired sister `poc-futuro/a4-org-settings/pre-recon-comprehensive` #1565). POC nuevo dedicado A5 cleanup `features/voucher-types/` heredó las 14 lecciones + #10-skippable starting state — pre-recon expand cumulative ciclos A5-C1+C2a+C2b+C2c+C3 las aplicó (engrams `poc-nuevo/a5/pre-recon-comprehensive` #1579 + paired sister `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580). POC paired payables↔receivables cleanup paired sister axis `features/{payables,receivables}/` heredó las 14 lecciones + #10-skippable starting state — pre-recon expand cumulative ciclos C0+C1a+C1b-α+C3-C4+C5-C6+C7-pre+C7 las aplicó (engrams `paired/payables-receivables/pre-recon-comprehensive` #1612 + `paired/payables-receivables/step-0-closed` #1613). POC nuevo dedicado payment cleanup `features/payment/` load-bearing + cumulative cutover hex modules/payment/ presentation cross-feature/cross-module heredó las 14 lecciones + #10-skippable + 1 NEW formal canonical §13.A5-ζ-prerequisite + 1 NEW top-level letter §13.B-paired starting state — pre-recon expand cumulative ciclos C0-pre+C1+C2+C3+C4-α+C4-β las aplicó (engrams `poc-nuevo/payment/c*/closed` cumulative). POCs siguientes inmediatos (~7 features remaining post-payment: IVA books / journal entries / fiscal periods / accounts / contacts / dispatches / shipments / wage / etc.) heredarán las 14 lecciones + 1 sub-precedent starting state + 5 §13 emergentes formales canonical α/γ/ε/ζ + ζ-prerequisite + 1 NEW top-level letter §13.B-paired (DTO drop axis paired) cumulative cross-POC + 6 NEW formal canonical POC payment (R-name-collision + §13.A features-legacy-type-only-import + Adapter Layer presentation/ reader port composition-root chain + Reader port Snapshot LOCAL definition + makeXAdapter() factory naming + Opción α absorption cleanup superseded tests atomic) + 1 sub-pattern matures POC payment (mapper move presentation→infrastructure data-access concern 2da evidencia) + 1 evidencia recurrente §13.A3-D4-α 22ª matures envelope expansion {6,9} env-dependent toggle. Pattern matures: 9 → 14 cumulative cross-POC + evidence count expansion POC nuevo A4 + POC nuevo A5 sin cementar lecciones nuevas (POC nuevo A5 NO origina lecciones — expand contadores evidencias cumulative #10-#14 + sub-precedent + cementa 4 §13 emergentes formales canonical α/γ/ε/ζ + 1 evidencia recurrente §13.A3-D4-α 10na matures) + POC paired payables↔receivables sin cementar lecciones nuevas (POC paired NO origina lecciones — expand contadores evidencias cumulative #10-#14 + sub-precedent + cementa 1 §13 emergente formal canonical NEW classification §13.A5-ζ-prerequisite + 1 NEW top-level letter §13.B-paired sibling §13.A1...§13.A5 + matures cumulative cross-POC §13.A5-α 11ma + 7ma post-cementación + §13.A5-γ Opción A bridge NEW + Opción C 4ta aplicación + §13.A5-ζ wholesale 6ta + 1 evidencia recurrente §13.A3-D4-α 17ª matures envelope expansion) + POC nuevo dedicado payment sin cementar lecciones nuevas (POC payment NO origina lecciones — expand contadores evidencias cumulative #10-#14 + sub-precedent + cementa 6 §13 emergentes formales canonical NEW + 1 sub-pattern matures + matures cumulative cross-POC §13.A5-ε 3ra evidencia post-cementación canonical + 1 evidencia recurrente §13.A3-D4-α 22ª matures envelope expansion).

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
| **POC nuevo dedicado A5** (cleanup `features/voucher-types/` load-bearing + cumulative cutover hex modules/voucher-types/ presentation cross-feature/cross-module) | Bookmark scope engrams `poc-nuevo/a5/pre-recon-comprehensive` (#1579) + paired sister `poc-futuro/a5-voucher-types/pre-recon-comprehensive` (#1580) — Cat 1 (9 source pages/routes + 1 paired test) + Cat 2 (10 vi.mock factory paired) + Cat 3 (5 archivos cross-feature/cross-module α/β/γ + paired test cascade Issue #1) + Cat 4 (3 cross-module integration tests cleanup hex Shape α uniform — drift correction retroactivo 4→3 §13.A5-ζ formal pre-RED) + atomic delete `features/voucher-types/` wholesale (server.ts + index.ts + voucher-types.types.ts + rmdir auto-cleaned, sin __tests__/ collateral). Marco lock granularity Path α'' merge atomic Cat 1+Cat 2 single ciclo A5-C1 mirror A4-C1 precedent + 3 ciclos paired sister Cat 3 split A5-C2a/A5-C2b/A5-C2c (granularity expandida natural §14 5ta paired sister cumulative §13.A5-α/ε/ζ matures cross-§13 same POC). | 5 ciclos cumulative entregados (granularity natural §14 expandida cumulative — Path α'' merge atomic A5-C1 Cat 1+Cat 2 paired + paired sister Cat 3 split A5-C2a/C2b/C2c cross-feature/cross-module 5ta evidencia cumulative §13.A5-α/ε/ζ + atomic delete A5-C3 wholesale): A5-C1 atomic Cat 1+Cat 2 cutover hex pages/routes + 10 vi.mock factory paired (Path α'' merge §13.A5-γ formal cementación PROACTIVE pre-RED 8 callsites Opción C — commits `9a4c51b` RED 54 assertions α + `cfab7aa` GREEN 19 archivos / +117/-100 — 9 source pages/routes + 10 vi.mock factory paired) + A5-C2a atomic Cat 3 cross-feature cleanup hex 9 archivos (commits `b853164` RED 13 assertions α §13.A5-α formal cementación PROACTIVE pre-RED hex factory addition Option B Marco lock + `f1b9d9d` GREEN Path α'' merge §13.A5-α factory + §13.A5-ε method-on-class Option D-3 final lock dynamic import bypass R2 + Parameters introspection bypass R5) + A5-C2b atomic Cat 3 cross-module cleanup hex 5 archivos α/β/γ + paired test cascade Issue #1 (commits `d9e9517` RED 13 assertions α §13.A5-α 4ta evidencia + `14605bc` GREEN matures cumulative §13.A5-α factory cross-§13) + A5-C2c atomic Cat 4 cross-module integration tests cleanup hex 3 archivos uniform Shape α (commits `40cf286` RED 10 tests/13 assertions α §13.A5-ζ formal cementación PROACTIVE pre-RED 5ta evidencia paired sister A5-C2a/C2b precedent EXACT + `5b91a63` GREEN Path swap mecánico Shape α uniform 5ta evidencia matures classification by-target-type) + A5-C3 atomic delete `features/voucher-types/` wholesale (commits `47d7bfb` RED 5 assertions α 3 transition + 2 safety net per `feedback_red_acceptance_failure_mode` mirror A4-C3 EXACT estricto Opción B + `f9a1e06` GREEN 3 archivos + rmdir, simpler shape sin __tests__/ collateral) + A5-D1 doc-only post-mortem cementación cumulative architecture.md §18.4 fila A5 + §13.7 contadores expand 5 lecciones + §19.8 status closure (esta fila + §19.8) + §13.A5-α/γ/ε/ζ formal cementación canonical + §20.6 verify retroactivo + §13.A3-D4-α 10na evidencia matures cumulative POC A5. **Suite 5092/7/2 cumulative invariant 5101 preserved runtime verified cementación A5-D1** (delta +94 net cumulative POC nuevo A5 vs A4 closure 4998 — runtime ground truth confirmed cumulative invariant arithmetic preservation `passed+failed+skipped=5101` invariant {7,8} margin §13.A3-D4-α 10na evidencia env-dependent toggle 5ta paired sister A5-D1 lección #14 PROACTIVE pre-cementación). **TSC 17 baseline EXACT preserved** (NO regression POC nuevo A5 vs A4 closure 17). **ESLint 10e/13w preserved** (NO regression POC nuevo A5). **REQ-FMB.5 0 violations preserved**. **Test files 482/489 cumulative** (delta -2 passed vs A4 closure 484 — features/voucher-types/__tests__/ deletes offset por NEW shape tests cumulative POC A5 ciclos C1-C3). 10 commits cumulative pre-push + A5-D1 doc-only commit cumulative cierre A5 entero (defer push batch A5 closure mirror precedent A1+A2+A3+A4 EXACT). | Ninguno (POC entero CLOSED A5-D1 cementación) | A5 cleanup `features/voucher-types/` load-bearing fue entregado cumulative cutover hex modules/voucher-types/ presentation precondición — granularity expandida natural §14 (originalmente propuesta agente pre-recon ~5 ciclos α' → 5 ciclos final con granularity Cat 3 split paired sister §13.A5-α/ε/ζ matures cross-§13 same POC). Pre-recon expand cumulative aplicó lecciones #1-#14 + #10-skippable heredadas POC nuevo A4 starting state — POC nuevo A5 NO cementa lecciones nuevas, expand contadores evidencias cumulative #10-#14 + sub-precedent (§13.7) + cementa 4 §13 emergentes formales canonical α/γ/ε/ζ + 1 evidencia recurrente §13.A3-D4-α 10na matures. 4 §13 emergentes formales POC nuevo A5 cumulative: §13.A5-α multi-level composition-root delegation factory `makeVoucherTypeRepository` 5 evidencias cumulative cross-§13 same POC + §13.A5-γ DTO divergence runtime path coverage 8 callsites Opción C 4× magnitud vs §13.A4-α + §13.A5-ε method-on-class shim signature divergence Option D-3 final lock + §13.A5-ζ classification by-target-type drift correction retroactivo 5 evidencias cumulative cross-§13 same POC. §13.A3-D4-α 10na evidencia matures cumulative POC A5 — env-dependent toggle dispatches-hub flake suite-full FAIL vs isolated 10/10 PASS divergence confirmed cross-cycle session A5-D1 PROACTIVE pre-cementación 3 consecutive runs in-session stable. Pattern paired sister cumulative drift docs cumulative — 5 evidencias formales lección #14 (§13.A3-C7-γ + §13.A3-C8-δ + §13.A3-D3-α + §13.A4-γ + A5-D1 PROACTIVE pre-cementación). |
| **POC paired payables↔receivables** (cleanup `features/{payables,receivables}/` load-bearing + cumulative cutover hex modules/{payables,receivables}/ presentation cross-feature/cross-module paired sister axis) | Bookmark scope engrams `paired/payables-receivables/pre-recon-comprehensive` (#1612) + paired sister `paired/payables-receivables/step-0-closed` (#1613) — Cat 1 paired (UI pages + API routes paired sister cxp+cxc 6 source) + Cat 2 paired (vi.mock factory paired 4 page-rbac) + Cat 3 paired (cross-feature/cross-module α/β/γ + paired test cascade — boundary attachContact Option A push INTO infrastructure/contact-attacher.ts via composition-root.ts barrel chain) + Cat 4 paired (drop legacy POJO type defs + DTO divergence paired axis hex Snapshot+Contact composition shape replacement) + barrel sub-imports residuales schemas zod cutover prerequisite (4 símbolos per side post C0+C1a+C1b-α+C3-C4+C5-C6 cumulative absorbed) + atomic delete `features/{payables,receivables}/` wholesale paired sister (12 archivos paired 6 per side × 2 sides + 2 dir rmdir auto-cleaned). Marco lock granularity refined cycle-start preceding sesión pre-recon comprehensive 9 ciclos initial granularity propose → 7 ciclos final con C7-pre split prerequisite §13.A5-ζ-prerequisite NEW classification PROACTIVE pre-RED canonical home + scope expand Opción B atomic c5-c6 cleanup superseded auto-declarado JSDoc origen single batch. | 7 ciclos cumulative entregados (granularity natural §14 refined cumulative — 9 ciclos initial → 7 ciclos final con C7-pre split prerequisite + scope expand Opción B atomic c5-c6 cleanup superseded auto-declarado JSDoc): C0 dispatch receivables RESIDUAL cleanup §13.A5-ζ partial + §13.A5-α paired sister (commits `d6b9f4d` RED + `5f18aac` GREEN — 6 swaps mecánicos atomic single batch) + C1a Cat 3 cross-module §13.A5-α path swap (commits `5ca99cf` RED 10 assertions α + `47449d8` GREEN 6 swaps + 2 JSDoc revoke atomic single batch — paired sister sub-cycle 6ta evidencia matures Path α direct Option B inverso 2da aplicación post-cementación) + C1b-α boundary attachContact Option A push INTO infrastructure/contact-attacher.ts via composition-root.ts barrel chain (commits `ec83d7c` RED-α SUPERSEDING `ee87364` invariant collision elevation R5 8 assertions α + `89e6441` GREEN 8 archivos atomic single batch §13.A5-α 7ma evidencia + R4+R5 invariant honor + α-A3.B canonical exception path) + C3-C4 cutover paired UI pages + API routes hex (commits `a610ef6` RED 26 assertions α 13/13 per side + `2278b11` GREEN 10 archivos atomic single batch §13.A5-γ Opción A bridge NEW pattern emergent + §13.A4-η vi.mock load-bearing render path coverage MATERIAL + 8va evidencia §13.A5-α paired sister sub-cycle 4ta aplicación post-cementación cumulative) + C5-C6 drop legacy POJO type defs + DTO divergence paired axis hex (commits `d5e626e` RED 26 assertions α 13/13 per side + `235b4d1` GREEN 14 archivos atomic single batch §13.B-paired NEW classification 'DTO drop axis paired' emergent + Snapshot+Contact hex DTO + bridge mapper simplification `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación post-cementación cumulative + 9na evidencia §13.A5-α paired sister sub-cycle 5ta aplicación post-cementación cumulative + 17ª evidencia §13.A3-D4-α envelope expansion {6,9} NEW flake source self-lock-integration emergent + 7ma evidencia diagnostic stash gate cross-POC) + C7-pre barrel sub-import migration prerequisite cutover schemas zod + dead aspirational vi.mock cleanup (commits `179da6d` RED 16 assertions α 8/8 per side + `fbb66e3` GREEN 8 archivos atomic single batch §13.A5-ζ-prerequisite NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home + Option A DELETE dead setters cleanup mock hygiene per `feedback_aspirational_mock_signals_unimplemented_contract` + 10ma evidencia §13.A5-α paired sister sub-cycle 6ta aplicación post-cementación cumulative + 8va evidencia diagnostic stash gate cross-POC) + C7 atomic delete features/{payables,receivables}/ wholesale paired axis hex + cascade cleanup c5-c6 superseded paired axis (commits `b57bee5` RED 16 assertions α 8/8 per side + `60fa450` GREEN 12 archivos delete + 8 tests cleanup atomic single batch scope expand Opción B Marco lock confirmed pre-commit §13.A5-ζ wholesale 6ta evidencia matures cumulative paired sister 3rd wholesale precedent A4-C3 + A5-C3 + C7-paired Opción A stricto + 11ma evidencia §13.A5-α paired sister sub-cycle 7ma aplicación post-cementación cumulative + 9na evidencia diagnostic stash gate pattern matures cumulative cross-POC) + C8 doc-only post-mortem cementación cumulative architecture.md §18.4 fila POC paired (esta fila) + §13.7 contadores expand 5 lecciones + §19.9 status closure + §13.A5-α/γ/ζ-prerequisite formal cementación canonical matures + §13.B-paired NEW formal cementación canonical top-level letter sibling §13.A1...§13.A5 + §20.7 verify retroactivo. **Suite 5199/7/2 cumulative invariant 5199 preserved runtime verified cementación C8** (delta +98 net cumulative POC paired vs A5 closure 5101 — runtime ground truth confirmed cumulative invariant arithmetic preservation `passed+failed+skipped=5199` invariant {6,9} margin §13.A3-D4-α 17ª evidencia matures envelope expansion 5101→5199 trajectory 8 commits cumulative + scope expand Opción B atomic single batch c5-c6 cleanup auto-declarado JSDoc origen — lección #14 6ta paired sister C8 PROACTIVE pre-cementación). **TSC 17 baseline EXACT preserved** (NO regression POC paired vs A5 closure 17). **ESLint 10e/13w preserved** (NO regression POC paired). **REQ-FMB.5 0 violations preserved** (delta-POC paired 0 — verify §20.7 PROD app/ paths). **Test files 501 cumulative** (delta +12 vs A5 closure 489 — features/{payables,receivables}/__tests__/ deletes paired offset por NEW shape tests cumulative POC paired ciclos C0-C7 14 paired-pr.test.ts files 7 per side cumulative paired sister + 8 paired-pr collateral c5-c6 cleanup post C7 GREEN auto-declarado JSDoc origen). 15 commits cumulative pre-push + C8 doc-only commit cumulative cierre POC paired entero (defer push batch POC paired closure mirror precedent A1+A2+A3+A4+A5 EXACT cumulative push deferred al cierre POC entero — D8 push cumulative final 16 commits batch single). | Ninguno (POC paired entero CLOSED C8 cementación + D8 push closure 16 commits cumulative batch) | POC paired payables↔receivables cleanup `features/{payables,receivables}/` load-bearing fue entregado cumulative cutover hex modules/{payables,receivables}/ presentation cross-feature/cross-module paired sister axis precondición — granularity expandida natural §14 (9 ciclos initial refined → 7 ciclos final con C7-pre split prerequisite §13.A5-ζ-prerequisite NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home + scope expand Opción B atomic c5-c6 cleanup superseded). Pre-recon expand cumulative aplicó lecciones #1-#14 + #10-skippable heredadas POC nuevo A5 starting state — POC paired NO cementa lecciones nuevas, expand contadores evidencias cumulative #10-#14 + sub-precedent (§13.7) + cementa 1 §13 emergente formal canonical NEW classification §13.A5-ζ-prerequisite + 1 letter NEW top-level §13 sibling §13.A1...§13.A5 = §13.B-paired (DTO drop axis paired UNIQUE legacy A1+A2 pre-hex pattern) + matures cumulative cross-POC §13.A5-α paired sister sub-cycle 11ma evidencia + 7ma aplicación post-cementación + §13.A5-γ Opción A bridge NEW pattern emergent C3-C4 + Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative C5-C6 + §13.A5-ζ wholesale 6ta evidencia matures cumulative cross-track + 1 evidencia recurrente §13.A3-D4-α 17ª matures envelope expansion {6,9} NEW flake source self-lock-integration emergent. **5 §13 emergentes cumulative POC paired**: 1 NEW formal canonical (§13.A5-ζ-prerequisite barrel sub-import migration prerequisite to wholesale delete) + 1 NEW top-level letter (§13.B-paired DTO drop axis paired) + 3 matures (§13.A5-α + §13.A5-γ + §13.A5-ζ) + 1 recurrente matures (§13.A3-D4-α 17ª). Pattern paired sister cumulative drift docs cumulative — 6 evidencias formales lección #14 (§13.A3-C7-γ + §13.A3-C8-δ + §13.A3-D3-α + §13.A4-γ + A5-D1 + POC paired C8 PROACTIVE pre-cementación 6ta paired sister) + 9 evidencias diagnostic stash gate pattern cumulative cross-POC + 11ma evidencia §13.A5-α paired sister sub-cycle 7ma aplicación post-cementación cumulative cross-POC. |

| **POC nuevo dedicado payment** (cleanup `features/payment/` load-bearing + cumulative cutover hex modules/payment/ presentation cross-feature/cross-module) | Bookmark scope engrams `poc-nuevo/payment/c*/closed` cumulative + `arch/§13/r-name-collision-type-vs-value-shadowing` #1638 + `arch/§13/A-features-legacy-type-only-import` #1640 — 6 sub-cycles cumulative POC payment (C0-pre barrel sub-import migration prerequisite §13.A5-ζ-prerequisite 2da evidencia + C1 cross-feature/cross-module presentation cutover routes + pages + vi.mock + §13 R-name-collision NEW 1ra evidencia + C2 DTO mapper centralizado payment-with-relations Path γ §13.A NEW emergent 1ra + C3 drop type axis PaymentWithRelations + hex local DTO Path β-prod scope §13.A 2da + C4-α Adapter Layer presentation/ reader port composition-root chain α-A3.B EXACT mirror 2da evidencia post C1b-α paired-pr 1ra + C4-β wholesale delete features/payment/* atomic + cross-feature TYPE swap LOCAL DTO Path a §13.A WHOLESALE RESOLUCIÓN cumulative + Opción α absorption Test 14 c4-α 3ra evidencia). Marco lock granularity refined cycle-start preceding sesión pre-recon comprehensive 6 ciclos initial granularity propose verified clean cumulative. | 6 ciclos cumulative entregados (granularity natural §14 cumulative — 6 ciclos refined granularity preserved): C0-pre barrel sub-import migration prerequisite cutover schemas zod (commits `7f61154` RED + `8102acb` GREEN — 6 archivos atomic single batch §13.A5-ζ-prerequisite NEW classification 2da evidencia matures cumulative cross-POC post-cementación canonical 1ra paired-pr C7-pre `b57bee5` precedent + 12ma evidencia §13.A5-α multi-level composition delegation cumulative) + C1 cross-feature/cross-module presentation cutover routes + pages + vi.mock targets PaymentService + PaymentRepository hex barrel single feature axis (commits `1f27120` RED 14 assertions α + `a14505d` GREEN 11 archivos atomic single batch §13.A5-α 13ma evidencia matures cumulative + §13.A5-ε method-on-class shim signature divergence drop alias 2da evidencia matures cumulative post-cementación canonical + §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL Opción A re-export class identity preserved + §13 R-name-collision NEW invariant collision category 1ra evidencia formal cementación target D1 doc-only) + C2 DTO mapper centralizado payment-with-relations extraction Path γ scope mapper extraction only NO drop type axis defer C3 (commits `6c35779` RED 13 assertions α + `0c79740` GREEN 2 archivos atomic single batch §13.A NEW emergent classification "hex presentation TYPE-only import desde legacy features/" 1ra evidencia formal cementación target D1 + §13.A5-γ DTO divergence runtime path coverage 5ta aplicación matures cumulative + lección REFINED feedback/step-0-expand-eslint-restricted-imports-grep 8th axis cross-module type-only import direction hex→legacy features) + C3 drop type axis PaymentWithRelations + hex local DTO canonical home Path β-prod scope mirror A3-C3 sale-with-details EXACT precedent (commits `5d2aa20` RED 15 assertions α + `f93dbd4` GREEN 7 archivos atomic single batch §13.A NEW emergent classification 2da evidencia formal post-cementación canonical PROACTIVE pre-D1 + §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures cumulative + lección REFINED feedback/red-regex-discipline NEW canonical home) + C4-α Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B paired C1b-α `89e6441` precedent (commits `f606863` RED 14 assertions α + `fcfc7e1` GREEN 14 archivos atomic single batch §13.A5-α multi-level composition delegation NEW evidencia matures + §13.A5-ε signature divergence drop alias 3ra evidencia post-cementación canonical applied + §13 NEW classification "Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B" 1ra evidencia POC payment cumulative 2da evidencia post paired C1b-α canonical PROACTIVE pre-D1 + 2 invariant collisions retroactive resolution Path C + Opción α + cascade superseded absorption + Snapshot LOCAL inline def mirror iva-books precedent EXACT cumulative cross-module 7 reader ports + makePaymentServiceAdapter naming convention NEW canonical + JSDoc atomic revoke + Opción α absorption 2da evidencia matures cross-POC) + C4-β wholesale delete features/payment/* atomic + cross-feature TYPE swap consumers via LOCAL DTO presentation/dto/ canonical home Path a (commits `3bc8fec` RED 12 assertions α + `b1cd3a5` GREEN 11 archivos atomic single batch §13.A5-ε signature divergence MATERIAL 3ra evidencia post-cementación canonical mirror PaymentWithRelations C3 EXACT + §13 R-name-collision RESOLVES double pair CreatePaymentInput/CreatePaymentServiceInput vía namespace path + §13.A WHOLESALE RESOLUCIÓN cumulative drops cross-module type-only import vector entire 1ra C2 + 2da C3 + 3ra C4-α evidencias resueltas wholesale + Opción α absorption Test 14 c4-α legacy shim cascade superseded 3ra evidencia matures cross-POC mirror paired C7 Opción B + C4-α GREEN EXACT cumulative + diagnostic stash gate 11ma evidencia anticipated bookmark accuracy MATERIAL) + D1 doc-only post-mortem cementación cumulative architecture.md §18.4 fila POC payment (esta fila) + §13.7 contadores expand 5 lecciones + §19.10 status closure + 6 NEW formal cementación canonical §13 + 1 sub-pattern matures + §13.A5-ε 3ra evidencia matures + §13.A3-D4-α 22ª evidencia counter + §20.8 verify retroactivo + sub-finding NEW WithCorrelation envelope passthrough emergente + §21.2 defer placeholder POC futuro paridad fix payment routes raw entity preservation. **Suite 5242/6/2 cumulative invariant 5242 preserved runtime verified cementación D1** (delta +43 net cumulative POC payment vs POC paired closure 5199 — runtime ground truth confirmed cumulative invariant arithmetic preservation `passed+failed+skipped=5242` invariant {6,9} margin §13.A3-D4-α 22ª evidencia matures envelope expansion env-dependent toggle within margin per `arch/lecciones/dispatches-hub-flake-recurrente`). **TSC 17 baseline EXACT preserved** (NO regression POC payment vs POC paired closure 17). **ESLint 10e/13w preserved** (NO regression POC payment). **REQ-FMB.5 0 violations preserved** (delta-POC payment 0 — verify §20.8 PROD app/ paths §20.1 EXACT regex grep 0 hits cumple + sub-finding NEW WithCorrelation envelope passthrough pre-existing legacy shim defer §21.2). 12 commits cumulative pre-push + D1 doc-only commit cumulative cierre POC payment entero (defer push batch POC payment closure mirror precedent A1+A2+A3+A4+A5+POC paired EXACT cumulative push deferred al cierre POC entero — push cumulative final 13 commits batch single). | Ninguno (POC payment entero CLOSED D1 cementación + push closure 13 commits cumulative batch) | POC nuevo dedicado payment cleanup `features/payment/` load-bearing fue entregado cumulative cutover hex modules/payment/ presentation cross-feature/cross-module precondición — granularity natural §14 6 ciclos refined preserved cumulative. Pre-recon expand cumulative aplicó lecciones #1-#14 + #10-skippable heredadas POC paired starting state + 1 NEW formal canonical §13.A5-ζ-prerequisite + 1 NEW top-level letter §13.B-paired heredadas POC paired — POC payment NO cementa lecciones nuevas, expand contadores evidencias cumulative #10-#14 + sub-precedent (§13.7) + cementa 6 §13 emergentes formales canonical NEW (R-name-collision + §13.A features-legacy-type-only-import + Adapter Layer presentation/ reader port composition-root chain α-A3.B EXACT + Reader port Snapshot LOCAL definition + makeXAdapter() factory naming + Opción α absorption cleanup superseded tests atomic) + 1 sub-pattern matures (§13 mapper move presentation→infrastructure data-access concern 2da evidencia) + matures cumulative cross-POC §13.A5-α 13ma evidencia + §13.A5-ε signature divergence drop alias 3ra evidencia post-cementación canonical + §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL Opción A re-export class identity preserved + 1 evidencia recurrente §13.A3-D4-α 22ª matures envelope expansion {6,9} env-dependent toggle. **9 §13 emergentes cumulative POC payment**: 6 NEW formal canonical + 1 sub-pattern matures + 2 matures cumulative cross-POC (§13.A5-ε 3ra + §13.A4-η post C4-α) + 1 recurrente matures (§13.A3-D4-α 22ª). Pattern paired sister cumulative drift docs cumulative — 7 evidencias formales lección #14 (§13.A3-C7-γ + §13.A3-C8-δ + §13.A3-D3-α + §13.A4-γ + A5-D1 + POC paired C8 PROACTIVE pre-cementación 6ta paired sister + POC payment D1 PROACTIVE pre-cementación 7ma paired sister 12ma evidencia paired sister cumulative cross-POC) + 11 evidencias diagnostic stash gate pattern cumulative cross-POC + 13ma evidencia §13.A5-α paired sister sub-cycle 8va aplicación post-cementación cumulative cross-POC. **Sub-finding NEW emergente cementación target D1** (§20.8 NEW + §21.2 NEW): WithCorrelation envelope passthrough pre-existing legacy shim pattern 4 routes (POST + PATCH x2 + PUT) — POC payment cycles preserved legacy contract via Adapter C4-α NO new leak introduced; §20.1 EXACT regex pattern cumple ✅ (0 hits literal `{ ...x, correlationId }` spread route handler), strict spirit §20 incluye envelope passthrough (lección REFINED feedback/§20-strict-spirit-vs-regex-literal NEW canonical home — verificación PROACTIVE pre-D1 MANDATORY future POCs cuando service retorna WithCorrelation envelope shape) — defer §21.2 POC futuro paridad fix payment routes raw entity preservation simétrico al precedent A3 sale + paired payable EXACT (`Response.json(rawEntity)`). Mirror precedent A3 D5 PATCH/POST mismatch defer NEW POC dedicated. |

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

### 19.8. Status closure POC nuevo dedicado A5

POC nuevo dedicado A5 "cleanup `features/voucher-types/` load-bearing + cumulative cutover hex modules/voucher-types/ presentation cross-feature/cross-module" entregó cleanup atomic Path α'' merge — A5-C1 atomic Cat 1+Cat 2 cutover hex pages/routes + 10 vi.mock factory paired (Path α'' merge §13.A5-γ formal cementación PROACTIVE pre-RED — commits `9a4c51b` RED 54 assertions α + `cfab7aa` GREEN 19 archivos / +117/-100 — 9 source pages/routes + 10 vi.mock factory paired) + A5-C2a atomic Cat 3 cross-feature cleanup hex 9 archivos (commits `b853164` RED 13 assertions α §13.A5-α formal cementación PROACTIVE pre-RED hex factory addition + `f1b9d9d` GREEN Path α'' merge §13.A5-α factory + §13.A5-ε method-on-class Option D-3 final lock) + A5-C2b atomic Cat 3 cross-module cleanup hex 5 archivos α/β/γ + paired test cascade Issue #1 (commits `d9e9517` RED 13 assertions α §13.A5-α 4ta evidencia + `14605bc` GREEN matures cumulative) + A5-C2c atomic Cat 4 cross-module integration tests cleanup hex 3 archivos uniform Shape α (commits `40cf286` RED 10 tests/13 assertions α §13.A5-ζ formal cementación PROACTIVE pre-RED 5ta evidencia paired sister + `5b91a63` GREEN Shape α uniform) + A5-C3 atomic delete `features/voucher-types/` wholesale (commits `47d7bfb` RED 5 assertions α 3 transition + 2 safety net mirror A4-C3 EXACT estricto Opción B + `f9a1e06` GREEN 3 archivos + rmdir, sin __tests__/ collateral). 10 commits cumulative pre-push + A5-D1 doc-only commit cumulative cierre A5 entero (defer push batch A5 closure mirror precedent A1+A2+A3+A4 EXACT cumulative push deferred al cierre POC entero).

**Métricas finales POC nuevo A5** (runtime verified A5-D1 PROACTIVE pre-cementación per lección #14 5ta paired sister): **Suite 5092/7/2 cumulative invariant 5101 preserved** (delta +94 net cumulative POC nuevo A5 vs A4 closure 4998 — runtime ground truth confirmed cumulative invariant arithmetic preservation {7,8} margin §13.A3-D4-α 10na evidencia env-dependent toggle within margin per `arch/lecciones/dispatches-hub-flake-recurrente`). **TSC 17 baseline EXACT preserved** (NO regression POC nuevo A5 vs A4 closure 17). **ESLint 10e/13w preserved** (NO regression POC nuevo A5). **REQ-FMB.5 0 violations preserved**. **Test files 482/489 cumulative** (delta -2 passed vs A4 closure 484 — features/voucher-types/__tests__/ deletes offset por NEW shape tests cumulative POC A5 ciclos C1-C3). Cumulative arithmetic invariant 5092+7+2=5101 holds.

**§13.A5-α — multi-level composition-root delegation factory `makeVoucherTypeRepository` formal cementación canonical** (5 evidencias cumulative cross-§13 same POC A5-C1+C2a+C2b+C2c+C3): durante POC nuevo A5 cleanup voucher-types hex cumulative ciclos paired sister, factory `makeVoucherTypeRepository(prisma)` resolution Option B Marco lock pre-RED A5-C2a — composition root delega VoucherTypeRepository instantiation cross-feature/cross-module callsites uniform multi-level (page composition root + service composition root + integration test factory). Pattern matures cumulative cross-§13 same POC: A5-C1 1ra Cat 1+Cat 2 cutover (Path α'' merge atomic) + A5-C2a 2da Cat 3 cross-feature factory addition Option B + A5-C2b 3ra Cat 3 cross-module 5 archivos α/β/γ + paired test cascade Issue #1 + A5-C2c 4ta Cat 4 cross-module integration tests Shape α uniform + A5-C3 5ta atomic delete preserva factory canonical multi-level. Cross-evidence analytics: 5 evidencias cumulative same POC matures pattern beyond single-cycle hypothesis — primera cementación canonical multi-level composition-root delegation cumulative cross-§13 paired sister §13.A4-η post-RED precedent. Body canónico engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 + paired sisters cumulative (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-γ — DTO divergence runtime path coverage 8 callsites formal cementación canonical (paired sister §13.A4-α 4× magnitud vs precedent)**: durante Step 0 PROACTIVE pre-RED A5-C1 descubrió DTO divergence runtime path coverage 8 callsites Opción C 4 representative patterns cumulative — hex `service.list/getByCode/create/update` returns `VoucherType` entity con VOs (`code: VoucherTypeCode` + `prefix: VoucherTypePrefix`); legacy callsites (9 source pages/routes) retornan `string` + `enum` directo. 4× magnitud vs §13.A4-α precedent (§13.A4-α 2 callsites snapshot serialization). Pattern matures: cualquier hex aggregate con VO encapsulation produces DTO divergence cuando expone via API — runtime path coverage RED scope expand pre-RED Opción C representative patterns OBLIGATORIO 4× magnitud cumulative beyond .toSnapshot() simple precedent A4. Body canónico engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-ε — method-on-class shim signature divergence Option D-3 trajectory final formal cementación canonical**: durante POC nuevo A5-C2a Cat 3 cross-feature cleanup descubrió method-level signature divergence con embedded shim logic — hex `service.list()` no-args vs legacy `service.list({orgId, ...filters})` object-DI positional. Trajectory exploration: D-1 explicit shim function rejected (extra surface) + D-2 inline rewrite rejected (compromise R2/R5) + D-3 method-on-class final Marco lock (dynamic import bypass R2 + `Parameters<typeof service.list>` introspection bypass R5 — preserves hex aggregate factory) + paired test cascade Issue #1 fix integration test absorbed atomic GREEN. Pattern reusable: cualquier hex method exposing positional vs object-DI signature divergence requires Option D-3 method-on-class trajectory pre-RED para preserve aggregate boundary + factory composition root canonical. Body canónico engram `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-ζ — classification by-target-type drift correction retroactivo formal cementación canonical** (5 evidencias cumulative cross-§13 same POC A5-C1+C2a+C2b+C2c+C3): durante Step 0 PROACTIVE expand pre-recon comprehensive A5-C1 descubrió Cat 4 listing drift correction retroactivo 4→3 — pre-recon paired test cascade detection debe clasificar por TIPO source/unit-test/integration-test/mock-declaration NO solo por PATH. Marco lock Option 1 pre-RED A5-C2c — drift correction cumulative cross-cycle 5 evidencias matures: A5-C1 1ra discovery Cat 4 listing 4→3 + A5-C2a 2da Cat 3 source classification + A5-C2b 3ra Cat 3 paired test cascade fix Issue #1 + A5-C2c 4ta Cat 4 integration tests Shape α uniform + A5-C3 5ta atomic delete simpler shape. Pattern reusable: cualquier pre-recon comprehensive paired test cascade detection requires classification by-target-type EXACT (source/unit-test/integration-test/mock-declaration) drift correction retroactivo cumulative cross-cycle si bookmark heredado inferential vs entregado real. Body canónico engram `arch/§13/A5-zeta-classification-by-target-type` #1598 + paired sister #1599 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A3-D4-α — dispatches-hub flake env-dependent toggle 10na evidencia matures cumulative POC A5** (heredada §13 emergente POC nuevo A3 sub-fase D4 push closure): durante A5-D1 PROACTIVE pre-cementación runtime verify (lección #14 5ta paired sister), suite-full reporta `dispatches-hub/route.test.ts > GET 200 con { items, total }` FAIL timeout 5000ms; mismo test isolated returns 10/10 PASS 1369ms 3.6× margen sobrante. Discriminator key: env-dependent CPU contention paralelo otros tests empuja latencia >5000ms suite-full vs sub-2s isolated CPU libre. Pattern matures cross-cycle session 3 consecutive runs in-session stable {7,8} margin per `arch/lecciones/dispatches-hub-flake-recurrente`. Resolution: NO drift material from POC A5 deletes (REQ-FMB.4 grep ZERO menciones voucher-types confirms heredado pre-A5 + cumulative invariant 5101 preserved arithmetic). 10na evidencia env-dependent toggle confirmed cross-cycle — engram pattern catalog update post-commit save batch sequence. Body canónico engram `arch/lecciones/dispatches-hub-flake-recurrente` (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 emergentes cumulative POC nuevo A5** — 4 emergentes formales canonical (α multi-level composition-root delegation factory + γ DTO divergence runtime path coverage 8 callsites Opción C 4× magnitud + ε method-on-class shim signature divergence Option D-3 final + ζ classification by-target-type drift correction retroactivo 5 evidencias) + 1 evidencia recurrente §13.A3-D4-α 10na matures cumulative POC A5. Body canónico vive en engrams — architecture.md preserva summary + cross-ref pattern §19.5 + §19.6 + §19.7 precedent.

**Lecciones operacionales agent-lock-discipline cumulative**: **14 cementadas + 1 sub-precedent** preserved POC nuevo A5 (NO origin lecciones nuevas — POC nuevo A5 expand contadores evidencias cumulative #10-#14 + sub-precedent — ver §13.7). Pattern matures: 9 (POC siguiente A1+A2) → 14 (POC nuevo A3 doc-only A3-D1) → 14 + evidence count expansion (POC nuevo A4 doc-only A4-D1) → 14 + further expansion + 4 §13 emergentes formales canonical α/γ/ε/ζ + 1 evidencia recurrente §13.A3-D4-α 10na (POC nuevo A5 doc-only A5-D1).

**Cross-ref engrams POC nuevo A5 closure**: `poc-nuevo/a5/c3/closed` #1606 (A5-C3 atomic delete features/voucher-types wholesale + bookmark cycle-start A5-D1 + 15 file+assumption pairs Step 0 checklist) + `poc-nuevo/a5/c2c/closed` #1602 (A5-C2c atomic Cat 4 integration tests cleanup hex Shape α uniform 5ta evidencia §13.A5-ζ matures) + `poc-nuevo/a5/c2b/closed` #1596 (A5-C2b atomic Cat 3 cross-module cleanup hex α/β/γ + paired test cascade Issue #1 4ta evidencia §13.A5-α matures) + `poc-nuevo/a5/c2a/closed` #1591 (A5-C2a atomic Cat 3 cross-feature cleanup hex Path α'' merge §13.A5-α factory + §13.A5-ε method-on-class Option D-3) + `poc-nuevo/a5/c1/closed` #1585 (A5-C1 atomic Cat 1+Cat 2 cutover voucher-types hex Path α'' merge mirror A4-C1 EXACT shape scaled 4× DTO divergence callsites material §13.A5-γ) + `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 + paired sisters cumulative (5 evidencias cumulative cross-§13 same POC) + `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 (DTO divergence 8 callsites Opción C 4× magnitud) + `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (Option D-3 method-on-class final lock) + `arch/§13/A5-zeta-classification-by-target-type` #1598 + paired sister #1599 (5 evidencias classification by-target-type drift correction retroactivo) + `arch/lecciones/dispatches-hub-flake-recurrente` (10na evidencia matures cumulative POC A5 env-dependent toggle — engram TBD update post-commit save batch sequence) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 5ta paired sister A5-D1 PROACTIVE pre-cementación cumulative invariant 5101 preserved {7,8} margin clean baseline preventive evidence) + `feedback/diagnostic-stash-gate-pattern` #1603 (3ra evidencia cumulative POC A5 grep-evidence economic asymmetry refinement) + `poc-nuevo/a5/pre-recon-comprehensive` #1579 + paired sister `poc-futuro/a5-voucher-types/pre-recon-comprehensive` #1580 (4 categorías cross-categoría cumulative drift correction Cat 4 listing 4→3 + §13.A5-ζ formal cementación PROACTIVE pre-RED).

### 19.9. Status closure POC paired payables↔receivables

POC paired payables↔receivables "cleanup `features/{payables,receivables}/` load-bearing + cumulative cutover hex modules/{payables,receivables}/ presentation cross-feature/cross-module paired sister axis" entregó cleanup paired sister cumulative — C0 dispatch receivables RESIDUAL cleanup §13.A5-ζ partial + §13.A5-α paired sister (commits `d6b9f4d` RED + `5f18aac` GREEN — 6 swaps mecánicos atomic single batch) + C1a Cat 3 cross-module §13.A5-α path swap (commits `5ca99cf` RED 10 assertions α + `47449d8` GREEN 6 swaps + 2 JSDoc revoke atomic single batch — paired sister sub-cycle 6ta evidencia matures Path α direct Option B inverso 2da aplicación post-cementación) + C1b-α boundary attachContact Option A push INTO infrastructure/contact-attacher.ts via composition-root.ts barrel chain (commits `ec83d7c` RED-α SUPERSEDING `ee87364` invariant collision elevation R5 8 assertions α + `89e6441` GREEN 8 archivos atomic single batch §13.A5-α 7ma evidencia + R4+R5 invariant honor + α-A3.B canonical exception path) + C3-C4 cutover paired UI pages + API routes hex (commits `a610ef6` RED 26 assertions α 13/13 per side + `2278b11` GREEN 10 archivos atomic single batch §13.A5-γ Opción A bridge NEW pattern emergent + §13.A4-η vi.mock load-bearing render path coverage MATERIAL + 8va evidencia §13.A5-α paired sister sub-cycle 4ta aplicación post-cementación cumulative) + C5-C6 drop legacy POJO type defs + DTO divergence paired axis hex (commits `d5e626e` RED 26 assertions α 13/13 per side + `235b4d1` GREEN 14 archivos atomic single batch §13.B-paired NEW classification 'DTO drop axis paired' emergent + Snapshot+Contact hex DTO + bridge mapper simplification `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación post-cementación cumulative + 9na evidencia §13.A5-α paired sister sub-cycle 5ta aplicación post-cementación cumulative + 17ª evidencia §13.A3-D4-α envelope expansion {6,9} NEW flake source self-lock-integration emergent + 7ma evidencia diagnostic stash gate cross-POC) + C7-pre barrel sub-import migration prerequisite cutover schemas zod + dead aspirational vi.mock cleanup (commits `179da6d` RED 16 assertions α 8/8 per side + `fbb66e3` GREEN 8 archivos atomic single batch §13.A5-ζ-prerequisite NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home + Option A DELETE dead setters cleanup mock hygiene per `feedback_aspirational_mock_signals_unimplemented_contract` + 10ma evidencia §13.A5-α paired sister sub-cycle 6ta aplicación post-cementación cumulative + 8va evidencia diagnostic stash gate cross-POC) + C7 atomic delete features/{payables,receivables}/ wholesale paired axis hex + cascade cleanup c5-c6 superseded paired axis (commits `b57bee5` RED 16 assertions α 8/8 per side + `60fa450` GREEN 12 archivos delete + 8 tests cleanup atomic single batch scope expand Opción B Marco lock confirmed pre-commit §13.A5-ζ wholesale 6ta evidencia matures cumulative paired sister 3rd wholesale precedent A4-C3 + A5-C3 + C7-paired Opción A stricto + 11ma evidencia §13.A5-α paired sister sub-cycle 7ma aplicación post-cementación cumulative + 9na evidencia diagnostic stash gate pattern matures cumulative cross-POC). 15 commits cumulative pre-push + C8 doc-only commit cumulative cierre POC paired entero (defer push batch POC paired closure mirror precedent A1+A2+A3+A4+A5 EXACT cumulative push deferred al cierre POC entero — D8 push cumulative final 16 commits batch single).

**Métricas finales POC paired** (runtime verified C8 PROACTIVE pre-cementación per lección #14 6ta paired sister): **Suite 5199/7/2 cumulative invariant 5199 preserved** (delta +98 net cumulative POC paired vs A5 closure 5101 — runtime ground truth confirmed cumulative invariant arithmetic preservation `passed+failed+skipped=5199` invariant {6,9} margin §13.A3-D4-α 17ª evidencia matures envelope expansion NEW flake source self-lock-integration emergent within margin per `arch/lecciones/dispatches-hub-flake-recurrente`). **TSC 17 baseline EXACT preserved** (NO regression POC paired vs A5 closure 17). **ESLint 10e/13w preserved** (NO regression POC paired). **REQ-FMB.5 0 violations preserved**. **Test files 501 cumulative** (delta +12 vs A5 closure 489 — features/{payables,receivables}/__tests__/ deletes paired offset por NEW shape tests cumulative POC paired ciclos C0-C7 14 paired-pr.test.ts files 7 per side cumulative paired sister + 8 paired-pr collateral c5-c6 cleanup post C7 GREEN auto-declarado JSDoc origen). Cumulative arithmetic invariant 5190+7+2=5199 holds.

**Ledger enumerated baseline failure POC paired closure C8 cumulative invariant 5199** (per `feedback_enumerated_baseline_failure_ledger` MANDATORY — sub-finding A5-D1 forward-applicable cementado): 7 fails enumerated explicit cycle-start C8 lower-bound {7} margin §13.A3-D4-α 17ª evidencia envelope expansion {6,9} cumulative POC paired closure pre-cementación:

  - BASELINE PRE-EXISTING (always present runs cumulative cross-POC):
    1. `components/settings/__tests__/matrix-warnings.test.tsx > "(e) warning container yellow/amber"`
    2. `components/accounting/__tests__/journal-entry-form-date-period.test.tsx > "JF-T01 periodId auto-set OPEN mount"`
    3. `components/accounting/__tests__/journal-entry-form-date-period.test.tsx > "JF-T02 changing date May auto-sets"`
    4. `__tests__/feature-boundaries.test.ts:330 > "production code deep-import features' internals"` (heredado margin envelope)
    5. `app/api/organizations/__tests__/route.test.ts > "PR8.1 (a) createMany 5 system roles"`
    6. `app/api/organizations/__tests__/route.test.ts > "PR8.1 (c) createMany DB org id"`
  - FLAKE RECURRENTE §13.A3-D4-α envelope {6,9} 17ª evidencia matures cumulative cross-cycles 11ª-17ª = 7 evidencias post-bookmark D8 cementación target margin envelope expansion NEW flake source emergent:
    7. `dispatches-hub/route.test.ts > "GET /api/organizations/[orgSlug]/dispatches-hub > retorna 200 con { items, total } para un rol válido"` (5000ms timeout) — fired suite full canonical run 1 ✓
  - Run 1 = 7 fails (lower bound {7}) — within {6,9} envelope honored cumulative POC paired closure pre-cementación

**§13.A5-α — multi-level composition-root delegation factory matures paired sister cross-§13 cross-POC cumulative** (11ma evidencia matures cumulative + 7ma aplicación post-cementación cumulative cross-POC paired): durante POC paired payables↔receivables cleanup paired sister cumulative ciclos C1a + C1b-α + C3-C4 + C5-C6 + C7-pre + C7, factory `make{Payables,Receivables}Service()` resolution Path α'' merge atomic Cat 1+Cat 2 paired sister cumulative — composition root delega {Payables,Receivables}Service instantiation cross-feature/cross-module callsites uniform multi-level paired (page composition root + service composition root + integration test factory + bridge `attachContact[s]` Promise<{X}SnapshotWithContact> contract evolves). Pattern matures cross-POC cumulative beyond single-POC hypothesis: 5 evidencias POC nuevo A5 (cementación canonical formal) + 6 evidencias POC paired sister sub-cycle (6ta C1a + 7ma C1b-α + 8va C3-C4 + 9na C5-C6 + 10ma C7-pre + 11ma C7) cumulative cross-§13 cross-POC = 11ma evidencia matures cumulative + 7ma aplicación post-cementación cumulative cross-POC. Cross-evidence analytics: paired sister sub-cycle pattern matures cumulative cross-POC validates canonical multi-level composition-root delegation pattern beyond single-POC same-§13 hypothesis. Body canónico engram `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 + paired sisters cumulative POC paired (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-γ — DTO divergence runtime path coverage matures Opción A bridge NEW pattern emergent + Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative POC paired** (paired sister §13.A5-γ canonical refresh post-cementación cumulative cross-POC): durante POC paired payables↔receivables cumulative ciclos C3-C4 + C5-C6, dos sub-patrones DTO divergence emergentes paired sister §13.A5-γ canonical:

  - **Opción A bridge NEW pattern emergent C3-C4** (paired sister cutover UI pages + API routes hex cxp+cxc): bridge `attachContact[s]` Promise<{X}SnapshotWithContact> contract evolves a hex DTO Snapshot+Contact composition shape — `attachContact(snapshot)` Path α direct entity → snapshot mapping bridge function NEW pattern emergent paired sister Opción C `.toSnapshot()` precedent A5-C1 cumulative — cuando POC bundle multiple Path α direct mappings cross-callsites paired sister axis (cxp + cxc), bridge function named `attachContact[s]` consolida paths comunes Path α direct entity-snapshot composition shape preserve hex aggregate factory composition root canonical.
  - **Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative C5-C6** (paired sister drop legacy POJO type defs + DTO divergence paired axis hex): bridge mapper simplification `.toSnapshot()` Path α direct entity → snapshot mapping drop `Prisma.Decimal` reconstruction overhead mapper interno simplifica — Snapshot exits infrastructure/, Contact attached at boundary R5 honored type-only Prisma at presentation hex barrel. Mirror Opción C precedent A5-C1 4ta aplicación post-cementación cumulative paired sister axis drops POJO `{X}WithContact` features types + NEW hex DTO `{X}SnapshotWithContact = {X}Snapshot & { contact: Contact }` composition shape Snapshot+Contact replacement.

Pattern matures: DTO divergence runtime path coverage 8 callsites POC nuevo A5 (formal cementación canonical) + Opción A bridge NEW pattern emergent C3-C4 paired + Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative C5-C6 paired = 3 sub-patterns cumulative cross-POC matures formal canonical paired sister §13.A5-γ. Body canónico engram `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 + paired sisters cumulative POC paired (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-ζ-prerequisite — barrel sub-import migration prerequisite to wholesale delete formal cementación canonical NEW classification** (1ra evidencia POC paired payables↔receivables C7-pre emergent — distingue de §13.A5-ζ wholesale): durante POC paired C7-pre, descubrió barrel sub-imports vivos productivos (schemas zod 4 símbolos per side residuales post C0+C1a+C1b-α+C3-C4+C5-C6 cumulative absorbed) exigen sub-cycle previo cutover cutover residuos barrel **antes** del wholesale delete C7 (mirror A4-C3 + A5-C3 atomic Opción B EXACT cuando barrel ya migrado precondición). Distinción §13.A5-ζ wholesale (single atomic delete ciclo Opción B EXACT) vs §13.A5-ζ-prerequisite (sub-cycle C7-pre cutover + sub-cycle C7 wholesale split):

  - **Trigger discriminator**: barrel sub-imports vivos pre-classification Path α split MANDATORY pre-RED expand classification 5-axis → §13.A5-ζ-prerequisite Path C7-α split sub-cycle previo C7-pre cutover + sub-cycle final C7 wholesale per Opción B EXACT
  - **Granularity expansion natural §14**: sub-cycle C7-pre cutover residuos absorbed BEFORE wholesale delete C7 — preserve precedent A4-C3 + A5-C3 mirror estricto cuando aplicable + expand granularity cuando residuos exigen cutover previo
  - **Cementación timing**: PROACTIVE pre-RED canonical home save b57bee5 batch (mirror §13.A5-ζ #1599 timing precedent A5-C2c) — paired sister POC-context inmutable + textual rule verification pre-RED requirement satisfied
  - **Dead aspirational vi.mock cleanup**: Option A DELETE entirely (NO swap path defensivo) per `feedback_aspirational_mock_signals_unimplemented_contract` paired sister POC paired emergent

Pattern reusable forward-applicable: cualquier wholesale delete `features/{X}/` candidato POC futuro (post cumulative cutover Cx hex paired sister axis) DEBE Step 0 cycle-start cold C7 expand PROJECT-scope grep classification 5-axis MANDATORY — si CONSUMER count > 0 (barrel sub-imports vivos productivos), Path C7-α split MANDATORY §13.A5-ζ-prerequisite cementación PROACTIVE pre-RED C7-pre (NO C7); si CONSUMER count == 0, atomic delete wholesale single ciclo Opción B EXACT §13.A5-ζ wholesale clasificación clásica. Body canónico engram `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite` #1629 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.B-paired — DTO drop axis paired formal cementación canonical NEW top-level letter sibling §13.A1...§13.A5** (1ra evidencia POC paired payables↔receivables C5-C6 emergent — UNIQUE legacy A1+A2 pre-hex pattern): durante POC paired C5-C6 cleanup paired sister axis, descubrió DTO drop axis paired pattern UNIQUE legacy A1+A2 pre-hex — sale/purchase precedent NO existe (verified grep PROJECT-scope `SaleWithContact`/`PurchaseWithContact` NO existen). NEW top-level §13 letter B-paired sibling §13.A1...§13.A5 canoniza POC paired payables↔receivables como POC entero distinto de §13.A series (POCs por feature) — forward cross-POC futuro paired POCs (e.g. payables↔receivables-style paired sister axis) heredan letter consistency cross-POC.

  - **POJO Prisma DTO drop pattern**: drop `{X}WithContact = AccountsX & { contact: Contact }` POJO Prisma con `amount/paid/balance: Prisma.Decimal` + bridge mapper interno reconstructs Decimal at infrastructure/ honor R5 (post-C1b-α canonical R4 exception path)
  - **NEW hex DTO Snapshot+Contact composition shape replacement**: `{X}SnapshotWithContact = {X}Snapshot & { contact: Contact }` exported desde `modules/{X}/presentation/server.ts` (entity Snapshot intersection Contact composition shape) con `amount/paid/balance: number` (entity Snapshot shape NO Decimal)
  - **Bridge contract evolution**: `attachContact[s]` returns `Promise<{X}SnapshotWithContact>` (drop Decimal reconstruction overhead mapper interno simplifica `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación post-cementación cumulative)
  - **Components consume hex Snapshot**: `Number(p.amount)` keeps working (number → number identity vs string → number coercion previa via JSON.stringify Decimal-to-string serialization wire contract preserved)
  - **R5 honored cumulative**: `import type { Contact }` from prisma at presentation layer (allowTypeImports), infrastructure mapper drops Prisma runtime imports keeping hex-pure to domain entity

Forward-applicable cross-POC futuro: cualquier feature legacy con Prisma POJO DTO + contact join shape → §13.B-paired drop POJO + Snapshot+Contact hex DTO replacement pattern aplica. Letter top-level sibling §13.A1...§13.A5 reserved para POCs paired axis NEW classification cumulative cross-POC futuro. Body canónico engram `paired/payables-receivables/c5-c6-closed` #1624 + `arch/§13/B-paired-dto-drop-axis-paired` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A3-D4-α — dispatches-hub flake env-dependent toggle 17ª evidencia matures cumulative POC paired envelope expansion {6,9}** (heredada §13 emergente POC nuevo A3 sub-fase D4 push closure — matures cumulative cross-POC paired): durante C8 PROACTIVE pre-cementación runtime verify (lección #14 6ta paired sister), suite-full reporta `dispatches-hub/route.test.ts > GET 200 con { items, total }` FAIL timeout 5000ms (fired suite full canonical run 1 ✓ within {6,9} envelope honored cumulative POC paired closure pre-cementación). Pattern matures cross-cycle session cumulative {6,9} margin envelope expansion 17ª evidencia matures POC paired closure — heredado cumulative cross-POC 11ª-17ª = 7 evidencias post-bookmark D8 cementación target margin envelope expansion NEW flake source self-lock-integration emergent C5-C6 paired closure verify (margin upper-bound {9} expansion cross-cycle session post-GREEN suite full re-run 2 fresh re-run verify enumeration). Discriminator key: env-dependent CPU contention paralelo otros tests empuja latencia >5000ms suite-full vs sub-2s isolated CPU libre. Resolution: NO drift material from POC paired deletes (REQ-FMB.4 grep ZERO menciones payables/receivables confirms heredado pre-paired + cumulative invariant 5199 preserved arithmetic). 17ª evidencia env-dependent toggle confirmed cross-cycle — engram pattern catalog update post-commit save batch sequence. Body canónico engram `arch/lecciones/dispatches-hub-flake-recurrente` (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 emergentes cumulative POC paired** — 1 NEW formal canonical (§13.A5-ζ-prerequisite barrel sub-import migration prerequisite to wholesale delete) + 1 NEW top-level letter (§13.B-paired DTO drop axis paired) + 3 matures cumulative cross-POC (§13.A5-α paired sister sub-cycle 11ma evidencia + 7ma aplicación post-cementación cumulative + §13.A5-γ Opción A bridge NEW pattern emergent + Opción C `.toSnapshot()` 4ta aplicación + §13.A5-ζ wholesale 6ta evidencia matures cumulative paired sister 3rd wholesale precedent A4-C3 + A5-C3 + C7-paired) + 1 evidencia recurrente §13.A3-D4-α 17ª matures envelope expansion {6,9} NEW flake source self-lock-integration emergent. Body canónico vive en engrams — architecture.md preserva summary + cross-ref pattern §19.5 + §19.6 + §19.7 + §19.8 precedent.

**Lecciones operacionales agent-lock-discipline cumulative**: **14 cementadas + 1 sub-precedent** preserved POC paired (NO origin lecciones nuevas — POC paired expand contadores evidencias cumulative #10-#14 + sub-precedent — ver §13.7). Pattern matures: 9 (POC siguiente A1+A2) → 14 (POC nuevo A3 doc-only A3-D1) → 14 + evidence count expansion (POC nuevo A4 doc-only A4-D1) → 14 + further expansion + 4 §13 emergentes formales canonical α/γ/ε/ζ + 1 evidencia recurrente §13.A3-D4-α 10na (POC nuevo A5 doc-only A5-D1) → 14 + further cumulative expansion + 1 NEW formal canonical §13.A5-ζ-prerequisite + 1 NEW top-level letter §13.B-paired + 3 matures cumulative cross-POC §13.A5-α/γ/ζ + 1 evidencia recurrente §13.A3-D4-α 17ª matures envelope expansion (POC paired doc-only C8). 9na evidencia diagnostic stash gate pattern matures cumulative cross-POC + 11ma evidencia §13.A5-α paired sister sub-cycle 7ma aplicación post-cementación cumulative cross-POC.

**Cross-ref engrams POC paired closure**: `paired/payables-receivables/c7-closed` #1630 (C7 atomic delete features/{payables,receivables}/ wholesale + cascade cleanup c5-c6 superseded scope expand Opción B atomic + 9na evidencia diagnostic stash gate + 11ma evidencia §13.A5-α paired sister sub-cycle 7ma aplicación post-cementación) + `paired/payables-receivables/c7-pre-closed` (C7-pre barrel sub-import migration prerequisite cutover schemas zod + dead aspirational vi.mock cleanup §13.A5-ζ-prerequisite NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home) + `paired/payables-receivables/c5-c6-closed` #1624 (C5-C6 drop legacy POJO type defs + DTO divergence paired axis hex §13.B-paired NEW classification 'DTO drop axis paired' emergent + Snapshot+Contact hex DTO + bridge mapper simplification `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación + 9na evidencia §13.A5-α + 17ª evidencia §13.A3-D4-α envelope expansion + 7ma evidencia diagnostic stash gate cross-POC) + `paired/payables-receivables/c3-c4-closed` #1622 (C3-C4 cutover paired UI pages + API routes hex §13.A5-γ Opción A bridge NEW pattern emergent + §13.A4-η vi.mock load-bearing render path coverage MATERIAL + 8va evidencia §13.A5-α paired sister sub-cycle 4ta aplicación post-cementación) + `paired/payables-receivables/c1b-alpha-closed` #1620 (C1b-α boundary attachContact Option A push INTO infrastructure/contact-attacher.ts via composition-root.ts barrel chain + 2 invariant collisions resolved + α-A3.B canonical R4 exception path heredado + 14ª evidencia §13.A3-D4-α 7ma evidencia §13.A5-α paired sister sub-cycle) + `paired/payables-receivables/c1a-closed` #1617 (C1a Cat 3 cross-module §13.A5-α path swap 6ta evidencia matures Path α direct Option B inverso 2da aplicación post-cementación) + `paired/payables-receivables/c0-closed` #1615 (C0 dispatch receivables RESIDUAL cleanup §13.A5-ζ partial + §13.A5-α paired sister) + `paired/payables-receivables/step-0-closed` #1613 (Step 0 cycle-start cold pre-recon comprehensive 4 Marco locks + 9 ciclos refined granularity propose) + `paired/payables-receivables/pre-recon-comprehensive` #1612 (5-axis classification + §13.A5 patterns aplicabilidad verify + emergentes detection + Marco lock 4 decisiones final + 9 ciclos refined granularity propose) + `arch/§13/A5-zeta-prerequisite-barrel-sub-import-migration-prerequisite` #1629 (NEW classification 1ra evidencia formal cementación PROACTIVE pre-RED canonical home) + `arch/§13/B-paired-dto-drop-axis-paired` (NEW top-level letter sibling §13.A1...§13.A5 — engram TBD post-commit save batch sequence) + `arch/§13/A5-alpha-multi-level-composition-root-delegation` #1587 + paired sisters cumulative POC paired (11ma evidencia matures cumulative + 7ma aplicación post-cementación cumulative cross-POC) + `arch/§13/A5-gamma-dto-divergence-runtime-path-coverage` #1582 + paired sisters cumulative POC paired (Opción A bridge NEW pattern + Opción C `.toSnapshot()` 4ta aplicación post-cementación cumulative) + `arch/lecciones/dispatches-hub-flake-recurrente` (17ª evidencia matures cumulative POC paired envelope expansion {6,9} NEW flake source self-lock-integration emergent — engram TBD update post-commit save batch sequence) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 6ta paired sister C8 PROACTIVE pre-cementación cumulative invariant 5199 preserved {6,9} margin clean baseline preventive evidence) + `feedback/diagnostic-stash-gate-pattern` #1603 (9na evidencia matures cumulative cross-POC paired grep-evidence economic asymmetry refinement + auto-declarado JSDoc origen scope expand Opción B atomic single batch).

### 19.10. Status closure POC nuevo dedicado payment

POC nuevo dedicado payment "cleanup `features/payment/` load-bearing + cumulative cutover hex modules/payment/ presentation cross-feature/cross-module" entregó cleanup payment cumulative — C0-pre barrel sub-import migration prerequisite cutover schemas zod (commits `7f61154` RED + `8102acb` GREEN — 6 archivos atomic single batch §13.A5-ζ-prerequisite NEW classification 2da evidencia matures cumulative cross-POC post-cementación canonical 1ra paired-pr C7-pre `b57bee5` precedent + 12ma evidencia §13.A5-α multi-level composition delegation cumulative) + C1 cross-feature/cross-module presentation cutover routes + pages + vi.mock targets PaymentService + PaymentRepository hex barrel single feature axis (commits `1f27120` RED 14 assertions α + `a14505d` GREEN 11 archivos atomic single batch §13.A5-α 13ma evidencia matures cumulative + §13.A5-ε method-on-class shim signature divergence drop alias 2da evidencia matures cumulative post-cementación canonical + §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL Opción A re-export class identity preserved + §13 R-name-collision NEW invariant collision category 1ra evidencia formal cementación target D1 doc-only) + C2 DTO mapper centralizado payment-with-relations extraction Path γ scope (commits `6c35779` RED 13 assertions α + `0c79740` GREEN 2 archivos atomic single batch §13.A NEW emergent classification "hex presentation TYPE-only import desde legacy features/" 1ra evidencia formal cementación target D1 + §13.A5-γ DTO divergence runtime path coverage 5ta aplicación matures cumulative + lección REFINED feedback/step-0-expand-eslint-restricted-imports-grep 8th axis cross-module type-only import direction hex→legacy features) + C3 drop type axis PaymentWithRelations + hex local DTO canonical home Path β-prod scope mirror A3-C3 sale-with-details EXACT precedent (commits `5d2aa20` RED 15 assertions α + `f93dbd4` GREEN 7 archivos atomic single batch §13.A 2da evidencia formal post-cementación canonical PROACTIVE pre-D1 + §13.A5-γ DTO divergence runtime path coverage 6ta aplicación matures cumulative + lección REFINED feedback/red-regex-discipline NEW canonical home) + C4-α Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B paired C1b-α `89e6441` precedent (commits `f606863` RED 14 assertions α + `fcfc7e1` GREEN 14 archivos atomic single batch §13.A5-α multi-level composition delegation NEW evidencia matures + §13.A5-ε signature divergence drop alias 3ra evidencia post-cementación canonical applied + §13 NEW classification "Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B" 1ra evidencia POC payment cumulative 2da evidencia post paired C1b-α canonical PROACTIVE pre-D1 + 2 invariant collisions retroactive resolution Path C + Opción α + cascade superseded absorption + Snapshot LOCAL inline def mirror iva-books precedent EXACT cumulative cross-module 7 reader ports + makePaymentServiceAdapter naming convention NEW canonical + JSDoc atomic revoke + Opción α absorption 2da evidencia matures cross-POC) + C4-β wholesale delete features/payment/* atomic + cross-feature TYPE swap consumers via LOCAL DTO presentation/dto/ canonical home Path a (commits `3bc8fec` RED 12 assertions α + `b1cd3a5` GREEN 11 archivos atomic single batch §13.A5-ε signature divergence MATERIAL 3ra evidencia post-cementación canonical mirror PaymentWithRelations C3 EXACT + §13 R-name-collision RESOLVES double pair CreatePaymentInput/CreatePaymentServiceInput vía namespace path + §13.A WHOLESALE RESOLUCIÓN cumulative drops cross-module type-only import vector entire 1ra C2 + 2da C3 + 3ra C4-α evidencias resueltas wholesale + Opción α absorption Test 14 c4-α legacy shim cascade superseded 3ra evidencia matures cross-POC mirror paired C7 Opción B + C4-α GREEN EXACT cumulative + diagnostic stash gate 11ma evidencia anticipated bookmark accuracy MATERIAL). 12 commits cumulative pre-push + D1 doc-only commit cumulative cierre POC payment entero (defer push batch POC payment closure mirror precedent A1+A2+A3+A4+A5+POC paired EXACT cumulative push deferred al cierre POC entero — push cumulative final 13 commits batch single).

**Métricas finales POC nuevo dedicado payment** (runtime verified D1 PROACTIVE pre-cementación per lección #14 12ma paired sister): **Suite 5242/6/2 cumulative invariant 5242 preserved** (delta +43 net cumulative POC payment vs POC paired closure 5199 — runtime ground truth confirmed cumulative invariant arithmetic preservation `passed+failed+skipped=5242` invariant {6,9} margin §13.A3-D4-α 22ª evidencia matures envelope expansion env-dependent toggle within margin per `arch/lecciones/dispatches-hub-flake-recurrente`). **TSC 17 baseline EXACT preserved** (NO regression POC payment vs POC paired closure 17). **ESLint 10e/13w preserved** (NO regression POC payment). **REQ-FMB.5 0 violations preserved** (delta-POC payment 0 — §20.8 PROD app/ paths §20.1 EXACT regex grep 0 hits cumple + sub-finding NEW WithCorrelation envelope passthrough pre-existing legacy shim defer §21.2). Cumulative arithmetic invariant 5234+6+2=5242 holds.

**Ledger enumerated baseline failure POC nuevo payment closure D1 cumulative invariant 5242** (per `feedback_enumerated_baseline_failure_ledger` MANDATORY — sub-finding A5-D1 forward-applicable cementado): 6-7 fails enumerated explicit cycle-start D1 lower-bound {6} margin §13.A3-D4-α 22ª evidencia envelope expansion {6,9} cumulative POC payment closure pre-cementación:

  - BASELINE PRE-EXISTING (always present runs cumulative cross-POC):
    1. `components/settings/__tests__/matrix-warnings.test.tsx > "(e) warning container yellow/amber"`
    2. `components/accounting/__tests__/journal-entry-form-date-period.test.tsx > "JF-T01 periodId auto-set OPEN mount"`
    3. `components/accounting/__tests__/journal-entry-form-date-period.test.tsx > "JF-T02 changing date May auto-sets"`
    4. `__tests__/feature-boundaries.test.ts:330 > "production code deep-import features' internals"` (heredado margin envelope)
    5. `app/api/organizations/__tests__/route.test.ts > "PR8.1 (a) createMany 5 system roles"`
    6. `app/api/organizations/__tests__/route.test.ts > "PR8.1 (c) createMany DB org id"`
  - FLAKE RECURRENTE §13.A3-D4-α envelope {6,9} 22ª evidencia matures cumulative cross-cycles 18ª-22ª = 5 evidencias post-bookmark POC paired D8 cementación target margin envelope expansion env-dependent toggle:
    7. `dispatches-hub/route.test.ts > "GET /api/organizations/[orgSlug]/dispatches-hub > retorna 200 con { items, total } para un rol válido"` (5000ms timeout) — env-dependent toggle suite-full FAIL vs isolated PASS divergence cross-cycle session
  - Run 1 D1 PROACTIVE pre-cementación = 6 fails (lower bound {6} sin FLAKE) — within {6,9} envelope honored cumulative POC payment closure pre-cementación
  - Run 2 post-GREEN diagnostic stash gate PROACTIVE = 7 fails (FLAKE triggered) — within {6,9} envelope honored

**§13 R-name-collision-type-vs-value-shadowing — NEW invariant collision category formal cementación canonical** (1ra evidencia POC payment C1 emergent — distinguishes R4/R5 ESLint enforced vs R-circular module resolution): durante POC payment C1, hex barrel re-exporta TYPE port AND Opción A re-export VALUE class same name → TS namespace shadowing TYPE-vs-VALUE re-export ambiguity emergent (TS2300 Duplicate identifier + TS2693 cascade type-vs-value at consumer). Resolution Opción α drop TYPE port del barrel re-export RECOMMENDED cuando consumer scope verified == 0 (single-line edit absorbed mismo GREEN batch — class identity preserved Marco lock Opción A EXACT). Distinción canonical §13 invariant collision categories: R4/R5 ESLint enforced + R-circular module resolution + R-name-collision NEW. C4-β resolution adicional via Path a LOCAL DTO presentation/dto/ canonical home unified UI/API-facing input cluster RESOLVES double pair CreatePaymentInput/CreatePaymentServiceInput distinct shapes vía namespace path. Pre-RED Step 0 expand 7th axis CR-name-collision namespace TYPE-vs-VALUE check MANDATORY pre-Marco lock cutover decision hex barrel re-export. Body canónico engram `arch/§13/r-name-collision-type-vs-value-shadowing` #1638 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A — features-legacy-type-only-import — NEW emergent classification formal cementación canonical** (3 evidencias C2 + C3 + C4-α RESOLVED wholesale C4-β): durante POC payment C2 + C3 + C4-α, hex presentation/ TYPE-only import desde legacy features/ emerge intermediate state (cross-module type-only import vector — R-features-legacy-type-import allowed temporal pre-wholesale-delete). 1ra evidencia C2 (`mapper.ts` Opción γ Path γ NO-OP transitorio + DTO mapper centralizado payment-with-relations extraction) + 2da evidencia C3 (Path β-prod scope drop type axis PaymentWithRelations + hex local DTO canonical home presentation/dto/payment-with-relations.ts mirror A3-C3 sale-with-details EXACT precedent + Opción A NEW §13.A NO-OP transitorio resolved) + 3ra evidencia C4-α (Adapter Layer cross-module type-only import legacy CreatePaymentInput/UpdatePaymentInput/PaymentFilters/AllocationInput/CreditAllocationSource intermediate state pre-wholesale). C4-β WHOLESALE RESOLUCIÓN cumulative drops vector entire — 3 evidencias resueltas wholesale via wholesale delete features/payment/* atomic + cross-feature TYPE swap LOCAL DTO presentation/dto/payment-input-types.ts Path a canonical home + hex barrel `./server` for PaymentFilters + CreditAllocationSource. Forward-applicable cross-POC futuro: si emerge cross-module type-only import legacy hex→features residual, classification §13.A NEW canonical home invariant collision elevation MANDATORY + Step 0 expand 8th axis cross-module type-only import direction hex→legacy features grep PROJECT-scope MANDATORY pre-Marco lock cutover decisions futuras. Body canónico engram `arch/§13/A-features-legacy-type-only-import` #1640 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 — Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B — NEW formal cementación canonical** (2da evidencia POC payment C4-α post paired C1b-α `89e6441` 1ra precedent EXACT): durante POC payment C4-α, presentation Adapter Layer delegating via reader port (DI inyectado from composition-root chain) + composition-root.ts canonical R4 exception path (only legitimate cross-layer presentation→infrastructure import, gated por canonical R4 exception). Pattern preserves legacy shim contract (envelope DTO `PaymentWithRelations` + zero-arg construct + args reorder + `WithCorrelation<...>` wrapping) sin violar R5 banPrismaInPresentation (reader port DI carries infra-side Prisma access via composition-root chain). Distinción canonical: Adapter Layer presentation/ ≠ inner application service hex naming. Forward-applicable cross-POC futuro: cualquier feature legacy con shim contract preservation requirement post-cutover hex hereda este pattern canonical 2da evidencia post C1b-α paired-pr 1ra precedent EXACT mirror. Body canónico engram `arch/§13/adapter-layer-presentation-reader-port-composition-root-chain` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 — Reader port domain-internal Snapshot type LOCAL definition pattern (mirror iva-books precedent EXACT cumulative cross-module 7 reader ports) — NEW formal cementación canonical** (1ra evidencia POC payment C4-α): durante POC payment C4-α invariant collision Path C resolution Collision #1 (R1 violation reader port — port file domain/ports/ importaba PaymentWithRelations type from presentation/dto/ — banDomainCrossLayer NO allowTypeImports carve-out), resolution Path C define Snapshot type LOCALLY inline en port file mirror SaleSnapshot sale-reader.port.ts:17-28 precedent EXACT cumulative cross-module 7 reader ports (sale-reader + iva-books readers + sale/purchase org-settings + iva-book readers). Distinción explícita "Snapshot domain-internal port boundary projection type" (domain/ports/) vs "presentation/dto/ UI envelope DTO" — distinct concerns NO conflated cumulative cross-modules. NO crear domain/dto/ NEW directory (Path A original rejected post-verify ground truth — premise verification MANDATORY pre-canonical claim NEW lección codificada feedback/premise-verification-canonical-claim NEW canonical home). Forward-applicable cross-POC futuro: cuando reader port retorna envelope shape + R1 ban domain → presentation type imports, define Snapshot type LOCALLY inline en port file. Body canónico engram `arch/§13/reader-port-domain-internal-snapshot-local-pattern` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 — makeXAdapter() factory naming convention — NEW formal cementación canonical** (forward-applicable cross-POC factory naming): durante POC payment C4-α, makePaymentServiceAdapter() factory naming convention NEW canonical (Marco lock Finding 2 retroactive) — singular UpperCase explicit "Adapter" suffix. Distingue clean del inner application service hex naming (makePaymentsService plural). §13 R-name-collision sub-finding cumulative — distinct names compiler-safe + human-reader explicit. Forward-applicable cross-POC futuro: makeXAdapter() factory wraps inner makeXService() via composition-root chain (X Adapter Layer presentation/ delegate via reader port + composition-root chain canonical R4 exception path EXACT mirror α-A3.B). Body canónico engram `arch/§13/make-x-adapter-naming-convention` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 — Sub-pattern mapper move presentation→infrastructure data-access concern matures 2da evidencia post-cementación canonical** (1ra A5-C2c precedent paired-pr + 2da POC payment C4-α): durante POC payment C4-α invariant collision retroactive resolution chain, mapper extraction (paymentInclude Prisma include shape + toPaymentWithRelations row→DTO transformer) move desde presentation/mappers/ hacia infrastructure/mappers/ — conceptualmente data-access concern, infrastructure layer canonical home post-move drop reverse smell + DRY violation. JSDoc atomic revoke mapper.ts post-MOVE Marco lock Finding 1 — R5 banPrismaInPresentation references removed mismo edit, replaced con "Infrastructure layer canonical home — Prisma value imports OK por convention hex; data-access concern". Forward-applicable cross-POC futuro: cuando mapper extraction emerge presentation/mappers/ + Prisma value imports MATERIAL, MOVE infrastructure/mappers/ canonical home + JSDoc atomic revoke mismo edit per `feedback_jsdoc_atomic_revoke`. Body canónico engram `arch/§13/mapper-move-presentation-infrastructure-data-access-concern` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 — Opción α absorption — when GREEN cutover supersede transitorios tests mismo cycle, absorb cleanup atomic mismo batch que origina cascade (NO defer split cycle) — NEW formal cementación canonical** (3 evidencias cumulative cross-POC paired C7 1ra + C4-α 2da + C4-β 3ra): durante POC payment C4-α + C4-β, cascade-NEW emerge en superseded tests (C2 + C3 paired tests superseded por MOVE mapper + C1 Test 14 superseded por drop línea 86 en C4-α; Test 14 c4-α superseded por wholesale delete shim en C4-β). Resolution Opción α absorption mismo GREEN batch — DELETE/DROP superseded tests + constants atomic mismo cycle que origina cascade. Mirror paired C7 Opción B EXACT precedent atomic delete wholesale + cleanup superseded tests cumulative cross-POC. NO defer split cycle separate (atomic principle preservation single batch). Forward-applicable cross-POC futuro: cuando GREEN cutover supersede tests transitorios mismo cycle, absorb cleanup atomic mismo batch — Marco lock retroactive ratify pre-commit MANDATORY si cascade-NEW emerge unanticipated. Body canónico engram `arch/§13/optional-alpha-absorption-cleanup-superseded-tests-atomic` (engram TBD post-commit save batch sequence — texto canonical home pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A5-ε — signature divergence drop alias matures 3ra evidencia post-cementación canonical** (1ra A5-C2c voucher-types `seedForOrg→seedDefaultsForOrg` + 2da POC payment C1 `findUnappliedPayments→findUnappliedByContact` + 3ra POC payment C4-β CreatePaymentInput/UpdatePaymentInput MATERIAL signature divergence): durante POC payment C4-β, hex domain `CreatePaymentInput`/`UpdatePaymentInput` (entity construction shape from `../domain/payment.entity`) vs legacy `CreatePaymentInput`/`UpdatePaymentInput` (UI/API-facing shape) signature divergence MATERIAL — 5 fields divergence CreatePaymentInput (organizationId hex / NO legacy + journalEntryId hex / NO legacy + direction legacy / NO hex + creditSources legacy / NO hex + allocations type AllocationInput vs AllocationDraft) + 1 field UpdatePaymentInput (allocations legacy / NO hex). Same name semantic distinto: hex domain = entity construction puro / legacy = UI/API-facing orchestration. Path a LOCAL DTO presentation/dto/payment-input-types.ts canonical home preserve UI/API-facing shape distinct de domain entity construction shape — RESOLVES naming clarity vía namespace path (LOCAL CreatePaymentInput presentation/dto/ distinct de domain CreatePaymentInput). Body canónico engram `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13.A3-D4-α — dispatches-hub flake env-dependent toggle 22ª evidencia matures cumulative POC payment envelope expansion {6,9}** (heredada §13 emergente POC nuevo A3 sub-fase D4 push closure — matures cumulative cross-POC payment): durante D1 PROACTIVE pre-cementación runtime verify (lección #14 12ma paired sister), suite-full reporta `dispatches-hub/route.test.ts > GET 200 con { items, total }` toggling FAIL/PASS env-dependent (run 1 PASS within {6}, run 2 post-GREEN diagnostic stash gate FAIL within {7} envelope). Pattern matures cross-cycle session cumulative {6,9} margin envelope expansion 22ª evidencia matures POC payment closure — heredado cumulative cross-POC 18ª-22ª = 5 evidencias post-bookmark POC paired D8 cementación target margin envelope expansion env-dependent toggle. Discriminator key: env-dependent CPU contention paralelo otros tests empuja latencia >5000ms suite-full vs sub-2s isolated CPU libre. Resolution: NO drift material from POC payment deletes (REQ-FMB.4 grep ZERO menciones payment confirms heredado pre-payment + cumulative invariant 5242 preserved arithmetic). 22ª evidencia env-dependent toggle confirmed cross-cycle — engram pattern catalog update post-commit save batch sequence. Body canónico engram `arch/lecciones/dispatches-hub-flake-recurrente` (texto canonical home — pointer-style aquí per `feedback_engram_textual_lock_redundancy`).

**§13 emergentes cumulative POC payment** — 6 NEW formal canonical (§13 R-name-collision-type-vs-value-shadowing + §13.A features-legacy-type-only-import + §13 Adapter Layer presentation/ reader port composition-root chain α-A3.B EXACT + §13 Reader port domain-internal Snapshot LOCAL definition + §13 makeXAdapter() factory naming + §13 Opción α absorption cleanup superseded tests atomic) + 1 sub-pattern matures (§13 mapper move presentation→infrastructure data-access concern 2da evidencia) + 2 matures cumulative cross-POC (§13.A5-ε signature divergence drop alias 3ra evidencia + §13.A4-η vi.mock factory load-bearing render path coverage MATERIAL post C4-α) + 1 evidencia recurrente §13.A3-D4-α 22ª matures envelope expansion. Body canónico vive en engrams — architecture.md preserva summary + cross-ref pattern §19.5 + §19.6 + §19.7 + §19.8 + §19.9 precedent.

**Lecciones operacionales agent-lock-discipline cumulative**: **14 cementadas + 1 sub-precedent** preserved POC payment (NO origin lecciones nuevas — POC payment expand contadores evidencias cumulative #10-#14 + sub-precedent — ver §13.7). Pattern matures: 9 (POC siguiente A1+A2) → 14 (POC nuevo A3 doc-only A3-D1) → 14 + evidence count expansion (POC nuevo A4 doc-only A4-D1) → 14 + further expansion + 4 §13 emergentes formales canonical α/γ/ε/ζ + 1 evidencia recurrente §13.A3-D4-α 10na (POC nuevo A5 doc-only A5-D1) → 14 + further cumulative expansion + 1 NEW formal canonical §13.A5-ζ-prerequisite + 1 NEW top-level letter §13.B-paired + 3 matures cumulative cross-POC §13.A5-α/γ/ζ + 1 evidencia recurrente §13.A3-D4-α 17ª (POC paired doc-only C8) → 14 + further cumulative expansion + 6 NEW formal canonical (R-name-collision + §13.A + Adapter Layer + Snapshot LOCAL + makeXAdapter + Opción α absorption) + 1 sub-pattern matures (mapper move) + 2 matures cumulative cross-POC §13.A5-ε + §13.A4-η + 1 evidencia recurrente §13.A3-D4-α 22ª (POC payment doc-only D1). 12ma evidencia paired sister lección #14 PROACTIVE pre-cementación cumulative invariant 5242 preserved {6,9} margin clean baseline preventive evidence + 11ma evidencia diagnostic stash gate pattern matures cumulative cross-POC anticipated bookmark accuracy MATERIAL.

**Cross-ref engrams POC nuevo dedicado payment closure**: `poc-nuevo/payment/c4-beta/closed` (C4-β GREEN wholesale delete features/payment/* atomic + cross-feature TYPE swap consumers via LOCAL DTO + Opción α absorption Test 14 c4-α 3ra evidencia matures + 11ma diagnostic stash gate evidencia anticipated bookmark + 3 cementaciones target D1) + `poc-nuevo/payment/c4-beta/red` #1650 (C4-β RED bookmark) + `poc-nuevo/payment/c4-alpha/closed` #1648 (C4-α GREEN Adapter Layer presentation/ reader port composition-root chain + 2 invariant collisions retroactive resolution Path C + Opción α + Snapshot LOCAL + makePaymentServiceAdapter naming + JSDoc atomic revoke + Opción α absorption 2da evidencia) + `poc-nuevo/payment/c4-alpha/red` #1646 (C4-α RED) + `poc-nuevo/payment/c3/closed` #1643 (C3 RED+GREEN drop type axis PaymentWithRelations + hex local DTO Path β-prod) + `poc-nuevo/payment/c2/closed` #1641 (C2 GREEN DTO mapper centralizado §13.A NEW emergent 1ra) + `poc-nuevo/payment/c1/closed` #1637 (C1 GREEN cross-feature/cross-module presentation cutover §13 R-name-collision NEW 1ra) + `poc-nuevo/payment/c0-pre/closed` #1635 (C0-pre barrel sub-import migration prerequisite §13.A5-ζ-prerequisite 2da evidencia matures) + `arch/§13/r-name-collision-type-vs-value-shadowing` #1638 (NEW formal cementación canonical 1ra evidencia POC payment C1 + RESOLVES double pair Path a C4-β LOCAL DTO namespace path) + `arch/§13/A-features-legacy-type-only-import` #1640 (NEW formal cementación canonical 3 evidencias RESOLVED wholesale C4-β) + `arch/§13/adapter-layer-presentation-reader-port-composition-root-chain` (NEW formal cementación canonical 2da evidencia α-A3.B EXACT — engram TBD post-commit save batch sequence) + `arch/§13/reader-port-domain-internal-snapshot-local-pattern` (NEW formal cementación canonical 1ra evidencia POC payment C4-α — engram TBD post-commit save batch sequence) + `arch/§13/make-x-adapter-naming-convention` (NEW formal cementación canonical factory naming — engram TBD post-commit save batch sequence) + `arch/§13/mapper-move-presentation-infrastructure-data-access-concern` (NEW sub-pattern matures 2da evidencia — engram TBD post-commit save batch sequence) + `arch/§13/optional-alpha-absorption-cleanup-superseded-tests-atomic` (NEW formal cementación canonical 3 evidencias cumulative — engram TBD post-commit save batch sequence) + `arch/§13/A5-epsilon-method-signature-shim-divergence` #1590 (matures 3ra evidencia post-cementación canonical aplicado) + `arch/lecciones/dispatches-hub-flake-recurrente` (22ª evidencia matures cumulative POC payment envelope expansion {6,9} — engram TBD update post-commit save batch sequence) + `arch/lecciones/leccion-14-engram-cumulative-arithmetic-runtime-verify` #1555 (lección #14 12ma paired sister D1 PROACTIVE pre-cementación cumulative invariant 5242 preserved {6,9} margin clean baseline preventive evidence) + `feedback/diagnostic-stash-gate-pattern` #1603 (11ma evidencia matures cumulative cross-POC anticipated bookmark accuracy MATERIAL — engram TBD update post-commit save batch sequence) + `feedback/red-regex-discipline` (NEW canonical home update — engram TBD post-commit save batch sequence) + `feedback/step-0-expand-eslint-restricted-imports-grep` (REFINED 9 axes update — engram TBD post-commit save batch sequence) + `feedback/premise-verification-canonical-claim` (NEW canonical home — engram TBD post-commit save batch sequence) + `feedback/marco-lock-L1-estricto-expand-axis-distinct-collision` (NEW canonical home — engram TBD post-commit save batch sequence) + `feedback/§20-strict-spirit-vs-regex-literal` (NEW canonical home REFINED §20.8 sub-finding WithCorrelation envelope passthrough — engram TBD post-commit save batch sequence).

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

### 20.6. Verify retroactivo POC nuevo A5

POC nuevo dedicado A5 "cleanup `features/voucher-types/` load-bearing + cumulative cutover hex modules/voucher-types/ presentation cross-feature/cross-module" verify retroactivo §20.1 pattern grep ejecutado pre-cierre A5-D1 doc-only post-mortem (PROACTIVE Marco mandate lección #14 5ta paired sister runtime verify pre-cementación):

- **Routes nuevas added POC nuevo A5**: 0 — POC nuevo A5 fue cumulative cutover (composition root `makeVoucherTypeRepository` factory + DTO mappers + DELETE legacy class instantiations features/voucher-types/), NO surface API growth.
- **Routes editadas POC nuevo A5**: 9 source pages/routes A5-C1 (Cat 1 cutover voucher-types hex composition root) + 5 archivos α/β/γ A5-C2a/C2b cross-feature/cross-module cleanup hex + 3 archivos uniform Shape α A5-C2c integration tests cleanup. 0 routes añaden `correlationId` al body — verify runtime grep `Response\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths + grep `NextResponse\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths. Modificaciones se limitaron a (a) replace legacy `VoucherTypesService` instantiations con composition root `makeVoucherTypeRepository(prisma)` factory + (b) replace import `@/features/voucher-types/server` con `@/modules/voucher-types/presentation/composition-root` + (c) signature swaps method-on-class shim Option D-3 (dynamic import bypass R2 + Parameters introspection bypass R5) + (d) DTO divergence runtime path coverage 8 callsites Opción C 4 representative patterns hex VoucherType entity con VOs vs legacy string+enum + (e) Response.json raw entity preserved (NO mapper invocation routes mutation per consumer behavior).
- **Convención §20 preservada**: leak shape NO regressed. 10 commits cumulative POC nuevo A5 verify clean contra `Response.json({ ...result, correlationId })` pattern.

Pattern application coherente §20.1 forward: cualquier hex route futura POCs siguientes inmediatos (~10 features remaining post-A5: IVA books / payables / receivables / journal entries / fiscal periods / accounts / contacts / dispatches / shipments / wage / etc.) DEBE auditarse contra leak shape pre-merge. Strip atómico mismo edit que toque la route. Lección #14 runtime verify pre-cementación architecture.md aplicable cumulative arithmetic claims POC future closures (Suite/TSC/ESLint/file counts).

### 20.7. Verify retroactivo POC paired payables↔receivables

POC paired payables↔receivables "cleanup `features/{payables,receivables}/` load-bearing + cumulative cutover hex modules/{payables,receivables}/ presentation cross-feature/cross-module paired sister axis" verify retroactivo §20.1 pattern grep ejecutado pre-cierre C8 doc-only post-mortem (PROACTIVE Marco mandate lección #14 6ta paired sister runtime verify pre-cementación):

- **Routes nuevas added POC paired**: 0 — POC paired fue cumulative cutover paired sister axis (composition root `make{Payables,Receivables}Service` factories + DTO mappers paired + DELETE legacy class instantiations features/{payables,receivables}/ wholesale + barrel sub-import migration prerequisite cutover schemas zod paired), NO surface API growth.
- **Routes editadas POC paired**: 6 source API routes paired (3 cxp + 3 cxc — `cxp/route.ts` + `cxp/[payableId]/route.ts` + `cxp/[payableId]/status/route.ts` + cxc mirror simétrico) C3-C4 cutover hex composition root + 4 page-rbac vi.mock factory paired C7-pre cleanup dead aspirational + 4 components consumer C5-C6 swap legacy import → hex barrel type-only erased at compile + 6 schemas zod barrel sub-imports cutover paired C7-pre prerequisite. 0 routes añaden `correlationId` al body — verify runtime grep `Response\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths + grep `NextResponse\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths. Modificaciones se limitaron a (a) replace legacy `PayablesService`/`ReceivablesService` instantiations con composition root `make{Payables,Receivables}Service()` factories paired + (b) replace import `@/features/{payables,receivables}/server` con `@/modules/{payables,receivables}/presentation/server` hex barrel type-only erased at compile (server-only safe banServerBarrels rule scope `@/features/*/server` only) + (c) signature swaps bridge mapper simplification `.toSnapshot()` Opción C precedent A5-C1 4ta aplicación post-cementación cumulative drop Decimal reconstruction overhead + (d) DTO divergence paired axis hex `{X}SnapshotWithContact = {X}Snapshot & { contact: Contact }` composition shape Snapshot+Contact hex DTO replacement legacy POJO `{X}WithContact` drop wholesale §13.B-paired NEW classification 'DTO drop axis paired' + (e) Response.json raw entity hex preserved (NO mapper invocation routes mutation per consumer behavior `{payable,receivable}-form.tsx` mutation handlers NO consume body solo `response.ok`).
- **Convención §20 preservada**: leak shape NO regressed. 15 commits cumulative POC paired verify clean contra `Response.json({ ...result, correlationId })` pattern.

### 20.8. Verify retroactivo POC nuevo dedicado payment

POC nuevo dedicado payment "cleanup `features/payment/` load-bearing + cumulative cutover hex modules/payment/ presentation cross-feature/cross-module" verify retroactivo §20.1 pattern grep ejecutado pre-cierre POC payment D1 doc-only post-mortem (PROACTIVE Marco mandate lección #14 12ma paired sister runtime verify pre-cementación):

- **Routes nuevas added POC nuevo payment**: 0 — POC nuevo payment fue cumulative cutover (cross-feature/cross-module presentation cutover routes + pages + vi.mock + DTO mapper centralizado + drop type axis hex local DTO + Adapter Layer reader port composition-root chain + wholesale delete features/payment/* atomic + cross-feature TYPE swap LOCAL DTO Path a), NO surface API growth.
- **Routes editadas POC nuevo payment**: 5 source API routes payment (`payments/route.ts` GET+POST + `payments/[paymentId]/route.ts` GET+PATCH+DELETE + `payments/[paymentId]/status/route.ts` PATCH + `payments/[paymentId]/allocations/route.ts` PUT + `payments/apply-credits/route.ts` POST) C1 cutover hex barrel + 2 source pages payment (`payments/page.tsx` + `payments/[paymentId]/page.tsx`) C1 cutover hex barrel + 1 source unapplied-payments route (`contacts/[contactId]/unapplied-payments/route.ts`) C1 cutover PaymentRepository → PrismaPaymentsRepository hex barrel + 2 client components consumer C4-β swap legacy import → hex barrel type-only erased at compile (`payment-list.tsx` + `payment-form.tsx`) + 4 vi.mock factory page-rbac C1 swap target hex barrel paired Opción A re-export class identity preserved §13.A4-η MATERIAL. **0 routes añaden `correlationId` al body literal spread** — verify runtime grep `Response\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths + grep `NextResponse\.json\(\s*\{\s*\.\.\.[^,]+,\s*correlationId` returned 0 matches PROD app/ paths. Modificaciones POC payment se limitaron a (a) replace import path `@/features/payment/server` con `@/modules/payment/presentation/server` hex barrel C1 + (b) cross-feature TYPE swap legacy `@/features/payment/payment.types` → LOCAL DTO `./dto/payment-input-types` (Adapter) + hex barrel `@/modules/payment/presentation/server` (components + Adapter PaymentFilters + CreditAllocationSource) C4-β + (c) `Response.json(payment)` envelope passthrough preserved heredado legacy shim contract pre-existing — NO route handler edit Response.json shape changed.
- **Convención §20.1 EXACT regex pattern preservada**: leak shape NO regressed por POC payment cycles. 12 commits cumulative POC nuevo payment verify clean contra `Response.json({ ...result, correlationId })` pattern literal spread.

**Sub-finding NEW emergente cementación target D1** — "WithCorrelation envelope passthrough pre-existing legacy shim pattern": durante D1 PROACTIVE verify retroactivo §20.1 pattern grep ejecución, descubrió 4 payment routes pasan `WithCorrelation<PaymentWithRelations>` envelope from service directly via `Response.json(payment)` — `payment` shape internal `{ ...row, correlationId }` constructed por Adapter `paymentService.update/create/createAndPost/post/void/updateAllocations` returns. Routes: `payments/route.ts:61` POST + `payments/[paymentId]/route.ts:43` PATCH + `payments/[paymentId]/status/route.ts:40` PATCH + `payments/[paymentId]/allocations/route.ts:37` PUT. **POC payment cycles preserved legacy contract via Adapter C4-α NO new leak introduced** — Adapter wraps inner hex `PaymentsService` returns + spreads `correlationId` mismo shape legacy shim contract pre-existing (legacy `features/payment/payment.service.ts` ALSO returned WithCorrelation envelopes preserved EXACT). C1 GREEN solo SWAP IMPORT path (`@/features/payment/server` → `@/modules/payment/presentation/server`), NO Response.json behavior changed cycles.

**§20.1 EXACT regex pattern grep cumple ✅** (literal spread route handler shape detection): POC payment NO introduces literal `{ ...x, correlationId }` spread leaks por cycle changes. **Sub-finding distinción strict spirit §20**: regex pattern detecta literal spread route handler line, NO captura indirect leak via service-returned WithCorrelation envelope passthrough. Strict spirit §20 (correlationId es telemetría interna del backend, NO parte del contrato API público) incluye envelope passthrough — body de `Response.json(payment)` cuando `payment` es WithCorrelation envelope leakea correlationId indirect, mismo concern semantic que §20 strict spirit aunque NO matches §20.1 regex pattern.

**Cross-ref defer §21.2 POC futuro paridad fix payment routes raw entity preservation**: pattern emergent surface D1 verify retroactivo — payment routes deben unwrap WithCorrelation envelope pre-Response.json honor §20 strict spirit (NOT solo §20.1 literal regex). Mirror precedent A3 sale + paired payable EXACT routes raw entity preservation (`Response.json(rawEntity)`) — destructure `const { correlationId, ...rest } = await paymentService.X(...)` + `Response.json(rest)`. Defer POC futuro dedicated paridad fix simétrico al precedent A3 D5 PATCH/POST mismatch defer separate POC. NO scope creep retroactive mid-D1 doc-only (D1 es post-mortem cumulative cementación canonical, NO RED+GREEN cycle).

**Lección REFINED `feedback/§20-strict-spirit-vs-regex-literal` NEW canonical home**: strict spirit §20 incluye envelope passthrough (NO solo literal spread regex) — verificación PROACTIVE pre-D1 MANDATORY future POCs cuando service retorna WithCorrelation envelope shape. Forward-applicable cross-POC futuro: ~7 features remaining post-payment heredan strict spirit verify pre-D1 cementación POC closure runtime — si service retorna WithCorrelation envelope (indirect leak passthrough), surface honest D1 verify retroactivo + defer §21.X POC futuro dedicated paridad fix raw entity preservation.

Pattern application coherente §20.1 forward: cualquier hex route futura POCs siguientes inmediatos (~7 features remaining post-payment) DEBE auditarse contra leak shape pre-merge — strict spirit §20 (incluido envelope passthrough indirect leak) + §20.1 EXACT regex pattern literal spread direct leak. Strip atómico mismo edit que toque la route. Lección #14 runtime verify pre-cementación architecture.md aplicable cumulative arithmetic claims POC future closures (Suite/TSC/ESLint/file counts).

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

### 21.2. Payment routes WithCorrelation envelope passthrough (defer POC futuro paridad fix payment routes raw entity preservation)

Routes payment retornan WithCorrelation envelope from Adapter via `Response.json(payment)` directly — pattern indirect leak emergent §20.8 sub-finding NEW surface D1 PROACTIVE verify retroactivo pre-cementación. **PRE-EXISTING behavior NOT introduced por POC payment cycles** — Adapter C4-α preserves legacy shim contract WithCorrelation EXACT (legacy `features/payment/payment.service.ts` también retornaba WithCorrelation envelopes preserved cumulative); POC payment C1 GREEN solo SWAP IMPORT path, NO Response.json behavior changed cycles:

| Endpoint / Service method | Path | Línea | Service return shape |
|---|---|---|---|
| Route handler POST `paymentService.create` / `createAndPost` | `app/api/organizations/[orgSlug]/payments/route.ts` | 61 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PATCH `paymentService.update` | `app/api/organizations/[orgSlug]/payments/[paymentId]/route.ts` | 43 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PATCH `paymentService.post` / `void` | `app/api/organizations/[orgSlug]/payments/[paymentId]/status/route.ts` | 40 | `WithCorrelation<PaymentWithRelations>` |
| Route handler PUT `paymentService.updateAllocations` | `app/api/organizations/[orgSlug]/payments/[paymentId]/allocations/route.ts` | 37 | `WithCorrelation<PaymentWithRelations>` |

**Ground truth**: WithCorrelation envelope `{ ...row, correlationId }` es internal audit telemetry shape (`correlationId` es identificador correlation tracking entre transacción + audit log per §20). Body `Response.json(payment)` shape leakea `correlationId` indirect via envelope passthrough — strict spirit §20 (correlationId es telemetría interna del backend, NO parte del contrato API público) incluye envelope passthrough mismo concern semantic. Resolution: routes deben destructure `const { correlationId, ...rest } = await paymentService.X(...)` + `Response.json(rest)` — mirror precedent A3 sale + paired payable EXACT raw entity preservation.

**§20.1 EXACT regex pattern NO match**: literal spread `Response.json({ ...x, correlationId })` regex detection scope detecta direct leak en route handler line, NO indirect passthrough. POC payment cycles preserved legacy contract — §20.1 regex grep returned 0 hits cumple verify retroactivo §20.8.

**Cobertura runtime**: payment routes integration tests cumulative POC payment cycles existen (commits cumulative C1+C2+C3+C4-α+C4-β shape tests — body shape regression covered runtime + REQ-FMB.5 0 violations preserved console/logger leaks separate concern).

**Cross-ref**: §20.8 (sub-finding NEW emergente surface D1 verify retroactivo + lección REFINED `feedback/§20-strict-spirit-vs-regex-literal` NEW canonical home) + engram `poc-futuro/payment-routes-correlationid-unwrap-paridad-fix` (POC futuro candidate fix paridad payment routes raw entity preservation simétrico al precedent A3 sale + paired payable EXACT — out-of-scope POC nuevo payment D1 doc-only entrega + NO RED+GREEN cycle mid-D1).
