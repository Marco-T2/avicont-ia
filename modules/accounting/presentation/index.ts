// Client-safe barrel for modules/accounting/presentation.
//
// POC #4 OLEADA 8 (last): re-exports `eq` + `sumDecimals` from shared/domain
// so client UI components (`components/accounting/journal-entry-*.tsx`) can
// route balance checks through the canonical Decimal-based helpers via a
// single hex barrel — eliminating Math.round(*100) === Math.round(*100)
// float-cents comparison at the UI layer.
//
// Bundle-weight note (acknowledged in design §8 risks): re-exporting from
// `../shared/domain/money.utils` transitively drags `Prisma` / `decimal.js`
// into the client chunk. Per R1-permissible-value-type-exception
// (money.utils.ts JSDoc L1-24) this is the canonical money-math runtime
// surface for `modules/accounting/*` and is accepted (~10KB gz). Different
// from the FS barrel's `node:module` concern (that involved
// `instanceof Prisma.Decimal` over already-serialized statements).
//
// Divergence from design §3 (which mis-targeted `server.ts` as the append
// site): `server.ts` is `"server-only"` and unreachable from `"use client"`
// components. α-ui-balance-01 regex matches end-of-path at `presentation"`
// (no `/server`). This `index.ts` is the ONLY consistent target.
//
// Sister: `modules/accounting/financial-statements/presentation/index.ts`.
export { eq, sumDecimals } from "../shared/domain/money.utils";

// ── Dashboard DTO (accounting-dashboard-pro) ──
// Client-safe types: pure interfaces, no runtime imports. Surfaced here
// (not in `./server`) so client components in `components/accounting/`
// can `import type` without dragging `"server-only"` into the bundle.
// Re-export from application/dto — DTO is owned by the application
// layer (the orchestrator service produces it) and lives there to keep
// R2 (`application/ must only depend on domain/`) clean of presentation/*
// imports.
export type * from "../application/dto/dashboard.types";
