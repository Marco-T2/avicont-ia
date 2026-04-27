export interface LotSnapshot {
  id: string;
  initialCount: number;
}

export interface LotInquiryPort {
  findById(organizationId: string, lotId: string): Promise<LotSnapshot | null>;
}
