# rbac-ui-gating Specification

## Purpose

Componente y hook para gatear UI (botones de acción, nav items) según la matriz de permisos. El gating de UI es **defensivo** (mejora UX ocultando lo no permitido); la autorización real siempre ocurre server-side.

## Requirements

### Requirement: `<Gated>` Component

The system MUST provide `<Gated resource={Resource} action={Action}>{children}</Gated>`. Children MUST render only if `canAccess(currentRole, resource, action) === true`. Loading states (role not yet resolved) MUST render nothing (no flash).

#### Scenario: U.1-S1 — contador ve botón "Contabilizar" en JE detail

- GIVEN a `contador` viewing JE detail
- WHEN `<Gated resource="journal" action="write">Contabilizar</Gated>` renders
- THEN the button is visible

#### Scenario: U.1-S2 — cobrador no ve "Editar" en sale detail

- GIVEN a `cobrador` viewing sale detail
- WHEN `<Gated resource="sales" action="write">Editar</Gated>` renders
- THEN the button is NOT in the DOM

#### Scenario: U.1-S3 — loading state

- GIVEN role not yet resolved (initial fetch in flight)
- WHEN `<Gated>` renders
- THEN children are NOT rendered (no flash)

---

### Requirement: `useCanAccess` Hook

The system MUST provide `useCanAccess(resource, action): boolean`. Returns `false` while role is loading. Returns the matrix result once resolved.

#### Scenario: U.2-S1 — hook retorna bool

- GIVEN role `auxiliar` resolved
- WHEN `useCanAccess("sales", "write")` is called
- THEN returns `true`

#### Scenario: U.2-S2 — hook durante loading

- GIVEN role fetch in flight
- WHEN `useCanAccess("journal", "write")` is called
- THEN returns `false`

---

### Requirement: Action Buttons Gated in Critical Views

The following action buttons MUST be wrapped in `<Gated>` or equivalent:

| View | Action | Resource | Action |
|------|--------|----------|--------|
| `journal-entry-detail` | Editar | journal | write |
| `journal-entry-detail` | Contabilizar | journal | write |
| `journal-entry-detail` | Anular | journal | write |
| `sale-detail` | Editar | sales | write |
| `sale-detail` | Anular | sales | write |
| `purchase-detail` | Editar | purchases | write |
| `payment-form` | Registrar pago | payments | write |
| `dispatch-form` | Crear despacho | dispatches | write |
| `voucher-types-manager` | Crear/Editar/Toggle | accounting-config | write |

#### Scenario: U.3-S1 — cobrador en JE detail

- GIVEN `cobrador` navigating to JE detail
- WHEN the page renders
- THEN no Editar/Contabilizar/Anular buttons are visible

#### Scenario: U.3-S2 — auxiliar en sale detail

- GIVEN `auxiliar` navigating to sale detail
- WHEN the page renders
- THEN Editar is hidden for POSTED sales (status gate) AND for all sales created by others (ownership gate out of scope here)

---

### Requirement: Members Admin Role Picker

The members admin `<select>` for role assignment MUST list exactly 5 options: `admin`, `contador`, `cobrador`, `auxiliar`, `member`. `owner` MUST NOT appear.

#### Scenario: U.4-S1 — picker contenido

- GIVEN an `admin` opening the add-member dialog
- WHEN the role select renders
- THEN it contains exactly `[admin, contador, cobrador, auxiliar, member]`
