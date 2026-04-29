import { NotFoundError } from "@/features/shared/errors";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import {
  Sale,
  type CreateSaleDraftInput,
} from "../domain/sale.entity";
import type {
  SaleFilters,
  SaleRepository,
} from "../domain/ports/sale.repository";
import {
  computeTrimPlan,
  type TrimPreviewItem,
} from "../domain/compute-trim-plan";
import {
  SaleContactInactive,
  SaleContactNotClient,
} from "./errors/sale-orchestration-errors";
import type { SaleUnitOfWork } from "./sale-unit-of-work";

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
}

export type CreateDraftInput = Omit<
  CreateSaleDraftInput,
  "organizationId" | "createdById"
>;

export interface CreateDraftResult {
  sale: Sale;
  correlationId: string;
}

export class SaleService {
  constructor(
    private readonly repo: SaleRepository,
    private readonly receivables?: ReceivableRepository,
    private readonly contacts?: ContactRepository,
    private readonly uow?: SaleUnitOfWork,
  ) {}

  async list(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<Sale[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Sale> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Venta");
    return found;
  }

  /**
   * Simulates the LIFO trim plan for an `editPosted` operation that would
   * lower the sale's total to `newTotal`. Read-only — no DB writes. Mirrors
   * legacy `sale.service.ts:525-560` (fidelidad regla #1).
   */
  async getEditPreview(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<EditPreview> {
    if (!this.receivables) {
      throw new Error(
        "SaleService.getEditPreview requires ReceivableRepository — inject in constructor",
      );
    }

    const sale = await this.getById(organizationId, saleId);
    if (!sale.receivableId) {
      return { trimPreview: [] };
    }

    const receivable = await this.receivables.findById(
      organizationId,
      sale.receivableId,
    );
    const rawPaid = receivable ? Number(receivable.paid.value) : 0;

    if (newTotal >= rawPaid) {
      return { trimPreview: [] };
    }

    const allocations = await this.receivables.findAllocationsForReceivable(
      organizationId,
      sale.receivableId,
    );

    return { trimPreview: computeTrimPlan(allocations, rawPaid - newTotal) };
  }

  /**
   * Creates a sale in DRAFT status. Mirrors legacy `sale.service.ts:212-247`
   * (fidelidad regla #1) — validates contact existence, active status, and
   * `CLIENTE` type before delegating to `Sale.createDraft` (which enforces
   * detail-line invariants intrinsically). Persists inside the UoW so the
   * audit context is set on the Postgres session for trigger-driven audit.
   */
  async createDraft(
    organizationId: string,
    input: CreateDraftInput,
    userId: string,
  ): Promise<CreateDraftResult> {
    if (!this.contacts) {
      throw new Error("SaleService.createDraft requires ContactRepository — inject in constructor");
    }
    if (!this.uow) {
      throw new Error("SaleService.createDraft requires SaleUnitOfWork — inject in constructor");
    }

    const contact = await this.contacts.findById(organizationId, input.contactId);
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new SaleContactInactive(input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new SaleContactNotClient(contact.type);
    }

    const sale = Sale.createDraft({
      ...input,
      organizationId,
      createdById: userId,
    });

    const { result, correlationId } = await this.uow.run(
      { userId, organizationId },
      (scope) => scope.sales.saveTx(sale),
    );

    return { sale: result, correlationId };
  }
}
