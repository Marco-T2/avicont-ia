# Delta for rbac-ui-gating

## MODIFIED Requirements

### Requirement: `<Gated>` Component

The system MUST provide `<Gated resource={Resource} action={Action}>{children}</Gated>`. Children MUST render only if `canAccess(currentRole, resource, action) === true` against the org's dynamic (DB-driven, cached) matrix. The component's public API (props signature) MUST remain frozen. Loading states (role or matrix not yet resolved) MUST render nothing (no flash).

(Previously: `canAccess` resolved against a static in-memory map; matrix was not per-org.)

#### Scenario: U.1-S1 — contador ve botón "Contabilizar" en JE detail

- GIVEN a `contador` viewing JE detail
- WHEN `<Gated resource="journal" action="write">Contabilizar</Gated>` renders
- THEN the button is visible

#### Scenario: U.1-S2 — cobrador no ve "Editar" en sale detail

- GIVEN a `cobrador` viewing sale detail
- WHEN `<Gated resource="sales" action="write">Editar</Gated>` renders
- THEN the button is NOT in the DOM

#### Scenario: U.1-S3 — loading state

- GIVEN role or matrix not yet resolved (initial fetch in flight)
- WHEN `<Gated>` renders
- THEN children are NOT rendered (no flash)

#### Scenario: U.1-S4 — custom role respected by Gated

- GIVEN user has custom role `facturador` with `journal.write = true`
- WHEN `<Gated resource="journal" action="write">Contabilizar</Gated>` renders
- THEN the button is visible

---

### Requirement: `useCanAccess` Hook

The system MUST provide `useCanAccess(resource, action): boolean`. The hook MUST resolve against the org's dynamic matrix (loaded from cache or API). The hook's public signature MUST remain frozen. Returns `false` while role or matrix is loading. Returns the matrix result once resolved.

(Previously: resolved against static map; no per-org matrix.)

#### Scenario: U.2-S1 — hook retorna bool

- GIVEN role `auxiliar` resolved with org matrix loaded
- WHEN `useCanAccess("sales", "write")` is called
- THEN returns `true`

#### Scenario: U.2-S2 — hook durante loading

- GIVEN role fetch or matrix fetch in flight
- WHEN `useCanAccess("journal", "write")` is called
- THEN returns `false`

#### Scenario: U.2-S3 — hook reflects matrix update within TTL

- GIVEN org matrix was just invalidated and reloaded (after admin edit)
- WHEN `useCanAccess` is called after the reload completes
- THEN returns the updated value

---

### Requirement: Members Admin Role Picker

The members admin `<select>` for role assignment MUST list all assignable roles for the org: the 5 assignable system roles (`admin`, `contador`, `cobrador`, `auxiliar`, `member`) plus any custom roles defined in the org. `owner` MUST NOT appear. The picker MUST load options dynamically from the org's role list.

(Previously: listed exactly 5 static options hardcoded; no custom roles displayed.)

#### Scenario: U.4-S1 — picker contains system + custom roles

- GIVEN org `alpha` has 5 assignable system roles and 1 custom role `facturador`
- WHEN an `admin` opens the add-member dialog
- THEN the role select contains exactly `[admin, contador, cobrador, auxiliar, member, facturador]`

#### Scenario: U.4-S2 — owner not in picker

- GIVEN org `alpha`
- WHEN the role picker renders
- THEN `owner` is NOT in the options list

## ADDED Requirements

### Requirement: U.5 — /settings/roles CRUD UI

The system MUST evolve `/settings/roles` from a read-only matrix display into a full CRUD hub. The page MUST allow `owner` and `admin` users to: view all roles (system + custom), create a custom role from a template, edit a custom role's matrix and `canPost`, and delete a custom role (with confirmation dialog). System roles MUST be displayed as read-only rows with no edit/delete controls.

#### Scenario: U.5-S1 — system role shown as read-only

- GIVEN `admin` navigates to `/settings/roles`
- WHEN the page renders
- THEN system role rows display the matrix but no Edit or Delete button

#### Scenario: U.5-S2 — custom role shows edit controls

- GIVEN custom role `facturador` exists in the org
- WHEN `admin` navigates to `/settings/roles`
- THEN the `facturador` row has Edit and Delete buttons

#### Scenario: U.5-S3 — create flow requires template selection

- GIVEN `admin` clicks "Create role"
- WHEN the creation dialog opens
- THEN it requires selecting a system role as template before enabling the Save button

#### Scenario: U.5-S4 — delete confirmation dialog

- GIVEN custom role `facturador` has zero members
- WHEN `admin` clicks Delete on `facturador`
- THEN a confirmation dialog appears before the DELETE API call is made
