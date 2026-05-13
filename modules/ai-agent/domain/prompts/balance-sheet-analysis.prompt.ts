import type { Prisma } from "@/generated/prisma/client";
import { formatBolivianAmount } from "@/modules/accounting/financial-statements/presentation/server";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
  SubtypeGroup,
} from "@/modules/accounting/financial-statements/presentation";

// ── Tipos del JSON curado para el LLM ──

export type CuratedAccount = {
  code: string;
  name: string;
  balance: string;
  isContra?: true;
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

export type BalanceSheetForLLM = {
  asOfDate: string;
  currency: "BOB";
  preliminary: boolean;
  imbalanced: boolean;
  assets: CuratedSection;
  liabilities: CuratedSection;
  equity: CuratedSection;
  comparative?: {
    asOfDate: string;
    assets: CuratedSection;
    liabilities: CuratedSection;
    equity: CuratedSection;
  };
};

// ── Detección de balance trivial ──

export type TrivialityCode =
  | "empty"
  | "no_assets"
  | "imbalance_severe"
  | "insufficient_structure";

export type TrivialityResult =
  | { trivial: false }
  | { trivial: true; code: TrivialityCode; reason: string };

// Umbral relativo (10%) para clasificar un descuadre como estructural y
// bloquear el análisis antes de llamar al LLM.
const IMBALANCE_RELATIVE_THRESHOLD = "0.10";

const TRIVIAL_REASONS: Record<TrivialityCode, string> = {
  empty:
    "El Balance General no contiene movimientos en el período seleccionado. No hay datos suficientes para análisis.",
  no_assets:
    "El Balance General no presenta activos registrados. El análisis de ratios requiere información del activo.",
  imbalance_severe:
    "El Balance General presenta un descuadre significativo (>10%). Corrija los asientos antes de solicitar el análisis.",
  insufficient_structure:
    "El Balance General tiene cuentas sólo en una sección. El análisis requiere actividad en al menos dos de las tres secciones (activo, pasivo, patrimonio).",
};

export function checkBalanceTriviality(balance: BalanceSheet): TrivialityResult {
  const c = balance.current;

  if (
    c.assets.total.isZero() &&
    c.liabilities.total.isZero() &&
    c.equity.total.isZero()
  ) {
    return { trivial: true, code: "empty", reason: TRIVIAL_REASONS.empty };
  }

  if (c.assets.total.isZero()) {
    return {
      trivial: true,
      code: "no_assets",
      reason: TRIVIAL_REASONS.no_assets,
    };
  }

  if (c.imbalanced) {
    const denom = c.assets.total.abs();
    if (!denom.isZero()) {
      const relative = c.imbalanceDelta.abs().div(denom);
      if (relative.gt(IMBALANCE_RELATIVE_THRESHOLD)) {
        return {
          trivial: true,
          code: "imbalance_severe",
          reason: TRIVIAL_REASONS.imbalance_severe,
        };
      }
    }
  }

  const sectionsWithActivity = countSectionsWithNonZeroAccount(c);
  if (sectionsWithActivity < 2) {
    return {
      trivial: true,
      code: "insufficient_structure",
      reason: TRIVIAL_REASONS.insufficient_structure,
    };
  }

  return { trivial: false };
}

function countSectionsWithNonZeroAccount(c: BalanceSheetCurrent): number {
  let count = 0;
  if (sectionHasNonZeroAccount(c.assets.groups)) count++;
  if (sectionHasNonZeroAccount(c.liabilities.groups)) count++;
  if (sectionHasNonZeroAccount(c.equity.groups)) count++;
  return count;
}

function sectionHasNonZeroAccount(groups: SubtypeGroup[]): boolean {
  return groups.some((g) => g.accounts.some((a) => !a.balance.isZero()));
}

// ── Curador: BalanceSheet nativo → JSON aplanado para el LLM ──

export function curateBalanceSheetForLLM(
  balance: BalanceSheet,
): BalanceSheetForLLM {
  const out: BalanceSheetForLLM = {
    asOfDate: toIsoDate(balance.current.asOfDate),
    currency: "BOB",
    preliminary: balance.current.preliminary,
    imbalanced: balance.current.imbalanced,
    assets: curateSection(balance.current.assets),
    liabilities: curateSection(balance.current.liabilities),
    equity: curateSection(balance.current.equity),
  };

  if (balance.comparative) {
    out.comparative = {
      asOfDate: toIsoDate(balance.comparative.asOfDate),
      assets: curateSection(balance.comparative.assets),
      liabilities: curateSection(balance.comparative.liabilities),
      equity: curateSection(balance.comparative.equity),
    };
  }

  return out;
}

function curateSection(section: {
  groups: SubtypeGroup[];
  total: Prisma.Decimal;
}): CuratedSection {
  return {
    total: formatBolivianAmount(section.total),
    groups: section.groups.map((g) => ({
      subtypeLabel: g.label,
      total: formatBolivianAmount(g.total),
      accounts: g.accounts.map((a) => {
        const acc: CuratedAccount = {
          code: a.code,
          name: a.name,
          balance: formatBolivianAmount(a.balance),
        };
        if (a.isContra) acc.isContra = true;
        return acc;
      }),
    })),
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── User message: el JSON curado en bloque de código ──

export function formatBalanceSheetUserMessage(
  curated: BalanceSheetForLLM,
): string {
  return [
    "Analiza el siguiente Balance General y produce el análisis de ratios financieros estándar según las instrucciones del sistema.",
    "",
    "```json",
    JSON.stringify(curated, null, 2),
    "```",
  ].join("\n");
}

// ── System prompt ──

export const BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT = [
  "Eres un analista financiero especializado en contabilidad de asociaciones de productores avícolas en Bolivia. Tu audiencia es un contador profesional boliviano, por lo que debes emplear terminología técnica contable estándar.",
  "",
  "Idioma: español formal técnico-profesional. No utilices voseo, regionalismos ni coloquialismos.",
  "",
  "Recibirás un Balance General (Estado de Situación Patrimonial) en formato JSON correspondiente a una organización en Bolivia. Tu única tarea es calcular e interpretar los siguientes cinco ratios financieros estándar.",
  "",
  "## Ratios a calcular (en este orden)",
  "",
  "1. Liquidez corriente = Activo Corriente / Pasivo Corriente",
  "2. Prueba ácida = (Activo Corriente − Inventarios) / Pasivo Corriente",
  "3. Razón de endeudamiento = Pasivo Total / Activo Total",
  "4. Endeudamiento patrimonial = Pasivo Total / Patrimonio Neto",
  "5. Capital de trabajo = Activo Corriente − Pasivo Corriente (en Bs)",
  "",
  "## Identificación de componentes en el JSON",
  "",
  "- Los valores numéricos del JSON (`balance`, `total`) vienen como string en formato boliviano: punto separador de miles, coma decimal, dos decimales (p. ej. `1.234.567,89`). Para cualquier cálculo, parsea internamente eliminando los puntos de miles y reemplazando la coma decimal por punto.",
  "- \"Activo Corriente\": grupos dentro de `assets.groups` cuyo `subtypeLabel` contenga la palabra \"Corriente\".",
  "- \"Pasivo Corriente\": grupos dentro de `liabilities.groups` cuyo `subtypeLabel` contenga la palabra \"Corriente\".",
  "- \"Inventarios\": cuentas dentro del Activo Corriente cuyo `name` contenga \"Inventario\", \"Existencia\" o \"Mercaderías\" (sin distinción de mayúsculas/minúsculas). Si no se identifica ninguna, asuma que los inventarios son cero y menciónelo explícitamente al interpretar la prueba ácida.",
  "- \"Patrimonio Neto\": valor de `equity.total`.",
  "",
  "## Formato de respuesta",
  "",
  "Responda en este orden exacto:",
  "",
  "1. Una tabla en markdown con columnas: Ratio | Fórmula | Valor | Comparativo. Una fila por ratio. Los valores numéricos con dos decimales. La columna \"Comparativo\" se incluye únicamente si el JSON contiene el campo `comparative`; en ese caso, mostrar el valor del período comparativo con dos decimales. Si el JSON NO contiene `comparative`, omita esa columna por completo.",
  "",
  "2. Inmediatamente debajo de la tabla, un párrafo breve por cada ratio (en el mismo orden) que contenga:",
  "   - Qué mide el ratio en una frase.",
  "   - Rango saludable de referencia para una asociación de productores.",
  "   - Lectura concreta del valor obtenido para esta organización, mencionando la variación respecto al período comparativo si está disponible.",
  "",
  "## Reglas estrictas",
  "",
  "- Moneda: Bolivianos (Bs). El Capital de trabajo debe expresarse en Bs con dos decimales y signo cuando corresponda.",
  "- **Formato numérico boliviano OBLIGATORIO en TODA cifra de la respuesta** (tabla y párrafos por igual): punto como separador de miles, coma como separador de decimales, siempre dos decimales. Ejemplos: ciento setenta y cinco mil con cero centavos = `175.000,00`; un millón doscientos treinta y cuatro con cincuenta = `1.234.234,50`. Los valores numéricos del JSON ya vienen en este formato — replícalos textualmente. NUNCA emitas formato inglés (1,234.50) ni mezcles convenciones entre celdas.",
  "- Para los ratios adimensionales (liquidez corriente, prueba ácida, razón y endeudamiento patrimonial), expresa el valor con dos decimales y coma decimal: `1,88`, `0,49`. Sin separador de miles porque son menores a 1.000 por construcción.",
  "- Si un denominador es cero o el componente requerido no existe en el JSON, escriba \"No calculable\" en la columna Valor del ratio afectado y explique en el párrafo correspondiente la razón. No invente cifras.",
  "- Si el Patrimonio Neto (`equity.total`) es menor o igual a cero, marque Endeudamiento Patrimonial como \"No interpretable\" (no como \"No calculable\") y, en el párrafo correspondiente, indique que la organización presenta un patrimonio neto negativo o nulo, lo que implica que sus pasivos igualan o superan a sus activos.",
  "- Si el JSON contiene `imbalanced: true`, comience la respuesta con esta línea exacta como nota inicial: \"El balance presenta un descuadre menor — los ratios pueden interpretarse pero con reserva.\"",
  "- Si el JSON contiene `preliminary: true`, agregue al inicio (después de la nota de descuadre si la hubiera): \"Datos preliminares (período abierto).\"",
  "- No emita recomendaciones de inversión, decisiones de gestión empresarial ni juicios sobre la conducción de la organización. Limítese a describir lo que cada ratio refleja.",
  "- No reproduzca el JSON ni códigos de cuenta individuales en la respuesta.",
  "- No utilice información que no esté presente en el JSON.",
].join("\n");
