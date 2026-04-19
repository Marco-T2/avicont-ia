# Spec: organization-profile

**Change**: organization-profile
**Date**: 2026-04-19
**Status**: DRAFT
**Artifact Store**: hybrid (engram + filesystem)
**Proposal**: openspec/changes/organization-profile/proposal.md

---

## 1. Capability

**`organization-profile`** — Per-organization business identity and per-document-type signature configuration.

Persists company identity (razón social, NIT, dirección, ciudad, teléfono, nro patronal, logoUrl) in a 1:1 `OrgProfile` model, and per-document-type signature blocks (ordered `SignatureLabel[]` + `showReceiverRow` flag) in `DocumentSignatureConfig`. Exposes both through an admin-only settings page at `/settings/company`. No PDF rendering is included — future renderers consume what this change persists.

---

## 2. Requirements

### REQ-OP.1 — OrgProfile Persistence

The system MUST lazily create a blank `OrgProfile` row for an organization that has none (`getOrCreate` semantics), and MUST upsert (partial PATCH) an existing row without touching omitted fields.

#### Scenario: First read creates blank profile

- GIVEN an organization exists with no `OrgProfile` row
- WHEN `OrgProfileService.getOrCreate(orgId)` is called
- THEN a new `OrgProfile` row is inserted with all scalar fields as empty strings or `null`
- AND the row is returned to the caller
- AND a second call returns the same row without inserting again

#### Scenario: PATCH updates only supplied fields

- GIVEN an `OrgProfile` row exists with `razonSocial = "Empresa A"` and `ciudad = "La Paz"`
- WHEN a PATCH request is received with `{ "ciudad": "Cochabamba" }`
- THEN only `ciudad` is updated to `"Cochabamba"`
- AND `razonSocial` remains `"Empresa A"`
- AND `updatedAt` is refreshed

#### Scenario: Duplicate OrgProfile creation is rejected

- GIVEN an `OrgProfile` row already exists for `orgId = "org-1"`
- WHEN a raw `CREATE` is attempted for the same `orgId`
- THEN the database unique constraint throws
- AND the service propagates a domain error (not a 500)

---

### REQ-OP.2 — OrgProfile Validation

The system MUST reject `OrgProfile` updates that violate field-level rules. Validation MUST run server-side before any database write. Errors MUST be returned as structured field-level messages.

| Field | Rule |
|---|---|
| `razonSocial` | Required, non-empty after trim, max 200 chars |
| `nit` | Required, non-empty after trim, max 50 chars |
| `direccion` | Required, non-empty after trim, max 300 chars |
| `ciudad` | Required, non-empty after trim, max 100 chars |
| `telefono` | Required, non-empty after trim, max 100 chars; allows `/` and `,` |
| `nroPatronal` | Optional; when present, max 50 chars |
| `logoUrl` | Optional; when present, MUST be a valid URL on the Vercel Blob domain pattern |

#### Scenario: Valid partial update passes validation

- GIVEN a PATCH body `{ "nit": "1234567", "ciudad": "Sucre" }`
- WHEN the validation layer runs
- THEN validation passes
- AND the repository upsert is called with the trimmed values

#### Scenario: Empty required field is rejected

- GIVEN a PATCH body `{ "razonSocial": "   " }` (whitespace-only)
- WHEN the validation layer runs
- THEN validation fails with a field error on `razonSocial`
- AND the error message references the field name
- AND no database write is made

#### Scenario: Over-length field is rejected

- GIVEN a PATCH body `{ "direccion": "<string of 301 chars>" }`
- WHEN the validation layer runs
- THEN validation fails with a field error on `direccion`

#### Scenario: Invalid logoUrl is rejected

- GIVEN a PATCH body `{ "logoUrl": "not-a-url" }`
- WHEN the validation layer runs
- THEN validation fails with a field error on `logoUrl`

---

### REQ-OP.3 — Logo Upload

The system MUST provide a dedicated endpoint that uploads a file to Vercel Blob and returns the resulting URL. The endpoint MUST validate MIME type and file size before uploading.

#### Scenario: Valid image upload succeeds

