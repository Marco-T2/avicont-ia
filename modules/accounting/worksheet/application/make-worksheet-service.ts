import type { WorksheetService } from "./worksheet.service";

/**
 * Factory placeholder for WorksheetService.
 *
 * Stub: throws at call time. Will be wired to
 * `presentation/composition-root.ts` at C3 GREEN, where PrismaWorksheetRepo
 * is injected into WorksheetService via deps-object ctor.
 *
 * Satisfies α33 (export) and α36 (WorksheetService reference) from the
 * C1 sentinel while keeping the application layer free of infrastructure concretions.
 */
export function makeWorksheetService(): WorksheetService {
  throw new Error(
    "makeWorksheetService: not yet wired — composition-root.ts wires at C3 GREEN",
  );
}
