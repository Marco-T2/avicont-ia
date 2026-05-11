import {
  OperationalDocType,
  type CreateOperationalDocTypeInput,
} from "../domain/operational-doc-type.entity";
import type { OperationalDocTypesRepository } from "../domain/operational-doc-type.repository";
import type { OperationalDocDirection } from "../domain/value-objects/operational-doc-direction";
import {
  OperationalDocTypeNotFoundError,
  OperationalDocTypeInUseError,
} from "../domain/errors/operational-doc-type-errors";

export type CreateOperationalDocTypeServiceInput = Omit<
  CreateOperationalDocTypeInput,
  "organizationId"
>;

export type UpdateOperationalDocTypeServiceInput = {
  name?: string;
  direction?: OperationalDocDirection;
};

export class OperationalDocTypeService {
  constructor(private readonly repo: OperationalDocTypesRepository) {}

  async list(
    organizationId: string,
    filters?: { isActive?: boolean; direction?: OperationalDocDirection },
  ): Promise<OperationalDocType[]> {
    const effectiveFilters: { isActive?: boolean; direction?: OperationalDocDirection } =
      filters?.isActive !== undefined ? filters : { ...filters, isActive: true };
    return this.repo.findAll(organizationId, effectiveFilters);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new OperationalDocTypeNotFoundError(id);
    return found;
  }

  async create(
    organizationId: string,
    input: CreateOperationalDocTypeServiceInput,
  ): Promise<OperationalDocType> {
    const docType = OperationalDocType.create({ ...input, organizationId });
    await this.repo.save(docType);
    return docType;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateOperationalDocTypeServiceInput,
  ): Promise<OperationalDocType> {
    const docType = await this.getById(organizationId, id);
    if (input.name !== undefined) docType.rename(input.name);
    if (input.direction !== undefined) docType.changeDirection(input.direction);
    await this.repo.save(docType);
    return docType;
  }

  async deactivate(
    organizationId: string,
    id: string,
  ): Promise<OperationalDocType> {
    const docType = await this.getById(organizationId, id);
    const activeCount = await this.repo.countActivePayments(organizationId, id);
    if (activeCount > 0) {
      throw new OperationalDocTypeInUseError(activeCount);
    }
    docType.deactivate();
    await this.repo.save(docType);
    return docType;
  }
}
