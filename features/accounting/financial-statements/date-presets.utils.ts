import type {
  DatePresetId,
  BreakdownBy,
  CompareWith,
  StatementColumn,
} from "./financial-statements.types";

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

export type DateRange = {
  dateFrom: Date;
  dateTo: Date;
};

export type ResolveDatePresetOptions = {
  tz: string;
  customFrom?: Date;
  customTo?: Date;
};

export type FilterPrecedenceInput = {
  fiscalRange?: DateRange;
  presetRange?: DateRange;
  customRange?: DateRange;
};

export type ResolvedFilterRange = DateRange & {
  preliminary: boolean;
};

// ── Utilidades internas de TZ ─────────────────────────────────────────────────

/**
 * Retorna la fecha "hoy" expresada en la TZ indicada como un objeto
 * { year, month (1-12), day }.
 */
function localDateParts(
  now: Date,
  tz: string,
): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value, 10);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Construye un Date a medianoche UTC dado year, month (1-12), day. */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Último día del mes dado. */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formatea un Date UTC a "DD/MM/YYYY". */
function formatDDMMYYYY(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

// ── resolveDatePreset ─────────────────────────────────────────────────────────

/**
 * Resuelve un DatePresetId a un par [startDate, endDate] en la TZ indicada.
 * Autoridad exclusiva de TZ America/La_Paz en todo el módulo.
 */
export function resolveDatePreset(
  preset: DatePresetId,
  options: ResolveDatePresetOptions,
): [Date, Date] {
  const { tz, customFrom, customTo } = options;
  const now = new Date();
  const { year, month, day } = localDateParts(now, tz);

  const today = utcDate(year, month, day);

  switch (preset) {
    case "today": {
      return [today, today];
    }

    case "yesterday": {
      const yesterday = utcDate(year, month, day - 1);
      return [yesterday, yesterday];
    }

    case "this_week": {
      // Semana ISO: lunes=1 … domingo=7
      // JS getUTCDay: 0=domingo, 1=lunes … 6=sábado
      const jsDay = today.getUTCDay();
      const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;
      const monday = new Date(today);
      monday.setUTCDate(today.getUTCDate() - daysFromMonday);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return [monday, sunday];
    }

    case "last_week": {
      const jsDay = today.getUTCDay();
      const daysFromMonday = jsDay === 0 ? 6 : jsDay - 1;
      const thisMonday = new Date(today);
      thisMonday.setUTCDate(today.getUTCDate() - daysFromMonday);
      const lastMonday = new Date(thisMonday);
      lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
      return [lastMonday, lastSunday];
    }

    case "this_month": {
      const first = utcDate(year, month, 1);
      const last = utcDate(year, month, lastDayOfMonth(year, month));
      return [first, last];
    }

    case "this_month_to_date": {
      const first = utcDate(year, month, 1);
      return [first, today];
    }

    case "last_month": {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const first = utcDate(prevYear, prevMonth, 1);
      const last = utcDate(prevYear, prevMonth, lastDayOfMonth(prevYear, prevMonth));
      return [first, last];
    }

    case "this_quarter": {
      const quarter = Math.ceil(month / 3);
      const qStartMonth = (quarter - 1) * 3 + 1;
      const qEndMonth = quarter * 3;
      const first = utcDate(year, qStartMonth, 1);
      const last = utcDate(year, qEndMonth, lastDayOfMonth(year, qEndMonth));
      return [first, last];
    }

    case "last_quarter": {
      const quarter = Math.ceil(month / 3);
      const prevQuarter = quarter === 1 ? 4 : quarter - 1;
      const prevYear = quarter === 1 ? year - 1 : year;
      const qStartMonth = (prevQuarter - 1) * 3 + 1;
      const qEndMonth = prevQuarter * 3;
      const first = utcDate(prevYear, qStartMonth, 1);
      const last = utcDate(prevYear, qEndMonth, lastDayOfMonth(prevYear, qEndMonth));
      return [first, last];
    }

    case "this_year": {
      return [utcDate(year, 1, 1), utcDate(year, 12, 31)];
    }

    case "this_year_to_date": {
      return [utcDate(year, 1, 1), today];
    }

    case "last_year": {
      const prevYear = year - 1;
      return [utcDate(prevYear, 1, 1), utcDate(prevYear, 12, 31)];
    }

    case "last_30_days": {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 30);
      return [start, today];
    }

    case "last_90_days": {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 90);
      return [start, today];
    }

    case "last_12_months": {
      const start = new Date(today);
      start.setUTCDate(today.getUTCDate() - 365);
      return [start, today];
    }

    case "all_dates": {
      return [utcDate(1970, 1, 1), today];
    }

    case "custom_date": {
      return [customFrom!, customTo!];
    }
  }
}

// ── applyFilterPrecedence ─────────────────────────────────────────────────────

/**
 * Aplica la precedencia de filtros: fiscal > preset > custom.
 * Cuando solo se usa custom, marca preliminary=true.
 */
export function applyFilterPrecedence(
  input: FilterPrecedenceInput,
): ResolvedFilterRange {
  const { fiscalRange, presetRange, customRange } = input;

  if (fiscalRange) {
    return { ...fiscalRange, preliminary: false };
  }

  if (presetRange) {
    return { ...presetRange, preliminary: false };
  }

  return { ...customRange!, preliminary: true };
}

// ── generateBreakdownBuckets ──────────────────────────────────────────────────

/**
 * Genera los StatementColumn[] según el breakdownBy y el rango de fechas.
 * Pura, sin Prisma, sin side effects.
 */
