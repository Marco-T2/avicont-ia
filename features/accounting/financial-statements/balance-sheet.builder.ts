import { AccountSubtype } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { sumDecimals, eq } from "./money.utils";
import { formatSubtypeLabel } from "@/features/accounting/account-subtype.utils";
import type {
  AccountMetadata,
  ResolvedBalance,
  BuildBalanceSheetInput,
  BalanceSheetCurrent,
  SubtypeGroup,
} from "./financial-statements.types";

type Decimal = Prisma.Decimal;

// ── Orden canónico de subtipos por sección ──
const ACTIVO_SUBTYPES: AccountSubtype[] = [
  AccountSubtype.ACTIVO_CORRIENTE,
  AccountSubtype.ACTIVO_NO_CORRIENTE,
];

const PASIVO_SUBTYPES: AccountSubtype[] = [
  AccountSubtype.PASIVO_CORRIENTE,
  AccountSubtype.PASIVO_NO_CORRIENTE,
];

const PATRIMONIO_SUBTYPES: AccountSubtype[] = [
  AccountSubtype.PATRIMONIO_CAPITAL,
  AccountSubtype.PATRIMONIO_RESULTADOS,
];

/**
 * Construye el Balance General a partir de datos pre-consultados.
 *
 * Función pura (REQ D3): no accede a Prisma ni produce efectos secundarios.
 * El service orquesta la consulta de datos y luego invoca este builder.
 *
 * Flujo (pseudocode §4.3 del design):
 * 1. Mapear balances por accountId → O(1) de lookup
 * 2. Filtrar cuentas activas con subtype definido (excluye nivel 1 y cuentas inactivas)
 * 3. Agrupar por subtype y calcular subtotales
 * 4. Insertar línea sintética de Resultado/Pérdida del Ejercicio en PATRIMONIO_RESULTADOS
 * 5. Calcular totales de sección
 * 6. Verificar ecuación contable con tolerancia ±0.01 (REQ-6)
 * 7. Determinar flag preliminary
 */
export function buildBalanceSheet(input: BuildBalanceSheetInput): BalanceSheetCurrent {
  const { accounts, balances, retainedEarningsOfPeriod, date, periodStatus, source } = input;

  // 1. Índice de balances por accountId para lookup O(1)
  const balanceMap = new Map<string, Decimal>(balances.map((b) => [b.accountId, b.balance]));

  // 2. Filtrar cuentas clasificables: activas + con subtype (excluye headers nivel 1)
  const classified = accounts.filter((a) => a.subtype !== null && a.isActive);

  // 3. Builder de grupo por subtype
  const buildGroup = (subtype: AccountSubtype): SubtypeGroup | null => {
    const accsForSubtype = classified
      .filter((a) => a.subtype === subtype)
      .map((a) => ({
        accountId: a.id,
        code: a.code,
        name: a.name,
        balance: balanceMap.get(a.id) ?? zeroDecimal(),
      }))
      .filter((a) => !a.balance.isZero()); // omitir cuentas con balance cero (REQ-1)

    if (accsForSubtype.length === 0) return null; // subtipo sin movimientos → omitido

    return {
      subtype,
      label: formatSubtypeLabel(subtype),
      accounts: accsForSubtype,
      total: sumDecimals(accsForSubtype.map((a) => a.balance)),
    };
  };

  // 4. Construir grupos por sección
  const assetsGroups = ACTIVO_SUBTYPES.map(buildGroup).filter(
    (g): g is SubtypeGroup => g !== null,
  );
  const liabGroups = PASIVO_SUBTYPES.map(buildGroup).filter(
    (g): g is SubtypeGroup => g !== null,
  );
  const equityGroups = PATRIMONIO_SUBTYPES.map(buildGroup).filter(
    (g): g is SubtypeGroup => g !== null,
  );

  // 5. Insertar línea sintética de resultado del ejercicio en PATRIMONIO_RESULTADOS (D8)
  if (!retainedEarningsOfPeriod.isZero()) {
    const syntheticLine = {
      accountId: "__synthetic_retained_earnings__",
      code: "—",
      name: retainedEarningsOfPeriod.isNegative() ? "Pérdida del Ejercicio" : "Resultado del Ejercicio",
      balance: retainedEarningsOfPeriod,
    };

    const resultsGroup = equityGroups.find((g) => g.subtype === AccountSubtype.PATRIMONIO_RESULTADOS);
    if (resultsGroup) {
      resultsGroup.accounts.push(syntheticLine);
      resultsGroup.total = resultsGroup.total.plus(retainedEarningsOfPeriod);
    } else {
      // No hay grupo PATRIMONIO_RESULTADOS aún — crear uno con solo la línea sintética
      equityGroups.push({
        subtype: AccountSubtype.PATRIMONIO_RESULTADOS,
        label: formatSubtypeLabel(AccountSubtype.PATRIMONIO_RESULTADOS),
        accounts: [syntheticLine],
        total: retainedEarningsOfPeriod,
      });
    }
  }

  // 6. Calcular totales de sección
  const totalAssets = sumDecimals(assetsGroups.map((g) => g.total));
  const totalLiab = sumDecimals(liabGroups.map((g) => g.total));
  const totalEquity = sumDecimals(equityGroups.map((g) => g.total));

  // 7. Verificar ecuación contable (REQ-6): Activo = Pasivo + Patrimonio
  const delta = totalAssets.minus(totalLiab.plus(totalEquity));
  const imbalanced = !eq(totalAssets, totalLiab.plus(totalEquity));

  // 8. Flag preliminary: true si el período no está cerrado o los datos son on-the-fly
  const preliminary = periodStatus !== "CLOSED" || source === "on-the-fly";

  return {
    asOfDate: date,
    assets: { groups: assetsGroups, total: totalAssets },
    liabilities: { groups: liabGroups, total: totalLiab },
    equity: {
      groups: equityGroups,
      total: totalEquity,
      retainedEarningsOfPeriod,
    },
    imbalanced,
    imbalanceDelta: delta,
    preliminary,
  };
}

// Crea un Decimal cero usando Prisma.Decimal (importado solo como constructor, no el cliente DB)
function zeroDecimal(): Decimal {
  return new Prisma.Decimal(0);
}
