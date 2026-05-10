import type { Farm } from "./farm.entity";

export interface FarmFilters {
  memberId?: string;
}

export interface FarmRepository {
  findAll(organizationId: string, filters?: FarmFilters): Promise<Farm[]>;
  findById(organizationId: string, id: string): Promise<Farm | null>;
  findByName(organizationId: string, name: string): Promise<Farm | null>;
  save(farm: Farm): Promise<void>;
  update(farm: Farm): Promise<void>;
  delete(organizationId: string, id: string): Promise<void>;
}
