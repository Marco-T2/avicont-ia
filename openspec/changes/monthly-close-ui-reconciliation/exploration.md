# Exploration — monthly-close-ui-reconciliation

> **Status:** Exploratory draft — SDD change paused.
>
> This change is in exploration phase only. No proposal, spec, design, or tasks have been written yet.
>
> **Pause reason:** Blocked on prerequisite changes `fiscal-period-monthly-create` and `apperror-details-passthrough`, both now archived (see `openspec/changes/archive/`).
>
> **Resume conditions:**
> - Monthly close functional correctness established (✅ via `fiscal-period-monthly-create`)
> - HTTP boundary honors `AppError.details` contract (✅ via `apperror-details-passthrough`)
>
> **Ready to resume:** Yes. Next step is `sdd-propose` using this exploration + `residual-debt-audit.md` as inputs.
>
> **Last updated:** 2026-04-22

## Question

Are `period-close-dialog` and `monthly-close-panel` duplicative surfaces (one should be deleted) or do they serve genuinely different UX contexts (both should stay, with clear boundaries)?

---

## Component A — period-close-dialog

### Location

`components/accounting/period-close-dialog.tsx`

### Callsites

Only one callsite:

- `components/accounting/period-list.tsx` (line 131) — the dialog is always rendered inside `PeriodList`; it becomes visible when `periodToClose` state is non-null.

`PeriodList` itself is rendered in:

- `app/(dashboard)/[orgSlug]/settings/periods/page.tsx`

No other page imports `PeriodCloseDialog` or `PeriodList`.

### Trigger UX

Inside the `PeriodList` table, each row with `status === "OPEN"` shows an outline "Cerrar" button. Clicking it sets `periodToClose` to that specific `FiscalPeriod` object, which causes the dialog to open. The period is pre-selected by the row context — the user does NOT choose from a dropdown; they clicked the row's action button.

### Props

```ts
interface PeriodCloseDialogProps {
  period: FiscalPeriod | null;   // null = hidden, non-null = open & pre-selected
  orgSlug: string;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}
```

`FiscalPeriod` is typed from `@/features/fiscal-periods` (full entity with `id`, `name`, `year`, `startDate`, `endDate`, `status`, etc.).

### Fields / Flow

The dialog renders immediately with the period already identified. The user sees:

1. Confirmation question: "¿Estás seguro de cerrar el período [name]?"
2. Warning: "Esta acción no se puede revertir."
3. Textarea: "Motivo (opcional)" — free-form, no minimum length enforced in the UI.
4. Buttons: Cancelar / Cerrar Período (destructive variant).

There is **no pre-close summary** shown (no document counts, no DEBE=HABER check result, no balance status). The user clicks Cerrar Período with zero context about the state of the period.

### Endpoint

`POST /api/organizations/[orgSlug]/monthly-close`

Payload: `{ periodId: period.id, justification?: string }` (justification omitted from body if blank).

### Success behavior

- `toast.success("Período [name] cerrado exitosamente")` via sonner.
- Calls `onClosed()` callback → caller (`PeriodList`) sets `periodToClose = null` and calls `router.refresh()`.
- No redirect. No correlation ID displayed. No audit-trail link shown.

### Error behavior

- `toast.error(message)` with the error from the API response or a generic fallback.
- Dialog stays open.

### Permissions

Page-level gate on `/settings/periods/page.tsx`: `requirePermission("accounting-config", "write", orgSlug)`.

The API route itself gates on `requirePermission("period", "close", orgSlug)`. There is a **mismatch**: the page requires `accounting-config:write`; the underlying action requires `period:close`. A user with `accounting-config:write` but not `period:close` can reach the UI and trigger the dialog, but will get a 403 from the API.

### Tests

- `components/accounting/__tests__/period-close-dialog.test.tsx` — T54/T55: asserts that the "Cerrar Período" button POSTs to `/api/organizations/acme/monthly-close` with `{ periodId }`. One test case. No error path tested, no justification payload tested.
- `app/(dashboard)/[orgSlug]/settings/periods/__tests__/page-rbac.test.ts` — tests the page RBAC gate (`accounting-config:write`). Does not test the dialog behavior.

### Notes

- The design.md (`cierre-periodo/design.md`) explicitly listed deletion of this component as the **final task** of the cierre-periodo change (§ "Deprecation path for legacy FiscalPeriodsService.close", step 3: "delete `components/accounting/period-close-dialog.tsx` if no longer referenced"). This deletion was NOT completed — the component still exists and is actively used.
- The `cierre-periodo` design described `/settings/periods/page.tsx` as the "only UI caller" of the dialog and flagged that page as the one being migrated away from the legacy `PATCH` endpoint. After migration, the intent was to delete the dialog, but it was kept alive in the settings/periods page with the new endpoint wired in.
- git history: the component was created in `a0b7276` (accounting core redesign) and then updated in `de65022` (T55: migrate to POST /monthly-close). The deletion task was never committed.

---

## Component B — monthly-close-panel

### Location

`components/settings/monthly-close-panel.tsx`

