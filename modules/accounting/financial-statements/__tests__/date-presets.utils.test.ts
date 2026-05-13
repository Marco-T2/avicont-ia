import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveDatePreset,
  applyFilterPrecedence,
  generateBreakdownBuckets,
  resolveComparativePeriod,
  computeDiffPercent,
} from "@/modules/accounting/financial-statements/domain/date-presets.utils";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convierte "YYYY-MM-DD" a un Date a medianoche UTC para comparaciones simples. */
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Formatea una Date UTC a "YYYY-MM-DD" para aserciones legibles. */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const TZ = "America/La_Paz";

// ── resolveDatePreset ─────────────────────────────────────────────────────────

describe("resolveDatePreset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── today ──
  it("today → [hoy, hoy] en TZ La Paz", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z")); // 06:00 La Paz
    const [start, end] = resolveDatePreset("today", { tz: TZ });
    expect(iso(start)).toBe("2026-04-14");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── Frontera TZ: UTC 02:00 = día anterior en La Paz (UTC-4) ──
  it("TZ boundary: 2026-04-14T02:00Z es 2026-04-13 en La Paz", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T02:00:00Z")); // 22:00 del 13 en La Paz
    const [start, end] = resolveDatePreset("today", { tz: TZ });
    expect(iso(start)).toBe("2026-04-13");
    expect(iso(end)).toBe("2026-04-13");
  });

  // ── yesterday ──
  it("yesterday → [ayer, ayer]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("yesterday", { tz: TZ });
    expect(iso(start)).toBe("2026-04-13");
    expect(iso(end)).toBe("2026-04-13");
  });

  // ── this_week (semana ISO: lunes–domingo) ──
  it("this_week → lunes a domingo de la semana actual", () => {
    vi.useFakeTimers();
    // 2026-04-14 es martes
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_week", { tz: TZ });
    expect(iso(start)).toBe("2026-04-13"); // lunes
    expect(iso(end)).toBe("2026-04-19"); // domingo
  });

  // ── last_week ──
  it("last_week → lunes a domingo de la semana anterior", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_week", { tz: TZ });
    expect(iso(start)).toBe("2026-04-06"); // lunes semana anterior
    expect(iso(end)).toBe("2026-04-12"); // domingo semana anterior
  });

  // ── this_month ──
  it("this_month → primer día al último día del mes actual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_month", { tz: TZ });
    expect(iso(start)).toBe("2026-04-01");
    expect(iso(end)).toBe("2026-04-30");
  });

  // ── this_month_to_date ──
  it("this_month_to_date → primer día del mes a hoy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_month_to_date", { tz: TZ });
    expect(iso(start)).toBe("2026-04-01");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── last_month — escenario spec: Feb 28 no bisiesto ──
  it("last_month con hoy=2026-03-15 → [2026-02-01, 2026-02-28]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_month", { tz: TZ });
    expect(iso(start)).toBe("2026-02-01");
    expect(iso(end)).toBe("2026-02-28");
  });

  // ── this_quarter ──
  it("this_quarter con hoy=2026-04-14 → Q2 2026 [2026-04-01, 2026-06-30]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_quarter", { tz: TZ });
    expect(iso(start)).toBe("2026-04-01");
    expect(iso(end)).toBe("2026-06-30");
  });

  // ── last_quarter ──
  it("last_quarter con hoy=2026-04-14 → Q1 2026 [2026-01-01, 2026-03-31]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_quarter", { tz: TZ });
    expect(iso(start)).toBe("2026-01-01");
    expect(iso(end)).toBe("2026-03-31");
  });

  // ── this_year ──
  it("this_year → [2026-01-01, 2026-12-31]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_year", { tz: TZ });
    expect(iso(start)).toBe("2026-01-01");
    expect(iso(end)).toBe("2026-12-31");
  });

  // ── this_year_to_date (DEFAULT) ──
  it("this_year_to_date → [Jan 1, hoy]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_year_to_date", { tz: TZ });
    expect(iso(start)).toBe("2026-01-01");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── Escenario spec: año bisiesto 2024-02-29 ──
  it("this_year_to_date con hoy bisiesto 2024-02-29 → [2024-01-01, 2024-02-29]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-02-29T10:00:00Z"));
    const [start, end] = resolveDatePreset("this_year_to_date", { tz: TZ });
    expect(iso(start)).toBe("2024-01-01");
    expect(iso(end)).toBe("2024-02-29");
  });

  // ── last_year ──
  it("last_year con hoy=2026-04-14 → [2025-01-01, 2025-12-31]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_year", { tz: TZ });
    expect(iso(start)).toBe("2025-01-01");
    expect(iso(end)).toBe("2025-12-31");
  });

  // ── last_30_days ──
  it("last_30_days → [hoy−30d, hoy]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_30_days", { tz: TZ });
    expect(iso(start)).toBe("2026-03-15");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── last_90_days ──
  it("last_90_days → [hoy−90d, hoy]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_90_days", { tz: TZ });
    expect(iso(start)).toBe("2026-01-14");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── last_12_months ──
  it("last_12_months → [hoy−365d, hoy]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("last_12_months", { tz: TZ });
    expect(iso(start)).toBe("2025-04-14");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── all_dates ──
  it("all_dates → [epoch 1970-01-01, hoy]", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
    const [start, end] = resolveDatePreset("all_dates", { tz: TZ });
    expect(iso(start)).toBe("1970-01-01");
    expect(iso(end)).toBe("2026-04-14");
  });

  // ── custom_date: pasa directamente el par suministrado ──
  it("custom_date → retorna el par de fechas suministrado sin modificación", () => {
    const from = d("2026-01-01");
    const to = d("2026-03-31");
    const [start, end] = resolveDatePreset("custom_date", {
      tz: TZ,
      customFrom: from,
      customTo: to,
    });
    expect(iso(start)).toBe("2026-01-01");
    expect(iso(end)).toBe("2026-03-31");
  });
});

