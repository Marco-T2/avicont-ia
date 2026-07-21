import "server-only";
// REQ-002: `import "server-only"` is LINE 1 (positional requirement per PRE-C3 Next.js
// doc-read lock). This prevents the module from being bundled into the client — Next.js
// throws a build-time error if any client component transitively imports this file.
// DISTINCT from the "use server" directive (which marks Server Functions/actions).
//
// NOTE: features/accounting/equity-statement/server.ts did NOT have server-only (it was
// in service.ts instead). This hex presentation barrel ADDS it from scratch per R3.
//
// D5 INVERSE (equity-statement barrel strategy — EXACT mirror of TB sister 2a50c2ca):
// - server.ts: server-only re-exports (EquityStatementService, factory, schema, exporters)
// - index.ts:  client-safe re-exports (TYPE-only domain types)
// - NO client.ts: zero React hooks in consumers — dispatch-hex pattern.
//   consumers use direct API fetch; import TYPES only.

// ── Service + composition root ──
export { EquityStatementService } from "../application/equity-statement.service";
export { makeEquityStatementService } from "./composition-root";

// ── Zod validation schema ──
export { equityStatementQuerySchema } from "../domain/equity-statement.validation";

// ── Exporters — [EXPORT] cluster paydown ──
// PDF/XLSX generation now goes through EquityStatementService.exportPdf/exportXlsx
// (injected EquityStatementExporterPort, wired in composition-root.ts). This barrel
// no longer re-exports the raw exporter functions (that re-export was the R4
// violation this paydown fixes) — route.ts calls the service methods instead.

// ── TYPE re-exports (also available in index.ts for client-safe consumption) ──
export type {
  EquityStatement,
  ColumnKey,
  RowKey,
  EquityCell,
  EquityRow,
  EquityColumn,
  EquityColumnTotals,
  BuildEquityStatementInput,
  EquityAccountMetadata,
  SerializedEquityCell,
  SerializedEquityRow,
  SerializedEquityStatement,
} from "../domain/equity-statement.types";

// ── Port companion DTOs (consumed by route.ts via service.getOrgMetadata) ──
// Added at C4 GREEN: route.ts calls service.getOrgMetadata(orgId) — return type is EquityOrgMetadata.
// Design §9.1 Option A: route no longer imports infra directly; DTO type flows via this barrel.
export type { EquityOrgMetadata } from "../domain/ports/equity-statement-query.port";