- GIVEN a POST request with a valid image file (MIME in the server whitelist, size within limit)
- WHEN the upload endpoint processes the request
- THEN the file is written to Vercel Blob
- AND the endpoint returns `{ "logoUrl": "<blob-url>" }` with HTTP 200
- AND the returned URL matches the Vercel Blob domain pattern

#### Scenario: Non-image MIME type is rejected before upload

- GIVEN a POST request with a file whose MIME type is not in the server whitelist (e.g. `application/pdf`)
- WHEN the upload endpoint runs server-side MIME validation
- THEN the file is NOT uploaded to Vercel Blob
- AND the endpoint returns HTTP 400 with a structured error identifying `mimeType`

#### Scenario: Oversized file is rejected before upload

- GIVEN a POST request with an image file exceeding the configured maximum file size
- WHEN the upload endpoint runs server-side size validation
- THEN the file is NOT uploaded to Vercel Blob
- AND the endpoint returns HTTP 400 with a structured error identifying `fileSize`

---

### REQ-OP.4 — DocumentSignatureConfig Persistence

The system MUST store one `DocumentSignatureConfig` row per `(orgId, documentType)` pair. Missing configs MUST be treated as `{ labels: [], showReceiverRow: false }` — no seeding on org creation. Each config MUST be upserted independently by `documentType`.

#### Scenario: First upsert creates config row

- GIVEN no `DocumentSignatureConfig` exists for `(orgId="org-1", documentType=COMPROBANTE)`
- WHEN a PATCH for `COMPROBANTE` is received with `{ "labels": ["ELABORADO", "APROBADO"], "showReceiverRow": false }`
- THEN a new row is inserted with `labels = ["ELABORADO", "APROBADO"]` and `showReceiverRow = false`
- AND `@@unique([orgId, documentType])` constraint is satisfied

#### Scenario: Second upsert replaces labels in place

- GIVEN a `DocumentSignatureConfig` row exists for `(org-1, COMPROBANTE)` with `labels = ["ELABORADO"]`
- WHEN a PATCH is received with `{ "labels": ["APROBADO", "CONTABILIZADO"] }`
- THEN the row is updated: `labels = ["APROBADO", "CONTABILIZADO"]`
- AND no second row is created

#### Scenario: Missing config returns default shape

- GIVEN no `DocumentSignatureConfig` row exists for `(org-1, VENTA)`
- WHEN the service reads the config for `VENTA`
- THEN it returns `{ documentType: "VENTA", labels: [], showReceiverRow: false }`
- AND no row is inserted as a side-effect of the read

---

### REQ-OP.5 — DocumentSignatureConfig Validation

The system MUST validate `DocumentSignatureConfig` updates before any database write.

| Field | Rule |
|---|---|
| `documentType` | MUST be one of the 8 `DocumentPrintType` enum values |
| `labels` | MAY be empty; MUST NOT contain duplicate `SignatureLabel` values |
| `labels[*]` | Each value MUST be one of the 7 `SignatureLabel` enum values |
| `showReceiverRow` | MUST be a boolean |

#### Scenario: Valid config with ordered labels passes

- GIVEN a PATCH body `{ "documentType": "COBRO", "labels": ["ELABORADO", "APROBADO", "VISTO_BUENO"], "showReceiverRow": true }`
- WHEN validation runs
- THEN validation passes
- AND `labels` order is preserved exactly as submitted for storage

#### Scenario: Duplicate labels are rejected

- GIVEN a PATCH body `{ "documentType": "VENTA", "labels": ["ELABORADO", "ELABORADO"] }`
- WHEN validation runs
- THEN validation fails with a field error on `labels` citing duplicate values
- AND no database write is made

#### Scenario: Unknown documentType is rejected

- GIVEN a PATCH body `{ "documentType": "FACTURA", "labels": [] }`
- WHEN validation runs
- THEN validation fails with a field error on `documentType`

#### Scenario: Empty labels array is valid

- GIVEN a PATCH body `{ "documentType": "PAGO", "labels": [], "showReceiverRow": false }`
- WHEN validation runs
- THEN validation passes
- AND the row is upserted with `labels = []`

---

### REQ-OP.6 — RBAC

All `OrgProfile` and `DocumentSignatureConfig` routes MUST be guarded by `requirePermission("accounting-config", "write", orgSlug)`. Non-owners/admins MUST receive HTTP 403. Cross-org attempts MUST be blocked.

