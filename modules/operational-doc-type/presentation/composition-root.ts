import "server-only";
import { OperationalDocTypeService } from "../application/operational-doc-type.service";
import { PrismaOperationalDocTypesRepository } from "../infrastructure/prisma-operational-doc-types.repository";

export { PrismaOperationalDocTypesRepository };

export function makeOperationalDocTypeService(): OperationalDocTypeService {
  return new OperationalDocTypeService(
    new PrismaOperationalDocTypesRepository(),
  );
}
