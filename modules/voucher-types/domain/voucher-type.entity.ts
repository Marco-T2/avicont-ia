import { VoucherTypeCode } from "./value-objects/voucher-type-code";
import { VoucherTypePrefix } from "./value-objects/voucher-type-prefix";

export interface VoucherTypeProps {
  id: string;
  organizationId: string;
  code: VoucherTypeCode;
  prefix: VoucherTypePrefix;
  name: string;
  description: string | null;
  isActive: boolean;
  isAdjustment: boolean;
  journalEntryCount?: number;
}

export interface CreateVoucherTypeInput {
  organizationId: string;
  code: string;
  prefix: string;
  name: string;
  description?: string | null;
  isAdjustment?: boolean;
}

export interface VoucherTypeSnapshot {
  id: string;
  organizationId: string;
  code: string;
  prefix: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isAdjustment: boolean;
  _count?: { journalEntries: number };
}

export class VoucherType {
  private constructor(private readonly props: VoucherTypeProps) {}

  static create(input: CreateVoucherTypeInput): VoucherType {
    return new VoucherType({
      id: crypto.randomUUID(),
      organizationId: input.organizationId,
      code: VoucherTypeCode.of(input.code),
      prefix: VoucherTypePrefix.of(input.prefix),
      name: input.name,
      description: input.description ?? null,
      isActive: true,
      isAdjustment: input.isAdjustment ?? false,
    });
  }

  static fromPersistence(props: VoucherTypeProps): VoucherType {
    return new VoucherType(props);
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code.value; }
  get prefix(): string { return this.props.prefix.value; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get isActive(): boolean { return this.props.isActive; }
  get isAdjustment(): boolean { return this.props.isAdjustment; }
  get journalEntryCount(): number | undefined { return this.props.journalEntryCount; }

  rename(name: string): VoucherType {
    return new VoucherType({ ...this.props, name });
  }

  changePrefix(prefix: string): VoucherType {
    return new VoucherType({
      ...this.props,
      prefix: VoucherTypePrefix.of(prefix),
    });
  }

  updateDescription(description: string | null | undefined): VoucherType {
    if (description === undefined) return this;
    return new VoucherType({ ...this.props, description });
  }

  deactivate(): VoucherType {
    return new VoucherType({ ...this.props, isActive: false });
  }

  activate(): VoucherType {
    return new VoucherType({ ...this.props, isActive: true });
  }

  toSnapshot(): VoucherTypeSnapshot {
    const snap: VoucherTypeSnapshot = {
      id: this.props.id,
      organizationId: this.props.organizationId,
      code: this.props.code.value,
      prefix: this.props.prefix.value,
      name: this.props.name,
      description: this.props.description,
      isActive: this.props.isActive,
      isAdjustment: this.props.isAdjustment,
    };
    if (this.props.journalEntryCount !== undefined) {
      snap._count = { journalEntries: this.props.journalEntryCount };
    }
    return snap;
  }
}