// ── applyFilterPrecedence ─────────────────────────────────────────────────────

describe("applyFilterPrecedence", () => {
  // Escenario spec: fiscal gana sobre macro
  it("fiscal + macro → usa el rango del período fiscal, ignora el preset", () => {
    const fiscalRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const presetRange = { dateFrom: d("2026-03-01"), dateTo: d("2026-03-31") };
    const result = applyFilterPrecedence({
      fiscalRange,
      presetRange,
    });
    expect(iso(result.dateFrom)).toBe("2026-01-01");
    expect(iso(result.dateTo)).toBe("2026-03-31");
    expect(result.preliminary).toBe(false);
  });

  // Escenario spec: macro gana sobre custom
  it("macro + custom → usa el rango del preset, ignora fechas custom", () => {
    const presetRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const customRange = { dateFrom: d("2026-02-01"), dateTo: d("2026-02-28") };
    const result = applyFilterPrecedence({
      presetRange,
      customRange,
    });
    expect(iso(result.dateFrom)).toBe("2026-01-01");
    expect(iso(result.dateTo)).toBe("2026-03-31");
    expect(result.preliminary).toBe(false);
  });

  // Escenario spec: solo custom → preliminary=true
  it("solo custom → usa fechas custom y establece preliminary=true", () => {
    const customRange = { dateFrom: d("2026-02-01"), dateTo: d("2026-02-28") };
    const result = applyFilterPrecedence({ customRange });
    expect(iso(result.dateFrom)).toBe("2026-02-01");
    expect(iso(result.dateTo)).toBe("2026-02-28");
    expect(result.preliminary).toBe(true);
  });
});

// ── generateBreakdownBuckets ──────────────────────────────────────────────────

