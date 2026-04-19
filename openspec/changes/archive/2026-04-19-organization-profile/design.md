# Design: organization-profile

**Change**: organization-profile
**Date**: 2026-04-19
**Status**: APPROVED-FOR-IMPLEMENTATION
**Artifact Store**: hybrid (engram + filesystem)
**Prior**: `openspec/changes/organization-profile/proposal.md`, `openspec/changes/organization-profile/specs/organization-profile/spec.md`, `openspec/changes/organization-profile/exploration.md`

---

## 1. Technical Approach

Mirror the existing `OrgSettings` feature exactly: one Prisma model per concern, `Service` → `Repository` → `Prisma` with `orgId` mandatory at the repo boundary, `zod` validators shared between API route and client, `useState + fetch` client form, `requirePermission("accounting-config", "write", orgSlug)` on every route. Add **Vercel Blob** only for the logo endpoint.

Two independent resources: `OrgProfile` (1:1 with Organization) and `DocumentSignatureConfig` (one row per `(orgId, documentType)`). No eager seeding — both use lazy `getOrCreate`. API surface is strictly REST + PATCH upsert.

---

## 2. Architecture Overview

```
Browser (company-profile-form.tsx, useState slices)
   │  fetch PATCH/POST JSON or multipart
   ▼
API Routes (app/api/organizations/[orgSlug]/…)
   │  requirePermission → zod parse → service
   ▼
Service (OrgProfileService / DocumentSignatureConfigService)
   │  resolves orgId from orgSlug context; enforces getOrCreate
   ▼
Repository (orgId-scoped Prisma calls, extends BaseRepository)
   │
   ▼
Prisma 7.5.0 → PostgreSQL (org_profile, document_signature_config)

Logo upload side-channel:
Browser (logo-uploader.tsx) ── multipart/form-data ──► POST /profile/logo
                                                       ├─ validate MIME+size
                                                       ├─ put(path, file, {access:"public", addRandomSuffix:true})
                                                       ├─ old-URL delete best-effort
                                                       └─ return { url }
```

---

## 3. Key Decisions

| # | Decision | Alternatives rejected | Rationale |
|---|---|---|---|
| D1 | `OrgProfile` 1:1 model, separate from `OrgSettings` | Extend OrgSettings; JSON column | Matches locked proposal; avoids god table. |
| D2 | Prisma enum array `SignatureLabel[]` stored as PG native enum array | `String[]`; join table | Proposal Alt C2 confirmed; PG + Prisma 7 supports enum arrays natively (`enumname[]`). |
| D3 | Lazy `getOrCreate` for both models — NO data migration seeding | Seed 1 row × N orgs on migration | Keeps migration empty; works uniformly for existing + new orgs. |
| D4 | **Logo max 2 MB**, MIME whitelist `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` | 5 MB; PNG-only | 2 MB covers any sane logo; SVG included for vector logos used in PDFs. |
| D5 | Blob path `org-logos/<orgId>/<uuid>.<ext>` with `addRandomSuffix: true` | Deterministic `logo` filename | Random suffix prevents overwrite errors; `orgId` scope eases future audit. |
| D6 | **Upload on file-select** — `POST /profile/logo` returns URL; stored in local state; committed by final `PATCH /profile` | Upload on submit (multipart in PATCH body) | Keeps main PATCH JSON-only; UX stays snappy. Orphan risk handled by D7. |
| D7 | On successful `PATCH /profile` with a new `logoUrl`, best-effort `del(oldUrl)` from the prior `OrgProfile.logoUrl` | Never delete; scheduled sweeper | Simple write-then-replace; failures logged, not blocking. |
| D8 | **Per-doc-type** endpoint: `PATCH /signature-configs/[documentType]` + `GET /signature-configs` (list) | Bulk payload PATCH | One failed config doesn't invalidate others; spec REQ-OP.4 already upserts per-(orgId, documentType). |
| D9 | **Per-section save buttons** (Identidad, Logo, per-docType block) | Single "Guardar todo" | Clearer error scoping, less invalidation, matches service boundaries. |
| D10 | **Dropdown** doc-type selector in Bloques de firma (8 values) | Tabs | 8 tabs wrap ugly; dropdown is cleaner for 8+. |
| D11 | **Inline × remove** per label + up/down buttons (user-confirmed) | Checkbox bulk select | Matches confirmed UX. |
| D12 | Zod schemas live in `features/*/validation.ts`, imported by both API route (server) and form (client) for shared types | Duplicate client schemas | Single source of truth; tree-shake-safe since zod is client-compatible. |
| D13 | Toast via `sonner` (`toast.success`/`toast.error`); inline field errors from zod response | `alert()` | `sonner` already installed; matches modern app patterns. |
| D14 | Every repo method takes `orgId` as **first required arg** | Optional scope | Enforces REQ-OP.7 at compile time. |

