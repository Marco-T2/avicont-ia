/**
 * Utilidades de fecha para avicont-ia.
 *
 * Estas funciones existen para resolver una clase de bug específica: cuando
 * se construye una Date a partir de una cadena UTC-midnight ("YYYY-MM-DDT00:00:00.000Z")
 * y se formatea con toLocaleDateString() en Bolivia (UTC-4), el resultado
 * muestra el día anterior porque la conversión TZ retrocede 4 horas.
 *
 * Regla: NUNCA usar `new Date(x).toLocaleDateString(...)` para mostrar fechas
 * de comprobantes. Usar `formatDateBO` en su lugar.
 */

// ── todayLocal ────────────────────────────────────────────────────────────────

/**
 * Today's date in local time as a "YYYY-MM-DD" string.
 *
 * Uses getFullYear / getMonth / getDate (local-time getters) instead of
 * toISOString() so a Bolivian user at 21:00 local (01:00 UTC next day) still
 * sees today's local calendar date.
 *
 * Intended for client-side rendering (the browser's local timezone is
 * correct). On the server, this depends on the process TZ — prefer a
 * different helper if a server-side default is ever needed; or ensure
 * TZ=America/La_Paz is set in the server environment.
 *
 * @returns string formatted as "YYYY-MM-DD" (zero-padded).
 */
export function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── formatDateBO ──────────────────────────────────────────────────────────────

/**
 * Format a date-only value for display in es-BO locale as "DD/MM/YYYY".
 *
 * Parses the ISO date portion (first 10 chars) directly without ever
 * instantiating a Date for the format step — this avoids any timezone
 * conversion and makes the output stable for values stored at UTC-midnight
 * (legacy rows) or UTC-noon (new rows).
 *
 * Key guarantee: `formatDateBO("2026-04-17T00:00:00.000Z")` returns
 * `"17/04/2026"` in Bolivia (UTC-4), unlike `new Date(x).toLocaleDateString("es-BO")`
 * which would return `"16/04/2026"` (shifted back one day).
 *
 * @param value
 *   - string  — "YYYY-MM-DD" or a full ISO "YYYY-MM-DDTHH:mm:ss.sssZ".
 *   - Date    — any Date; the UTC calendar day is used (value.toISOString().slice(0,10)).
 *   - null / undefined — returns "" (defensive, never throws on falsy API payloads).
 * @returns "DD/MM/YYYY" with zero-padded day/month, or "" for null/undefined/malformed.
 * @throws  Never. Malformed strings shorter than 10 chars return "" as well.
 */
