import "server-only";
// REQ-002: `import "server-only"` is LINE 1 (positional requirement per PRE-C3 Next.js
// doc-read lock: use-client.md + server-and-client-components.md). This prevents the
// module from being bundled into the client — Next.js throws a build-time error if any
// client component transitively imports this file.
// DISTINCT from the "use server" directive (which marks Server Functions/actions).
//
// D5 INVERSE (trial-balance barrel strategy — EXACT mirror of FS sister b8b9dcf5):
// - server.ts: server-only re-exports (TrialBalanceService, factory, schema, exporters)
// - index.ts:  client-safe re-exports (TYPE-only domain types)
// - NO client.ts: zero React hooks in consumers — dispatch-hex pattern, NOT ai-agent dual-barrel.
//   consumers (trial-balance-page-client.tsx) use useSWR + direct API fetch; import TYPES only.

// ── Service + composition root ──
export { TrialBalanceService } from "../application/trial-balance.service";
export { makeTrialBalanceService } from "./composition-root";

// ── Zod validation schema ──
export { trialBalanceQuerySchema } from "../domain/trial-balance.validation";

// ── Exporter functions (server-side consumers: route.ts for PDF/XLSX downloads) ──
export { exportTrialBalancePdf } from "../infrastructure/exporters/trial-balance-pdf.exporter";
export { exportTrialBalanceXlsx } from "../infrastructure/exporters/trial-balance-xlsx.exporter";

// ── TYPE re-exports (also available in index.ts for client-safe consumption) ──
export type {
  TrialBalanceReport,
  TrialBalanceFilters,
  TrialBalanceRow,
  TrialBalanceTotals,
  SerializedTrialBalanceReport,
  SerializedTrialBalanceRow,
  SerializedTrialBalanceTotals,
} from "../domain/trial-balance.types";
