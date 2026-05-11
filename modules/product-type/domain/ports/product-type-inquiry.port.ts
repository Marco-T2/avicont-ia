export type ProductTypeSnapshot = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface ProductTypesInquiryPort {
  list(
    organizationId: string,
    filters?: { isActive?: boolean },
  ): Promise<ProductTypeSnapshot[]>;
  findById(
    organizationId: string,
    id: string,
  ): Promise<ProductTypeSnapshot | null>;
}
