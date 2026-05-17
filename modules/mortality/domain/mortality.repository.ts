import type { Mortality } from "./mortality.entity";

export interface MortalityRepository {
  findByLot(organizationId: string, lotId: string): Promise<Mortality[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<Mortality | null>;
  countByLot(organizationId: string, lotId: string): Promise<number>;
  save(mortality: Mortality): Promise<void>;
  update(mortality: Mortality): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
}
