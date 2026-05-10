export interface LotSnapshot {
  id: string;
  initialCount: number;
}

export interface LotExistencePort {
  findById(organizationId: string, lotId: string): Promise<LotSnapshot | null>;
}