---

## 4. Prisma Schema Block

Add inside `prisma/schema.prisma` (after `OrgSettings`):

```prisma
enum SignatureLabel {
  ELABORADO
  APROBADO
  VISTO_BUENO
  PROPIETARIO
  REVISADO
  REGISTRADO
  CONTABILIZADO
}

enum DocumentPrintType {
  BALANCE_GENERAL
  ESTADO_RESULTADOS
  COMPROBANTE
  DESPACHO
  VENTA
  COMPRA
  COBRO
  PAGO
}

model OrgProfile {
  id             String   @id @default(cuid())
  organizationId String   @unique
  razonSocial    String   @default("")
  nit            String   @default("")
  direccion      String   @default("")
  ciudad         String   @default("")
  telefono       String   @default("")
  nroPatronal    String?
  logoUrl        String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@map("org_profile")
}

model DocumentSignatureConfig {
  id               String             @id @default(cuid())
  organizationId   String
  documentType     DocumentPrintType
  labels           SignatureLabel[]
  showReceiverRow  Boolean            @default(false)
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt
  organization     Organization       @relation(fields: [organizationId], references: [id])

  @@unique([organizationId, documentType])
  @@index([organizationId])
  @@map("document_signature_config")
}
```

And on `Organization` add two relations:

```prisma
profile                 OrgProfile?
documentSignatureConfigs DocumentSignatureConfig[]
```

**Prisma 7.5 enum-array note**: Postgres supports enum arrays natively; Prisma generates `SignatureLabel[]` as `_SignatureLabel` Postgres array; order is preserved. Confirmed against Prisma 7 docs.

---

## 5. Migration Strategy

Single migration `YYYYMMDDHHMMSS_add_organization_profile` that:

1. `CREATE TYPE "SignatureLabel" AS ENUM (...)` (7 values)
2. `CREATE TYPE "DocumentPrintType" AS ENUM (...)` (8 values)
3. `CREATE TABLE "org_profile" (...)` with unique `organizationId`, FK
4. `CREATE TABLE "document_signature_config" (...)` with unique `(organizationId, documentType)`, FK, index
5. No `INSERT` statements — lazy `getOrCreate` handles all existing orgs on first access.

Rollback = drop both tables and both enums; safe because no existing data references them.

---

## 6. Service Layer

**`features/org-profile/org-profile.service.ts`** (class, DI-friendly repo):

```ts
class OrgProfileService {
  constructor(private repo = new OrgProfileRepository()) {}
  async getOrCreate(orgId: string): Promise<OrgProfile>;
  async update(orgId: string, patch: UpdateOrgProfileInput): Promise<OrgProfile>;
  async updateLogo(orgId: string, newUrl: string): Promise<OrgProfile>;
  // best-effort — never throws
  async deleteLogoBlob(url: string): Promise<void>;
}
```

- `update` calls `getOrCreate(orgId)` first (same guard as `OrgSettingsService.update`).
- `updateLogo` is `update(orgId, { logoUrl: newUrl })` then `deleteLogoBlob(previousUrl)` best-effort.

**`features/document-signature-config/document-signature-config.service.ts`**:

