# Proposal: organization-profile

_Generated: 2026-04-19 | Phase: sdd-propose | Status: DRAFT | Artifact store: hybrid_
_Prior: see `exploration.md` (user decisions in the launch prompt supersede exploration recommendations where they diverge)_

---

## Intent

Today the system stores **zero company identity data** — there is no NIT, address, phone, or logo anywhere, and no foundation for signature blocks on printed documents. Operational documents will eventually be printed, but the data layer that those PDFs must read from does not exist yet.

This change builds **the data model and the settings UI** for company identity and signature-block configuration. No PDF work is included — future PDF renderers will consume what this change persists.

## Goal

Persist per-organization company identity (razón social, NIT, dirección, etc.) plus a per-document-type signature configuration, and expose both through an admin-only settings page at `/settings/company`.

## Approach

### Split storage cleanly

Add a new 1:1 `OrgProfile` model next to `OrgSettings`. `OrgSettings` stays accounting-focused; `OrgProfile` owns business-identity fields. This follows the existing 1:1 Organization → OrgSettings pattern and keeps services, repos, and routes separated by concern.

### Signature blocks are action-based, not person-based

Two independent categories per document type — no role coupling, no signer-name storage:

1. **Internal labels** — user picks 0..N values from a fixed `SignatureLabel` enum (ELABORADO, APROBADO, VISTO_BUENO, PROPIETARIO, REVISADO, REGISTRADO, CONTABILIZADO) and orders them. PDF renders `[label]` over a blank line where personnel physically sign with their own seal. **No pre-printed name.**
2. **Receiver row** — a single boolean flag (`showReceiverRow`) that toggles a three-field row (`Nombre y Apellido | C.I. | Firma`) for third-party recipients (e.g., a client signing a Cobro).

**Why this is cleaner than a role-based design**: a role model (`propietario`, `contador`, `auxiliar`…) would have to track people, tie to RBAC roles, and break every time personnel change. Action-based labels are stable, flexible (same person can sign as ELABORADO on one doc and REVISADO on another), require no user management, and the blank line below each label lets the existing personal seal do the identification work.

### One row per (org, documentType)

`DocumentSignatureConfig` stores an ordered `SignatureLabel[]` plus `showReceiverRow` for each of the 8 `DocumentPrintType` values. `@@unique([orgId, documentType])` gives clean upsert semantics. Each document type is configured independently — no implicit sharing.

### UI is deliberately simple (MVP)

REST + `useState + fetch`, matching `OrgSettingsForm`. Reorder via up/down buttons, not drag-and-drop. Three form sections: Identidad, Logo, Bloques de firma. Logo upload goes through Vercel Blob.

## Scope

### In Scope

- New Prisma model `OrgProfile` (1:1 with Organization) — 7 scalar fields + audit fields.
- New Prisma enums `SignatureLabel` (7 values) and `DocumentPrintType` (8 values).
- New Prisma model `DocumentSignatureConfig` with `(orgId, documentType)` uniqueness, ordered `SignatureLabel[]`, and `showReceiverRow` flag.
- New service + repository + validation for `OrgProfile`.
- New service + repository + validation for `DocumentSignatureConfig`.
- New API route for company profile CRUD (`PATCH` upsert).
- New API route for signature config CRUD (per doc type).
- Vercel Blob upload endpoint for `logoUrl`.
- New page `app/(dashboard)/[orgSlug]/settings/company/page.tsx` guarded by `requirePermission("accounting-config", "write", orgSlug)`.
- New settings-hub card "Perfil de Empresa" (8th card).
- `OrgProfileService.getOrCreate(orgId)` pattern for orgs without a profile row.
- Prisma migration for all new tables + enums.

### Out of Scope (explicit deferrals)

- **PDF renderers for operational documents** (Comprobante, Venta, Compra, Cobro, Pago, Despacho) — large separate effort; this change only persists the data they will later consume.
- **EEFF orgName bugfix** (`orgSlug` → `OrgProfile.razonSocial` in Balance General / Estado de Resultados PDFs) — trivial, but deferred so this change stays PDF-free.
- **Personnel / directives storage** (mentioned in exploration) — not included in the locked data model; out of scope.
- **Signer-name storage on signature blocks** — explicitly rejected by the user; labels only.
- **New RBAC resource** — reuse `accounting-config:write` (confirmed appropriate).
- **Drag-and-drop label reordering** — MVP uses up/down buttons.

## Capabilities

> Contract with sdd-spec. Research `openspec/specs/` before authoring specs.

### New Capabilities

- `organization-profile`: persists per-organization business identity (razón social, NIT, dirección, ciudad, teléfono, nro patronal, logo) and per-document-type signature configuration (ordered internal labels + receiver-row toggle).

### Modified Capabilities

