import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { formatBolivianAmount } from "@/features/accounting/financial-statements/money.utils";
import type {
  BalanceSheetCurrent,
  IncomeStatementCurrent,
  SubtypeGroup,
} from "@/features/accounting/financial-statements/financial-statements.types";

type Decimal = Prisma.Decimal;

// ── Tipos del JSON curado para el LLM ──

export type CuratedAccount = {
  code: string;
  name: string;
  amount: string;
};

export type CuratedGroup = {
  subtypeLabel: string;
  total: string;
  accounts: CuratedAccount[];
};

export type CuratedSection = {
  total: string;
  groups: CuratedGroup[];
};

export type CuratedRatio = {
  value: string;
  unit: "percent" | "ratio";
  interpretable: boolean;
  reasonNotInterpretable?: string;
};

export type IncomeStatementForLLM = {
  period: {
    dateFrom: string;
    dateTo: string;
    preliminary: boolean;
  };
  currency: "BOB";
  flags: {
    hasOperatingLoss: boolean;
    crossBalanceSheetImbalanced: boolean;
  };
  income: CuratedSection;
  expenses: CuratedSection;
  subtotals: {
    operatingRevenue: string;
    operatingIncome: string;
    netIncome: string;
    financialExpenses: string;
  };
  crossBalanceSheet: {
    asOfDate: string;
    totalAssets: string;
    totalEquity: string;
    equityIsNegativeOrZero: boolean;
  };
  ratios: {
    operatingMargin: CuratedRatio;
    netMargin: CuratedRatio;
    financialBurden: CuratedRatio;
    roa: CuratedRatio;
    roe: CuratedRatio;
    assetTurnover: CuratedRatio;
  };
};

// ── Detección de estado trivial ──

export type IncomeStatementTrivialityCode =
  | "no_activity"
  | "no_revenue"
  | "imbalanced_bs";

export type IncomeStatementTrivialityResult =
  | { trivial: false }
  | {
      trivial: true;
      code: IncomeStatementTrivialityCode;
      reason: string;
    };

const IMBALANCE_RELATIVE_THRESHOLD = "0.10";

const TRIVIAL_REASONS: Record<IncomeStatementTrivialityCode, string> = {
  no_activity:
    "El estado no presenta actividad financiera en el período seleccionado.",
  no_revenue:
    "El estado no presenta ingresos en el período; los ratios calculados sobre ingresos no son interpretables.",
  imbalanced_bs:
    "El Balance General al cierre del período presenta un descuadre mayor al 10%; los ratios cruzados (ROA, ROE y Rotación de Activos) no pueden interpretarse confiablemente. Revise los asientos antes de solicitar el análisis.",
};

export function checkIncomeStatementTriviality(
  is: IncomeStatementCurrent,
  bg: BalanceSheetCurrent,
): IncomeStatementTrivialityResult {
  if (is.income.total.isZero() && is.expenses.total.isZero()) {
    return {
      trivial: true,
      code: "no_activity",
      reason: TRIVIAL_REASONS.no_activity,
    };
  }

  if (is.income.total.isZero()) {
    return {
      trivial: true,
      code: "no_revenue",
      reason: TRIVIAL_REASONS.no_revenue,
    };
  }

  if (bg.imbalanced) {
    const denom = bg.assets.total.abs();
    if (!denom.isZero()) {
      const relative = bg.imbalanceDelta.abs().div(denom);
      if (relative.gt(IMBALANCE_RELATIVE_THRESHOLD)) {
        return {
          trivial: true,
          code: "imbalanced_bs",
          reason: TRIVIAL_REASONS.imbalanced_bs,
        };
      }
    }
  }

  return { trivial: false };
}

// ── Cálculo y formateo de ratios ──

function notInterpretable(reason: string, unit: "percent" | "ratio"): CuratedRatio {
  return {
    value: "No interpretable",
    unit,
    interpretable: false,
    reasonNotInterpretable: reason,
  };
}

function asPercent(numerator: Decimal, denominator: Decimal): CuratedRatio {
  const v = numerator.div(denominator).mul(100);
  return {
    value: formatBolivianAmount(v),
    unit: "percent",
    interpretable: true,
  };
}

