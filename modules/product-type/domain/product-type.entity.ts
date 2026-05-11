export interface ProductTypeProps {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductTypeInput {
  organizationId: string;
  code: string;
  name: string;
  sortOrder?: number;
}

export interface ProductTypeSnapshot {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductType {
  private constructor(private readonly props: ProductTypeProps) {}

  static create(input: CreateProductTypeInput): ProductType {
    const now = new Date();
    return new ProductType({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
      isActive: true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: ProductTypeProps): ProductType {
    return new ProductType(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get isActive(): boolean { return this.props.isActive; }
  get sortOrder(): number { return this.props.sortOrder; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  rename(name: string): void {
    (this.props as { name: string }).name = name;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  changeCode(code: string): void {
    (this.props as { code: string }).code = code;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  changeSortOrder(sortOrder: number): void {
    (this.props as { sortOrder: number }).sortOrder = sortOrder;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  deactivate(): void {
    (this.props as { isActive: boolean }).isActive = false;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  activate(): void {
    (this.props as { isActive: boolean }).isActive = true;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  toSnapshot(): ProductTypeSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      code: this.props.code,
      name: this.props.name,
      isActive: this.props.isActive,
      sortOrder: this.props.sortOrder,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
