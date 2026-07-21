/**
 * Domain-owned mirrors of the account classification enums ([PRISMA] cluster,
 * D1 paydown). Domain and application code import these instead of
 * `@/generated/prisma/enums` — the Prisma enum may only be touched by
 * infrastructure adapters mapping at the boundary (R5).
 *
 * SHAPE: deliberately the exact shape Prisma generates (const object +
 * derived literal union, see `generated/prisma/enums.ts`) rather than the
 * `as const` array idiom of the sibling VOs (journal-entry-status.ts). Reason:
 * consumers use member access extensively (`AccountSubtype.ACTIVO_CORRIENTE`
 * appears ~40x in account-subtype.utils.ts alone) and zod schemas feed the
 * object straight into `z.nativeEnum`/`z.enum`. Because both sides are
 * structurally identical string-literal unions, domain values flow into
 * Prisma-typed adapter parameters (and back) with no casts.
 *
 * DRIFT GUARD: `modules/accounting/__tests__/enum-domain-mirror.sync.test.ts`
 * deep-equals each mirror against its Prisma-generated counterpart, so a
 * schema.prisma change that adds/renames/removes a member fails loudly there
 * instead of silently desynchronizing the domain.
 *
 * This file must stay a LEAF (zero imports). The reverted validation.ts fix
 * documented in `__tests__/hex-boundaries.ratchet.test.ts` showed what happens
 * when enum re-exports ride on a file with a heavy import graph (TDZ crash via
 * composition-root cycle) — a leaf mirror is the safe variant of that fix.
 */

// ── AccountType — mirrors `enum AccountType` in prisma/schema.prisma ──

export const AccountType = {
  ACTIVO: "ACTIVO",
  PASIVO: "PASIVO",
  PATRIMONIO: "PATRIMONIO",
  INGRESO: "INGRESO",
  GASTO: "GASTO",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

// ── AccountSubtype — mirrors `enum AccountSubtype` (NIIF/PCGA level-2) ──

export const AccountSubtype = {
  ACTIVO_CORRIENTE: "ACTIVO_CORRIENTE",
  ACTIVO_NO_CORRIENTE: "ACTIVO_NO_CORRIENTE",
  PASIVO_CORRIENTE: "PASIVO_CORRIENTE",
  PASIVO_NO_CORRIENTE: "PASIVO_NO_CORRIENTE",
  PATRIMONIO_CAPITAL: "PATRIMONIO_CAPITAL",
  PATRIMONIO_RESULTADOS: "PATRIMONIO_RESULTADOS",
  INGRESO_OPERATIVO: "INGRESO_OPERATIVO",
  INGRESO_NO_OPERATIVO: "INGRESO_NO_OPERATIVO",
  GASTO_OPERATIVO: "GASTO_OPERATIVO",
  GASTO_ADMINISTRATIVO: "GASTO_ADMINISTRATIVO",
  GASTO_FINANCIERO: "GASTO_FINANCIERO",
  GASTO_NO_OPERATIVO: "GASTO_NO_OPERATIVO",
} as const;

export type AccountSubtype = (typeof AccountSubtype)[keyof typeof AccountSubtype];

// ── AccountNature — mirrors `enum AccountNature` (saldo deudor/acreedor) ──

export const AccountNature = {
  DEUDORA: "DEUDORA",
  ACREEDORA: "ACREEDORA",
} as const;

export type AccountNature = (typeof AccountNature)[keyof typeof AccountNature];
