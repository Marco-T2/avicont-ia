import type { Mortality } from "./mortality.entity";

export interface MortalityRepository {
  findByLot(organizationId: string, lotId: string): Promise<Mortality[]>;
  countByLot(organizationId: string, lotId: string): Promise<number>;
  save(mortality: Mortality): Promise<void>;
}