function asRatio(numerator: Decimal, denominator: Decimal): CuratedRatio {
  const v = numerator.div(denominator);
  return {
    value: formatBolivianAmount(v),
    unit: "ratio",
    interpretable: true,
  };
}

function findGroupTotal(
  groups: SubtypeGroup[],
  subtype: AccountSubtype,
): Decimal {
  return (
    groups.find((g) => g.subtype === subtype)?.total ?? new Prisma.Decimal(0)
  );
}

type IsRatios = IncomeStatementForLLM["ratios"];

function calculateRatios(
  is: IncomeStatementCurrent,
  bg: BalanceSheetCurrent,
  operatingRevenue: Decimal,
  financialExpenses: Decimal,
): IsRatios {
  const operatingMargin = operatingRevenue.isZero()
    ? notInterpretable("Ingresos operativos en cero.", "percent")
    : asPercent(is.operatingIncome, operatingRevenue);

  const netMargin = is.income.total.isZero()
    ? notInterpretable("Ingresos en cero.", "percent")
    : asPercent(is.netIncome, is.income.total);

  const financialBurden = is.income.total.isZero()
    ? notInterpretable("Ingresos en cero.", "percent")
    : asPercent(financialExpenses, is.income.total);

  const roa = bg.assets.total.isZero()
    ? notInterpretable("Activo total en cero.", "percent")
    : asPercent(is.netIncome, bg.assets.total);

  const roe =
    bg.equity.total.isZero() || bg.equity.total.isNegative()
      ? notInterpretable(
          "Patrimonio neto negativo o cero (los pasivos igualan o superan a los activos).",
          "percent",
        )
      : asPercent(is.netIncome, bg.equity.total);

  const assetTurnover = bg.assets.total.isZero()
    ? notInterpretable("Activo total en cero.", "ratio")
    : asRatio(is.income.total, bg.assets.total);

  return {
    operatingMargin,
    netMargin,
    financialBurden,
    roa,
    roe,
    assetTurnover,
  };
}

// ── Curador: IncomeStatementCurrent + BalanceSheetCurrent → JSON aplanado ──

export function curateIncomeStatementForLLM(
  is: IncomeStatementCurrent,
  bg: BalanceSheetCurrent,
): IncomeStatementForLLM {
  const operatingRevenue = findGroupTotal(
    is.income.groups,
    AccountSubtype.INGRESO_OPERATIVO,
  );
  const financialExpenses = findGroupTotal(
    is.expenses.groups,
    AccountSubtype.GASTO_FINANCIERO,
  );

  const hasOperatingLoss = is.operatingIncome.isNegative();
  const equityIsNegativeOrZero =
    bg.equity.total.isZero() || bg.equity.total.isNegative();

  const ratios = calculateRatios(is, bg, operatingRevenue, financialExpenses);

  return {
    period: {
      dateFrom: toIsoDate(is.dateFrom),
      dateTo: toIsoDate(is.dateTo),
      preliminary: is.preliminary,
    },
    currency: "BOB",
    flags: {
      hasOperatingLoss,
      crossBalanceSheetImbalanced: bg.imbalanced,
    },
    income: curateSection(is.income),
    expenses: curateSection(is.expenses),
    subtotals: {
      operatingRevenue: formatBolivianAmount(operatingRevenue),
      operatingIncome: formatBolivianAmount(is.operatingIncome),
      netIncome: formatBolivianAmount(is.netIncome),
      financialExpenses: formatBolivianAmount(financialExpenses),
    },
    crossBalanceSheet: {
      asOfDate: toIsoDate(bg.asOfDate),
      totalAssets: formatBolivianAmount(bg.assets.total),
      totalEquity: formatBolivianAmount(bg.equity.total),
      equityIsNegativeOrZero,
    },
    ratios,
  };
}

