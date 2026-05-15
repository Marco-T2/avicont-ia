/**
 * Pure worksheet builder — no Prisma DB access.
 *
 * **Revoked-by: DEC-1** (sub-POC 6 archive of oleada-money-decimal-hex-purity).
 * DEC-1 (Derived from: R1): domain + application use decimal.js@10.6.0 direct.
 * Prisma.Decimal is forbidden outside infrastructure adapters. This builder
 * now runtime-imports `decimal.js` directly per sub-POC 2 Cycle 4 swap
 * (commit 41d40d9a).
 *
 * [HISTORICAL — see Revoked-by above]
 * **R1-permissible-value-type-exception**: this domain file runtime-imports
 * `Prisma` from `@/generated/prisma/client` to access `Prisma.Decimal`
 * (value-type arithmetic engine). Locked invariant OLEADA 5 archive #2282.
 *
 * REQ-009 locked (D4 Option A): ZERO imports from
 * @/modules/accounting/financial-statements/**. The cross-module dep on
 * `sumDecimals + eq from @/modules/accounting/financial-statements/presentation/server`
 * (OLEADA 5 relic) is BROKEN. sumDecimals + eq copied to own domain/money.utils.ts.
 *
 * WS-D1 locked: imports WorksheetAccountMetadata + WorksheetMovementAggregation
 * from "./types" (domain), NOT from the infra repository (WS-D1 design §2).
 */
import Decimal from "decimal.js";
import type { AccountType } from "@/generated/prisma/enums";
import { sumDecimals, eq } from "./money.utils";
import type { WorksheetAccountMetadata, WorksheetMovementAggregation } from "./types";
import type {
  WorksheetRow,
  WorksheetGroup,
  WorksheetTotals,
  WorksheetReport,
} from "./worksheet.types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BuildWorksheetInput = {
  accounts: WorksheetAccountMetadata[];
  sumas: WorksheetMovementAggregation[];
  ajustes: WorksheetMovementAggregation[];
  dateFrom: Date;
  dateTo: Date;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/** Canonical group order per REQ-9 */
const CANONICAL_ORDER: AccountType[] = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "GASTO"];

const ZERO = new Decimal(0);
const z = () => new Decimal(0);

// ── Helpers ───────────────────────────────────────────────────────────────────

function maxZero(d: Decimal): Decimal {
  return d.gt(ZERO) ? d : z();
}

function zeroTotals(): WorksheetTotals {
  return {
    sumasDebe:          z(),
    sumasHaber:         z(),
    saldoDeudor:        z(),
    saldoAcreedor:      z(),
    ajustesDebe:        z(),
    ajustesHaber:       z(),
    saldoAjDeudor:      z(),
    saldoAjAcreedor:    z(),
    resultadosPerdidas: z(),
    resultadosGanancias:z(),
    bgActivo:           z(),
    bgPasPat:           z(),
  };
}

function addTotals(a: WorksheetTotals, b: WorksheetTotals): WorksheetTotals {
  return {
    sumasDebe:           a.sumasDebe.plus(b.sumasDebe),
    sumasHaber:          a.sumasHaber.plus(b.sumasHaber),
    saldoDeudor:         a.saldoDeudor.plus(b.saldoDeudor),
    saldoAcreedor:       a.saldoAcreedor.plus(b.saldoAcreedor),
    ajustesDebe:         a.ajustesDebe.plus(b.ajustesDebe),
    ajustesHaber:        a.ajustesHaber.plus(b.ajustesHaber),
    saldoAjDeudor:       a.saldoAjDeudor.plus(b.saldoAjDeudor),
    saldoAjAcreedor:     a.saldoAjAcreedor.plus(b.saldoAjAcreedor),
    resultadosPerdidas:  a.resultadosPerdidas.plus(b.resultadosPerdidas),
    resultadosGanancias: a.resultadosGanancias.plus(b.resultadosGanancias),
    bgActivo:            a.bgActivo.plus(b.bgActivo),
    bgPasPat:            a.bgPasPat.plus(b.bgPasPat),
  };
}

