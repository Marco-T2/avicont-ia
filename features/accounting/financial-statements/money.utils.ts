import { Prisma } from "@/generated/prisma/client";

// Alias local para no repetir Prisma.Decimal en firmas
type Decimal = Prisma.Decimal;

// Tolerancia estándar para la verificación de ecuación contable (REQ-6)
const TOLERANCE = new Prisma.Decimal("0.01");

/**
 * Redondea un Decimal a 2 decimales con la convención half-up (REQ-10).
 * Ejemplo: 0.005 → 0.01, 0.004 → 0.00
 *
 * Nota: usamos toDecimalPlaces sobre el Decimal para conservar el tipo.
 * La serialización a string con trailing zeros se hace en serializeStatement.
 */
export function roundHalfUp(d: Decimal): Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Convierte un Decimal a string con exactamente 2 decimales (con trailing zeros).
 * Ejemplo: Decimal(100) → "100.00", Decimal(1.5) → "1.50"
 */
function decimalToFixed2(d: Decimal): string {
  return roundHalfUp(d).toFixed(2);
}

/**
 * Suma un array de Decimals. Lista vacía → 0.
 * No usa Number() — mantiene precisión arbitraria de decimal.js.
 */
export function sumDecimals(xs: Decimal[]): Decimal {
  return xs.reduce((acc, x) => acc.plus(x), new Prisma.Decimal(0));
}

/**
 * Formato numérico boliviano: punto como separador de miles y coma como
 * separador de decimales (siempre 2 decimales). Pre-formatear en la frontera
 * de salida (ej. JSON curado para LLM) cumple dos funciones: (a) ancla el
 * formato exacto que el consumidor debe replicar literalmente, (b) elimina
 * la inconsistencia tabla-vs-texto que aparece cuando un LLM elige formato
 * inglés por defecto (1,234.50) en una celda y "ES" (1.234,50) en otra.
 *
 * Ejemplos:
 *   0           → "0,00"
 *   1234.5      → "1.234,50"
 *   -30000      → "-30.000,00"
 *   1000000     → "1.000.000,00"
 */
export function formatBolivianAmount(d: Decimal): string {
  const negative = d.isNegative();
  const [intPart, decPart] = d.abs().toFixed(2).split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${withThousands},${decPart}`;
}

/**
 * Compara dos Decimals con tolerancia ±0.01 BOB.
 * Usado para verificar la ecuación contable (REQ-6).
 */
export function eq(a: Decimal, b: Decimal): boolean {
  return a.minus(b).abs().lte(TOLERANCE);
}

/**
 * Serializa un objeto (statement, grupo, etc.) convirtiendo recursivamente
 * todos los valores Decimal en strings redondeados half-up a 2 decimales.
 *
 * Se aplica SOLO en la frontera de serialización (route handler → Response.json).
 * El pipeline interno siempre trabaja con Decimal.
 *
 * Preserva: string, number, boolean, null, undefined, Date.
 */
export function serializeStatement<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  // Decimal de Prisma (decimal.js) se detecta por instanceof
  if (obj instanceof Prisma.Decimal) {
    return decimalToFixed2(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeStatement) as unknown as T;
  }

  if (typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as object)) {
      result[key] = serializeStatement((obj as Record<string, unknown>)[key]);
    }
    return result as T;
  }

  return obj;
}