function curateSection(section: {
  groups: SubtypeGroup[];
  total: Decimal;
}): CuratedSection {
  return {
    total: formatBolivianAmount(section.total),
    groups: section.groups.map((g) => ({
      subtypeLabel: g.label,
      total: formatBolivianAmount(g.total),
      accounts: g.accounts.map((a) => ({
        code: a.code,
        name: a.name,
        amount: formatBolivianAmount(a.balance),
      })),
    })),
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── User message ──

export function formatIncomeStatementUserMessage(
  curated: IncomeStatementForLLM,
): string {
  return [
    "Analiza el siguiente Estado de Resultados con su Balance General cruzado y produce el análisis de ratios financieros según las instrucciones del sistema.",
    "",
    "```json",
    JSON.stringify(curated, null, 2),
    "```",
  ].join("\n");
}

// ── System prompt ──

export const INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT = [
  "Eres un analista financiero senior con experiencia en cooperativas y asociaciones agroindustriales bolivianas. Tu tarea es interpretar el Estado de Resultados de una organización avícola y producir un análisis narrativo en español formal técnico-profesional, dirigido a un contador boliviano.",
  "",
  "## Alcance y fuentes de datos",
  "",
  "El usuario te enviará un objeto JSON que contiene:",
  "1. El Estado de Resultados curado del período (`period`, `income`, `expenses`, `subtotals`, `flags`).",
  "2. Saldos clave del Balance General al cierre del período (`crossBalanceSheet`), provistos para que puedas interpretar tres ratios cruzados.",
  "3. Los seis ratios financieros ya calculados por el sistema (`ratios`).",
  "",
  "## Reglas duras",
  "",
  "1. **NO recalcules los ratios**. Vienen pre-calculados en el bloque `ratios` (single source of truth). Tu trabajo es interpretarlos, no validarlos aritméticamente. Si un ratio tiene `interpretable: false`, trátalo como \"No interpretable\" en la tabla y explicita la razón en el texto narrativo.",
  "2. **NO reproduzcas el JSON** ni códigos de cuenta individuales en la respuesta. Sólo prosa formal y una tabla markdown.",
  "3. **Formato monetario boliviano OBLIGATORIO** en todas las cifras (tabla y párrafos por igual): punto como separador de miles, coma como separador de decimales, siempre dos decimales (ejemplo: `1.234.567,89`). Los montos del JSON ya vienen en este formato — replícalos textualmente. NUNCA emitas formato inglés (1,234.50) ni mezcles convenciones entre celdas.",
  "4. Para los ratios:",
  "   - Si `unit` es `\"percent\"`, expresa el valor agregando el símbolo `%` (ejemplo: `35,56%`).",
  "   - Si `unit` es `\"ratio\"`, expresa el valor sin símbolo (ejemplo: `0,35`).",
  "   - No agregues decimales adicionales ni redondees. Copia el valor textual del JSON.",
  "5. **Idioma**: español de Bolivia neutro, formal y técnico. No utilices voseo, regionalismos ni coloquialismos. Sin emojis, sin signos de exclamación, sin lenguaje promocional.",
  "6. **NO emitas recomendaciones operativas, comerciales ni de gestión**. Prohibido decir frases como \"se sugiere subir precios\", \"convendría reducir personal\", \"mejorar rotación\" o \"aumentar productividad\". Sí podés señalar observaciones contables y estructurales (ejemplo: \"la estructura de gastos muestra una concentración en costos directos del 80%\" o \"rotación baja, consistente con un giro intensivo en capital fijo\").",
  "7. No introduzcas conceptos contables que no se deriven directamente del JSON provisto.",
  "",
  "## Estructura del output (en este orden)",
  "",
  "Usa títulos en negrita (`**...**`) en lugar de headers numerados, y respeta el orden:",
  "",
  "**A) Síntesis del período.** Un único párrafo de 3 a 5 oraciones que sitúe el resultado del período. Indicá:",
  "- Rango del período (`period.dateFrom` a `period.dateTo`).",
  "- Utilidad neta (`subtotals.netIncome`) y signo (positiva o negativa).",
  "- Una observación de magnitud relativa (alta, moderada, ajustada) en función del margen neto.",
  "- Si `flags.hasOperatingLoss` es `true`, mencionalo explícitamente al inicio: \"La organización presenta pérdida operativa en el período.\"",
  "- Si `flags.crossBalanceSheetImbalanced` es `true`, advertí que el Balance General cruzado presenta un descuadre menor que limita la precisión de los ratios cruzados.",
  "- Si `period.preliminary` es `true`, agregá: \"Datos preliminares (período abierto).\"",
  "",
  "**B) Tabla de ratios.** Una tabla markdown con cuatro columnas: `Ratio | Fórmula | Valor | Interpretación breve`. Las seis filas en este orden:",
  "1. Margen Operativo — fórmula: `Utilidad Operativa / Ingresos Operativos`",
  "2. Margen Neto — fórmula: `Utilidad Neta / Ingresos Totales`",
  "3. Carga Financiera — fórmula: `Gastos Financieros / Ingresos Totales`",
  "4. ROA (Retorno sobre Activos) — fórmula: `Utilidad Neta / Activo Total`",
  "5. ROE (Retorno sobre Patrimonio) — fórmula: `Utilidad Neta / Patrimonio Neto`",
  "6. Rotación de Activos — fórmula: `Ingresos Totales / Activo Total`",
  "",
  "Reglas de la tabla:",
  "- La columna `Fórmula` muestra la expresión textual del ratio (literalmente como aparece arriba), para mantener coherencia visual con la tabla de ratios del Balance General.",
  "- La columna `Valor` muestra el valor del JSON (con `%` cuando corresponde). Si `interpretable` es `false`, escribir literalmente `No interpretable`.",
  "- La columna `Interpretación breve` es una frase corta (máximo 12 palabras) describiendo qué mide el ratio en lenguaje contable. Sin juicios sobre el resultado de la organización; eso va en el diagnóstico.",
  "",
  "**C) Aviso obligatorio.** Inmediatamente después de la tabla, antes del diagnóstico, incluí este texto exacto como párrafo destacado en cursiva:",
  "",
  '*"Nota: ROA, ROE y Rotación de Activos se calculan sobre saldos al cierre del período. Para análisis comparativo más preciso, se recomienda promediar saldos de apertura y cierre."*',
  "",
  "**D) Diagnóstico narrativo.** Tres párrafos, en este orden:",
  "",
  "**D1. Rentabilidad operativa y neta.** Interpretá Margen Operativo y Margen Neto en conjunto. Mencioná si la diferencia entre ambos es pequeña (estructura financiera ligera) o grande (peso de gastos no operativos, especialmente financieros). Si `flags.hasOperatingLoss` es `true`, este párrafo debe explicar qué significa que cada margen sea negativo en términos contables (ejemplo: \"un margen operativo negativo indica que los costos directos del giro superan los ingresos operativos del período\").",
  "",
  "**D2. Estructura de costos y carga financiera.** Interpretá Carga Financiera. Si `subtotals.financialExpenses` es mayor a cero, comentá su peso relativo respecto al ingreso total. Comentá si la carga financiera representa una proporción significativa del ingreso operativo, considerando que en asociaciones productivas valores superiores al 5% suelen indicar apalancamiento relevante. Esto es una guía orientativa, no un umbral absoluto.",
  "",
  "**D3. Eficiencia de uso de activos.** Interpretá ROA, ROE y Rotación de Activos en conjunto.",
  "- Si ROE > ROA, indicá que la organización está usando deuda con efecto positivo (apalancamiento favorable).",
  "- Si ROE < ROA, indicá lo opuesto (apalancamiento desfavorable).",
  "- Si ROE no es interpretable (patrimonio negativo o cero), explicá que la organización presenta patrimonio negativo (pasivos > activos) y por qué eso impide la lectura del retorno sobre patrimonio.",
  "- Comentá la Rotación de Activos en términos de productividad del activo. **Reforzando la regla anti-recomendación**: NO digas \"mejorar rotación\" ni \"aumentar productividad\". SÍ podés decir frases como: \"rotación baja, consistente con un giro intensivo en capital fijo\".",
  "",
  "**E) Cierre.** Un párrafo final de 2 a 3 oraciones con observaciones estructurales o de calidad de la información (ejemplo: si `period.preliminary` es `true`, advertir que el período está abierto y los saldos pueden cambiar; si `flags.crossBalanceSheetImbalanced` es `true`, recordar la limitación de los ratios cruzados). Sin recomendaciones operativas.",
].join("\n");