Note: despite being in `components/settings/`, this component is rendered inside an **accounting** route (`/accounting/monthly-close`), not a settings route. The directory placement appears to be a leftover naming choice from a prior phase.

### Callsites

Only one callsite:

- `app/(dashboard)/[orgSlug]/accounting/monthly-close/page.tsx` (line 34)

No other page imports `MonthlyClosePanel`.

### Trigger UX

The panel is **always rendered on page load** — it is not a dialog that opens from a button. The user navigates to `/[orgSlug]/accounting/monthly-close` and the panel is the entire page content.

The panel has its own internal flow:

1. User selects a period from a `<Select>` dropdown (all periods listed, including CLOSED ones marked "(Cerrado)").
2. On selection, a `GET /api/organizations/[orgSlug]/monthly-close/summary?periodId=...` call fires automatically to fetch the pre-close summary.
3. Summary renders (document counts, drafts breakdown, voucher type table, balance check).
4. If the period passes all checks (`canClose = !isClosed && !hasDrafts && summary !== null && summary.balance.balanced === true`), a "Cerrar Período" (destructive) button is enabled.
5. Clicking the button opens an **internal confirmation dialog** (rendered inline inside the panel) with the period name, posted document count, a warning about blocking, and a justification textarea.
6. User optionally fills justification and clicks "Confirmar Cierre".

### Props

```ts
interface MonthlyClosePanelProps {
  orgSlug: string;
  periods: Period[];   // plain object shape: { id, name, startDate, endDate, status }
}
```

`Period` is a local interface (not the Prisma entity type), so the page serializes the dates to ISO strings before passing them. This is necessary because Next.js Server Components cannot pass `Date` objects to Client Components.

### Fields / Flow

The panel has a two-stage flow:

**Stage 1 — Summary view (always shown after period selection)**:
- Posted document counts: Dispatches / Cobros y Pagos / Asientos Contables.
- Draft document counts (amber warning cards, shown only when drafts > 0): same three categories.
- Journals by voucher type table: Code / Type / Count / Total Debe.
- Balance status: DEBE=HABER (implicit in enabling the close button) or explicit red banner "DEBE ≠ HABER — No se puede cerrar este período" with debit, credit, and difference values.
- "Cerrado" badge if period already closed.

**Stage 2 — Confirmation dialog (internal, triggered by "Cerrar Período" button)**:
- Period name.
- Count of posted documents that will be locked.
- Amber warning: "Esta acción bloqueará todos los documentos contabilizados del período. Solo administradores podrán editar documentos bloqueados con justificación."
- Justification textarea (labeled "Justificación (opcional)").
- Buttons: Cancelar / Confirmar Cierre.

### Endpoint

Same: `POST /api/organizations/[orgSlug]/monthly-close`

Payload: `{ periodId: selectedPeriodId, justification?: string }` (same structure).

Also calls: `GET /api/organizations/[orgSlug]/monthly-close/summary?periodId=...` (panel-only; dialog does not call this).

### Success behavior

- Closes the internal confirmation dialog.
- Clears justification state.
- Calls `router.refresh()`.
- Re-fetches the summary to reflect `CLOSED` state (shows "CERRADO" badge, hides the close button).
- **No toast**. No correlation ID displayed. No audit-trail link shown.
- Errors are shown inline (a red banner inside the panel), not via toast.

### Permissions

Page-level gate on `/accounting/monthly-close/page.tsx`: `requirePermission("journal", "read", orgSlug)`.

The API route itself gates on `requirePermission("period", "close", orgSlug)`. There is a **double mismatch**:
- The panel page requires `journal:read` (a read permission).
- The actual close action requires `period:close`.
- A user with `journal:read` but not `period:close` can see the full summary but will get a 403 when attempting the close. The close button is not conditionally hidden based on `period:close` — the guard is entirely at the API layer.

### Tests

- `components/settings/__tests__/monthly-close-panel.test.tsx` — T57/T58: two tests. (a) Balance banner renders when `balanced = false`. (b) Justification string is included in the POST body. Both are integration-style component tests with fetch mocked.
- `app/(dashboard)/[orgSlug]/accounting/monthly-close/__tests__/page.test.ts` — page RBAC gate (`journal:read`).

### Notes

- `monthly-close-panel` is a self-contained, stateful panel: it owns period selection, summary fetching, and the confirmation step. It is a complete workflow in a single component.
- git history: created in `ffe37a9` (monthly close, LOCKED status, audit trail — original cierre-periodo impl) and updated in `bd2af53` (T58: balance warning + justification input).
- The component is placed under `components/settings/` but is used in an **accounting** route, not a settings route. This is an inconsistency in the directory structure.

---

## Cross-cutting comparison