export function generateBreakdownBuckets(
  dateRange: DateRange,
  breakdownBy: BreakdownBy,
): StatementColumn[] {
  const { dateFrom, dateTo } = dateRange;

  if (breakdownBy === "total") {
    return [
      {
        id: "col-current",
        label: "Total",
        dateFrom,
        dateTo,
        role: "current",
      },
    ];
  }

  if (breakdownBy === "months") {
    return generateMonthBuckets(dateFrom, dateTo);
  }

  if (breakdownBy === "quarters") {
    // Degradar a meses si el rango produce menos de 2 trimestres
    const quarterBuckets = generateQuarterBuckets(dateFrom, dateTo);
    if (quarterBuckets.length < 2) {
      return generateMonthBuckets(dateFrom, dateTo);
    }
    return quarterBuckets;
  }

  // years: degradar a meses si el rango produce menos de 2 años calendario
  const yearBuckets = generateYearBuckets(dateFrom, dateTo);
  if (yearBuckets.length < 2) {
    return generateMonthBuckets(dateFrom, dateTo);
  }
  return yearBuckets;
}

function generateMonthBuckets(dateFrom: Date, dateTo: Date): StatementColumn[] {
  const cols: StatementColumn[] = [];
  let year = dateFrom.getUTCFullYear();
  let month = dateFrom.getUTCMonth() + 1;
  const endYear = dateTo.getUTCFullYear();
  const endMonth = dateTo.getUTCMonth() + 1;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const lastDay = lastDayOfMonth(year, month);
    const asOfDate = utcDate(year, month, lastDay);
    cols.push({
      id: `col-${year}-${String(month).padStart(2, "0")}`,
      label: formatDDMMYYYY(asOfDate),
      asOfDate,
      dateFrom: utcDate(year, month, 1),
      dateTo: asOfDate,
      role: "current",
    });

    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return cols;
}

function generateQuarterBuckets(dateFrom: Date, dateTo: Date): StatementColumn[] {
  const cols: StatementColumn[] = [];
  const startYear = dateFrom.getUTCFullYear();
  const startMonth = dateFrom.getUTCMonth() + 1;
  const endYear = dateTo.getUTCFullYear();
  const endMonth = dateTo.getUTCMonth() + 1;

  let year = startYear;
  let quarter = Math.ceil(startMonth / 3);

  while (true) {
    const qStartMonth = (quarter - 1) * 3 + 1;
    const qEndMonth = quarter * 3;

    if (year > endYear || (year === endYear && qStartMonth > endMonth)) break;

    const qFrom = utcDate(year, qStartMonth, 1);
    const qTo = utcDate(year, qEndMonth, lastDayOfMonth(year, qEndMonth));

    cols.push({
      id: `col-${year}-q${quarter}`,
      label: `T${quarter} ${year}`,
      dateFrom: qFrom,
      dateTo: qTo,
      role: "current",
    });

    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }

  return cols;
}

function generateYearBuckets(dateFrom: Date, dateTo: Date): StatementColumn[] {
  const cols: StatementColumn[] = [];
  const startYear = dateFrom.getUTCFullYear();
  const endYear = dateTo.getUTCFullYear();

  for (let y = startYear; y <= endYear; y++) {
    cols.push({
      id: `col-${y}`,
      label: `${y}`,
      dateFrom: utcDate(y, 1, 1),
      dateTo: utcDate(y, 12, 31),
      role: "current",
    });
  }

  return cols;
}

// ── resolveComparativePeriod ──────────────────────────────────────────────────

type ResolveComparativeOptions = {
  customRange?: DateRange;
};

/**
 * Resuelve el período comparativo dado el rango actual y el modo compareWith.
 * Retorna null cuando compareWith="none".
 */
export function resolveComparativePeriod(
  currentRange: DateRange,
  compareWith: CompareWith,
  options?: ResolveComparativeOptions,
): DateRange | null {
  if (compareWith === "none") return null;

  if (compareWith === "custom") {
    return options?.customRange ?? null;
  }

  const { dateFrom, dateTo } = currentRange;
  const durationMs = dateTo.getTime() - dateFrom.getTime();

  if (compareWith === "previous_period") {
    // El período anterior termina el día antes de que empiece el actual
    const prevToMs = dateFrom.getTime() - 86_400_000;
    const prevTo = new Date(prevToMs);
    const prevToDay = utcDate(
      prevTo.getUTCFullYear(),
      prevTo.getUTCMonth() + 1,
      prevTo.getUTCDate(),
    );
    // Misma cantidad de días inclusive: la duración en ms cubre (n-1) intervalos
    // entre n días, así que prevFrom = prevToDay - durationMs
    const prevFromMs = prevToDay.getTime() - durationMs;
    const prevFrom = new Date(prevFromMs);
    const prevFromDay = utcDate(
      prevFrom.getUTCFullYear(),
      prevFrom.getUTCMonth() + 1,
      prevFrom.getUTCDate(),
    );
    return { dateFrom: prevFromDay, dateTo: prevToDay };
  }

  // previous_year
  const prevFrom = new Date(dateFrom);
  prevFrom.setUTCFullYear(prevFrom.getUTCFullYear() - 1);
  const prevTo = new Date(dateTo);
  prevTo.setUTCFullYear(prevTo.getUTCFullYear() - 1);
  return { dateFrom: prevFrom, dateTo: prevTo };
}

// ── computeDiffPercent ────────────────────────────────────────────────────────

/**
 * Calcula la variación porcentual: (current - comparative) / |comparative| * 100.
 * Retorna null si el denominador es 0 o si algún valor es null.
 */
export function computeDiffPercent(
  current: number | null,
  comparative: number | null,
): number | null {
  if (current === null || comparative === null) return null;
  if (comparative === 0) return null;
  return ((current - comparative) / Math.abs(comparative)) * 100;
}