```ts
class DocumentSignatureConfigService {
  constructor(private repo = new DocumentSignatureConfigRepository()) {}
  /** returns all 8 doc types with defaults for missing rows (no inserts) */
  async listAll(orgId: string): Promise<DocumentSignatureConfigView[]>;
  async getOrDefault(orgId: string, docType: DocumentPrintType): Promise<DocumentSignatureConfigView>;
  async upsert(orgId: string, docType: DocumentPrintType, patch: UpdateSignatureConfigInput): Promise<DocumentSignatureConfig>;
}
```

`DocumentSignatureConfigView = { documentType, labels, showReceiverRow }` — flat, no DB ids, covers the "missing = default shape" contract in REQ-OP.4.

---

## 7. Repository Layer

Both extend `BaseRepository` (auto-injects `prisma`).

```ts
class OrgProfileRepository extends BaseRepository {
  findByOrgId(orgId: string): Promise<OrgProfile | null>;
  create(orgId: string): Promise<OrgProfile>;                        // all strings default ""
  update(orgId: string, data: UpdateOrgProfileInput): Promise<OrgProfile>;
}

class DocumentSignatureConfigRepository extends BaseRepository {
  findMany(orgId: string): Promise<DocumentSignatureConfig[]>;       // scoped
  findOne(orgId: string, docType: DocumentPrintType): Promise<DocumentSignatureConfig | null>;
  upsert(orgId: string, docType: DocumentPrintType, data: UpdateSignatureConfigInput): Promise<DocumentSignatureConfig>;
}
```

Every method's first parameter is `orgId: string`. No overload exists that omits it. REQ-OP.7 satisfied at compile time.

---

## 8. Validation Layer (zod)

**`features/org-profile/org-profile.validation.ts`**:

```ts
export const updateOrgProfileSchema = z.object({
  razonSocial: z.string().trim().min(1).max(200).optional(),
  nit:         z.string().trim().min(1).max(50).optional(),
  direccion:   z.string().trim().min(1).max(300).optional(),
  ciudad:      z.string().trim().min(1).max(100).optional(),
  telefono:    z.string().trim().min(1).max(100).optional(),
  nroPatronal: z.string().trim().max(50).optional().nullable(),
  logoUrl:     z.string().url().optional().nullable(),
});
export type UpdateOrgProfileInput = z.infer<typeof updateOrgProfileSchema>;

export const logoUploadConstraints = {
  maxBytes: 2 * 1024 * 1024,
  allowedMimes: ["image/png","image/jpeg","image/webp","image/svg+xml"] as const,
};
```

**`features/document-signature-config/document-signature-config.validation.ts`**:

```ts
export const signatureLabelEnum = z.enum([
  "ELABORADO","APROBADO","VISTO_BUENO","PROPIETARIO","REVISADO","REGISTRADO","CONTABILIZADO",
]);
export const documentPrintTypeEnum = z.enum([
  "BALANCE_GENERAL","ESTADO_RESULTADOS","COMPROBANTE","DESPACHO","VENTA","COMPRA","COBRO","PAGO",
]);

export const updateSignatureConfigSchema = z.object({
  labels: z.array(signatureLabelEnum)
    .refine(arr => new Set(arr).size === arr.length, { message: "duplicate labels" }),
  showReceiverRow: z.boolean(),
});
export type UpdateSignatureConfigInput = z.infer<typeof updateSignatureConfigSchema>;
```

Pure functions, zero side effects — trivially unit-testable.

---

## 9. API Routes