export function formatDateBO(value: string | Date | null | undefined): string {
  if (value == null) return "";

  let isoPrefix: string;

  if (value instanceof Date) {
    // Verificar que es una Date válida antes de llamar toISOString
    if (isNaN(value.getTime())) return "";
    isoPrefix = value.toISOString().slice(0, 10);
  } else {
    if (value.length < 10) return "";
    isoPrefix = value.slice(0, 10);
  }

  // Validar formato YYYY-MM-DD (segmentos de 4-2-2 dígitos)
  const parts = isoPrefix.split("-");
  if (
    parts.length !== 3 ||
    parts[0].length !== 4 ||
    parts[1].length !== 2 ||
    parts[2].length !== 2 ||
    parts.some((p) => !/^\d+$/.test(p))
  ) {
    return "";
  }

  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

// ── formatDateTimeBO / formatTimeBO ───────────────────────────────────────────

/**
 * Formatter compartido — TZ Bolivia, 24h, sin locale-dependent separators.
 * Usar con `formatToParts` para armar el output a mano y evitar quirks de
 * Intl entre versiones de Node (ej. "24:00" vs "00:00" según runtime).
 */
const BO_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface BOParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

function toBOParts(value: string | Date | null | undefined): BOParts | null {
  if (value == null) return null;
  let date: Date;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    date = value;
  } else {
    if (value.length === 0) return null;
    date = new Date(value);
    if (isNaN(date.getTime())) return null;
  }
  const parts = BO_DATETIME_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/**
 * Format a real timestamp for display in es-BO locale as "DD/MM/YYYY HH:mm",
 * converted to America/La_Paz (UTC-4).
 *
 * Use this for timestamps that represent an instant in time (e.g. `audit_logs.createdAt`,
 * `now()` outputs from Postgres triggers). Do NOT use for "calendar day" values
 * stored at UTC-midnight or UTC-noon — those should use `formatDateBO` instead.
 *
 * @param value  ISO string, Date, or nullish. Anything malformed → "".
 * @returns "DD/MM/YYYY HH:mm" in BO local time, or "" for null/undefined/malformed.
 */
export function formatDateTimeBO(
  value: string | Date | null | undefined,
): string {
  const p = toBOParts(value);
  if (!p) return "";
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/**
 * Format a real timestamp for display as "HH:mm" in BO local time.
 *
 * Useful when the date is already shown in a parent UI element and you only
 * need the time-of-day to disambiguate events in the same day.
 *
 * @param value  ISO string, Date, or nullish. Anything malformed → "".
 * @returns "HH:mm" in BO local time, or "" for null/undefined/malformed.
 */
export function formatTimeBO(
  value: string | Date | null | undefined,
): string {
  const p = toBOParts(value);
  if (!p) return "";
  return `${p.hour}:${p.minute}`;
}

// ── lastDayOfUTCMonth ─────────────────────────────────────────────────────────

/**
 * Returns a Date representing the last day of the UTC month for the given date.
 *
 * Uses `Date.UTC(year, month + 1, 0)` — day=0 wraps to the last day of the
 * previous month. Works correctly for:
 * - January (31 days), April (30 days), February leap (29), February non-leap (28)
 * - December: `Date.UTC(year, 12, 0)` wraps to Dec 31 of the same year.
 *
 * @param date  Any Date; UTC getters are used — local timezone is irrelevant.
 * @returns A Date at UTC midnight of the last day of that month.
 */
export function lastDayOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

// ── addUTCDays ────────────────────────────────────────────────────────────────

/**
 * Returns a new Date offset by `delta` whole UTC days from `date`.
 *
 * Positive delta advances, negative delta goes back. Preserves the original
 * time-of-day in UTC and handles month/year wrap via native setUTCDate
 * overflow semantics.
 *
 * Examples:
 *   addUTCDays(new Date("2026-04-17T00:00:00Z"), -1) → 2026-04-16T00:00:00.000Z
 *   addUTCDays(new Date("2026-03-01T12:00:00Z"),  1) → 2026-03-02T12:00:00.000Z
 *
 * Use this instead of inline `new Date(d); d.setUTCDate(d.getUTCDate() - 1)`
 * chains — callers of that pattern tend to miss the "clone first" step and
 * mutate the source date accidentally.
 *
 * @param date  Any Date; UTC getters/setters are used — local TZ is ignored.
 * @param delta Signed integer number of days (fractions are truncated by native setUTCDate).
 * @returns A new Date `delta` days offset from the input.
 */
export function addUTCDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

// ── startOfMonth / endOfMonth (local TZ) ──────────────────────────────────────

/**
 * Returns a Date at local midnight (00:00:00.000) of the first day of the month
 * containing `date`. Uses local-time getters/constructor, so in a process with
 * TZ=America/La_Paz the result is BO-local start-of-month.
 *
 * Used by route handlers that default date ranges to "current month" (REQ-AUDIT.1).
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Returns a Date at local 23:59:59.999 of the last day of the month containing
 * `date`. Uses the `setDate(0)` of next month trick to handle variable-length
 * months (Feb leap years, 30/31-day months).
 */
export function endOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

// ── toNoonUtc ─────────────────────────────────────────────────────────────────

/**
 * Normalize a date input to a UTC-noon Date for persistence.
 *
 * Storing the instant at 12:00 UTC guarantees the calendar day round-trips
 * unambiguously for any timezone within UTC-12 .. UTC+12. Use this as the
 * single code path for Sale / Purchase / Dispatch / IVA books repository date
 * writes — do NOT inline `new Date(input.date + "T12:00:00.000Z")`.
 *
 * Always calls `slice(0, 10)` on the ISO string first, so full ISO strings
 * ("YYYY-MM-DDTHH:mm:ss.sssZ") are handled correctly without double-appending
 * the time suffix. This means `toNoonUtc("2026-04-17T00:00:00.000Z")` and
 * `toNoonUtc("2026-04-17")` both return `new Date("2026-04-17T12:00:00.000Z")`.
 *
 * When a `Date` instance is passed (e.g. from Zod's `z.coerce.date()` boundary),
 * its ISO string is extracted first via `toISOString()` before slicing.
 *
 * @param value  a bare "YYYY-MM-DD" string, a full ISO string, or a `Date` instance.
 *               Anything longer than 10 chars is truncated before appending noon UTC.
 * @returns a Date representing noon UTC on the given calendar day.
 * @throws  RangeError if the resulting Date is Invalid (caller sends trash).
 *          Callers are expected to validate via Zod before calling.
 */
export function toNoonUtc(value: string | Date): Date {
  const raw = value instanceof Date ? value.toISOString() : value;
  const datePart = raw.slice(0, 10);
  const d = new Date(`${datePart}T12:00:00.000Z`);
  if (isNaN(d.getTime())) {
    throw new RangeError(`Invalid date: "${String(value)}"`);
  }
  return d;
}