#### Scenario: Admin accesses profile route

- GIVEN a user with role `owner` or `admin` in org `"acme"`
- WHEN they send a GET or PATCH to `/api/organizations/acme/profile`
- THEN `requirePermission("accounting-config", "write", "acme")` resolves
- AND the handler proceeds normally

#### Scenario: Non-admin receives 403

- GIVEN a user with role `member` (no `accounting-config:write` in matrix)
- WHEN they send a PATCH to `/api/organizations/acme/profile`
- THEN `requirePermission` throws
- AND the route returns HTTP 403
- AND no database write is made

#### Scenario: Cross-org access blocked

- GIVEN an authenticated `owner` of org `"beta"`
- WHEN they send a PATCH to `/api/organizations/acme/profile` (different org)
- THEN `requireOrgAccess` inside `requirePermission` throws (user not a member of `"acme"`)
- AND the route returns HTTP 403 or 404

---

### REQ-OP.7 — Multi-Tenant Isolation

Every repository method for `OrgProfile` and `DocumentSignatureConfig` MUST include `orgId` as a mandatory filter on every query. Cross-org access MUST be impossible by construction at the repository layer.

#### Scenario: Repository always scopes by orgId

- GIVEN `OrgProfileRepository.findByOrgId(orgId)` is called with `orgId = "org-1"`
- WHEN the Prisma query executes
- THEN the `WHERE` clause includes `orgId = "org-1"`
- AND rows belonging to any other org are never returned

#### Scenario: No unscoped query is possible

- GIVEN a repository method signature for `OrgProfile` or `DocumentSignatureConfig`
- WHEN the method is invoked
- THEN `orgId` MUST be a required parameter (no optional overload that omits it)
- AND TypeScript enforces this at compile time

---

### REQ-OP.8 — Settings Hub Entry

The settings hub page MUST display an 8th card titled **"Perfil de Empresa"** linking to `/{orgSlug}/settings/company`. The card MUST appear only when the user has `accounting-config:read` permission (consistent with the existing hub pattern).

#### Scenario: Admin sees 8th card

- GIVEN a user with `owner` or `admin` role visits `/{orgSlug}/settings`
- WHEN the hub renders
- THEN 8 cards are visible
- AND the 8th card has title "Perfil de Empresa"
- AND clicking it navigates to `/{orgSlug}/settings/company`

#### Scenario: Member does not see card (if hub gates per-card)

- GIVEN a user with `member` role (no `accounting-config:read`) visits `/{orgSlug}/settings`
- WHEN the hub renders
- THEN the "Perfil de Empresa" card is absent OR the hub redirects before rendering

---

### REQ-OP.9 — Settings Page Route

The `/settings/company` page MUST be a React Server Component guarded by `requirePermission("accounting-config", "write", orgSlug)`. It MUST hydrate the client form with the current `OrgProfile` and all existing `DocumentSignatureConfig` rows before returning HTML.

#### Scenario: Admin loads company settings page

- GIVEN a user with `admin` role navigates to `/{orgSlug}/settings/company`
- WHEN the server component executes
- THEN `requirePermission("accounting-config", "write", orgSlug)` is called first
- AND `OrgProfileService.getOrCreate(orgId)` is called to fetch (or create) the profile
- AND all existing `DocumentSignatureConfig` rows for the org are fetched
- AND the client form component receives both as props
- AND no redirect is triggered

#### Scenario: Non-admin is redirected

- GIVEN a user with `member` role navigates to `/{orgSlug}/settings/company`
- WHEN the server component executes
- THEN `requirePermission` throws
- AND `redirect(\`/${orgSlug}\`)` is called
- AND no form is rendered

---

### REQ-OP.10 — Company Form Sections

The client form component MUST render three distinct sections: **Identidad**, **Logo**, and **Bloques de firma**. The Bloques de firma section MUST support per-docType label selection, order preservation via up/down buttons, individual label removal, and `showReceiverRow` toggle.

#### Scenario: User reorders labels with up/down buttons

- GIVEN the Bloques de firma section shows labels `["ELABORADO", "APROBADO", "VISTO_BUENO"]` for docType `COMPROBANTE`
- WHEN the user clicks the down button on `"ELABORADO"`
- THEN the local state becomes `["APROBADO", "ELABORADO", "VISTO_BUENO"]`
- AND no network request is made until "Guardar" is clicked