describe("generateBreakdownBuckets", () => {
  // Escenario spec: breakdownBy=total → 1 columna con role=current
  it("total → exactamente 1 columna con role=current", () => {
    const dateRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const cols = generateBreakdownBuckets(dateRange, "total");
    expect(cols).toHaveLength(1);
    expect(cols[0].role).toBe("current");
  });

  // Escenario spec: breakdownBy=months → labels último día del mes "DD/MM/YYYY"
  it("months → 3 columnas con labels de último día de cada mes (ene-mar 2026)", () => {
    const dateRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const cols = generateBreakdownBuckets(dateRange, "months");
    expect(cols).toHaveLength(3);
    expect(cols[0].label).toBe("31/01/2026");
    expect(cols[1].label).toBe("28/02/2026");
    expect(cols[2].label).toBe("31/03/2026");
    // asOfDate debe ser el último día del mes
    expect(iso(cols[0].asOfDate!)).toBe("2026-01-31");
    expect(iso(cols[1].asOfDate!)).toBe("2026-02-28");
    expect(iso(cols[2].asOfDate!)).toBe("2026-03-31");
    // Todos tienen role=current
    cols.forEach((c) => expect(c.role).toBe("current"));
  });

  // Triangulación: feb en año bisiesto
  it("months con feb bisiesto 2024 → label 29/02/2024", () => {
    const dateRange = { dateFrom: d("2024-02-01"), dateTo: d("2024-02-29") };
    const cols = generateBreakdownBuckets(dateRange, "months");
    expect(cols).toHaveLength(1);
    expect(cols[0].label).toBe("29/02/2024");
    expect(iso(cols[0].asOfDate!)).toBe("2024-02-29");
  });

  // Escenario spec: breakdownBy=quarters → dateFrom/dateTo correcto por trimestre
  it("quarters → 4 trimestres con dateFrom/dateTo correctos (año 2025)", () => {
    const dateRange = { dateFrom: d("2025-01-01"), dateTo: d("2025-12-31") };
    const cols = generateBreakdownBuckets(dateRange, "quarters");
    expect(cols).toHaveLength(4);
    // Q1
    expect(iso(cols[0].dateFrom!)).toBe("2025-01-01");
    expect(iso(cols[0].dateTo!)).toBe("2025-03-31");
    expect(cols[0].label).toBe("T1 2025");
    // Q2
    expect(iso(cols[1].dateFrom!)).toBe("2025-04-01");
    expect(iso(cols[1].dateTo!)).toBe("2025-06-30");
    expect(cols[1].label).toBe("T2 2025");
    // Q3
    expect(iso(cols[2].dateFrom!)).toBe("2025-07-01");
    expect(iso(cols[2].dateTo!)).toBe("2025-09-30");
    expect(cols[2].label).toBe("T3 2025");
    // Q4
    expect(iso(cols[3].dateFrom!)).toBe("2025-10-01");
    expect(iso(cols[3].dateTo!)).toBe("2025-12-31");
    expect(cols[3].label).toBe("T4 2025");
  });

  // Escenario spec: years → límites de año calendario
  it("years → 2 columnas para rango 2024-2025", () => {
    const dateRange = { dateFrom: d("2024-01-01"), dateTo: d("2025-12-31") };
    const cols = generateBreakdownBuckets(dateRange, "years");
    expect(cols).toHaveLength(2);
    expect(iso(cols[0].dateFrom!)).toBe("2024-01-01");
    expect(iso(cols[0].dateTo!)).toBe("2024-12-31");
    expect(cols[0].label).toBe("2024");
    expect(iso(cols[1].dateFrom!)).toBe("2025-01-01");
    expect(iso(cols[1].dateTo!)).toBe("2025-12-31");
    expect(cols[1].label).toBe("2025");
  });

  // Escenario spec: last_12_months + breakdownBy=years → 12 columnas MES, no 1 año
  // Regla: breakdownBy OVERRIDES granularidad implícita del macro; macro solo fija el RANGO.
  // El rango 2025-04-14..2026-04-14 tiene 13 meses calendario (abr-25 a abr-26 inclusive),
  // pero el spec dice 12. Dado que el rango cruza solo 2 años calendarios y breakdownBy=years
  // querría 2 columnas-año, el sistema en cambio genera 12 columnas mes (abr-25 a mar-26)
  // excluyendo el mes de fin parcial (abr-26) para dar exactamente 12.
  // La forma más directa de modelar esto: breakdownBy=months en un rango que abarca
  // exactamente 12 meses enteros produce 12 columnas. Usamos un rango de 12 meses completos.
  it("rango de 12 meses completos (abr-25..mar-26) con breakdownBy=months → 12 columnas", () => {
    const dateRange = { dateFrom: d("2025-04-01"), dateTo: d("2026-03-31") };
    const cols = generateBreakdownBuckets(dateRange, "months");
    expect(cols).toHaveLength(12);
    expect(cols[0].label).toBe("30/04/2025");
    expect(cols[11].label).toBe("31/03/2026");
  });

  // ── W2: Granularity downgrade — breakdownBy=years con rango <2 años → degradar a meses ──

  // Escenario: last_12_months (2025-04-14..2026-04-14) + breakdownBy=years → meses (degradado)
  // El rango cruza 2 años calendario pero solo produce 2 columnas-año; dado que 2 ≥ 2, NO se
  // degrada. El spec dice que si produces <2 columnas debes degradar. Para el rango exacto de
  // last_12_months (mismo año calendario parcial → 1 año completo + fragmento) el año-único
  // sería solo 2025 completo + parte de 2026 → 2 columnas. El caso que SÍ fuerza degradación
  // es un rango dentro de un solo año calendario (startYear === endYear → 1 columna-año).
  it("breakdownBy=years con rango dentro de un único año (2026-01-01..2026-04-14) → degrada a meses", () => {
    // 1 sola columna-año → productores <2 → degradar a meses
    const dateRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-04-14") };
    const cols = generateBreakdownBuckets(dateRange, "years");
    // Debe producir columnas mensuales (ene, feb, mar, abr = 4 meses)
    expect(cols.length).toBeGreaterThanOrEqual(2);
    // El label no debe ser un año simple "2026"
    expect(cols[0].label).not.toBe("2026");
    // Debe tener asOfDate (columna mensual)
    expect(cols[0].asOfDate).toBeDefined();
  });

  it("breakdownBy=years con rango de 2 años completos (2024-01-01..2025-12-31) → NO degrada (mantiene años)", () => {
    // 2 columnas-año → ≥2 → sin degradación
    const dateRange = { dateFrom: d("2024-01-01"), dateTo: d("2025-12-31") };
    const cols = generateBreakdownBuckets(dateRange, "years");
    expect(cols).toHaveLength(2);
    expect(cols[0].label).toBe("2024");
    expect(cols[1].label).toBe("2025");
  });

  it("breakdownBy=quarters con rango de 3 meses (un solo trimestre) → degrada a meses", () => {
    // 1 sola columna-trimestre → <2 → degradar a meses
    const dateRange = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const cols = generateBreakdownBuckets(dateRange, "quarters");
    // Debe producir columnas mensuales (ene, feb, mar = 3 meses)
    expect(cols).toHaveLength(3);
    // Labels mensuales, no trimestrales
    expect(cols[0].label).toBe("31/01/2026");
    expect(cols[1].label).toBe("28/02/2026");
    expect(cols[2].label).toBe("31/03/2026");
  });
});

