import "server-only";
// REQ-002: `import "server-only"` is LINE 1 (positional requirement per PRE-C3 Next.js
// doc-read lock). This prevents the module from being bundled into the client — Next.js
// throws a build-time error if any client component transitively imports this file.
// DISTINCT from `"use server"` directive (which marks Server Functions/actions).
//
// D5 INVERSE (financial-statements barrel strategy):
// - server.ts: server-only re-exports (FinancialStatementsService, factory, schemas, RUNTIME)
// - index.ts:  client-safe re-exports (serializeStatement + TYPE-only)
// - NO client.ts: zero React hooks in consumers — dispatch-hex pattern, NOT ai-agent pattern.
//
// RUNTIME exports exposed here are consumed server-side by:
// - formatBolivianAmount: ai-agent domain prompts (2 files) — RUNTIME
// - roundHalfUp, sumDecimals, eq: 5 sibling features (trial-balance, equity-statement,
//   worksheet, initial-balance, iva-books) — RUNTIME via server.ts barrel

// ── Service + composition root ──
export { FinancialStatementsService } from "../application/financial-statements.service";
export { makeFinancialStatementsService } from "./composition-root";

// ── Zod validation schemas ──
export {
  balanceSheetQuerySchema,
  incomeStatementQuerySchema,
} from "../domain/financial-statements.validation";

// ── RUNTIME exports (server-side consumers) ──
// `serializeStatement` is environment-neutral (no server-only deps) but is also
// re-exported here for SYMMETRY with the old features/.../server.ts surface
// (which re-exported `* from "./money.utils"`). Routes already importing
// `serializeStatement` from the server barrel (initial-balance, trial-balance,
// equity-statement) continue to use the same barrel post-cutover. Composition
// root extension precedent: ai-agent C4 GREEN ccab3a77 added makeAgentRateLimitService
// to presentation/server.ts for symmetric post-cutover surface preservation.
export {
  formatBolivianAmount,
  roundHalfUp,
  sumDecimals,
  eq,
  serializeStatement,
} from "../domain/money.utils";
