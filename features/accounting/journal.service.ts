import "server-only";
import type { JournalsService } from "@/modules/accounting/presentation/server";
import type { WithCorrelation } from "@/features/shared/audit-tx";
import type { JournalEntryStatus } from "@/generated/prisma/client";
import type { ExportVoucherOpts } from "@/modules/accounting/infrastructure/exporters/voucher-pdf.types";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  CorrelationAuditFilters,
  CorrelationAuditResult,
} from "./journal.types";

/**
 * Thin delegating SHIM over the hex `JournalsService`.
 *
 * POC #7 OLEADA 6 sub-POC 7/8 — C5 Option B2a. The journal/ledger core was
 * folded into the hex `modules/accounting/` across C0–C4 (additive). C5 B2a
 * converts this file from the full legacy implementation into a thin shim:
 * the class name + public method signatures are PRESERVED so the
 * `@/features/accounting/server` barrel and the ~10 `app/` runtime consumers
 * stay byte-stable (their repoint to the hex factory is sub-POC 8 scope).
 * Every method body delegates to the hex `JournalsService` — ZERO duplicated
 * implementation logic lives here anymore.
 *
 * ── Lazy hex resolution (cycle break) ──
 * `makeJournalsService` lives in the hex `composition-root`, which wires the
 * full accounting adapter graph. A STATIC import of it here would make the
 * legacy `@/features/accounting/server` barrel transitively pull the entire
 * hex wiring graph at module-init — and that graph has a load-order cycle
 * with `modules/organizations` (`LegacyAccountSeedAdapter` → `makeAccountsService`).
 * Resolving the factory through a lazy `import()` cached in a module-level
 * promise removes the static module-graph edge entirely: the hex barrel is
 * only loaded on the FIRST method call, by which point every module is fully
 * initialized. All shim methods are already `async`, so the extra `await` is
 * free.
 *
 * ── Return-shape reconciliation ──
 * The hex write use cases return the `Journal` AGGREGATE (createEntry) or
 * `{ journal: Journal; correlationId }` (createAndPost / updateEntry /
 * transitionStatus); the legacy public surface returns the
 * `JournalEntryWithLines` DTO (and `WithCorrelation<…>` for the writes). A
 * pure `Journal → JournalEntryWithLines` mapper is IMPOSSIBLE — the aggregate
 * carries no joined `account` / `contact` / `voucherType` relations. The
 * behavior-preserving equivalent: persist via the hex, then re-hydrate the
 * full DTO via `hex.getById()` (the same `journalIncludeLines` Prisma include
 * the legacy repo used). Result is a byte-identical DB write + a
 * byte-identical DTO — at the cost of one extra read round-trip per write.
 * The 5 read/utility methods need no reconciliation: the hex returns the
 * identical DTO shapes.
 */
let hexFactoryPromise: Promise<() => JournalsService> | null = null;

async function resolveHex(): Promise<JournalsService> {
  if (!hexFactoryPromise) {
    hexFactoryPromise = import("@/modules/accounting/presentation/server").then(
      (m) => m.makeJournalsService,
    );
  }
  return (await hexFactoryPromise)();
}

export class JournalService {
  // ── Reads — hex returns identical DTO shapes, pure pass-through ──

  async list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return (await resolveHex()).list(organizationId, filters);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines> {
    return (await resolveHex()).getById(organizationId, id);
  }

  async getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null> {
    return (await resolveHex()).getLastReferenceNumber(
      organizationId,
      voucherTypeId,
    );
  }

  async getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number> {
    return (await resolveHex()).getNextNumber(
      organizationId,
      voucherTypeId,
      periodId,
    );
  }

  async getCorrelationAudit(
    organizationId: string,
    filters: CorrelationAuditFilters,
  ): Promise<CorrelationAuditResult> {
    return (await resolveHex()).getCorrelationAudit(organizationId, filters);
  }

  async exportVoucherPdf(
    organizationId: string,
    entryId: string,
    opts: ExportVoucherOpts,
  ): Promise<Buffer> {
    return (await resolveHex()).exportVoucherPdf(organizationId, entryId, opts);
  }

  // ── Writes — re-hydrate the legacy DTO via getById after the hex persist ──

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryWithLines> {
    const hex = await resolveHex();
    const journal = await hex.createEntry(organizationId, input, {
      userId: input.createdById,
    });
    return hex.getById(organizationId, journal.id);
  }

  async createAndPost(
    organizationId: string,
    input: CreateJournalEntryInput,
    context: { userId: string; role: string },
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const hex = await resolveHex();
    const { journal, correlationId } = await hex.createAndPost(
      organizationId,
      input,
      context,
    );
    const dto = await hex.getById(organizationId, journal.id);
    return { ...dto, correlationId };
  }

  async updateEntry(
    organizationId: string,
    id: string,
    input: UpdateJournalEntryInput,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const hex = await resolveHex();
    const { journal, correlationId } = await hex.updateEntry(
      organizationId,
      id,
      input,
      { userId: input.updatedById, role, justification },
    );
    const dto = await hex.getById(organizationId, journal.id);
    return { ...dto, correlationId };
  }

  async transitionStatus(
    organizationId: string,
    id: string,
    targetStatus: JournalEntryStatus,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const hex = await resolveHex();
    const { journal, correlationId } = await hex.transitionStatus(
      organizationId,
      id,
      targetStatus as "POSTED" | "LOCKED" | "VOIDED",
      { userId, role: role ?? "", justification },
    );
    const dto = await hex.getById(organizationId, journal.id);
    return { ...dto, correlationId };
  }
}
