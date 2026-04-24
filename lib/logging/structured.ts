/**
 * Emite un log de observabilidad operacional con forma JSON.
 *
 * Pensado para ser consumido por herramientas de ingestión (Vercel, Cloud Run,
 * agregadores de logs) que parsean stdout línea-por-línea. Cada invocación
 * produce una línea JSON estable con `event` como discriminador.
 *
 * NO es un reemplazo de `audit_logs`. Esta infra es best-effort y no pasa por
 * triggers de Postgres — sirve para alerting y debugging, no para compliance.
 * Ver docs/adr/001-eliminacion-audit-log-imbalance.md.
 *
 * Normaliza tipos que no serializan bien con JSON.stringify nativo:
 * - `Prisma.Decimal` → string (toFixed(2)) para preservar precisión monetaria
 * - `Date` → ISO string
 */
export function logStructured(payload: Record<string, unknown>): void {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    normalized[key] = normalize(value);
  }
  console.warn(JSON.stringify(normalized));
}

function normalize(value: unknown): unknown {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  // Duck-typing sobre Decimal (Prisma.Decimal / decimal.js) en vez de
  // `instanceof`: el runtime de Prisma puede re-exportar la clase desde
  // boundaries distintos (generated client vs test env), lo que hace que
  // `instanceof` dé false negative. `constructor.name === "Decimal"` + presencia
  // de `toFixed` es estable across boundaries.
  if (isDecimal(value)) return value.toFixed(2);
  return value;
}

function isDecimal(value: unknown): value is { toFixed: (n: number) => string } {
  if (typeof value !== "object" || value === null) return false;
  if (typeof (value as { toFixed?: unknown }).toFixed !== "function") return false;
  // Prisma expone el constructor con nombre "Decimal" o un alias versionado
  // (p.ej. "Decimal2" en el runtime generado). Matcheamos el prefijo para
  // tolerar ambos, sin depender de `instanceof` que es frágil cross-module.
  const name = (value as { constructor?: { name?: string } }).constructor?.name ?? "";
  return name.startsWith("Decimal");
}
