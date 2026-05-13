import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { sumDecimals } from "./money.utils";
import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import type {
  BuildInitialBalanceInput,
  InitialBalanceGroup,
  InitialBalanceRow,
  InitialBalanceSection,
  InitialBalanceStatement,
} from "./initial-balance.types";

/**
 * Pure builder for the Balance Inicial report. Given already-signed-net rows
 * aggregated from every POSTED CA voucher of the organization, groups them by
 * `AccountSubtype` into two fixed sections — `ACTIVO` (all DEUDORA subtypes)
 * and `PASIVO_PATRIMONIO` (all ACREEDORA subtypes) — computes subtotals, and
 * surfaces the accounting invariant `Σ ACTIVO == Σ (PASIVO+PATRIMONIO)`.
 *
 * Section mapping (unambiguous — the `AccountSubtype` enum is prefixed by type):
 *   ACTIVO              → ACTIVO_CORRIENTE, ACTIVO_NO_CORRIENTE
 *   PASIVO_PATRIMONIO   → PASIVO_CORRIENTE, PASIVO_NO_CORRIENTE,
 *                          PATRIMONIO_CAPITAL, PATRIMONIO_RESULTADOS
 *
 * INGRESO_* and GASTO_* subtypes are silently skipped — they do not belong in a
 * CA (they close before it). Their presence would signal upstream data
 * corruption, but the builder is deliberately tolerant: the service/UI layers
 * surface the imbalance delta instead.
 *
 * Pure function — no Prisma client, no I/O, no async.
 *
 * **D4 Option A**: sumDecimals imported from `./money.utils` (5th copy — NOT from
 * `@/modules/accounting/financial-statements/presentation/server`). Cross-module
 * dep on FS presentation broken. Consolidation MANDATORY at sub-POC 6.
 * Cite D4 Option A, proposal #2329.
 *
 * **formatSubtypeLabel**: imported from `@/features/accounting/account-subtype.utils`
 * (shared utility NOT under features/accounting/initial-balance/). This is a shared
 * formatting helper — NOT a domain→presentation cross-import. Tolerated per design §10.
 *
 * **R1-permissible-value-type-exception**: runtime-imports `Prisma.Decimal` as a
 * VALUE-TYPE arithmetic engine (not entity). OLEADA 5 archive #2282.
 */
export function buildInitialBalance(
  input: BuildInitialBalanceInput,
): InitialBalanceStatement {
  const { orgId, org, dateAt, rows, caCount } = input;
  const ZERO = new Prisma.Decimal(0);

  const activoSection = buildSection(
    "ACTIVO",
    "ACTIVO",
    ACTIVO_SUBTYPES,
    rows,
  );
  const pasivoPatrimonioSection = buildSection(
    "PASIVO_PATRIMONIO",
    "PASIVO Y PATRIMONIO",
    PASIVO_PATRIMONIO_SUBTYPES,
    rows,
  );

  const imbalanceDelta = activoSection.sectionTotal
    .sub(pasivoPatrimonioSection.sectionTotal)
    .abs();
  const imbalanced = !activoSection.sectionTotal.equals(
    pasivoPatrimonioSection.sectionTotal,
  );

  return {
    orgId,
    org,
    dateAt,
    sections: [activoSection, pasivoPatrimonioSection],
    imbalanced,
    imbalanceDelta: imbalanced ? imbalanceDelta : ZERO,
    multipleCA: caCount > 1,
    caCount,
  };
}

// ── Canonical subtype order per section (mirrors balance-sheet.builder) ───────

const ACTIVO_SUBTYPES: readonly AccountSubtype[] = [
  AccountSubtype.ACTIVO_CORRIENTE,
  AccountSubtype.ACTIVO_NO_CORRIENTE,
] as const;

const PASIVO_PATRIMONIO_SUBTYPES: readonly AccountSubtype[] = [
  AccountSubtype.PASIVO_CORRIENTE,
  AccountSubtype.PASIVO_NO_CORRIENTE,
  AccountSubtype.PATRIMONIO_CAPITAL,
  AccountSubtype.PATRIMONIO_RESULTADOS,
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSection(
  key: InitialBalanceSection["key"],
  label: string,
  subtypeOrder: readonly AccountSubtype[],
  rows: readonly InitialBalanceRow[],
): InitialBalanceSection {
  const groups: InitialBalanceGroup[] = subtypeOrder
    .map((subtype) => buildGroup(subtype, rows))
    .filter((g): g is InitialBalanceGroup => g !== null);

  const sectionTotal = sumDecimals(groups.map((g) => g.subtotal));

  return { key, label, groups, sectionTotal };
}

function buildGroup(
  subtype: AccountSubtype,
  rows: readonly InitialBalanceRow[],
): InitialBalanceGroup | null {
  const groupRows = rows.filter((r) => r.subtype === subtype);
  if (groupRows.length === 0) return null;

  const subtotal = sumDecimals(groupRows.map((r) => r.amount));

  return {
    subtype,
    label: formatSubtypeLabel(subtype),
    rows: groupRows,
    subtotal,
  };
}