| Aspect | period-close-dialog | monthly-close-panel |
|--------|---------------------|---------------------|
| **Component type** | Modal dialog | Full-page panel (with internal confirm dialog) |
| **Period selection** | Pre-selected by row click | User selects from dropdown |
| **Pre-close summary** | No | Yes — posted counts, drafts, voucher types, balance |
| **Balance check display** | No (API enforces but UI shows nothing) | Yes — explicit "DEBE ≠ HABER" banner with amounts |
| **Draft document warning** | No | Yes — amber banner + per-entity draft counts |
| **Justification input** | Yes, optional, no label | Yes, optional, labeled "Justificación (opcional)" |
| **Confirm step** | Single step (Cerrar Período button = submit) | Two steps (Cerrar Período → internal confirm dialog) |
| **Post-close feedback** | Toast (sonner) | Inline state update (re-fetch summary, no toast) |
| **Correlation ID shown** | No | No |
| **Audit-trail link** | No | No |
| **Page context** | /settings/periods — fiscal period management (admin CRUD) | /accounting/monthly-close — dedicated close workflow |
| **Page permission (gate)** | `accounting-config:write` | `journal:read` |
| **API permission (gate)** | `period:close` (enforced at API) | `period:close` (enforced at API) |
| **Success action** | Toast + callback (router.refresh via parent) | Silent + router.refresh + re-fetch summary |
| **Error display** | Toast (sonner) | Inline red banner in panel |
| **Tests** | 1 test (endpoint dispatch) | 2 tests (balance banner + justification payload) |
| **Directory** | components/accounting/ | components/settings/ (but used in /accounting route) |

---

## Findings

1. **The cierre-periodo change planned deletion of `period-close-dialog` but never executed it.** The design.md explicitly calls it out as the final task (step 3 of the deprecation path). The component was migrated to the new endpoint (`POST /monthly-close`) in T55 but was not deleted. It survives wired into `/settings/periods`.

2. **The two surfaces serve different UX contexts, but the contexts are not well-defined.** `period-close-dialog` is an "emergency inline action" surfaced within the period management list (a settings/admin screen). `monthly-close-panel` is a "deliberate ritual" with a full summary review before acting, surfaced on a dedicated accounting workflow page. The difference is real, but it was not intentionally designed — it emerged from migration history.

3. **`period-close-dialog` is a degraded close experience.** It offers zero pre-flight visibility: no balance check display, no draft warning, no document counts. The API will still reject an unbalanced or draft-carrying period, but the user sees only a toast error with no actionable context. The panel surfaces all of this proactively.

4. **Permission model is inconsistent across both surfaces.** The dialog page requires `accounting-config:write`; the panel page requires `journal:read`. Both ultimately need `period:close` at the API. Neither page conditionally hides the trigger based on `period:close` — access control is entirely deferred to the API response. This means:
   - A user with `journal:read` but not `period:close` can navigate the full panel summary and only fail at the confirmation step.
   - A user with `accounting-config:write` but not `period:close` can click "Cerrar" in the period table and see a 403 toast.

5. **Neither surface shows the `correlationId` or links to the close-event audit viewer.** The design.md describes the intended post-close UX ("Período cerrado. 147 documentos bloqueados. Ver evento de auditoría →") but neither component implements it. This is a missing feature in both.

6. **`monthly-close-panel` is placed in `components/settings/` but belongs to `components/accounting/`.** This is a directory inconsistency introduced during the cierre-periodo implementation. It is cosmetic but creates confusion.

7. **No third close surface found.** Search across `app/`, `components/`, and `features/` found no other component rendering or calling the close endpoint beyond the two documented here plus the legacy `PATCH /periods/[periodId]` route (which now returns 410 Gone for close payloads).

8. **The confirmation UX within `monthly-close-panel` is itself a mini-dialog.** This means the panel has a dialog-within-a-page pattern, while the `period-close-dialog` is a dialog-within-a-dialog (or dialog launched from a table action). Both converge on a confirmation step, just with different amounts of pre-close context.

---

## Open questions for proposal phase

1. **Should `/settings/periods` retain a close action at all?** If the canonical close workflow lives at `/accounting/monthly-close`, is the "Cerrar" button in the period table an intentional convenience shortcut (for admins who want a fast inline action) or an accident of incomplete migration? The answer determines whether `period-close-dialog` is deleted or kept with improved UX.

2. **If `period-close-dialog` is kept, should it gain a summary step?** The dialog currently fires blind. Should it call `GET /monthly-close/summary` before enabling the submit button, mirroring the panel? Or is the design intent for this path to be a "fast-path close" where the admin accepts the risk of an API rejection?

3. **What permission should gate the `/settings/periods` page?** Currently it requires `accounting-config:write`, which is an admin-oriented write permission. But the close button inside requires `period:close`. Should the page show the close button only when the user also has `period:close`? Should the page permission itself be `period:close`?

4. **What permission should gate the `/accounting/monthly-close` page?** Currently `journal:read` — a read permission — gates a page that can trigger a destructive write. Should this be `period:close` instead? Or is `journal:read` the right gate for the summary view, with the close button itself conditionally rendered based on `period:close`?

5. **Should post-close UX show the `correlationId` / audit-trail link in both, one, or neither surface?** The design intended a "Ver evento de auditoría →" link. This is missing from both components. If the surfaces are unified or the canonical surface is designated, this feature needs to be scoped in.

6. **Is the `components/settings/` directory placement of `monthly-close-panel` intentional?** If the canonical surface is the `/accounting/monthly-close` page, the component should live in `components/accounting/`. This is a refactor task but has downstream import impact.
