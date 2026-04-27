export interface FiscalPeriodLike {
  startDate: Date | string;
  endDate: Date | string;
  status: "OPEN" | "CLOSED";
}

function toIsoDateSlice(value: Date | string): string {
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

export function findPeriodCoveringDate<T extends FiscalPeriodLike>(
  date: string,
  periods: readonly T[],
): T | null {
  return (
    periods.find(
      (p) =>
        p.status === "OPEN" &&
        toIsoDateSlice(p.startDate) <= date &&
        date <= toIsoDateSlice(p.endDate),
    ) ?? null
  );
}