| Method | Path | Body | Response | Errors |
|---|---|---|---|---|
| GET | `/api/organizations/[orgSlug]/profile` | — | `OrgProfile` (after `getOrCreate`) | 401, 403 |
| PATCH | `/api/organizations/[orgSlug]/profile` | `UpdateOrgProfileInput` (JSON) | updated `OrgProfile` | 400 (zod), 401, 403 |
| POST | `/api/organizations/[orgSlug]/profile/logo` | `multipart/form-data` with field `file` | `{ url: string }` | 400 (MIME/size), 401, 403, 502 (blob) |
| GET | `/api/organizations/[orgSlug]/signature-configs` | — | `DocumentSignatureConfigView[]` (8 items, defaults for missing) | 401, 403 |
| PATCH | `/api/organizations/[orgSlug]/signature-configs/[documentType]` | `UpdateSignatureConfigInput` | upserted row | 400 (invalid enum/duplicate/body), 401, 403 |

Error shape (existing convention): `{ error: string, fieldErrors?: Record<string, string[]> }`, produced by `handleError`.

`params: Promise<{ orgSlug: string }>` and `params: Promise<{ orgSlug: string, documentType: string }>` — confirmed against Next.js 16.2.1 docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`).

---

## 10. Page & Components

**RSC — `app/(dashboard)/[orgSlug]/settings/company/page.tsx`**:
- Signature `{ params: Promise<{ orgSlug: string }> }` (Next.js 16 requirement).
- `requirePermission("accounting-config", "write", orgSlug)` first; on throw → `redirect(\`/${orgSlug}\`)`.
- Hydrates `OrgProfile` via `OrgProfileService.getOrCreate(orgId)` and the 8 views via `DocumentSignatureConfigService.listAll(orgId)`.
- Passes both as props to `<CompanyProfileForm>`.

**Client — `components/settings/company-profile-form.tsx`**:
- `"use client"`; orchestrates 3 sections; holds 2 state slices:
  - `const [profile, setProfile] = useState(initialProfile)` (identity + logoUrl)
  - `const [configs, setConfigs] = useState<Record<DocumentPrintType, View>>(initialConfigsByType)`
- Each section has its own "Guardar" button that PATCHes only that slice (D9). On success `router.refresh()` + `toast.success`; on 400 inline field errors; on other → `toast.error`.

**Subcomponents in `components/settings/company/`**:
- `identity-section.tsx` — text inputs for the 7 fields; one save button.
- `logo-uploader.tsx` — file input (`accept="image/png,image/jpeg,image/webp,image/svg+xml"`); POSTs multipart immediately; writes returned URL into parent state; preview `<img>` next to input; save button persists via `PATCH /profile`.
- `signature-config-editor.tsx` — renders one docType's config; receives `docType`, view, `onChange`, `onSave`.
- `label-picker.tsx` — list of chosen labels (each row: label + ↑ + ↓ + `× quitar`) + dropdown "Agregar" for remaining labels; `showReceiverRow` checkbox.
- `doc-type-dropdown.tsx` — shadcn Select with 8 human-readable options; controls which `signature-config-editor` mounts below.

---

## 11. Settings Hub Update

Append one entry in `SETTINGS_CARDS` (`app/(dashboard)/[orgSlug]/settings/page.tsx`):

```ts
{
  id: "company",
  title: "Perfil de Empresa",
  description: "Datos de la empresa y bloques de firma para documentos impresos",
  href: (orgSlug) => `/${orgSlug}/settings/company`,
  Icon: Building2, // from lucide-react
}
```

Also import `Building2` in the existing lucide import block. No gating change needed — the hub already guards with `accounting-config:read`.

---

## 12. Testing Strategy (Strict TDD Mode)

All tests are **vitest**. RED → GREEN → REFACTOR per task.

| Layer | Suite | Cases |
|---|---|---|
| Validation (pure) | `features/org-profile/org-profile.validation.test.ts` | passes valid patch; rejects empty trim; rejects over-length; rejects bad URL; ignores omitted |
| Validation (pure) | `features/document-signature-config/document-signature-config.validation.test.ts` | valid config passes + order preserved; duplicate labels rejected; unknown enum rejected; empty labels OK |
| Repo (mock prisma via DI) | `features/org-profile/org-profile.repository.test.ts` | `findByOrgId` scopes by orgId; `create` inserts defaults; `update` only sets provided fields |
| Repo | `features/document-signature-config/document-signature-config.repository.test.ts` | `findMany` scopes by orgId; `upsert` uses composite unique; order preserved in labels |
| Service | `features/org-profile/org-profile.service.test.ts` | `getOrCreate` returns existing; creates when missing; calls repo once on second call; `updateLogo` swaps URL + calls delete best-effort; delete swallows errors |
| Service | `features/document-signature-config/document-signature-config.service.test.ts` | `listAll` returns 8 views (missing → default shape, no insert); `getOrDefault` never inserts; `upsert` forwards to repo |
| Route | `app/api/organizations/[orgSlug]/profile/route.test.ts` | 403 without permission; 400 on zod fail; 200 returns updated; cross-org blocked |
| Route | `app/api/organizations/[orgSlug]/profile/logo/route.test.ts` | 400 wrong MIME; 400 oversize; 200 returns URL; 403 non-admin |
| Route | `app/api/organizations/[orgSlug]/signature-configs/route.test.ts` | 200 lists 8; 403 non-admin |
| Route | `app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.test.ts` | 200 upsert; 400 duplicate labels; 400 unknown enum; 403 non-admin |
| Component | `components/settings/company/label-picker.test.tsx` | up/down reorder; inline × remove; add from dropdown |
| Component | `components/settings/company-profile-form.test.tsx` | per-section save only PATCHes its slice; toast on success; field errors render on 400 |

Repo tests follow the existing project practice (DI-inject a mocked `PrismaClient` via `BaseRepository(db)`). Route tests mock the service and `requirePermission`.

---

## 13. Rollback

Revert the migration (drop both tables + both enums) and revert the commit. Safe because lazy `getOrCreate` means no production data is seeded — only rows written by users post-deploy exist. Reaffirms proposal rollback plan.

---

## 14. File Map

**New files:**

```
prisma/migrations/<ts>_add_organization_profile/migration.sql

features/org-profile/index.ts
features/org-profile/org-profile.types.ts
features/org-profile/org-profile.validation.ts
features/org-profile/org-profile.service.ts
features/org-profile/org-profile.repository.ts
features/org-profile/org-profile.validation.test.ts
features/org-profile/org-profile.service.test.ts
features/org-profile/org-profile.repository.test.ts

features/document-signature-config/index.ts
features/document-signature-config/document-signature-config.types.ts
features/document-signature-config/document-signature-config.validation.ts
features/document-signature-config/document-signature-config.service.ts
features/document-signature-config/document-signature-config.repository.ts
features/document-signature-config/document-signature-config.validation.test.ts
features/document-signature-config/document-signature-config.service.test.ts
features/document-signature-config/document-signature-config.repository.test.ts

app/api/organizations/[orgSlug]/profile/route.ts
app/api/organizations/[orgSlug]/profile/route.test.ts
app/api/organizations/[orgSlug]/profile/logo/route.ts
app/api/organizations/[orgSlug]/profile/logo/route.test.ts
app/api/organizations/[orgSlug]/signature-configs/route.ts
app/api/organizations/[orgSlug]/signature-configs/route.test.ts
app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.ts
app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.test.ts

app/(dashboard)/[orgSlug]/settings/company/page.tsx

components/settings/company-profile-form.tsx
components/settings/company-profile-form.test.tsx
components/settings/company/identity-section.tsx
components/settings/company/logo-uploader.tsx
components/settings/company/signature-config-editor.tsx
components/settings/company/label-picker.tsx
components/settings/company/label-picker.test.tsx
components/settings/company/doc-type-dropdown.tsx
lib/document-print-type-labels.ts   // human-readable labels for DocumentPrintType + SignatureLabel
```

**Modified files:**

```
prisma/schema.prisma                 — add 2 enums, 2 models, 2 relations on Organization
app/(dashboard)/[orgSlug]/settings/page.tsx  — add 8th "Perfil de Empresa" card
```

**Total**: 36 new, 2 modified.

---

## 15. Open Questions

None. All 12 orchestrator-listed decisions resolved.