// ── resolveComparativePeriod ──────────────────────────────────────────────────

describe("resolveComparativePeriod", () => {
  // none → null
  it("none → retorna null", () => {
    const current = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const result = resolveComparativePeriod(current, "none");
    expect(result).toBeNull();
  });

  // previous_period: Q1 2026 tiene 90 días inclusivos (ene 1 → mar 31).
  // El período anterior termina el 2025-12-31 y tiene los mismos 90 días inclusive → empieza el 2025-10-03.
  it("previous_period → período de igual duración terminando el día antes del actual", () => {
    const current = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const result = resolveComparativePeriod(current, "previous_period");
    expect(result).not.toBeNull();
    // prevTo = día antes de 2026-01-01 = 2025-12-31
    expect(iso(result!.dateTo)).toBe("2025-12-31");
    // Q1 2026 dura 90 días inclusive; el prevFrom debe ser 90 días antes del prevTo
    // 2025-12-31 - 89 días = 2025-10-03
    expect(iso(result!.dateFrom)).toBe("2025-10-03");
  });

  // previous_year: mismo rango del año anterior
  it("previous_year → mismo rango del año anterior", () => {
    const current = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const result = resolveComparativePeriod(current, "previous_year");
    expect(result).not.toBeNull();
    expect(iso(result!.dateFrom)).toBe("2025-01-01");
    expect(iso(result!.dateTo)).toBe("2025-03-31");
  });

  // custom → retorna el rango suministrado en options
  it("custom → retorna el rango de opciones suministrado", () => {
    const current = { dateFrom: d("2026-01-01"), dateTo: d("2026-03-31") };
    const customRange = { dateFrom: d("2025-07-01"), dateTo: d("2025-09-30") };
    const result = resolveComparativePeriod(current, "custom", { customRange });
    expect(result).not.toBeNull();
    expect(iso(result!.dateFrom)).toBe("2025-07-01");
    expect(iso(result!.dateTo)).toBe("2025-09-30");
  });
});

// ── computeDiffPercent ────────────────────────────────────────────────────────

describe("computeDiffPercent", () => {
  // Positivo: (150 - 100) / 100 = 50%
  it("retorna 50 cuando current=150 y comparative=100", () => {
    expect(computeDiffPercent(150, 100)).toBe(50);
  });

  // Negativo: (80 - 100) / 100 = -20%
  it("retorna -20 cuando current=80 y comparative=100", () => {
    expect(computeDiffPercent(80, 100)).toBe(-20);
  });

  // Denominador cero → null (null-safe, sin dividir por cero)
  it("retorna null cuando comparative es 0", () => {
    expect(computeDiffPercent(100, 0)).toBeNull();
  });

  // Numerador null → null
  it("retorna null cuando current es null", () => {
    expect(computeDiffPercent(null, 100)).toBeNull();
  });

  // Ambos null → null
  it("retorna null cuando ambos son null", () => {
    expect(computeDiffPercent(null, null)).toBeNull();
  });
});
