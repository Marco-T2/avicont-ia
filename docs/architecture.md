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

**Cross-ref**: la regla complementa Stop rule v4 (engram `feedback/sub-agent-stop-rule`); ambas evitan que parity gaps lleguen a master.

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

¹ **Nota correctiva (POC #11.0a A5 β Step 0 D-Step0#2)**: pre-recon A5 β reveló 3 server components adicionales consumiendo `SaleService` legacy NO listados en el scope formal del bookmark histórico A4-a: `app/(dashboard)/[orgSlug]/sales/page.tsx`, `sales/[saleId]/page.tsx`, `dispatches/page.tsx`. POC #11.0c hereda **10 cutovers explícitos** (8 iva-books + 1 hub + `dispatches/page` — el surface nuevo que A5 β agrega al scope heredado), no 9. Los otros 2 server components (`sales/page` + `sales/[saleId]/page`) son consumers conocidos pre-existentes pero quedan para auditoría retroactiva POC #11.0c. El bookmark histórico se preserva sin reescribir — la corrección vive aquí (auditabilidad).

² **Nota correctiva (POC #11.0b post-A3 audit-6 Marco challenge)**: bookmark scope POC #11.0b nunca se lockeó explícitamente al inicio del POC (asumido implícito mirror sale POC #11.0a 5 sub-fases). Cuando A1+A2+A3 cerraron, reporte interpretó "POC #11.0b CLOSED completo" — Marco surfaceó el gap (A4 + A5 pendientes mirror sale precedent). Bookmark `poc-11/0b/scope-locked-bookmark` (engram) se creó retroactivamente con γ lockeada Marco (A4-a γ minimal + A5 cleanup completo deferral). POC #11.0c hereda **11 cutovers purchase-side explícitos** post A4-a γ (2 core API restantes + 4 iva-books/purchases + 3 server components + 2 client components) + cleanup completo `features/purchase/` (mirror sale cleanup completo diferido). Tsc baseline POC #11.0c heredado actualizado: 16 errores (3 sales/route + 2 purchases/route + 11 findManyByCodes) — drift heredado A4-a γ simétrico al sale precedente. El bookmark POC #11.0b se preserva con la corrección retroactiva en `poc-11/0b/scope-locked-bookmark` engram (auditabilidad). Lección operacional: bookmark scope-locked-bookmark al INICIO de un POC es check obligatorio — sin él, cierre prematuro pasa silently incluso con auditoría retroactiva por sub-fase.

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
