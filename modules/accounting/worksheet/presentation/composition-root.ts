import { PrismaWorksheetRepo } from "../infrastructure/prisma-worksheet.repo";
import { WorksheetService } from "../application/worksheet.service";

/**
 * Zero-arg factory that wires infrastructure adapters into the application service.
 *
 * Per design §4: composition root = the ONLY place that instantiates infrastructure
 * concretions. The service receives `{ repo: WorksheetQueryPort }` deps-object,
 * not a concretion — port interface is the boundary (WS-D3).
 *
 * Called by server.ts (server-only context) and API routes via makeWorksheetService().
 * Never called from client components — those import TYPE-only from presentation/index.ts.
 *
 * 1-adapter wiring (TB mirror, NOT ES 2-adapter shape):
 * PrismaWorksheetRepo → WorksheetService. No secondary port.
 *
 * Sister precedent: modules/accounting/trial-balance/presentation/composition-root.ts
 * (zero-arg factory pattern).
 */
export function makeWorksheetService(): WorksheetService {
  const repo = new PrismaWorksheetRepo();
  return new WorksheetService({ repo });
}
