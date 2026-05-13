import "server-only";
// REQ-002: `import "server-only"` is LINE 1 (positional requirement per PRE-C3 Next.js
// doc-read lock: server-and-client-components.md). This prevents the module from being
// bundled into the client — Next.js throws a build-time error if any client component
// transitively imports this file.
// DISTINCT from the "use server" directive (which marks Server Functions/actions).
//
// D5 axis-distinct POSITIVE (cleanest D5 in OLEADA 6):
// features/accounting/worksheet/server.ts ALREADY had `import "server-only"` on line 1.
// C3 MIGRATES (not adds) — no new guard required. Source: WS explore #2314.
//
// D5 INVERSE (worksheet barrel strategy — EXACT mirror of TB sister):
// - server.ts: server-only re-exports (WorksheetService, factory, schema, exporters)
// - index.ts:  client-safe re-exports (TYPE-only domain types)
// - NO client.ts: zero React hooks in worksheet module — pure data/computation module.
//   Consumers use direct API fetch; import TYPES only from barrel.

// ── Service + composition root ──
export { WorksheetService } from "../application/worksheet.service";
export { makeWorksheetService } from "./composition-root";

// ── Zod validation schema ──
export { worksheetQuerySchema } from "../domain/worksheet.validation";

// ── Exporter functions (server-side consumers: route.ts for PDF/XLSX downloads) ──
export { exportWorksheetPdf } from "../infrastructure/exporters/worksheet-pdf.exporter";
export { exportWorksheetXlsx } from "../infrastructure/exporters/worksheet-xlsx.exporter";

// ── TYPE re-exports (also available in index.ts for client-safe consumption) ──
export type {
  WorksheetReport,
  WorksheetFilters,
  WorksheetRow,
  WorksheetTotals,
  WorksheetGroup,
} from "../domain/worksheet.types";

// WS-D1: WorksheetMovementAggregation + WorksheetAccountMetadata live in domain/types.ts
// (extracted from infra at C0 per WS-D1 — port interface cannot reference infra-defined types).
export type {
  WorksheetMovementAggregation,
  WorksheetAccountMetadata,
} from "../domain/types";
