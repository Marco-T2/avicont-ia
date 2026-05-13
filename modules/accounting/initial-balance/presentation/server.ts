import "server-only";
// REQ-002: `import "server-only"` is LINE 1 (positional requirement per PRE-C3 Next.js
// doc-read lock: server-and-client-components.md). This prevents the module from being
// bundled into the client — Next.js throws a build-time error if any client component
// transitively imports this file.
// DISTINCT from the "use server" directive (which marks Server Functions/actions).
//
// D5 axis-distinct POSITIVE (cleanest D5 in OLEADA 6 — same as WS):
// features/accounting/initial-balance/server.ts ALREADY had `import "server-only"` on line 1.
// C3 MIGRATES (not adds) — no new guard required.
//
// D5 INVERSE (initial-balance barrel strategy — EXACT mirror of WS/TB sister):
// - server.ts: server-only re-exports (InitialBalanceService, factory, schema, exporters)
// - index.ts:  client-safe re-exports (TYPE-only domain types)
// - NO client.ts: zero React hooks in initial-balance module — pure data/computation module.
//   Consumers use direct API fetch; import TYPES only from barrel.

// ── Service + composition root ──
export { InitialBalanceService } from "../application/initial-balance.service";
export { makeInitialBalanceService } from "./composition-root";

// ── Zod validation schema ──
export { initialBalanceQuerySchema } from "../domain/initial-balance.validation";

// ── Exporter functions (server-side consumers: route.ts for PDF/XLSX downloads) ──
export { exportInitialBalancePdf } from "../infrastructure/exporters/initial-balance-pdf.exporter";
export { exportInitialBalanceXlsx } from "../infrastructure/exporters/initial-balance-xlsx.exporter";

// ── TYPE re-exports (also available in index.ts for client-safe consumption) ──
export type {
  InitialBalanceRow,
  InitialBalanceStatement,
  InitialBalanceGroup,
  InitialBalanceSection,
  InitialBalanceOrgHeader,
  BuildInitialBalanceInput,
} from "../domain/initial-balance.types";
