import { ValidationError } from "@/features/shared/errors";

/**
 * Convierte un string ISO (YYYY-MM-DD o datetime con offset) en `Date` que
 * representa la fecha calendario como UTC midnight.
 *
 * Asientos contables son por día calendario, no por instante. Si un caller
 * manda `"2026-04-30T23:00:00-04:00"` y se construye con `new Date(...)`,
 * el resultado es `2026-05-01T03:00:00Z` — un día distinto en UTC. Esto
 * caería en el período fiscal equivocado (`FiscalPeriodsService.findByDate`
 * compara contra `month` derivado de `getUTCMonth(startDate)`).
 *
 * Esta normalización extrae solo `YYYY-MM-DD` y construye `T00:00:00Z`,
 * alineado con cómo el seed persiste `startDate` de los períodos.
 */
export function parseEntryDate(rawDate: string): Date {
  const dateOnly = rawDate.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new ValidationError(
      `La fecha del asiento es inválida (recibido: "${rawDate}").`,
    );
  }
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(
      `La fecha del asiento es inválida (recibido: "${rawDate}").`,
    );
  }
  return parsed;
}
