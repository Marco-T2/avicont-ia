/**
 * Client-safe barrel for annual-close — TYPE-only re-exports.
 *
 * Mirror precedent EXACT (initial-balance/presentation/index.ts pattern):
 *   - server.ts → server-only re-exports (factory + Zod schemas)
 *   - index.ts  → client-safe TYPE-only re-exports (consumed by UI components
 *                 + API DTO callers that don't need the service itself)
 *
 * NO React hooks here — annual-close presentation is currently pure
 * data/service. Phase 7 may add UI-shaped types (year accordion DTO) — those
 * land here when they materialize.
 */
export type {
  AnnualCloseResult,
  AnnualCloseSummary,
} from "../application/annual-close.service";