- None. `org-settings` is untouched by this change — no shared fields, no existing form altered.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add `OrgProfile`, `DocumentSignatureConfig`, enums `SignatureLabel`, `DocumentPrintType`; add relations on `Organization`. |
| `prisma/migrations/` | New | Migration creating both tables and both enums. |
| `features/org-profile/` | New | Service, repository, validation for company profile. |
| `features/document-signature-config/` | New | Service, repository, validation for signature configs. |
| `app/api/organizations/[orgSlug]/profile/route.ts` | New | GET + PATCH for `OrgProfile`. |
| `app/api/organizations/[orgSlug]/profile/logo/route.ts` | New | POST for Vercel Blob logo upload. |
| `app/api/organizations/[orgSlug]/signature-configs/route.ts` | New | GET list + PATCH per `documentType`. |
| `app/(dashboard)/[orgSlug]/settings/company/page.tsx` | New | RSC guarded by `requirePermission("accounting-config", "write", orgSlug)`; hydrates client form. |
| `components/settings/org-profile-form.tsx` | New | Client component, `useState + fetch`; three sections (Identidad, Logo, Bloques de firma). |
| `app/(dashboard)/[orgSlug]/settings/page.tsx` | Modified | Add 8th card "Perfil de Empresa". |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prisma 7 enum-array column (`SignatureLabel[]`) syntax differs from earlier versions. | Med | Design phase verifies against `node_modules/next/dist/docs/` and Prisma 7 release notes before migration is drafted. |
| Vercel Blob SDK (`@vercel/blob` 2.3.1) API differs from older examples. | Med | Design phase pins the exact upload pattern against the installed version; size limit + MIME whitelist defined there. |
| A user navigates to a future operational-doc PDF route before signature config is set. | Low | PDFs are out of scope; but signature config defaults to `labels: []` + `showReceiverRow: false`, so a future renderer would simply skip signature rows without crashing. |
| Orgs created before this change have no `OrgProfile` row. | High (expected) | `OrgProfileService.getOrCreate(orgId)` creates a blank row on first read, mirroring `OrgSettingsService`. |
| Clerk multi-tenant scoping — every query must pass `orgId`. | Med | Repository layer enforces `orgId` on all methods; services resolve `orgId` from `orgSlug` before delegating. |
| Logo upload leaves orphaned blobs if save fails. | Low | Design-phase decision: upload only on form submit, or delete prior blob URL when a new one replaces it. |

## Rollback Plan

1. Revert the commit adding `OrgProfile`, `DocumentSignatureConfig`, and both enums.
2. Run `prisma migrate resolve --rolled-back` then `prisma migrate deploy` against a migration that drops both tables and both enums.
3. Remove the `/settings/company` route and the 8th settings card.
4. No existing data references these tables — drop is safe.

## Dependencies

- `@vercel/blob` 2.3.1 — already installed.
- Prisma 7.5.0 generated client at `generated/prisma/` — already set up.
- `requirePermission` from `@/features/shared/permissions.server` — already available; no RBAC changes.
- Strict TDD Mode is active — all new services/repos/validation require tests authored alongside them.

## Success Criteria

- [ ] An admin (`owner`/`admin` role) visits `/settings/company`, fills in identity fields, uploads a logo, configures signature blocks for each of the 8 `DocumentPrintType` values, and saves successfully.
- [ ] `OrgProfile` is upserted with all 7 fields; `logoUrl` resolves to a Vercel Blob URL; all 8 `DocumentSignatureConfig` rows persist with correct ordered `labels` and `showReceiverRow`.
- [ ] Non-admin users receive a 403 from `requirePermission("accounting-config", "write", orgSlug)`.
- [ ] An org without an existing profile sees a blank form (via `getOrCreate`) without error.
- [ ] Prisma migration applies cleanly to a dev DB and rolls back cleanly.
- [ ] All new services, repositories, and validators have accompanying tests (Strict TDD Mode).
- [ ] No existing PDF or settings page is altered.

## Open Questions (for spec/design phases)

1. **Logo constraints**: max size (e.g., 2 MB), allowed MIME (`image/png`, `image/jpeg`, `image/svg+xml`?), max dimensions — decide in design phase.
2. **Teléfono format**: locked as free text allowing `/` or `,` separators — confirm no validation beyond non-empty required.
3. **Signature config read shape**: does the form fetch all 8 configs in one GET, or one per doc type? Design phase.
4. **API method for signature config**: single `PATCH /signature-configs` with full payload, or per-doc-type `PATCH /signature-configs/[documentType]`? Design phase.
5. **Migration seeding**: should the migration seed 8 blank `DocumentSignatureConfig` rows per existing org, or rely on `getOrCreate` lazily? Design phase.
6. **Delete-vs-reorder of internal labels**: up/down is locked — confirm "remove" is also a per-row button, not a bulk checkbox list. Spec phase.
