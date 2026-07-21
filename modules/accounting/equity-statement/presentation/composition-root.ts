import { PrismaEquityStatementRepo } from "../infrastructure/prisma-equity-statement.repo";
import { PrismaIncomeStatementSourceAdapter } from "../infrastructure/prisma-income-statement-source.adapter";
import { EquityStatementExporterAdapter } from "../infrastructure/adapters/equity-statement-exporter.adapter";
import type { EquityStatementService } from "../application/equity-statement.service";
import { makeEquityStatementService as buildEquityStatementService } from "../application/make-equity-statement-service";

/**
 * Zero-arg factory that wires infrastructure adapters into the application service.
 *
 * AXIS-DISTINCT vs TB sister: wires 2 adapters instead of 1.
 *   repo       → PrismaEquityStatementRepo   (implements EquityStatementQueryPort, 6 methods)
 *   incomeSource → PrismaIncomeStatementSourceAdapter (implements IncomeStatementSourcePort, 2 methods)
 *
 * Per design: composition root = the ONLY place that instantiates infrastructure
 * concretions. The service receives `{ repo, incomeSource }` deps-object — port
 * interfaces are the boundary. No concretion reference escapes this module.
 *
 * Called by server.ts (server-only context) and API routes via makeEquityStatementService().
 * Never called from client components — those import TYPE-only from presentation/index.ts.
 *
 * Sister precedent: modules/accounting/trial-balance/presentation/composition-root.ts
 * (single-adapter pattern, GREEN 2a50c2ca). This file extends with 2-adapter shape.
 */
export function makeEquityStatementService(): EquityStatementService {
  const repo = new PrismaEquityStatementRepo();
  const incomeSource = new PrismaIncomeStatementSourceAdapter();
  // [EXPORT] cluster paydown — exporter port wired here (was a raw exporter
  // re-export from presentation/server.ts, R4 violation).
  const exporter = new EquityStatementExporterAdapter();
  // [REVERSE-WIRING] paydown: the injectable factory lives in application/;
  // this zero-arg entry only instantiates concretions and passes them down.
  return buildEquityStatementService({ repo, incomeSource, exporter });
}