function rowToTotals(row: WorksheetRow): WorksheetTotals {
  return {
    sumasDebe:           row.sumasDebe,
    sumasHaber:          row.sumasHaber,
    saldoDeudor:         row.saldoDeudor,
    saldoAcreedor:       row.saldoAcreedor,
    ajustesDebe:         row.ajustesDebe,
    ajustesHaber:        row.ajustesHaber,
    saldoAjDeudor:       row.saldoAjDeudor,
    saldoAjAcreedor:     row.saldoAjAcreedor,
    resultadosPerdidas:  row.resultadosPerdidas,
    resultadosGanancias: row.resultadosGanancias,
    bgActivo:            row.bgActivo,
    bgPasPat:            row.bgPasPat,
  };
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Pure function — no Prisma DB access. Accepts two aggregation arrays
 * (sumas + ajustes) and account metadata, produces a WorksheetReport.
 *
 * All arithmetic uses decimal.js Decimal end-to-end (REQ-14).
 */
export function buildWorksheet(input: BuildWorksheetInput): WorksheetReport {
  const { accounts, sumas, ajustes, dateFrom, dateTo } = input;

  // Index aggregations by accountId for O(1) lookup
  const sumasMap = new Map<string, WorksheetMovementAggregation>(
    sumas.map((s) => [s.accountId, s]),
  );
  const ajustesMap = new Map<string, WorksheetMovementAggregation>(
    ajustes.map((a) => [a.accountId, a]),
  );

  // ── Build rows per account ──────────────────────────────────────────────────

  const rowsByType = new Map<AccountType, WorksheetRow[]>();

  for (const account of accounts) {
    const sumaEntry  = sumasMap.get(account.id);
    const ajusteEntry = ajustesMap.get(account.id);

    const sumasDebe   = sumaEntry?.totalDebit   ?? z();
    const sumasHaber  = sumaEntry?.totalCredit  ?? z();
    const ajustesDebe  = ajusteEntry?.totalDebit  ?? z();
    const ajustesHaber = ajusteEntry?.totalCredit ?? z();

    // REQ-3: Saldos del Mayor
    const saldoDeudor   = maxZero(sumasDebe.minus(sumasHaber));
    const saldoAcreedor = maxZero(sumasHaber.minus(sumasDebe));

    // REQ-4: Saldos Ajustados (handles sign-flip via MAX clamp)
    const lhs = saldoDeudor.plus(ajustesDebe);
    const rhs = saldoAcreedor.plus(ajustesHaber);
    const saldoAjDeudor   = maxZero(lhs.minus(rhs));
    const saldoAjAcreedor = maxZero(rhs.minus(lhs));

    // REQ-8: Visibility — isDetail=true AND any non-zero column
    const hasActivity =
      !saldoAjDeudor.isZero()   ||
      !saldoAjAcreedor.isZero() ||
      !ajustesDebe.isZero()     ||
      !ajustesHaber.isZero();

    if (!account.isDetail || !hasActivity) {
      if (!account.isDetail && hasActivity) {
        console.warn(
          `[worksheet.builder] Non-detail account "${account.code}" (${account.id}) has activity but is hidden per REQ-8 visibility rule.`,
        );
      }
      continue;
    }

    // REQ-5/6: Column assignment by AccountType
    let resultadosPerdidas  = z();
    let resultadosGanancias = z();
    let bgActivo            = z();
    let bgPasPat            = z();

    switch (account.type) {
      case "ACTIVO": {
        if (account.isContraAccount) {
          // REQ-6: contra-account uses the opposite side and negates
          // When saldoAjAcreedor > 0 (normal contra balance): bgActivo = -saldoAjAcreedor
          // When saldoAjDeudor > 0 (sign-flipped contra, REQ-6.E1): bgActivo = -saldoAjDeudor
          const raw = saldoAjAcreedor.gt(ZERO) ? saldoAjAcreedor : saldoAjDeudor;
          bgActivo = raw.negated();
        } else {
          bgActivo = saldoAjDeudor;
        }
        break;
      }
      case "PASIVO":
      case "PATRIMONIO": {
        if (account.isContraAccount) {
          // Data anomaly: contra + non-ACTIVO. Log warn and route normally.
          console.warn(
            `[worksheet.builder] Data anomaly: isContraAccount=true on ${account.type} account "${account.code}" (${account.id}). Routing as normal ${account.type}.`,
          );
        }
        bgPasPat = saldoAjAcreedor;
        break;
      }
      case "GASTO": {
        resultadosPerdidas = saldoAjDeudor;
        break;
      }
      case "INGRESO": {
        resultadosGanancias = saldoAjAcreedor;
        break;
      }
    }

    const row: WorksheetRow = {
      accountId:           account.id,
      code:                account.code,
      name:                account.name,
      isContraAccount:     account.isContraAccount,
      accountType:         account.type,
      isCarryOver:         false,
      sumasDebe,
      sumasHaber,
      saldoDeudor,
      saldoAcreedor,
      ajustesDebe,
      ajustesHaber,
      saldoAjDeudor,
      saldoAjAcreedor,
      resultadosPerdidas,
      resultadosGanancias,
      bgActivo,
      bgPasPat,
    };

    if (!rowsByType.has(account.type)) {
      rowsByType.set(account.type, []);
    }
    rowsByType.get(account.type)!.push(row);
  }

  // ── Build groups in canonical order ────────────────────────────────────────

  const groups: WorksheetGroup[] = [];

  for (const accountType of CANONICAL_ORDER) {
    const rows = rowsByType.get(accountType);
    if (!rows || rows.length === 0) continue; // REQ-9.S3: skip empty groups

    // Per-group subtotals (REQ-9.S2)
    const subtotals = rows.reduce(
      (acc, row) => addTotals(acc, rowToTotals(row)),
      zeroTotals(),
    );

    groups.push({ accountType, rows, subtotals });
  }

  // ── Carry-over row (REQ-7) ──────────────────────────────────────────────────

  // Collect ER totals BEFORE carry-over
  const sumPerdidas   = sumDecimals(groups.flatMap((g) => g.rows.map((r) => r.resultadosPerdidas)));
  const sumGanancias  = sumDecimals(groups.flatMap((g) => g.rows.map((r) => r.resultadosGanancias)));
  const netResult     = sumGanancias.minus(sumPerdidas); // >0 → Ganancia, <0 → Pérdida

  let carryOverRow: WorksheetRow | undefined;

  if (!netResult.isZero()) {
    if (netResult.isPositive()) {
      // Ganancia: balance ER by adding to perdidas; balance BG by adding to Pas-Pat
      carryOverRow = {
        accountId:           "__carry_over__",
        code:                "—",
        name:                "Ganancia del Ejercicio",
        isContraAccount:     false,
        accountType:         "INGRESO", // logical home — carry-over is a result of INGRESO > GASTO
        isCarryOver:         true,
        sumasDebe:           z(),
        sumasHaber:          z(),
        saldoDeudor:         z(),
        saldoAcreedor:       z(),
        ajustesDebe:         z(),
        ajustesHaber:        z(),
        saldoAjDeudor:       z(),
        saldoAjAcreedor:     z(),
        resultadosPerdidas:  netResult,
        resultadosGanancias: z(),
        bgActivo:            z(),
        bgPasPat:            netResult,
      };
    } else {
      // Pérdida: balance ER by adding abs to ganancias; balance BG by subtracting from Pas-Pat
      // (a loss reduces equity — it belongs on the Pas-Pat side as a negative, not as a positive Activo).
      const abs = netResult.abs();
      carryOverRow = {
        accountId:           "__carry_over__",
        code:                "—",
        name:                "Pérdida del Ejercicio",
        isContraAccount:     false,
        accountType:         "GASTO",
        isCarryOver:         true,
        sumasDebe:           z(),
        sumasHaber:          z(),
        saldoDeudor:         z(),
        saldoAcreedor:       z(),
        ajustesDebe:         z(),
        ajustesHaber:        z(),
        saldoAjDeudor:       z(),
        saldoAjAcreedor:     z(),
        resultadosPerdidas:  z(),
        resultadosGanancias: abs,
        bgActivo:            z(),
        bgPasPat:            abs.negated(),
      };
    }
  }

  // ── Grand totals (includes carry-over) ────────────────────────────────────

  let grandTotals = groups.reduce(
    (acc, g) => addTotals(acc, g.subtotals),
    zeroTotals(),
  );
  if (carryOverRow) {
    grandTotals = addTotals(grandTotals, rowToTotals(carryOverRow));
  }

  // ── Imbalance check ────────────────────────────────────────────────────────

  const delta       = grandTotals.bgActivo.minus(grandTotals.bgPasPat);
  const imbalanced  = !eq(grandTotals.bgActivo, grandTotals.bgPasPat);

  return {
    orgId:        "", // filled by service with real orgId
    dateFrom,
    dateTo,
    groups,
    carryOverRow,
    grandTotals,
    imbalanced,
    imbalanceDelta: delta,
  };
}