#### Scenario: User removes a label

- GIVEN the Bloques de firma section shows labels `["ELABORADO", "APROBADO"]`
- WHEN the user removes `"ELABORADO"`
- THEN the local state becomes `["APROBADO"]`

#### Scenario: User toggles showReceiverRow

- GIVEN `showReceiverRow` is `false` for `COBRO`
- WHEN the user toggles the checkbox
- THEN local state sets `showReceiverRow = true` for `COBRO`
- AND saving persists `showReceiverRow: true` to the server

#### Scenario: Guardar submits all dirty sections

- GIVEN the user changed `razonSocial` in Identidad and reordered labels for `COMPROBANTE`
- WHEN they click "Guardar"
- THEN a PATCH to `/api/organizations/{orgSlug}/profile` is sent with the updated identity fields
- AND a PATCH for `COMPROBANTE` config is sent with the new label order
- AND on success the form reflects the saved state

---

## 3. Acceptance Criteria

- [ ] **REQ-OP.1**: `OrgProfileService.getOrCreate(orgId)` creates a blank row on first call; subsequent calls return the same row
- [ ] **REQ-OP.1**: PATCH updates only supplied fields; omitted fields are unchanged
- [ ] **REQ-OP.2**: All 7 field rules enforced server-side; structured field-level errors returned on violation
- [ ] **REQ-OP.3**: Upload endpoint validates MIME + size before writing to Vercel Blob; returns `logoUrl` on success
- [ ] **REQ-OP.4**: `DocumentSignatureConfig` upserts by `(orgId, documentType)`; missing configs return default shape without inserting
- [ ] **REQ-OP.5**: Duplicate labels rejected; empty labels array accepted; order preserved exactly
- [ ] **REQ-OP.6**: All routes gate on `requirePermission("accounting-config", "write", orgSlug)`; non-admins get 403
- [ ] **REQ-OP.7**: Every repo method includes mandatory `orgId` filter; TypeScript enforces at compile time
- [ ] **REQ-OP.8**: Settings hub shows 8th card "Perfil de Empresa" for owners/admins
- [ ] **REQ-OP.9**: `/settings/company` page calls `requirePermission` first, then hydrates form server-side
- [ ] **REQ-OP.10**: Form has 3 sections; up/down reorder, label removal, showReceiverRow toggle all work client-side before save
- [ ] All new services, repos, and validators have vitest tests (Strict TDD Mode: RED → GREEN → REFACTOR)

---

## 4. Non-Requirements (Explicit Exclusions)

- PDF renderers for operational documents (Comprobante, Venta, Compra, Cobro, Pago, Despacho) — deferred
- EEFF orgName fix (`orgSlug` → `OrgProfile.razonSocial` in existing PDFs) — deferred
- Signer-name or personnel storage on signature blocks — explicitly rejected
- Drag-and-drop label reordering — MVP uses up/down buttons only
- New RBAC resource — reuses `accounting-config:write`
- `DocumentSignatureConfig` seeding on organization creation — lazy `getOrCreate` per doc type

---

## 5. Dependencies

| Dependency | Status |
|---|---|
| `@vercel/blob` 2.3.1 — installed | Ready |
| Prisma 7.5.0 client at `generated/prisma/` | Ready |
| `requirePermission` from `@/features/shared/permissions.server` | Ready |
| `accounting-config:write` allows `["owner", "admin"]` | Confirmed |
| Strict TDD Mode | Active |

---

## 6. Open Questions (Assumed for Spec)

1. **Logo constraints (size + MIME whitelist)**: Delegated to design phase. Spec states "server validates MIME type and rejects non-image uploads" and "server enforces a maximum file size" without pinning exact values.
2. **API shape for signature configs**: Single `PATCH /signature-configs` with full payload vs. per-doc-type — delegated to design phase.
3. **Label removal UX**: Assumed as a per-label remove button alongside up/down buttons (not a bulk checkbox approach). Confirmed in B8.
4. **Migration seeding**: No seeding on org creation — lazy getOrCreate is the contract (B3). Design phase may revisit for existing orgs.
