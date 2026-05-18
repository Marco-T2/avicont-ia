import { NotFoundError } from "@/features/shared/errors";
import {
  Lot,
  type CreateLotInput,
  type CloseLotInput,
  type UpdateLotInput,
} from "../domain/lot.entity";
import type { LotRepository } from "../domain/lot.repository";
import { LotNameDuplicate } from "../domain/errors/lot-errors";
import type { LotSummary } from "../domain/value-objects/lot-summary";

export type CreateLotServiceInput = Omit<CreateLotInput, "organizationId">;
export type UpdateLotServiceInput = UpdateLotInput;

export class LotService {
  constructor(private readonly repo: LotRepository) {}

  async list(organizationId: string): Promise<Lot[]> {
    return this.repo.findAll(organizationId);
  }

  async listByFarm(organizationId: string, farmId: string): Promise<Lot[]> {
    return this.repo.findByFarm(organizationId, farmId);
  }

  async getById(organizationId: string, id: string): Promise<Lot> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Lote");
    return found;
  }

  async create(
    organizationId: string,
    input: CreateLotServiceInput,
  ): Promise<Lot> {
    const lot = Lot.create({ ...input, organizationId });
    await this.repo.save(lot);
    return lot;
  }

  async close(
    organizationId: string,
    id: string,
    input: CloseLotInput,
  ): Promise<Lot> {
    const lot = await this.getById(organizationId, id);
    const closed = lot.close(input.endDate);
    await this.repo.update(closed);
    return closed;
  }

  /**
   * Updates `name` and/or `barnNumber` of a Lot. Other fields are
   * immutable (INV-04). Throws NotFoundError if missing,
   * LotCannotUpdateInactive (from entity) if not ACTIVE,
   * LotNameDuplicate if the new name collides with another lot in
   * the same org. Idempotent when the new name equals the current
   * name (self-collision excluded). Spec REQ-100.
   *
   * Marco decision: uniqueness check application-side via findAll
   * + filter (no Prisma @@unique constraint — escala granjero OK,
   * evita migration extra).
   */
  async update(
    organizationId: string,
    id: string,
    input: UpdateLotServiceInput,
  ): Promise<Lot> {
    const lot = await this.getById(organizationId, id);

    if (input.name !== undefined && input.name !== lot.name) {
      const siblings = await this.repo.findAll(organizationId);
      const conflict = siblings.find(
        (l) => l.id !== id && l.name === input.name,
      );
      if (conflict) throw new LotNameDuplicate(input.name);
    }

    const updated = lot.update(input); // throws LotCannotUpdateInactive if not ACTIVE
    await this.repo.update(updated);
    return updated;
  }

  async getSummary(
    organizationId: string,
    id: string,
  ): Promise<{ lot: Lot; summary: LotSummary }> {
    const found = await this.repo.findByIdWithRelations(organizationId, id);
    if (!found) throw new NotFoundError("Lote");
    const summary = found.lot.computeSummary(
      found.expenses,
      found.mortalityLogs,
    );
    return { lot: found.lot, summary };
  }

  /**
   * Returns counts of child records (Expense, MortalityLog) that
   * would be cascade-deleted along with this Lot. UI shows these
   * counts in the confirm dialog (spec REQ-102). Throws
   * NotFoundError if the lot does not exist.
   */
  async getDeletePreview(
    organizationId: string,
    id: string,
  ): Promise<{ expensesCount: number; mortalityCount: number }> {
    await this.getById(organizationId, id);
    const counts = await this.repo.findChildCounts(organizationId, id);
    return {
      expensesCount: counts.expenses,
      mortalityCount: counts.mortality,
    };
  }

  /**
   * Hard-deletes the Lot and all its child Expense + MortalityLog
   * records. The actual cascade tx is owned by the repo adapter
   * (design D-1, INV-06 atomicity). Throws NotFoundError if the
   * lot does not exist. Spec REQ-101.
   */
  async delete(organizationId: string, id: string): Promise<void> {
    await this.getById(organizationId, id);
    await this.repo.delete(organizationId, id);
  }
}
